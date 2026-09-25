import { requireSupabase } from '../lib/supabaseClient.js'

export async function listCategories(userId, type) {
  if (!userId) throw new Error('Sign in to access your categories.')
  if (type && !['income', 'expense'].includes(type)) throw new Error('Choose income or expense for this category.')

  let query = requireSupabase()
    .from('categories')
    .select('id,user_id,name,type,created_at,updated_at')
    .eq('user_id', userId)
    .order('type', { ascending: true })
    .order('name', { ascending: true })

  if (type) query = query.eq('type', type)
  const { data, error } = await query

  if (error) {
    if (error.code === '42501') throw new Error('The database denied this request. Check that the migration is applied and you are signed in.')
    throw new Error('Could not load categories. Check your connection and try again.')
  }
  return data ?? []
}
