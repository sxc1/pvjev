import { describe, expect, it } from 'vitest'
import { decodeReplayMatchEnvelope, decodeConnectFourMatchEnvelope } from '../../src/storage'
import { validSaves } from '../fixtures/v05'
import { yellowFirstSave } from '../fixtures/connect-four'

const clone = <T>(value: T): T => structuredClone(value)

function ticJevSave(): any {
  const save: any = clone(validSaves.humanTurn)
  save.match.assignment = { opponent: 'jev', credentialRoute: 'visitor' }
  save.match.moves[1].provenance = 'jev'
  save.match.moves[1].analysis = {
    confidence: 0.742, resolvedModelId: 'jev-resolved',
    choices: [
      { moveId: 'cell-4', probability: 0.3 },
      ...[1, 2, 3, 5, 6, 7, 8].map(cell => ({ moveId: `cell-${cell}`, probability: 0.1 })),
    ],
    tie: { count: 1, selectedMoveId: 'cell-4' },
  }
  return save
}

function connectJevSave(): any {
  const save: any = clone(yellowFirstSave)
  save.match.assignment = { opponent: 'jev', credentialRoute: 'visitor' }
  save.match.moves[1].provenance = 'jev'
  save.match.moves[1].analysis = {
    confidence: 0.51, resolvedModelId: 'jev-resolved',
    choices: [
      { moveId: 'column-1', probability: 0.4 },
      ...[0, 2, 3, 4, 5, 6].map(column => ({ moveId: `column-${column}`, probability: 0.1 })),
    ],
    tie: { count: 1, selectedMoveId: 'column-1' },
  }
  return save
}

describe('V5 versioned Jev replay', () => {
  it('accepts complete retained analysis in both games and rejects old saves', () => {
    expect(decodeReplayMatchEnvelope(ticJevSave()).status).toBe('valid')
    expect(decodeConnectFourMatchEnvelope(connectJevSave()).status).toBe('valid')
    const oldTic = ticJevSave(); oldTic.schemaVersion = 1
    const oldConnect = connectJevSave(); oldConnect.schemaVersion = 1
    expect(decodeReplayMatchEnvelope(oldTic).status).toBe('invalid')
    expect(decodeConnectFourMatchEnvelope(oldConnect).status).toBe('invalid')
  })

  it.each([
    ['wrong route', (save: any) => { save.match.assignment.credentialRoute = 'shared' }],
    ['missing probability', (save: any) => { save.match.moves[1].analysis.choices.pop() }],
    ['duplicate choice', (save: any) => { save.match.moves[1].analysis.choices[1].moveId = 'cell-4' }],
    ['numeric string', (save: any) => { save.match.moves[1].analysis.choices[0].probability = '0.3' }],
    ['wrong order', (save: any) => { save.match.moves[1].analysis.choices.reverse() }],
    ['wrong tie', (save: any) => { save.match.moves[1].analysis.tie.count = 2 }],
    ['wrong selected move', (save: any) => { save.match.moves[1].analysis.tie.selectedMoveId = 'cell-1' }],
    ['bad sum', (save: any) => { save.match.moves[1].analysis.choices[1].probability = 0.09 }],
    ['ordinary RNG with analysis', (save: any) => { save.match.assignment = { opponent: 'rng' } }],
    ['key in recovery', (save: any) => { save.recovery.visitorKey = 'forbidden' }],
  ])('rejects %s', (_label, mutate) => {
    const save = ticJevSave(); mutate(save)
    expect(decodeReplayMatchEnvelope(save).status).toBe('invalid')
  })

  it('retains independent counters and manual retry only on a visitor CPU turn', () => {
    const save: any = clone(validSaves.cpuTurnAfterTwoInvalid)
    save.match.assignment = { opponent: 'jev', credentialRoute: 'visitor' }
    save.recovery = { consecutiveServiceFailures: 2, consecutiveInvalid: 1, disposition: 'manual-retry-required' }
    expect(decodeReplayMatchEnvelope(save).status).toBe('valid')
    save.recovery.consecutiveServiceFailures = 0
    expect(decodeReplayMatchEnvelope(save).status).toBe('invalid')
    save.recovery.consecutiveServiceFailures = 3
    expect(decodeReplayMatchEnvelope(save).status).toBe('invalid')
  })
})
