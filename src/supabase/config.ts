export interface SupabaseConfig {
  readonly url: string
  readonly publishableKey: string
}

export type ConfigResult =
  | { readonly available: true; readonly config: SupabaseConfig }
  | { readonly available: false; readonly reason: string }

export function readSupabaseConfig(env: { VITE_SUPABASE_URL?: string; VITE_SUPABASE_PUBLISHABLE_KEY?: string } = import.meta.env): ConfigResult {
  const url = env.VITE_SUPABASE_URL?.trim()
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
  if (!url || !publishableKey) return { available: false, reason: 'Supabase configuration is missing.' }
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname))) {
      return { available: false, reason: 'Supabase URL must use HTTPS.' }
    }
    if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') {
      return { available: false, reason: 'Supabase URL is malformed.' }
    }
  } catch {
    return { available: false, reason: 'Supabase URL is malformed.' }
  }
  if (!/^(sb_publishable_[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.test(publishableKey)) {
    return { available: false, reason: 'Supabase publishable key is malformed.' }
  }
  return { available: true, config: { url, publishableKey } }
}
