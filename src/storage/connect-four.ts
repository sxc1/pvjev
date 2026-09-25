import type { KeyValueStorage } from '../contracts/application'
import type { ConnectFourBoardOutcome, ConnectFourMatch, ConnectFourPosition, ConnectFourWinningLine } from '../contracts/connect-four'
import type { ConnectFourMatchEnvelope } from '../contracts/persistence'
import { CONNECT_FOUR_MATCH_STORAGE_KEY, CONNECT_FOUR_SCHEMA_VERSION } from '../contracts/persistence'
import { applyMove, initialPosition, isLegalMove } from '../games/connect-four/rules'
import { createStorageAdapter, type DecodeResult } from './index'

const invalid = (reason: string): DecodeResult<ConnectFourMatchEnvelope> => ({ status: 'invalid', reason })
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const player = (value: unknown): value is 'one' | 'two' => value === 'one' || value === 'two'
const color = (value: unknown): value is 'red' | 'yellow' => value === 'red' || value === 'yellow'
const column = (value: unknown): boolean => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 6
const cell = (value: unknown): boolean => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 41
const line = (value: unknown): boolean => Array.isArray(value) && value.length >= 4 && value.length <= 7 && value.every(cell)
const lines = (value: unknown): boolean => Array.isArray(value) && value.length <= 4 && value.every(line)

function boardOutcome(value: unknown): boolean {
  if (!object(value)) return false
  if (value.kind === 'ongoing' || value.kind === 'draw') return true
  return value.kind === 'win' && player(value.winner) && lines(value.winningLines) && (value.winningLines as unknown[]).length >= 1
}

function matchOutcome(value: unknown): boolean {
  if (boardOutcome(value)) return true
  return object(value) && value.kind === 'resignation' && player(value.resigningPlayer) &&
    player(value.winner) && Number.isInteger(value.ply) && Number(value.ply) >= 0 && Number(value.ply) <= 42
}

function position(value: unknown): boolean {
  return object(value) && Array.isArray(value.board) && value.board.length === 42 &&
    value.board.every((entry: unknown) => entry === 0 || entry === 1 || entry === 2) &&
    Array.isArray(value.columns) && value.columns.length <= 42 && value.columns.every(column) &&
    player(value.nextPlayer) && boardOutcome(value.outcome) && lines(value.winningLines)
}

function record(value: unknown): boolean {
  if (!object(value) || !Number.isInteger(value.ply) || Number(value.ply) < 1 || Number(value.ply) > 42 ||
    !column(value.column) || !cell(value.landingCell) || !player(value.player) || !color(value.color) ||
    'analysis' in value) return false
  if (value.actor === 'human') return value.provenance === 'human' && !('diagnostic' in value)
  if (value.actor !== 'cpu') return false
  if (value.provenance === 'rng') return !('diagnostic' in value)
  return value.provenance === 'rng-fallback' && typeof value.diagnostic === 'string' && value.diagnostic.length > 0
}

function normalizeLines(value: readonly ConnectFourWinningLine[]): string[] {
  return value.map(line => [...line].sort((a, b) => a - b).join(',')).sort()
}

function sameLines(left: readonly ConnectFourWinningLine[], right: readonly ConnectFourWinningLine[]): boolean {
  const a = normalizeLines(left), b = normalizeLines(right)
  return a.length === b.length && a.every((entry, index) => entry === b[index])
}

function sameBoardOutcome(left: ConnectFourBoardOutcome, right: ConnectFourBoardOutcome): boolean {
  if (left.kind !== right.kind) return false
  return left.kind !== 'win' || right.kind !== 'win' ||
    (left.winner === right.winner && sameLines(left.winningLines, right.winningLines))
}

function samePosition(left: ConnectFourPosition, right: ConnectFourPosition): boolean {
  return left.nextPlayer === right.nextPlayer &&
    left.board.every((entry, index) => entry === right.board[index]) &&
    left.columns.length === right.columns.length && left.columns.every((entry, index) => entry === right.columns[index]) &&
    sameLines(left.winningLines, right.winningLines) && sameBoardOutcome(left.outcome, right.outcome)
}

