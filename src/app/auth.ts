import type { AccountIdentity, AuthAdapter, AuthSnapshot, AuthStore } from '../contracts/account'

export interface AuthStoreOptions {
  readonly adapter?: AuthAdapter
  readonly unavailableReason?: string
  readonly baseUrl?: string
  readonly location?: Pick<Location, 'origin' | 'pathname' | 'search' | 'hash'>
  readonly replaceUrl?: (url: string) => void
}

function oauthReturnError(location: Pick<Location, 'pathname' | 'search' | 'hash'>, replaceUrl: (url: string) => void): string | null {
  const search = new URLSearchParams(location.search)
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''))
  const error = search.get('error_description') ?? hash.get('error_description') ?? search.get('error') ?? hash.get('error')
  // The SDK owns PKCE code exchange. Never remove its code before it has consumed it.
  const consumed = error ? ['error', 'error_code', 'error_description'] : []
  let changed = false
  for (const params of [search, hash]) for (const key of consumed) {
    if (params.has(key)) { params.delete(key); changed = true }
  }
  if (changed) replaceUrl(`${location.pathname}${search.size ? `?${search}` : ''}${hash.size ? `#${hash}` : ''}`)
  return error ? 'Google sign-in could not be completed. Please try again.' : null
}

export function createAuthStore(options: AuthStoreOptions): AuthStore {
  const { adapter } = options
  let snapshot: AuthSnapshot = adapter
    ? { status: 'loading', account: null, pending: null, error: null }
    : { status: 'unavailable', account: null, pending: null, error: 'Account sign-in is unavailable.' }
  const listeners = new Set<() => void>()
  let started = false
  let disposed = false
  let unsubscribe: (() => void) | undefined
  let eventRevision = 0
  let actionRevision = 0

  const publish = (next: AuthSnapshot) => {
    if (disposed || JSON.stringify(next) === JSON.stringify(snapshot)) return
    snapshot = next
    listeners.forEach(listener => listener())
  }
  const reconcile = (account: AccountIdentity | null, error: string | null = null) => {
    publish(account
      ? { status: 'signed-in', account, pending: null, error }
      : { status: 'signed-out', account: null, pending: null, error })
  }
  const resolveSession = async (revision: number, error: string | null = null) => {
    if (!adapter) return
    try {
      const account = await adapter.getSession()
      if (!disposed && eventRevision === revision) reconcile(account, error)
    } catch {
      if (!disposed && eventRevision === revision) reconcile(null, error ?? 'Account session could not be loaded.')
    }
  }

  return {
    start() {
      if (started || disposed) return
      started = true
      const location = options.location ?? window.location
      const replaceUrl = options.replaceUrl ?? (url => window.history.replaceState(window.history.state, '', url))
      const returnError = oauthReturnError(location, replaceUrl)
      if (!adapter) return
      unsubscribe = adapter.onAuthStateChange((_event, account) => {
        eventRevision++
        // Keep this callback synchronous; consumers can schedule their own follow-up work.
        reconcile(account, returnError)
      })
      void resolveSession(eventRevision, returnError)
    },
    dispose() {
      if (disposed) return
      disposed = true
      unsubscribe?.()
      listeners.clear()
    },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    getSnapshot() { return snapshot },
    async signIn() {
      if (!adapter || snapshot.status !== 'signed-out' || snapshot.pending) return
      const revision = ++actionRevision
      publish({ ...snapshot, pending: 'sign-in', error: null })
      try {
        const origin = options.location?.origin ?? window.location.origin
        const redirectTo = new URL(options.baseUrl ?? import.meta.env.BASE_URL, origin).href
        const result = await adapter.signInWithGoogle(redirectTo)
        if (disposed || revision !== actionRevision || snapshot.status !== 'signed-out') return
        if (result.error) publish({ ...snapshot, pending: null, error: 'Google sign-in could not be started. Please try again.' })
        // On success, remain pending until navigation or an auth notification arrives.
      } catch {
        if (!disposed && revision === actionRevision && snapshot.status === 'signed-out')
          publish({ ...snapshot, pending: null, error: 'Google sign-in could not be started. Please try again.' })
      }
    },
    async signOut() {
      if (!adapter || snapshot.status !== 'signed-in' || snapshot.pending) return
      const revision = ++actionRevision
      eventRevision++
      publish({ status: 'signed-out', account: null, pending: null, error: null })
      try {
        const result = await adapter.signOutLocal()
        if (disposed || revision !== actionRevision) return
        if (result.error) await resolveSession(eventRevision, 'Sign-out failed. Please try again.')
      } catch {
        if (!disposed && revision === actionRevision) await resolveSession(eventRevision, 'Sign-out failed. Please try again.')
      }
    },
  }
}
