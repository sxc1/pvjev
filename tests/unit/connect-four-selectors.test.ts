import { describe, expect, it } from 'vitest'
import type { ConnectFourSnapshot } from '../../src/contracts'
import { inspectionText, selectConnectFourPresentation } from '../../src/games/connect-four/selectors'
import { emptyReviewView, reviewingFirstMoveView, yellowFirstMatch } from '../fixtures/connect-four'

const base: ConnectFourSnapshot = {
  setup: yellowFirstMatch.setup,
  match: yellowFirstMatch,
  view: { location: { mode: 'live' }, pendingColumn: null, mobileHistoryOpen: false, resignationDialogOpen: false },
  request: { status: 'idle', consecutiveInvalid: 0 },
  settings: { confirmMoves: false },
  notices: [],
}

describe('Connect Four history presentation', () => {
  it('shows the latest live board and color-aware labels', () => {
    const view = selectConnectFourPresentation(base)!
    expect(view.position.board[35]).toBe(1)
    expect(view.position.board[36]).toBe(2)
    expect(view.entries.map(entry => entry.label)).toEqual(['1y A1', '1r B1'])
    expect(view.latestCell).toBe(36)
    expect(view.selectedCell).toBeNull()
    expect(view.canGoBack).toBe(true)
    expect(view.canGoForward).toBe(false)
  })

  it('keeps later live moves in history while reconstructing only the selected prefix', () => {
    const view = selectConnectFourPresentation({ ...base, view: reviewingFirstMoveView })!
    expect(view.position.board[35]).toBe(1)
    expect(view.position.board[36]).toBe(0)
    expect(view.entries).toHaveLength(2)
    expect(view.entries.map(entry => entry.selected)).toEqual([true, false])
    expect(view.placementPlyByCell.get(35)).toBe(1)
    expect(view.placementPlyByCell.has(36)).toBe(false)
    expect(view.selectedCell).toBe(35)
    expect(view.latestCell).toBeNull()
    expect(view.canGoBack).toBe(false)
    expect(view.canGoForward).toBe(true)
    expect(view.historicalLabel).toContain('1y A1')
  })

  it('holds an empty review even after live moves arrive', () => {
    const view = selectConnectFourPresentation({ ...base, view: emptyReviewView })!
    expect(view.position.board.every(cell => cell === 0)).toBe(true)
    expect(view.entries).toHaveLength(2)
    expect(view.selectedPly).toBeNull()
    expect(view.canGoForward).toBe(true)
    expect(view.canGoBack).toBe(false)
    expect(view.reviewedMove).toBeNull()
  })

  it('uses no CPU details in human inspection and identifies RNG provenance', () => {
    expect(inspectionText(yellowFirstMatch.moves[0])).toBe('Your yellow move at A1.')
    expect(inspectionText(yellowFirstMatch.moves[1])).toBe('Random CPU move at B1.')
  })
})
