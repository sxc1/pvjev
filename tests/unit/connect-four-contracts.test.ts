import { describe, expect, it } from 'vitest'
import type { ConnectFourMoveRecord } from '../../src/contracts'
import { allSetups, emptyPosition, emptyReviewView, redSecondMatch, reviewingFirstMoveView, yellowFirstMatch, yellowFirstSave } from '../fixtures/connect-four'

describe('C1 Connect Four contracts and independent fixtures', () => {
  it('represents all four setup choices and keeps color separate from opening player', () => {
    expect(allSetups).toHaveLength(4)
    expect(new Set(allSetups.map((setup) => `${setup.humanColor}:${setup.humanOrder}`)).size).toBe(4)
    expect(yellowFirstMatch.moves[0]).toMatchObject({ player: 'one', color: 'yellow', actor: 'human' })
    expect(redSecondMatch.moves[0]).toMatchObject({ player: 'one', color: 'yellow', actor: 'cpu' })
  })

  it('represents empty review and an independent historical selection', () => {
    expect(emptyPosition.board).toHaveLength(42)
    expect(emptyReviewView.location).toEqual({ mode: 'review', selectedPly: null })
    expect(reviewingFirstMoveView.location).toEqual({ mode: 'review', selectedPly: 1 })
    expect(yellowFirstMatch.moves).toHaveLength(2)
    expect(yellowFirstSave.match.position.columns).toEqual([0, 1])
  })

  it('keeps RNG records free of analysis and reserves a separate Jev variant', () => {
    type Analyzed = ConnectFourMoveRecord<{ readonly score: number }>
    const jev: Analyzed = {
      ply: 2, column: 1, landingCell: 36, player: 'two', color: 'red',
      actor: 'cpu', provenance: 'jev', analysis: { score: 0.5 },
    }
    expect(jev.provenance).toBe('jev')
    expect(yellowFirstMatch.moves[1]).toMatchObject({ provenance: 'rng' })
    expect('analysis' in yellowFirstMatch.moves[1]).toBe(false)
  })
})
