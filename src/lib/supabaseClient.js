import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? ''

let validUrl = false
if (supabaseUrl) {
  try {
    const parsedUrl = new URL(supabaseUrl)
    validUrl = parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:'
  } catch {
    validUrl = false
  }
}

export const supabaseConfigError = !supabaseUrl
  ? 'VITE_SUPABASE_URL is missing.'
  : !supabasePublishableKey
    ? 'VITE_SUPABASE_PUBLISHABLE_KEY is missing.'
    : !validUrl
      ? 'VITE_SUPABASE_URL must be a valid HTTP or HTTPS URL.'
      : null

export const isSupabaseConfigured = supabaseConfigError === null

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey)
  : null

export function requireSupabase() {
  if (!supabase) {
    throw new Error(supabaseConfigError ?? 'Supabase is not configured.')
  }

  return supabase
}
