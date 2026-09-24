import { describe, expect, it } from 'vitest'
import type { KeyValueStorage } from '../../src/contracts/application'
import { MATCH_STORAGE_KEY, SETTINGS_STORAGE_KEY } from '../../src/contracts/persistence'
import { createStorageAdapter, decodeReplayMatchEnvelope } from '../../src/storage'
import { validSaves, validSettings } from '../fixtures/v05'

function clone<T>(value: T): T { return structuredClone(value) }

function store(raw?: string) {
  const values = new Map<string, string>()
  if (raw !== undefined) values.set(MATCH_STORAGE_KEY, raw)
  const storage: KeyValueStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value) },
    removeItem: key => { values.delete(key) },
  }
  return { values, adapter: createStorageAdapter(() => storage) }
}

describe('T6 replay restore', () => {
  it.each(Object.entries(validSaves))('round trips %s with authoritative history', (_name, save) => {
    const { adapter } = store()
    expect(adapter.writeMatch(save)).toEqual({ status: 'saved' })
    expect(adapter.readMatch(decodeReplayMatchEnvelope)).toEqual({ status: 'valid', value: save })
  })

  it('keeps settings independent from an invalid match and leaves the original save untouched', () => {
    const corrupted = clone(validSaves.humanTurn)
    corrupted.match.position.board[0] = 'O'
    const raw = JSON.stringify(corrupted)
    const { values, adapter } = store(raw)
    expect(adapter.writeSettings(validSettings)).toEqual({ status: 'saved' })
    expect(adapter.readMatch(decodeReplayMatchEnvelope).status).toBe('invalid')
    expect(adapter.readSettings()).toEqual({ status: 'valid', value: validSettings })
    expect(values.get(MATCH_STORAGE_KEY)).toBe(raw)
    expect(values.get(SETTINGS_STORAGE_KEY)).toBe(JSON.stringify(validSettings))
  })

  it.each([
    ['wrong ply', (save: any) => { save.match.moves[1].ply = 3 }],
    ['wrong symbol', (save: any) => { save.match.moves[1].symbol = 'X' }],
    ['wrong actor', (save: any) => { save.match.moves[1].actor = 'human' }],
    ['duplicate cell', (save: any) => { save.match.moves[1].cell = 0 }],
    ['forged board', (save: any) => { save.match.position.board[0] = 'O' }],
    ['forged next side', (save: any) => { save.match.position.nextSymbol = 'O' }],
    ['forged cached outcome', (save: any) => { save.match.position.outcome = { kind: 'draw' } }],
    ['forged match outcome', (save: any) => { save.match.outcome = { kind: 'draw' } }],
    ['invalid retry count on human turn', (save: any) => { save.recovery.consecutiveInvalid = 1 }],
  ])('rejects %s', (_name, corrupt) => {
    const save: any = clone(validSaves.humanTurn)
    corrupt(save)
    expect(decodeReplayMatchEnvelope(save).status).toBe('invalid')
  })

  it('rejects moves after a terminal win', () => {
    const save: any = clone(validSaves.win)
    save.match.moves.push({ ply: 6, symbol: 'O', cell: 5, actor: 'cpu', provenance: 'rng' })
    expect(decodeReplayMatchEnvelope(save).status).toBe('invalid')
  })

  it.each([
    ['resigning on a terminal board', (save: any) => { save.match.position = clone(validSaves.win.match.position); save.match.moves = clone(validSaves.win.match.moves); save.match.outcome.ply = 5 }],
    ['wrong resigning side', (save: any) => { save.match.outcome.resigningSymbol = 'O' }],
    ['wrong resignation winner', (save: any) => { save.match.outcome.winner = 'X' }],
    ['wrong resignation ply', (save: any) => { save.match.outcome.ply = 0 }],
    ['retry count on resignation', (save: any) => { save.recovery.consecutiveInvalid = 1 }],
  ])('rejects %s', (_name, corrupt) => {
    const save: any = clone(validSaves.resignation)
    corrupt(save)
    expect(decodeReplayMatchEnvelope(save).status).toBe('invalid')
  })

  it('rejects a forged winning line and a retry count on a completed match', () => {
    const win: any = clone(validSaves.win)
    win.match.position.winningLines = [[0, 3, 6]]
    expect(decodeReplayMatchEnvelope(win).status).toBe('invalid')
    const draw: any = clone(validSaves.draw)
    draw.recovery.consecutiveInvalid = 2
    expect(decodeReplayMatchEnvelope(draw).status).toBe('invalid')
  })
})
