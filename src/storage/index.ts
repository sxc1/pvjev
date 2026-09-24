import type { KeyValueStorage } from '../contracts/application'
import type { MatchEnvelope, SettingsEnvelope, StorageReadResult, StorageWriteResult } from '../contracts/persistence'
import { MATCH_STORAGE_KEY, SCHEMA_VERSION, SETTINGS_STORAGE_KEY } from '../contracts/persistence'

export type DecodeResult<Value> =
  | { readonly status: 'valid'; readonly value: Value }
  | { readonly status: 'invalid'; readonly reason: string }

export type Decoder<Value> = (value: unknown) => DecodeResult<Value>

const invalid = (reason: string): DecodeResult<never> => ({ status: 'invalid', reason })
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const symbol = (value: unknown): value is 'X' | 'O' => value === 'X' || value === 'O'
const cell = (value: unknown): boolean => value === null || symbol(value)
const move = (value: unknown): boolean => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 8
const line = (value: unknown): boolean => Array.isArray(value) && value.length === 3 && value.every(move)
const lines = (value: unknown): boolean => Array.isArray(value) && value.every(line)

function boardOutcome(value: unknown): boolean {
  if (!object(value)) return false
  if (value.kind === 'ongoing' || value.kind === 'draw') return true
  return value.kind === 'win' && symbol(value.winner) && lines(value.winningLines)
}

function position(value: unknown): boolean {
  return object(value) && Array.isArray(value.board) && value.board.length === 9 &&
    value.board.every(cell) && symbol(value.nextSymbol) && boardOutcome(value.outcome) && lines(value.winningLines)
}

function record(value: unknown): boolean {
  if (!object(value) || !Number.isInteger(value.ply) || Number(value.ply) < 1 ||
    !symbol(value.symbol) || !move(value.cell) || 'analysis' in value) return false
  if (value.actor === 'human') return value.provenance === 'human' && !('diagnostic' in value)
  if (value.actor !== 'cpu') return false
  if (value.provenance === 'rng') return !('diagnostic' in value)
  return value.provenance === 'rng-fallback' && typeof value.diagnostic === 'string' &&
    value.diagnostic.length > 0
}

function matchOutcome(value: unknown): boolean {
  if (boardOutcome(value)) return true
  return object(value) && value.kind === 'resignation' && symbol(value.resigningSymbol) &&
    symbol(value.winner) && Number.isInteger(value.ply) && Number(value.ply) >= 0
}

/** Structural decoding only. T6 supplies replay validation before accepting a restored match. */
export function decodeMatchEnvelope(value: unknown): DecodeResult<MatchEnvelope> {
  if (!object(value)) return invalid('Saved match is not an object.')
  if (value.schemaVersion !== SCHEMA_VERSION) return invalid('Saved match has an unsupported schema version.')
  const match = value.match
  if (!object(match) || match.gameId !== 'tic-tac-toe' || typeof match.id !== 'string' ||
    match.id.length === 0 || !symbol(match.humanSymbol) || !Array.isArray(match.moves) ||
    match.moves.length > 9 || !match.moves.every(record) || !position(match.position) ||
    !matchOutcome(match.outcome)) return invalid('Saved match has an invalid shape.')
  if (!object(value.recovery) || !Number.isInteger(value.recovery.consecutiveInvalid) ||
    Number(value.recovery.consecutiveInvalid) < 0 || Number(value.recovery.consecutiveInvalid) > 2) {
    return invalid('Saved match has invalid recovery metadata.')
  }
  return { status: 'valid', value: value as unknown as MatchEnvelope }
}

export function decodeSettingsEnvelope(value: unknown): DecodeResult<SettingsEnvelope> {
  if (!object(value)) return invalid('Saved settings are not an object.')
  if (value.schemaVersion !== SCHEMA_VERSION) return invalid('Saved settings have an unsupported schema version.')
  if (!object(value.settings) || typeof value.settings.confirmMoves !== 'boolean') {
    return invalid('Saved settings have an invalid shape.')
  }
  return { status: 'valid', value: value as unknown as SettingsEnvelope }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export interface StorageAdapter {
  readMatch(decoder?: Decoder<MatchEnvelope>): StorageReadResult<MatchEnvelope>
  readSettings(): StorageReadResult<SettingsEnvelope>
  writeMatch(envelope: MatchEnvelope): StorageWriteResult
  writeSettings(envelope: SettingsEnvelope): StorageWriteResult
  removeMatch(): StorageWriteResult
  removeSettings(): StorageWriteResult
}

/** Acquisition is deferred to each operation because even accessing localStorage can throw. */
export function createStorageAdapter(acquire: () => KeyValueStorage): StorageAdapter {
  function read<Value>(key: string, decoder: Decoder<Value>): StorageReadResult<Value> {
    let raw: string | null
    try {
      raw = acquire().getItem(key)
    } catch (error) {
      return { status: 'unavailable', error: errorMessage(error) }
    }
    if (raw === null) return { status: 'missing' }
    let parsed: unknown
    try {
      parsed = JSON.parse(raw) as unknown
    } catch {
      return { status: 'invalid', reason: 'Saved data is not valid JSON.' }
    }
    return decoder(parsed)
  }

  function write(key: string, value: unknown): StorageWriteResult {
    try {
      acquire().setItem(key, JSON.stringify(value))
      return { status: 'saved' }
    } catch (error) {
      return { status: 'unavailable', error: errorMessage(error) }
    }
  }

  function remove(key: string): StorageWriteResult {
    try {
      acquire().removeItem(key)
      return { status: 'saved' }
    } catch (error) {
      return { status: 'unavailable', error: errorMessage(error) }
    }
  }

  return {
    readMatch: (decoder = decodeMatchEnvelope) => read(MATCH_STORAGE_KEY, decoder),
    readSettings: () => read(SETTINGS_STORAGE_KEY, decodeSettingsEnvelope),
    writeMatch: (envelope) => write(MATCH_STORAGE_KEY, envelope),
    writeSettings: (envelope) => write(SETTINGS_STORAGE_KEY, envelope),
    removeMatch: () => remove(MATCH_STORAGE_KEY),
    removeSettings: () => remove(SETTINGS_STORAGE_KEY),
  }
}

export { decodeReplayMatchEnvelope } from './replay'
