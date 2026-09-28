import { readSupabaseConfig } from '../src/supabase/config.ts'

const result = readSupabaseConfig(process.env)
if (!result.available) {
  console.error(result.reason)
  process.exitCode = 1
}
