import type { AuthSnapshot } from '../contracts/account'

export function AccountControls({ auth, onSignIn, onSignOut }: {
  readonly auth: AuthSnapshot
  readonly onSignIn: () => void
  readonly onSignOut: () => void
}) {
  if (auth.status === 'loading') return <div className="pv-account" role="status">Loading account…</div>
  if (auth.status === 'unavailable') return <div className="pv-account" role="status">Account unavailable</div>
  return <div className="pv-account">
    {auth.status === 'signed-in' ? <>
      <span className="pv-account-name" title={auth.account.email || undefined}>{auth.account.name || auth.account.email || 'Account'}</span>
      <button className="pv-button pv-button-secondary" type="button" disabled={auth.pending === 'sign-out'} onClick={onSignOut}>{auth.pending === 'sign-out' ? 'Signing out…' : 'Sign out'}</button>
    </> : <button className="pv-button pv-button-secondary" type="button" disabled={auth.pending === 'sign-in'} onClick={onSignIn}>{auth.pending === 'sign-in' ? 'Signing in…' : 'Sign in with Google'}</button>}
    {auth.error && <span className="pv-account-error" role="alert">{auth.error}</span>}
  </div>
}
