import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { AccountIdentity, AuthAdapter, AuthEvent } from '../contracts/account'
import type { Database } from './database.types'

function identity(user: User | null | undefined): AccountIdentity | null {
  if (!user) return null
  const name = user.user_metadata?.full_name ?? user.user_metadata?.name
  return { id: user.id, email: user.email ?? null, name: typeof name === 'string' ? name : null }
}

export function createSupabaseAuthAdapter(client: SupabaseClient<Database>): AuthAdapter {
  return {
    async getSession() {
      const { data, error } = await client.auth.getSession()
      if (error) throw new Error(error.message)
      return identity(data.session?.user)
    },
    onAuthStateChange(listener) {
      const { data } = client.auth.onAuthStateChange((event, session) => {
        if (['INITIAL_SESSION', 'SIGNED_IN', 'SIGNED_OUT', 'TOKEN_REFRESHED', 'USER_UPDATED'].includes(event)) {
          listener(event as AuthEvent, identity(session?.user))
        }
      })
      return () => data.subscription.unsubscribe()
    },
    async signInWithGoogle(redirectTo) {
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
      return error ? { error: error.message } : {}
    },
    async signOutLocal() {
      const { error } = await client.auth.signOut({ scope: 'local' })
      return error ? { error: error.message } : {}
    },
  }
}
