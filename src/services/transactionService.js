import { requireSupabase } from '../lib/supabaseClient.js'

const TRANSACTION_TYPES = ['income', 'expense']
const PAGE_SIZE = 50

function requireUserId(userId) {
  if (!userId) throw new Error('Sign in to access your transactions.')
}

function validateTransaction(input) {
  if (!TRANSACTION_TYPES.includes(input.type)) {
    throw new Error('Choose whether this is income or an expense.')
  }

  const amountText = String(input.amount ?? '').trim()
  const amount = Number(amountText)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Enter an amount greater than zero.')
  }
  if ((amountText.split('.')[1] ?? '').length > 2) {
    throw new Error('Enter no more than two decimal places.')
  }
  if (amount >= 10_000_000_000) {
    throw new Error('Enter an amount below 10,000,000,000.')
  }

  const date = typeof input.transactionDate === 'string' ? input.transactionDate : ''
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? Date.parse(date + 'T00:00:00Z')
    : Number.NaN
  if (!Number.isFinite(parsedDate) || new Date(parsedDate).toISOString().slice(0, 10) !== date) {
    throw new Error('Choose a valid transaction date.')
  }

  const description = typeof input.description === 'string' ? input.description.trim() : ''
  if (description.length > 500) {
    throw new Error('Descriptions can be up to 500 characters.')
  }
  if (!input.categoryId) {
    throw new Error('Choose a category.')
  }

  return {
    type: input.type,
    amount: Number(amount.toFixed(2)),
    category_id: input.categoryId,
    description,
    transaction_date: date,
  }
}

function readableError(error, fallback) {
  if (error?.code === '23503') return new Error('Choose a category of the same type in your account.')
  if (error?.code === '23514') return new Error('The transaction does not meet the database validation rules.')
  if (error?.code === '42501') return new Error('The database denied this action. Check that the migration is applied and you are signed in.')
  if (['PGRST200', 'PGRST202', 'PGRST205'].includes(error?.code)) {
    return new Error('SpendWise could not find the finance tables. Check that the database migration completed successfully.')
  }
  return new Error(fallback)
}

async function requireOwnedCategory(userId, categoryId, type) {
  const { data, error } = await requireSupabase()
    .from('categories')
    .select('id')
    .eq('id', categoryId)
    .eq('user_id', userId)
    .eq('type', type)
    .maybeSingle()

  if (error) throw readableError(error, 'Could not verify the selected category.')
  if (!data) throw new Error('Choose a category of the same type in your account.')
}

export async function listTransactions(userId, filters = {}, offset = 0) {
  requireUserId(userId)
  if (!Number.isInteger(offset) || offset < 0) throw new Error('Invalid transaction page.')
  if (filters.fromDate && filters.toDate && filters.fromDate > filters.toDate) {
    throw new Error('The start date must be on or before the end date.')
  }

  const client = requireSupabase()
  let query = client
    .from('transactions')
    .select('id,user_id,category_id,type,amount,description,transaction_date,created_at,updated_at,category:categories!transactions_category_matches_owner_and_type(id,name,type)', { count: 'exact' })
    .eq('user_id', userId)

  if (filters.type) query = query.eq('type', filters.type)
  if (filters.categoryId) query = query.eq('category_id', filters.categoryId)
  if (filters.fromDate) query = query.gte('transaction_date', filters.fromDate)
  if (filters.toDate) query = query.lte('transaction_date', filters.toDate)

  if (filters.amount) {
    const amount = Number(filters.amount)
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Enter an amount greater than zero.')
    query = query.eq('amount', amount)
  }
  if (filters.search?.trim()) {
    query = query.ilike('description', '%' + filters.search.trim() + '%')
  }

  if (filters.sort === 'amount-high' || filters.sort === 'amount-low') {
    query = query
      .order('amount', { ascending: filters.sort === 'amount-low' })
      .order('transaction_date', { ascending: false })
  } else {
    query = query
      .order('transaction_date', { ascending: filters.sort === 'oldest' })
      .order('created_at', { ascending: filters.sort === 'oldest' })
  }

  const { data, error, count } = await query.range(offset, offset + PAGE_SIZE - 1)
  if (error) throw readableError(error, 'Could not load transactions. Check your connection and try again.')
  return { transactions: data ?? [], count: count ?? 0 }
}

export async function createTransaction(userId, input) {
  requireUserId(userId)
  const transaction = validateTransaction(input)
  await requireOwnedCategory(userId, transaction.category_id, transaction.type)

  const { data, error } = await requireSupabase()
    .from('transactions')
    .insert({ ...transaction, user_id: userId })
    .select('id,user_id,category_id,type,amount,description,transaction_date,created_at,updated_at,category:categories!transactions_category_matches_owner_and_type(id,name,type)')
    .single()

  if (error) throw readableError(error, 'Could not save the transaction. Please try again.')
  return data
}

export async function updateTransaction(userId, transactionId, input) {
  requireUserId(userId)
  if (!transactionId) throw new Error('Choose a transaction to edit.')
  const transaction = validateTransaction(input)
  await requireOwnedCategory(userId, transaction.category_id, transaction.type)

  const { data, error } = await requireSupabase()
    .from('transactions')
    .update(transaction)
    .eq('id', transactionId)
    .eq('user_id', userId)
    .select('id,user_id,category_id,type,amount,description,transaction_date,created_at,updated_at,category:categories!transactions_category_matches_owner_and_type(id,name,type)')
    .single()

  if (error) throw readableError(error, 'Could not update the transaction. Please try again.')
  return data
}

export async function deleteTransaction(userId, transactionId) {
  requireUserId(userId)
  if (!transactionId) throw new Error('Choose a transaction to delete.')
  const { data, error } = await requireSupabase()
    .from('transactions')
    .delete()
    .eq('id', transactionId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle()

  if (error) throw readableError(error, 'Could not delete the transaction. Please try again.')
  if (!data) throw new Error('That transaction was not found in your account.')
}

export const TRANSACTION_PAGE_SIZE = PAGE_SIZE
