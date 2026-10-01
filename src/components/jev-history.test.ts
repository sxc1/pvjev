import { describe, expect, it } from 'vitest'
import type { ConnectFourSnapshot, TicTacToeSnapshot } from '../contracts/application'
import { selectTicTacToePresentation } from '../games/tic-tac-toe/selectors'
import { selectConnectFourPresentation } from '../games/connect-four/selectors'
import { humanTurnMatch } from '../../tests/fixtures/v05'
import { yellowFirstMatch } from '../../tests/fixtures/connect-four'

const analysis = { confidence: 0.74212, choices: [{ moveId: 'cell-4', probability: 0.6 }, { moveId: 'cell-1', probability: 0.4 }], tie: { count: 1, selectedMoveId: 'cell-4' }, resolvedModelId: 'resolved-internal' }
const request = { status: 'idle' as const, consecutiveInvalid: 0, consecutiveServiceFailures: 0 }

describe('Jev history presentation', () => {
  it('shows confidence before Tic Tac Toe notation from the saved CPU record', () => {
    const match = { ...humanTurnMatch, assignment: { opponent: 'jev' as const, credentialRoute: 'visitor' as const }, moves: [humanTurnMatch.moves[0], { ply: 2, symbol: 'O' as const, cell: 4, actor: 'cpu' as const, provenance: 'jev' as const, analysis }] }
    const snapshot = { match, request, settings: { confirmMoves: false }, setupSymbol: 'X' as const, notices: [], selectedGame: 'tic-tac-toe' as const, view: { location: { mode: 'review' as const, ply: 2 }, pendingCell: null, mobileHistoryOpen: true, resignationDialogOpen: false } } satisfies TicTacToeSnapshot
    const view = selectTicTacToePresentation(snapshot)!
    expect(view.entries[1].label).toMatch(/^Confidence 0\.742 /)
    expect(view.reviewedMove?.provenance).toBe('jev')
    expect(view.position.board[4]).toBe('O')
  })
  it('shows saved confidence for Connect Four without changing the reviewed board', () => {
    const cfAnalysis = { ...analysis, choices: [{ moveId: 'column-1', probability: 1 }], tie: { count: 1, selectedMoveId: 'column-1' } }
    const match = { ...yellowFirstMatch, assignment: { opponent: 'jev' as const, credentialRoute: 'visitor' as const }, moves: [yellowFirstMatch.moves[0], { ply: 2, column: 1, landingCell: 36, player: 'two' as const, color: 'red' as const, actor: 'cpu' as const, provenance: 'jev' as const, analysis: cfAnalysis }] }
    const snapshot = { match, request, settings: { confirmMoves: false }, setup: match.setup, notices: [], view: { location: { mode: 'review' as const, selectedPly: 2 }, pendingColumn: null, mobileHistoryOpen: true, resignationDialogOpen: false } } satisfies ConnectFourSnapshot
    const view = selectConnectFourPresentation(snapshot)!
    expect(view.entries[1].label).toMatch(/^Confidence 0\.742 /)
    expect(view.reviewedMove?.provenance).toBe('jev')
    expect(view.position.board[36]).toBe(2)
  })
})

