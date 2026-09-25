import { requireSupabase } from '../lib/supabaseClient.js'

function requireUserId(userId) {
  if (!userId) throw new Error('Sign in to access your budgets.')
}

function validateMonth(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month ?? '')) {
    throw new Error('Choose a valid budget month.')
  }
  return month + '-01'
}

function validateBudget(input) {
  const amountText = String(input.amount ?? '').trim()
  if (!/^\d+(?:\.\d{1,2})?$/.test(amountText)) {
    throw new Error('Enter a positive budget amount with no more than two decimal places.')
  }

  const amount = Number(amountText)
  if (!Number.isFinite(amount) || amount <= 0 || amount >= 10_000_000_000) {
    throw new Error('Enter a budget amount greater than zero and below 10,000,000,000.')
  }
  if (!input.categoryId) throw new Error('Choose an expense category.')

  return {
    amount: Number(amount.toFixed(2)),
    category_id: input.categoryId,
    budget_month: validateMonth(input.budgetMonth),
    category_type: 'expense',
  }
}

function readableError(error, fallback) {
  if (error?.code === '23505') return new Error('A budget already exists for this category and month.')
  if (error?.code === '23503') return new Error('Choose an expense category in your account.')
  if (error?.code === '23514') return new Error('The budget does not meet the database validation rules.')
  if (error?.code === '42501') return new Error('The database denied this action. Check that the migration is applied and you are signed in.')
  if (error?.code === 'PGRST202') {
    return new Error('SpendWise could not find the budget spending function. Apply the budget migration in Supabase, then try again.')
  }
  if (['PGRST200', 'PGRST205'].includes(error?.code)) {
    return new Error('SpendWise could not find the finance tables. Check that the database migration completed successfully.')
  }
  return new Error(fallback)
}

async function requireOwnedExpenseCategory(userId, categoryId) {
  const { data, error } = await requireSupabase()
    .from('categories')
    .select('id')
    .eq('id', categoryId)
    .eq('user_id', userId)
    .eq('type', 'expense')
    .maybeSingle()

  if (error) throw readableError(error, 'Could not verify the selected category.')
  if (!data) throw new Error('Choose an expense category in your account.')
}

export async function listBudgets(userId, month) {
  requireUserId(userId)
  const budgetMonth = validateMonth(month)
  const { data, error } = await requireSupabase()
    .from('budgets')
    .select('id,user_id,category_id,amount,budget_month,created_at,updated_at,category:categories!budgets_category_matches_owner_and_type(id,name,type)')
    .eq('user_id', userId)
    .eq('budget_month', budgetMonth)
    .order('created_at', { ascending: true })

  if (error) throw readableError(error, 'Could not load budgets. Check your connection and try again.')
  return data ?? []
}

export async function getBudgetSpending(userId, month) {
  requireUserId(userId)
  const budgetMonth = validateMonth(month)
  const { data, error } = await requireSupabase().rpc('get_budget_spending', {
    p_month_start: budgetMonth,
  })

  if (error) throw readableError(error, 'Could not load spending totals. Check your connection and try again.')
  return Object.fromEntries((data ?? []).map((row) => [row.category_id, Number(row.spent)]))
}

export async function createBudget(userId, input) {
  requireUserId(userId)
  const budget = validateBudget(input)
  await requireOwnedExpenseCategory(userId, budget.category_id)

  const { data, error } = await requireSupabase()
    .from('budgets')
    .insert({ ...budget, user_id: userId })
    .select('id')
    .single()

  if (error) throw readableError(error, 'Could not save the budget. Please try again.')
  return data
}

export async function updateBudget(userId, budgetId, input) {
  requireUserId(userId)
  if (!budgetId) throw new Error('Choose a budget to edit.')
  const budget = validateBudget(input)
  await requireOwnedExpenseCategory(userId, budget.category_id)

  const { data, error } = await requireSupabase()
    .from('budgets')
    .update(budget)
    .eq('id', budgetId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle()

  if (error) throw readableError(error, 'Could not update the budget. Please try again.')
  if (!data) throw new Error('That budget was not found in your account.')
  return data
}

export async function deleteBudget(userId, budgetId) {
  requireUserId(userId)
  if (!budgetId) throw new Error('Choose a budget to delete.')
  const { data, error } = await requireSupabase()
    .from('budgets')
    .delete()
    .eq('id', budgetId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle()

  if (error) throw readableError(error, 'Could not delete the budget. Please try again.')
  if (!data) throw new Error('That budget was not found in your account.')
}
