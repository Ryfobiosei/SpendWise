import { requireSupabase } from '../lib/supabaseClient.js'

const CATEGORY_TYPES = ['income', 'expense']

function validateCategory(input) {
  const name = typeof input?.name === 'string' ? input.name.trim() : ''
  if (name.length < 1 || name.length > 60) {
    throw new Error('Category names must be between 1 and 60 characters.')
  }
  if (!CATEGORY_TYPES.includes(input?.type)) {
    throw new Error('Choose income or expense for this category.')
  }
  return { name, type: input.type }
}

function readableError(error, fallback) {
  if (error?.code === '23505') return new Error('A category with that name already exists for this type.')
  if (error?.code === '23503') return new Error('This category is still used by a transaction or budget, so it cannot be deleted or retyped yet.')
  if (error?.code === '23514') return new Error('The category name or type does not meet the database rules.')
  if (error?.code === '42501') return new Error('The database denied this action. Check that the migration is applied and you are signed in.')
  return new Error(fallback)
}

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

export async function createCategory(userId, input) {
  if (!userId) throw new Error('Sign in to create a category.')
  const category = validateCategory(input)
  const { data, error } = await requireSupabase()
    .from('categories')
    .insert({ ...category, user_id: userId })
    .select('id,user_id,name,type,created_at,updated_at')
    .single()

  if (error) throw readableError(error, 'Could not create the category. Please try again.')
  return data
}

export async function updateCategory(userId, categoryId, input) {
  if (!userId) throw new Error('Sign in to update a category.')
  if (!categoryId) throw new Error('Choose a category to edit.')
  const category = validateCategory(input)
  const { data, error } = await requireSupabase()
    .from('categories')
    .update(category)
    .eq('id', categoryId)
    .eq('user_id', userId)
    .select('id,user_id,name,type,created_at,updated_at')
    .single()

  if (error) throw readableError(error, 'Could not update the category. Please try again.')
  return data
}

export async function deleteCategory(userId, categoryId) {
  if (!userId) throw new Error('Sign in to delete a category.')
  if (!categoryId) throw new Error('Choose a category to delete.')
  const { data, error } = await requireSupabase()
    .from('categories')
    .delete()
    .eq('id', categoryId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle()

  if (error) throw readableError(error, 'Could not delete the category. Please try again.')
  if (!data) throw new Error('That category was not found in your account.')
}
