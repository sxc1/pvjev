import { describe, expect, it } from 'vitest'
import type { KeyValueStorage } from '../../src/contracts/application'
import { CONNECT_FOUR_MATCH_STORAGE_KEY, MATCH_STORAGE_KEY, SETTINGS_STORAGE_KEY } from '../../src/contracts/persistence'
import { createConnectFourStorageAdapter, createStorageAdapter, decodeConnectFourMatchEnvelope } from '../../src/storage'
import { yellowFirstSave } from '../fixtures/connect-four'
import { validSaves, validSettings } from '../fixtures/v05'

const literalWin = {
  schemaVersion: 1,
  match: {
    gameId: 'connect-four', id: 'literal-win', setup: { humanColor: 'red', humanOrder: 'first' },
    moves: [
      { ply: 1, column: 0, landingCell: 35, player: 'one', color: 'red', actor: 'human', provenance: 'human' },
      { ply: 2, column: 6, landingCell: 41, player: 'two', color: 'yellow', actor: 'cpu', provenance: 'rng' },
      { ply: 3, column: 1, landingCell: 36, player: 'one', color: 'red', actor: 'human', provenance: 'human' },
      { ply: 4, column: 6, landingCell: 34, player: 'two', color: 'yellow', actor: 'cpu', provenance: 'rng' },
      { ply: 5, column: 2, landingCell: 37, player: 'one', color: 'red', actor: 'human', provenance: 'human' },
      { ply: 6, column: 5, landingCell: 40, player: 'two', color: 'yellow', actor: 'cpu', provenance: 'rng' },
      { ply: 7, column: 3, landingCell: 38, player: 'one', color: 'red', actor: 'human', provenance: 'human' },
    ],
    position: {
      board: [
        0,0,0,0,0,0,0, 0,0,0,0,0,0,0, 0,0,0,0,0,0,0,
        0,0,0,0,0,0,0, 0,0,0,0,0,0,2, 1,1,1,1,0,2,2,
      ],
      columns: [0,6,1,6,2,5,3], nextPlayer: 'two',
      outcome: { kind: 'win', winner: 'one', winningLines: [[35,36,37,38]] },
      winningLines: [[35,36,37,38]],
    },
    outcome: { kind: 'win', winner: 'one', winningLines: [[35,36,37,38]] },
  },
  recovery: { consecutiveInvalid: 0 },
}

function clone<T>(value: T): T { return structuredClone(value) }

function storage() {
  const values = new Map<string, string>()
  const backend: KeyValueStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value) },
    removeItem: key => { values.delete(key) },
  }
  return { values, legacy: createStorageAdapter(() => backend), connectFour: createConnectFourStorageAdapter(() => backend) }
}

