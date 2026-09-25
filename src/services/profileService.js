import { requireSupabase } from '../lib/supabaseClient.js'

const CURRENCIES = ['GHS', 'USD', 'EUR', 'GBP']

function requireUserId(userId) {
  if (!userId) throw new Error('Sign in to access your profile.')
}

function profileError(error) {
  if (error?.code === '42501') return new Error('The database denied this profile request. Check that the profile migration is applied and you are signed in.')
  if (error?.code === '23514') return new Error('Enter a name and choose a supported currency.')
  if (['PGRST200', 'PGRST205'].includes(error?.code)) return new Error('SpendWise could not find your profile table. Check that the database migration completed successfully.')
  return new Error('Could not save your profile. Check your connection and try again.')
}

export async function getProfile(userId) {
  requireUserId(userId)
  const { data, error } = await requireSupabase()
    .from('profiles')
    .select('id,full_name,currency')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw profileError(error)
  if (!data) throw new Error('Your profile was not found. Sign out and back in, then try again.')
  return data
}

export async function updateProfile(userId, input) {
  requireUserId(userId)
  const fullName = typeof input.fullName === 'string' ? input.fullName.trim() : ''
  if (fullName.length < 1 || fullName.length > 80) {
    throw new Error('Your name must be between 1 and 80 characters.')
  }
  if (!CURRENCIES.includes(input.currency)) throw new Error('Choose one of the supported currencies.')

  const { data, error } = await requireSupabase()
    .from('profiles')
    .update({ full_name: fullName, currency: input.currency })
    .eq('id', userId)
    .select('id,full_name,currency')
    .maybeSingle()

  if (error) throw profileError(error)
  if (!data) throw new Error('Your profile was not found. Sign out and back in, then try again.')
  return data
}
