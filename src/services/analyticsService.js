import { requireSupabase } from '../lib/supabaseClient.js'

function requireUserId(userId) {
  if (!userId) throw new Error('Sign in to view your financial reports.')
}

function monthStart(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month ?? '')) {
    throw new Error('Choose a valid report month.')
  }
  return month + '-01'
}

function reportError(error, fallback) {
  if (error?.code === 'PGRST202') {
    return new Error('SpendWise could not find the reporting functions. Apply the reporting migration in Supabase, then try again.')
  }
  if (error?.code === '42501') return new Error('The database denied this report. Check that you are signed in and the migrations are applied.')
  return new Error(fallback)
}

async function callReport(userId, name, args, fallback) {
  requireUserId(userId)
  const { data, error } = await requireSupabase().rpc(name, args)
  if (error) throw reportError(error, fallback)
  return data ?? []
}

export async function getFinancialTotals(userId, month) {
  const rows = await callReport(
    userId,
    'get_financial_totals',
    { p_month_start: monthStart(month) },
    'Could not load your financial totals.',
  )
  const totals = rows[0] ?? {}
  return {
    totalIncome: Number(totals.total_income ?? 0),
    totalExpenses: Number(totals.total_expenses ?? 0),
    monthIncome: Number(totals.month_income ?? 0),
    monthExpenses: Number(totals.month_expenses ?? 0),
  }
}

export async function getMonthlyCashflow(userId, month, monthCount = 6) {
  const rows = await callReport(
    userId,
    'get_monthly_cashflow',
    { p_month_start: monthStart(month), p_month_count: monthCount },
    'Could not load your monthly trend.',
  )
  return rows.map((row) => ({
    month: row.month_start,
    income: Number(row.income ?? 0),
    expenses: Number(row.expenses ?? 0),
  }))
}

export async function getCategorySpending(userId, month) {
  const rows = await callReport(
    userId,
    'get_category_spending',
    { p_month_start: monthStart(month) },
    'Could not load your category totals.',
  )
  return rows.map((row) => ({
    categoryId: row.category_id,
    categoryName: row.category_name,
    spent: Number(row.spent ?? 0),
  }))
}

export async function getDailySpending(userId, month) {
  const rows = await callReport(
    userId,
    'get_daily_spending',
    { p_month_start: monthStart(month) },
    'Could not load your daily spending.',
  )
  return rows.map((row) => ({ date: row.transaction_date, spent: Number(row.spent ?? 0) }))
}

export async function getLargestExpenses(userId, month, limit = 5) {
  const rows = await callReport(
    userId,
    'get_largest_expenses',
    { p_month_start: monthStart(month), p_limit: limit },
    'Could not load your largest expenses.',
  )
  return rows.map((row) => ({
    id: row.transaction_id,
    date: row.transaction_date,
    description: row.description,
    amount: Number(row.amount ?? 0),
    category: row.category_name,
  }))
}

export async function listRecentTransactions(userId, limit = 5) {
  requireUserId(userId)
  const { data, error } = await requireSupabase()
    .from('transactions')
    .select('id,type,amount,description,transaction_date,category:categories!transactions_category_matches_owner_and_type(id,name,type)')
    .eq('user_id', userId)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    if (error.code === '42501') throw reportError(error, 'Could not load recent transactions.')
    throw new Error('Could not load recent transactions. Check your connection and try again.')
  }
  return data ?? []
}
