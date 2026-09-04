import { createClient } from '@supabase/supabase-js'

// Built from the caller's own access token (not the service role key), so every
// query runs as that user and Postgres RLS enforces per-user isolation for us.
export function supabaseForToken(accessToken: string) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
