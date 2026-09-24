import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { TicTacToeScreen } from '../../src/components/TicTacToeScreen'
import type { TicTacToeSnapshot } from '../../src/contracts'
import { cpuTurnMatch, drawnMatch, humanTurnMatch, resignedMatch, wonMatch } from '../fixtures/v05'

const idle = { status: 'idle', consecutiveInvalid: 0 } as const
const live = { location: { mode: 'live' }, pendingCell: null, mobileHistoryOpen: false, resignationDialogOpen: false } as const
const base: TicTacToeSnapshot = {
  selectedGame: 'tic-tac-toe', setupSymbol: 'X', match: null, view: live,
  request: idle, settings: { confirmMoves: false }, notices: [],
}

function html(snapshot: TicTacToeSnapshot) {
  return renderToStaticMarkup(createElement(TicTacToeScreen, {
    snapshot,
    dispatch: () => undefined,
    board: createElement('button', { type: 'button' }, 'A3, empty'),
    history: createElement('p', null, 'History fixture'),
  }))
}

describe('T5 shell fixtures', () => {
  it('renders setup and native disabled future navigation', () => {
    const markup = html(base)
    expect(markup).toContain('Choose your side')
    expect(markup).toContain('aria-pressed="true"')
    expect(markup).not.toContain('Reset choice')
    expect(markup).toContain('aria-label="Settings"')
    expect(markup).toMatch(/disabled=""[^>]*>Connect Four/)
    expect(markup).toMatch(/disabled=""[^>]*>Chess/)
    expect(markup).not.toContain('role="tab"')
  })

  it('keeps live CPU status during review and provides separate inspection container', () => {
    const markup = html({ ...base, match: cpuTurnMatch, view: { ...live, location: { mode: 'review', ply: 1 }, mobileHistoryOpen: true }, request: { status: 'pending', token: { gameId: 'tic-tac-toe', matchId: cpuTurnMatch.id, expectedPly: 2, attemptId: 'test' }, startedAt: 0, retryAvailable: true, consecutiveInvalid: 0 } })
    expect(markup).not.toContain('Choose your side to start a match.')
    expect(markup).toContain('Move history and inspection')
    expect(markup).toContain('Retry CPU move')
  })

  it('renders long errors without clipping their text and exposes immediate retry', () => {
    const error = 'Provider failed: ' + 'very long diagnostic '.repeat(30)
    const markup = html({ ...base, match: cpuTurnMatch, request: { status: 'failed', token: { gameId: 'tic-tac-toe', matchId: cpuTurnMatch.id, expectedPly: 2, attemptId: 'test' }, error, retryAvailable: true, consecutiveInvalid: 0 } })
    expect(markup).toContain(error)
    expect(markup).toContain('role="alert"')
    expect(markup).toContain('Retry CPU move')
    expect(markup).not.toContain('CPU is thinking')
  })

  it('switches match action from Resign to Rematch and shows terminal result', () => {
    const active = html({ ...base, match: humanTurnMatch })
    expect(active).toContain('>Resign</button>')
    expect(active).toContain('>Your turn</p>')
    const terminal = html({ ...base, match: wonMatch })
    expect(terminal).toContain('>Rematch</button>')
    expect(terminal).toContain('>Victory</p>')
    expect(html({ ...base, match: { ...wonMatch, humanSymbol: 'O' } })).toContain('>Defeat</p>')
    expect(html({ ...base, match: resignedMatch })).toContain('>Defeat</p>')
    expect(html({ ...base, match: drawnMatch })).toContain('>Draw</p>')
  })

  it('shows recovery action and a checked confirmation preference', () => {
    const markup = html({ ...base, settings: { confirmMoves: true }, notices: [{ kind: 'invalid-match', message: 'Saved match could not be loaded.' }] })
    expect(markup).toContain('Start fresh')
    expect(markup).toContain('aria-label="Settings"')
    expect(markup).toContain('disabled=""')
  })
})