/** Validate the bounded shape, then replay every placement before trusting cached state. */
export function decodeConnectFourMatchEnvelope(value: unknown): DecodeResult<ConnectFourMatchEnvelope> {
  if (!object(value)) return invalid('Saved Connect Four match is not an object.')
  if (value.schemaVersion !== CONNECT_FOUR_SCHEMA_VERSION) return invalid('Saved Connect Four match has an unsupported schema version.')
  const match = value.match
  if (!object(match) || match.gameId !== 'connect-four' || typeof match.id !== 'string' ||
    match.id.trim().length === 0 || !object(match.setup) || !color(match.setup.humanColor) ||
    (match.setup.humanOrder !== 'first' && match.setup.humanOrder !== 'second') ||
    !Array.isArray(match.moves) || match.moves.length > 42 || !match.moves.every(record) ||
    !position(match.position) || !matchOutcome(match.outcome)) return invalid('Saved Connect Four match has an invalid shape.')
  if (!object(value.recovery) || !Number.isInteger(value.recovery.consecutiveInvalid) ||
    Number(value.recovery.consecutiveInvalid) < 0 || Number(value.recovery.consecutiveInvalid) > 2) {
    return invalid('Saved Connect Four match has invalid recovery metadata.')
  }

  const typed = value as unknown as ConnectFourMatchEnvelope
  let replay = initialPosition()
  const humanPlayer = typed.match.setup.humanOrder === 'first' ? 'one' : 'two'
  for (const [index, move] of typed.match.moves.entries()) {
    const expectedPlayer = index % 2 === 0 ? 'one' : 'two'
    const expectedColor = expectedPlayer === humanPlayer
      ? typed.match.setup.humanColor
      : typed.match.setup.humanColor === 'red' ? 'yellow' : 'red'
    const expectedActor = expectedPlayer === humanPlayer ? 'human' : 'cpu'
    if (move.ply !== index + 1 || move.player !== expectedPlayer || move.color !== expectedColor || move.actor !== expectedActor) {
      return invalid('Saved Connect Four move identity does not match setup and ply.')
    }
    if (!isLegalMove(replay, move.column)) return invalid('Saved Connect Four moves contain an illegal continuation.')
    const next = applyMove(replay, move.column)
    const landing = next.board.findIndex((entry, cellIndex) => entry !== replay.board[cellIndex])
    if (move.landingCell !== landing) return invalid('Saved Connect Four landing cell does not match gravity.')
    replay = next
  }

  const savedMatch = typed.match as ConnectFourMatch
  if (!samePosition(savedMatch.position, replay)) return invalid('Saved Connect Four live position does not match moves.')
  if (savedMatch.outcome.kind === 'resignation') {
    if (replay.outcome.kind !== 'ongoing' || savedMatch.moves.length === 0 ||
      savedMatch.outcome.ply !== savedMatch.moves.length ||
      savedMatch.outcome.resigningPlayer !== humanPlayer || savedMatch.outcome.winner === humanPlayer) {
      return invalid('Saved Connect Four resignation is invalid.')
    }
  } else if (!sameBoardOutcome(savedMatch.outcome, replay.outcome)) {
    return invalid('Saved Connect Four match outcome does not match moves.')
  }
  const cpuTurn = savedMatch.outcome.kind === 'ongoing' && replay.nextPlayer !== humanPlayer
  if (!cpuTurn && typed.recovery.consecutiveInvalid !== 0) {
    return invalid('Saved Connect Four recovery count requires a CPU turn.')
  }
  return { status: 'valid', value: typed }
}

export function createConnectFourStorageAdapter(acquire: () => KeyValueStorage) {
  return createStorageAdapter(acquire, { matchKey: CONNECT_FOUR_MATCH_STORAGE_KEY, decodeMatch: decodeConnectFourMatchEnvelope })
}
