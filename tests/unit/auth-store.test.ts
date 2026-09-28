import { describe, expect, it, vi } from 'vitest'
import { createAuthStore } from '../../src/app/auth'
import { readSupabaseConfig } from '../../src/supabase/config'
import type { AccountIdentity, AuthAdapter, AuthEvent } from '../../src/contracts/account'

const user: AccountIdentity = { id: 'account-1', email: 'a@example.test', name: 'A' }

function fakeAuth(initial: AccountIdentity | null = null) {
  let listener: ((event: AuthEvent, account: AccountIdentity | null) => void) | undefined
  const signIn = vi.fn(async (_url: string) => ({}))
  const signOut = vi.fn(async () => ({}))
  const unsubscribe = vi.fn()
  const adapter: AuthAdapter = {
    getSession: vi.fn(async () => initial),
    onAuthStateChange: callback => { listener = callback; return unsubscribe },
    signInWithGoogle: signIn,
    signOutLocal: signOut,
  }
  return { adapter, emit: (event: AuthEvent, account: AccountIdentity | null) => listener?.(event, account), signIn, signOut, unsubscribe }
}

const location = { origin: 'https://example.test', pathname: '/pvjev/', search: '', hash: '' }

describe('auth store', () => {
  it('restores a session and accepts newer auth events over a pending initial read', async () => {
    let finish!: (value: AccountIdentity | null) => void
    const auth = fakeAuth()
    auth.adapter.getSession = () => new Promise(resolve => { finish = resolve })
    const store = createAuthStore({ adapter: auth.adapter, location, baseUrl: '/pvjev/' })
    store.start()
    expect(store.getSnapshot().status).toBe('loading')
    auth.emit('SIGNED_IN', user)
    finish(null)
    await Promise.resolve()
    expect(store.getSnapshot()).toMatchObject({ status: 'signed-in', account: user })
    store.dispose()
    expect(auth.unsubscribe).toHaveBeenCalledOnce()
  })

  it('uses the app root for OAuth and guards duplicate attempts', async () => {
    const auth = fakeAuth()
    const store = createAuthStore({ adapter: auth.adapter, location, baseUrl: '/pvjev/' })
    store.start()
    await Promise.resolve()
    await store.signIn()
    await store.signIn()
    expect(auth.signIn).toHaveBeenCalledOnce()
    expect(auth.signIn).toHaveBeenCalledWith('https://example.test/pvjev/')
  })

  it('clears identity immediately on sign-out and restores it with an error on failure', async () => {
    const auth = fakeAuth(user)
    auth.signOut.mockResolvedValueOnce({ error: 'failed' })
    const store = createAuthStore({ adapter: auth.adapter, location })
    store.start()
    await Promise.resolve()
    const signingOut = store.signOut()
    expect(store.getSnapshot().status).toBe('signed-out')
    await signingOut
    expect(store.getSnapshot()).toMatchObject({ status: 'signed-in', account: user, error: 'Sign-out failed. Please try again.' })
  })

  it('keeps guest play available when configuration is absent', () => {
    expect(readSupabaseConfig({})).toMatchObject({ available: false })
    const store = createAuthStore({ unavailableReason: 'missing', location })
    store.start()
    expect(store.getSnapshot()).toMatchObject({ status: 'unavailable', account: null })
  })

  it('surfaces OAuth return errors and preserves unrelated URL parameters', async () => {
    const auth = fakeAuth()
    const replaceUrl = vi.fn()
    const store = createAuthStore({ adapter: auth.adapter, location: { ...location, search: '?foo=bar&error=access_denied' }, replaceUrl })
    store.start()
    await Promise.resolve()
    expect(store.getSnapshot().error).toMatch(/Google sign-in/)
    expect(replaceUrl).toHaveBeenCalledWith('/pvjev/?foo=bar')
  })
})