describe('C4 Connect Four storage and replay', () => {
  it('keeps the new match independent of legacy match and shared settings', () => {
    const { values, legacy, connectFour } = storage()
    expect(legacy.writeMatch(validSaves.humanTurn)).toEqual({ status: 'saved' })
    expect(legacy.writeSettings(validSettings)).toEqual({ status: 'saved' })
    expect(connectFour.writeMatch(yellowFirstSave)).toEqual({ status: 'saved' })
    expect(connectFour.readMatch()).toEqual({ status: 'valid', value: yellowFirstSave })
    expect(legacy.readMatch()).toEqual({ status: 'valid', value: validSaves.humanTurn })
    expect(values.has(CONNECT_FOUR_MATCH_STORAGE_KEY)).toBe(true)
    expect(values.has(MATCH_STORAGE_KEY)).toBe(true)
    expect(values.has(SETTINGS_STORAGE_KEY)).toBe(true)
    expect(connectFour.removeMatch()).toEqual({ status: 'saved' })
    expect(legacy.readMatch().status).toBe('valid')
    expect(legacy.readSettings().status).toBe('valid')
  })

  it('accepts literal ongoing saves and validates recovery only on a CPU turn', () => {
    expect(decodeConnectFourMatchEnvelope(yellowFirstSave).status).toBe('valid')
    const cpuTurn = {
      schemaVersion: 1,
      match: {
        ...yellowFirstSave.match,
        moves: yellowFirstSave.match.moves.slice(0, 1),
        position: {
          board: [
            0,0,0,0,0,0,0, 0,0,0,0,0,0,0, 0,0,0,0,0,0,0,
            0,0,0,0,0,0,0, 0,0,0,0,0,0,0, 1,0,0,0,0,0,0,
          ],
          columns: [0], nextPlayer: 'two', outcome: { kind: 'ongoing' }, winningLines: [],
        },
      },
      recovery: { consecutiveInvalid: 2 },
    }
    expect(decodeConnectFourMatchEnvelope(cpuTurn).status).toBe('valid')
    expect(decodeConnectFourMatchEnvelope({ ...yellowFirstSave, recovery: { consecutiveInvalid: 1 } }).status).toBe('invalid')
  })

  it.each([
    ['wrong ply', (save: any) => { save.match.moves[1].ply = 3 }],
    ['wrong player', (save: any) => { save.match.moves[1].player = 'one' }],
    ['wrong color', (save: any) => { save.match.moves[1].color = 'yellow' }],
    ['wrong actor', (save: any) => { save.match.moves[1].actor = 'human' }],
    ['wrong landing', (save: any) => { save.match.moves[1].landingCell = 29 }],
    ['wrong column', (save: any) => { save.match.moves[1].column = 7 }],
    ['unsupported analysis', (save: any) => { save.match.moves[1].analysis = {} }],
    ['unsupported Jev', (save: any) => { save.match.moves[1].provenance = 'jev' }],
    ['forged board', (save: any) => { save.match.position.board[36] = 0 }],
    ['forged columns', (save: any) => { save.match.position.columns = [0,0] }],
    ['forged outcome', (save: any) => { save.match.outcome = { kind: 'draw' } }],
    ['bad recovery', (save: any) => { save.recovery.consecutiveInvalid = 3 }],
    ['unsupported version', (save: any) => { save.schemaVersion = 2 }],
  ])('rejects %s', (_name, corrupt) => {
    const save: any = clone(yellowFirstSave)
    corrupt(save)
    expect(decodeConnectFourMatchEnvelope(save).status).toBe('invalid')
  })

  it('rejects malformed JSON, excessive records, and inconsistent resignation', () => {
    const { values, connectFour } = storage()
    values.set(CONNECT_FOUR_MATCH_STORAGE_KEY, '{bad json')
    expect(connectFour.readMatch().status).toBe('invalid')
    const oversized: any = clone(yellowFirstSave)
    oversized.match.moves = Array(43).fill(oversized.match.moves[0])
    expect(decodeConnectFourMatchEnvelope(oversized).status).toBe('invalid')
    const resigned: any = clone(yellowFirstSave)
    resigned.match.outcome = { kind: 'resignation', resigningPlayer: 'one', winner: 'two', ply: 2 }
    expect(decodeConnectFourMatchEnvelope(resigned).status).toBe('valid')
    resigned.match.outcome.ply = 1
    expect(decodeConnectFourMatchEnvelope(resigned).status).toBe('invalid')
  })

  it('replays a literal win and rejects altered lines or moves after the win', () => {
    expect(decodeConnectFourMatchEnvelope(literalWin).status).toBe('valid')
    const wrongLine: any = clone(literalWin)
    wrongLine.match.position.winningLines = [[35,36,37,39]]
    expect(decodeConnectFourMatchEnvelope(wrongLine).status).toBe('invalid')
    const afterWin: any = clone(literalWin)
    afterWin.match.moves.push({ ply: 8, column: 4, landingCell: 39, player: 'two', color: 'yellow', actor: 'cpu', provenance: 'rng' })
    expect(decodeConnectFourMatchEnvelope(afterWin).status).toBe('invalid')
  })

  it('contains storage access and quota failures', () => {
    const inaccessible = createConnectFourStorageAdapter(() => { throw new Error('blocked') })
    expect(inaccessible.readMatch()).toEqual({ status: 'unavailable', error: 'blocked' })
    expect(inaccessible.writeMatch(yellowFirstSave)).toEqual({ status: 'unavailable', error: 'blocked' })
    expect(inaccessible.removeMatch()).toEqual({ status: 'unavailable', error: 'blocked' })
  })
})
