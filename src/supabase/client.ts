import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import type { SupabaseConfig } from './config'

export function createBrowserSupabaseClient(config: SupabaseConfig): SupabaseClient<Database> {
  return createClient<Database>(config.url, config.publishableKey, {
    auth: {
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
}
