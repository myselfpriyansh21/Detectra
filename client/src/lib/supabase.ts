import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

function looksLikeRealSupabaseUrl(v?: string) {
  return !!v && /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(v.trim())
}
function looksLikeRealAnonKey(v?: string) {
  // Supabase anon keys are JWTs — they always start with "eyJ".
  return !!v && v.trim().startsWith('eyJ') && v.trim().length > 40
}

// The platform runs fully on synthetic/demo data out of the box (see
// AuthContext + syntheticData) so it always demos even without a live
// Supabase project. A blank, missing, or placeholder .env is treated as
// "not configured" rather than silently breaking auth — real credentials
// must actually look like a Supabase URL + JWT anon key to switch modes.
export const supabaseConfigured = looksLikeRealSupabaseUrl(url) && looksLikeRealAnonKey(anonKey)

export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(url as string, anonKey as string)
  : null
