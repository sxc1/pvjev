export interface AccountIdentity {
  readonly id: string
  readonly email: string | null
  readonly name: string | null
}

export type AuthEvent = 'INITIAL_SESSION' | 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED'

export interface AuthAdapter {
  getSession(): Promise<AccountIdentity | null>
  onAuthStateChange(listener: (event: AuthEvent, account: AccountIdentity | null) => void): () => void
  signInWithGoogle(redirectTo: string): Promise<{ readonly error?: string }>
  signOutLocal(): Promise<{ readonly error?: string }>
}

export type AuthSnapshot =
  | { readonly status: 'loading'; readonly account: null; readonly pending: null; readonly error: string | null }
  | { readonly status: 'unavailable'; readonly account: null; readonly pending: null; readonly error: string | null }
  | { readonly status: 'signed-out'; readonly account: null; readonly pending: 'sign-in' | null; readonly error: string | null }
  | { readonly status: 'signed-in'; readonly account: AccountIdentity; readonly pending: 'sign-out' | null; readonly error: string | null }

export interface AuthStore {
  start(): void
  dispose(): void
  subscribe(listener: () => void): () => void
  getSnapshot(): AuthSnapshot
  signIn(): Promise<void>
  signOut(): Promise<void>
}
