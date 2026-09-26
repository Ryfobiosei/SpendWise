import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfigError = (!url || !publishableKey)
  ? 'Missing Expo Supabase settings.'
  : '';

export const supabase = createClient(
  url || 'https://example.supabase.co',
  publishableKey || 'missing-publishable-key',
  {
    auth: {
      storage: localStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
