import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ConnectFourScreen } from '../../src/components/ConnectFourScreen'
import type { ConnectFourMatch, ConnectFourSnapshot } from '../../src/contracts'
import { allSetups, emptyPosition, redSecondMatch, yellowFirstMatch } from '../fixtures/connect-four'

const view = { location: { mode: 'live' }, pendingColumn: null, mobileHistoryOpen: false, resignationDialogOpen: false } as const
const base: ConnectFourSnapshot = { setup: allSetups[0], match: null, view, request: { status: 'idle', consecutiveInvalid: 0 }, settings: { confirmMoves: false }, notices: [] }
const html = (snapshot: ConnectFourSnapshot) => renderToStaticMarkup(createElement(ConnectFourScreen, { snapshot, dispatch: () => undefined, onConfirmMoves: () => {} }))
const withMatch = (match: ConnectFourMatch, extras: Partial<ConnectFourSnapshot> = {}): ConnectFourSnapshot => ({ ...base, setup: match.setup, match, ...extras })

describe('Connect Four screen', () => {
  it.each(allSetups)('shows independent color and order choices for %o', setup => {
    const markup = html({ ...base, setup })
    expect(markup).toContain('Set up Connect Four')
    expect(markup).toMatch(/aria-label="Your color"/)
    expect(markup).toMatch(/aria-label="Move order"/)
    expect(markup).toMatch(new RegExp(`aria-label="Play as ${setup.humanColor}" aria-pressed="true"`))
    expect(markup).toMatch(new RegExp(`aria-label="Play ${setup.humanOrder}" aria-pressed="true"`))
    expect(markup).toContain('Start game')
  })

  it('shows match action and live status independently of review', () => {
    const empty = withMatch({ ...yellowFirstMatch, moves: [], position: emptyPosition })
    expect(html(empty)).toContain('>Restart</button>')
    expect(html(withMatch(yellowFirstMatch))).toContain('>Resign</button>')
    expect(html(withMatch(yellowFirstMatch))).toContain('>Your turn</p>')
    const review = html(withMatch(yellowFirstMatch, { view: { ...view, location: { mode: 'review', selectedPly: 1 } } }))
    expect(review).toContain('>Your turn</p>')
    expect(review).toContain('aria-pressed="true"')
    expect(review).toContain('Historical Connect Four board')
    expect(review).not.toContain('Historical position after')
    expect(review).not.toContain('Move inspection')
    expect(html(withMatch({ ...yellowFirstMatch, outcome: { kind: 'draw' } }))).toContain('>Draw</p>')
    expect(html(withMatch({ ...yellowFirstMatch, outcome: { kind: 'resignation', resigningPlayer: 'one', winner: 'two', ply: 2 } }))).toContain('>Defeat</p>')
  })

  it('reflects CPU turn, retry, shared settings control, and mobile history control', () => {
    const markup = html(withMatch({ ...redSecondMatch, moves: [], position: emptyPosition }, {
      settings: { confirmMoves: true },
      request: { status: 'pending', token: { gameId: 'connect-four', matchId: redSecondMatch.id, expectedPly: 1, attemptId: 'attempt' }, startedAt: 0, retryAvailable: true, consecutiveInvalid: 0 },
    }))
    expect(markup).toContain('CPU is thinking')
    expect(markup).toContain('Retry CPU move')
    expect(markup).toContain('aria-label="Settings"')
    expect(markup).toContain('Show history')
  })

  it('exposes resignation dialog and recovery controls', () => {
    const markup = html(withMatch(yellowFirstMatch, { view: { ...view, resignationDialogOpen: true }, notices: [{ kind: 'invalid-match', message: 'Cannot restore.' }] }))
    expect(markup).toContain('Resign this match?')
    expect(markup).toContain('Keep playing')
    expect(markup).toContain('Start fresh')
  })
})
