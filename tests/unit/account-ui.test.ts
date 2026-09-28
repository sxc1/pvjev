import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TicTacToeScreen } from '../../src/components/TicTacToeScreen'
import { ConnectFourScreen } from '../../src/components/ConnectFourScreen'
import type { AccountViewModel } from '../../src/components/AppShell'
import type { TicTacToeSnapshot, ConnectFourSnapshot } from '../../src/contracts'

const stats: AccountViewModel['statistics'] = { accountId: 'user-1', status: 'ready', error: null, notices: [], rows: {
  'tic-tac-toe': { gameId: 'tic-tac-toe', winRng: 2, lossRng: 1, drawRng: 3, winJev: 0, lossJev: 0, drawJev: 0, lastMatchId: null, lastMatchCompletedAt: null },
  'connect-four': { gameId: 'connect-four', winRng: 4, lossRng: 5, drawRng: 6, winJev: 0, lossJev: 0, drawJev: 0, lastMatchId: null, lastMatchCompletedAt: null },
} }
const account: AccountViewModel = { auth: { status: 'signed-in', account: { id: 'user-1', email: 'test@example.com', name: 'Player' }, pending: null, error: null }, statistics: stats,
  onSignIn: () => {}, onSignOut: () => {}, onRetryStats: () => {}, onDismissResultNotice: () => {} }
const ttt: TicTacToeSnapshot = { selectedGame: 'tic-tac-toe', setupSymbol: 'X', match: null, view: { location: { mode: 'live' }, pendingCell: null, mobileHistoryOpen: false, resignationDialogOpen: false }, request: { status: 'idle', consecutiveInvalid: 0 }, settings: { confirmMoves: false }, notices: [] }
const cf: ConnectFourSnapshot = { setup: { humanColor: 'red', humanOrder: 'first' }, match: null, view: { location: { mode: 'live' }, pendingColumn: null, mobileHistoryOpen: false, resignationDialogOpen: false }, request: { status: 'idle', consecutiveInvalid: 0 }, settings: { confirmMoves: false }, notices: [] }
const render = (view: AccountViewModel) => renderToStaticMarkup(createElement(TicTacToeScreen, { snapshot: ttt, dispatch: () => {}, account: view }))

describe('shared account UI', () => {
  it('shows loading, guest, unavailable, and pending sign-in controls', () => {
    expect(render({ ...account, auth: { status: 'loading', account: null, pending: null, error: null } })).toContain('Loading account…')
    expect(render({ ...account, auth: { status: 'unavailable', account: null, pending: null, error: null } })).toContain('Account unavailable')
    expect(render({ ...account, auth: { status: 'signed-out', account: null, pending: null, error: null } })).toContain('Sign in with Google')
    expect(render({ ...account, auth: { status: 'signed-out', account: null, pending: 'sign-in', error: 'Sign-in failed' } })).toMatch(/Signing in…<\/button><span class="pv-account-error" role="alert">Sign-in failed/)
  })
  it('selects each game row, labels the table, and hides metadata', () => {
    const ticMarkup = render(account)
    const cfMarkup = renderToStaticMarkup(createElement(ConnectFourScreen, { snapshot: cf, dispatch: () => {}, onConfirmMoves: () => {}, account }))
    expect(ticMarkup).toContain('Your stats')
    expect(ticMarkup).toContain('scope="col">Wins')
    expect(ticMarkup).toContain('scope="row">RNG</th><td>2</td><td>1</td><td>3</td>')
    expect(cfMarkup).toContain('scope="row">RNG</th><td>4</td><td>5</td><td>6</td>')
    expect(ticMarkup).toContain('Jev <span class="pv-stats-note">(unavailable)</span>')
    expect(ticMarkup).not.toContain('lastMatchId')
  })
  it('distinguishes a failed read from zero totals and renders one dismissible live notice', () => {
    const markup = render({ ...account, statistics: { ...stats, status: 'error', rows: {}, error: 'read failed', notices: [{ id: 'notice-1', message: 'Your result could not be saved.' }] } })
    expect(markup).toContain('Stats unavailable')
    expect(markup).toContain('>Retry</button>')
    expect(markup).not.toContain('scope="row">RNG')
    expect(markup).toContain('aria-live="polite"')
    expect(markup).toContain('aria-label="Dismiss result notice"')
  })
})
