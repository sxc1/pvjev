import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { TicTacToeMatch, TicTacToeSnapshot } from '../../src/contracts'
import { TicTacToeBoard } from '../../src/components/TicTacToeBoard'
import { TicTacToeHistory } from '../../src/components/TicTacToeHistory'
import { inspectionText, selectTicTacToePresentation } from '../../src/games/tic-tac-toe/selectors'
import { cpuTurnMatch, humanTurnMatch, wonMatch } from '../fixtures/v05'

const base: TicTacToeSnapshot = {
  selectedGame: 'tic-tac-toe', setupSymbol: 'X', match: null,
  view: { location: { mode: 'live' }, pendingCell: null, mobileHistoryOpen: false, resignationDialogOpen: false },
  request: { status: 'idle', consecutiveInvalid: 0 }, settings: { confirmMoves: false }, notices: [],
}

function snapshot(match: TicTacToeMatch, ply?: number): TicTacToeSnapshot {
  return { ...base, match, view: { ...base.view, location: ply ? { mode: 'review', ply } : { mode: 'live' } } }
}

describe('T8 historical selectors and widgets', () => {
  it('separates live and review of the latest move, and never navigates to the empty board', () => {
    const live = selectTicTacToePresentation(snapshot(humanTurnMatch))!
    const reviewed = selectTicTacToePresentation(snapshot(humanTurnMatch, 2))!
    expect(live.cells[4].highlight).toBe('latest')
    expect(reviewed.cells[4].highlight).toBe('reviewed')
    expect(live.canGoBack).toBe(true)
    expect(live.canGoForward).toBe(false)
    expect(reviewed.canGoForward).toBe(false)
    expect(reviewed.canReturnToCurrent).toBe(true)
    const first = selectTicTacToePresentation(snapshot(humanTurnMatch, 1))!
    expect(first.canGoBack).toBe(false)
    expect(first.canGoForward).toBe(true)
    expect(first.cells[4].symbol).toBeNull()
    expect(first.cells[4].canActivate).toBe(false)
    expect(first.cells[0].label).toContain('inspect 1x A3')
  })

  it('derives all winning fills from the displayed prefix and preserves reviewed outlines', () => {
    const doubleWinCells = [0, 1, 2, 3, 6, 5, 8, 7, 4]
    const doubleWin: TicTacToeMatch = {
      ...wonMatch,
      moves: doubleWinCells.map((cell, index) => ({
        ply: index + 1, cell, symbol: index % 2 === 0 ? 'X' as const : 'O' as const,
        actor: index % 2 === 0 ? 'human' as const : 'cpu' as const,
        provenance: index % 2 === 0 ? 'human' as const : 'rng' as const,
      })),
      position: { board: ['X', 'O', 'X', 'O', 'X', 'O', 'X', 'O', 'X'], nextSymbol: 'O', outcome: { kind: 'win', winner: 'X', winningLines: [[0, 4, 8], [2, 4, 6]] }, winningLines: [[0, 4, 8], [2, 4, 6]] },
      outcome: { kind: 'win', winner: 'X', winningLines: [[0, 4, 8], [2, 4, 6]] },
    }
    const latest = selectTicTacToePresentation(snapshot(doubleWin, 9))!
    expect(latest.cells.filter(cell => cell.winning === 'human').map(cell => cell.index)).toEqual([0, 2, 4, 6, 8])
    expect(latest.cells[4].highlight).toBe('reviewed')
    const previous = selectTicTacToePresentation(snapshot(doubleWin, 8))!
    expect(previous.cells[4].symbol).toBeNull()
    expect(previous.cells.every(cell => cell.winning === 'none')).toBe(true)
  })

  it('previews without changing board/history and labels provenance without scores', () => {
    const pending = { ...snapshot(humanTurnMatch), settings: { confirmMoves: true }, view: { ...base.view, pendingCell: 2 } }
    const selected = selectTicTacToePresentation(pending)!
    expect(selected.cells[2].preview).toBe(true)
    expect(selected.cells[2].symbol).toBeNull()
    expect(selected.entries).toHaveLength(2)
    expect(selected.canConfirm).toBe(true)
    const board = renderToStaticMarkup(createElement(TicTacToeBoard, { snapshot: pending, dispatch: () => undefined }))
    expect(board).toContain('Confirm move')
    expect(board).toContain('Pending')
    expect(inspectionText(humanTurnMatch.moves[0])).toContain('Your X move')
    expect(inspectionText(humanTurnMatch.moves[1])).toContain('Random CPU move')
    expect(inspectionText({ ply: 2, cell: 4, symbol: 'O', actor: 'cpu', provenance: 'rng-fallback', diagnostic: 'Invalid response' })).toContain('Random fallback at B2. Invalid response')
    expect(inspectionText(humanTurnMatch.moves[1])).not.toContain('score')
  })

  it('renders native controls and collapsible mobile history from controller state', () => {
    const current = snapshot(cpuTurnMatch, 1)
    const markup = renderToStaticMarkup(createElement(TicTacToeHistory, { snapshot: { ...current, view: { ...current.view, mobileHistoryOpen: true } }, dispatch: () => undefined }))
    expect(markup).toContain('aria-expanded="true"')
    expect(markup).toContain('pv-history-expanded')
    expect(markup).not.toContain('Return to current')
    expect(markup).toContain('Reviewing 1x A3')
    expect(markup).not.toContain('score')
    const empty = selectTicTacToePresentation(snapshot({ ...cpuTurnMatch, moves: [], position: { board: [null, null, null, null, null, null, null, null, null], nextSymbol: 'X', outcome: { kind: 'ongoing' }, winningLines: [] } }))!
    expect(empty.canGoBack).toBe(false)
  })
})
