import { describe, expect, it } from 'vitest'
import { cpuTurnMatch, drawnMatch, humanTurnMatch, resignedMatch, scriptedProvider, validSaves, wonMatch } from '../fixtures/v05'

describe('T1 independent fixtures', () => {
  it('contains hand-authored ongoing and terminal save envelopes', () => {
    expect(Object.keys(validSaves)).toEqual(['humanTurn', 'cpuTurnAfterTwoInvalid', 'win', 'draw', 'resignation'])
    expect(humanTurnMatch.position.board).toEqual(['X', null, null, null, 'O', null, null, null, null])
    expect(cpuTurnMatch.position.nextSymbol).toBe('O')
    expect(wonMatch.position.winningLines).toEqual([[0, 1, 2]])
    expect(drawnMatch.moves).toHaveLength(9)
    expect(resignedMatch.position.outcome.kind).toBe('ongoing')
    expect(resignedMatch.outcome.kind).toBe('resignation')
    expect(validSaves.cpuTurnAfterTwoInvalid.recovery.consecutiveInvalid).toBe(2)
  })

  it('scripts delayed, malformed, and failing provider responses', async () => {
    const script = scriptedProvider([
      { kind: 'deferred' },
      { kind: 'invalid', value: { move: 10 } },
      { kind: 'failure', message: 'offline' },
    ])
    const input = { position: cpuTurnMatch.position, legalMoves: [1, 2], signal: new AbortController().signal }
    const first = script.provider.chooseMove(input)
    expect(script.pendingCount).toBe(1)
    script.resolveNext({ move: 1 })
    await expect(first).resolves.toEqual({ move: 1 })
    await expect(script.provider.chooseMove(input)).resolves.toEqual({ move: 10 })
    await expect(script.provider.chooseMove(input)).rejects.toThrow('offline')
    expect(script.calls).toBe(3)
  })
})
