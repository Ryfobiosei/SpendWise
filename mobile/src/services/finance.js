import { supabase } from '../lib/supabase';

const PAGE_SIZE = 50;
const requireUser = (userId) => { if (!userId) throw new Error('Sign in to access your finances.'); };
const monthStart = (month) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month || '')) throw new Error('Choose a valid month.');
  return `${month}-01`;
};
const amountValue = (value, label = 'amount') => {
  const text = String(value ?? '').trim();
  const amount = Number(text);
  if (!/^\d+(?:\.\d{1,2})?$/.test(text) || !Number.isFinite(amount) || amount <= 0 || amount >= 10_000_000_000) {
    throw new Error(`Enter a ${label} greater than zero with up to two decimal places.`);
  }
  return Number(amount.toFixed(2));
};
const raise = (error, fallback) => {
  if (error?.code === '23505') throw new Error('That item already exists.');
  if (error?.code === '23503') throw new Error('Choose a category belonging to your account with the matching type.');
  if (error?.code === '42501') throw new Error('The database denied this action. Confirm the Supabase migrations and sign-in.');
  if (error?.code === 'PGRST202') throw new Error('A required reporting function is missing. Apply the SpendWise SQL migrations in Supabase.');
  throw new Error(fallback || error?.message || 'Something went wrong.');
};

export async function listCategories(userId) {
  requireUser(userId);
  const { data, error } = await supabase.from('categories').select('id,user_id,name,type,created_at,updated_at').eq('user_id', userId).order('type').order('name');
  if (error) raise(error, 'Could not load categories.');
  return data || [];
}

export async function createCategory(userId, input) {
  requireUser(userId);
  const name = input?.name?.trim();
  if (!name || name.length > 60 || !['expense', 'income'].includes(input.type)) throw new Error('Enter a category name up to 60 characters and choose a type.');
  const { data, error } = await supabase.from('categories').insert({ user_id: userId, name, type: input.type }).select('id').single();
  if (error) raise(error, 'Could not create the category.');
  return data;
}
export async function updateCategory(userId, id, input) {
  requireUser(userId);
  const name = input?.name?.trim();
  if (!id || !name || name.length > 60 || !['expense', 'income'].includes(input.type)) throw new Error('Enter a category name up to 60 characters and choose a type.');
  const { data, error } = await supabase.from('categories').update({ name, type: input.type }).eq('id', id).eq('user_id', userId).select('id').single();
  if (error) raise(error, 'Could not update the category.');
  return data;
}
export async function deleteCategory(userId, id) {
  requireUser(userId);
  const { data, error } = await supabase.from('categories').delete().eq('id', id).eq('user_id', userId).select('id').maybeSingle();
  if (error) raise(error, 'Category is still used by an item, so it cannot be deleted.');
  if (!data) throw new Error('That category was not found in your account.');
}

export async function listTransactions(userId, filters = {}, offset = 0) {
  requireUser(userId);
  let query = supabase.from('transactions').select('id,user_id,category_id,type,amount,description,transaction_date,created_at,updated_at,category:categories!transactions_category_matches_owner_and_type(id,name,type)', { count: 'exact' }).eq('user_id', userId).order('transaction_date', { ascending: false }).order('created_at', { ascending: false });
  if (filters.type) query = query.eq('type', filters.type);
  const { data, count, error } = await query.range(offset, offset + PAGE_SIZE - 1);
  if (error) raise(error, 'Could not load transactions.');
  return { transactions: data || [], count: count || 0 };
}
function transactionPayload(input) {
  const date = input?.transactionDate;
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? new Date(`${date}T00:00:00Z`) : null;
  if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new Error('Enter a valid date as YYYY-MM-DD.');
  if (!['expense', 'income'].includes(input.type)) throw new Error('Choose income or expense.');
  if (!input.categoryId) throw new Error('Choose a category.');
  const description = String(input.description || '').trim();
  if (description.length > 500) throw new Error('Descriptions can be up to 500 characters.');
  return { type: input.type, amount: amountValue(input.amount), category_id: input.categoryId, description, transaction_date: date };
}
export async function createTransaction(userId, input) {
  requireUser(userId);
  const { data, error } = await supabase.from('transactions').insert({ ...transactionPayload(input), user_id: userId }).select('id').single();
  if (error) raise(error, 'Could not save the transaction.');
  return data;
}
export async function updateTransaction(userId, id, input) {
  requireUser(userId);
  const { data, error } = await supabase.from('transactions').update(transactionPayload(input)).eq('id', id).eq('user_id', userId).select('id').single();
  if (error) raise(error, 'Could not update the transaction.');
  return data;
}
export async function deleteTransaction(userId, id) {
  requireUser(userId);
  const { data, error } = await supabase.from('transactions').delete().eq('id', id).eq('user_id', userId).select('id').maybeSingle();
  if (error) raise(error, 'Could not delete the transaction.');
  if (!data) throw new Error('That transaction was not found in your account.');
}

export async function listBudgets(userId, month) {
  requireUser(userId);
  const { data, error } = await supabase.from('budgets').select('id,user_id,category_id,amount,budget_month,created_at,updated_at,category:categories!budgets_category_matches_owner_and_type(id,name,type)').eq('user_id', userId).eq('budget_month', monthStart(month)).order('created_at');
  if (error) raise(error, 'Could not load budgets.');
  return data || [];
}
export async function getBudgetSpending(userId, month) {
  requireUser(userId);
  const { data, error } = await supabase.rpc('get_budget_spending', { p_month_start: monthStart(month) });
  if (error) raise(error, 'Could not load budget spending.');
  return Object.fromEntries((data || []).map((row) => [row.category_id, Number(row.spent)]));
}
function budgetPayload(input) {
  if (!input.categoryId) throw new Error('Choose an expense category.');
  return { amount: amountValue(input.amount, 'budget amount'), category_id: input.categoryId, budget_month: monthStart(input.budgetMonth), category_type: 'expense' };
}
export async function createBudget(userId, input) {
  requireUser(userId);
  const { data, error } = await supabase.from('budgets').insert({ ...budgetPayload(input), user_id: userId }).select('id').single();
  if (error) raise(error, 'Could not save the budget.');
  return data;
}
export async function updateBudget(userId, id, input) {
  requireUser(userId);
  const { data, error } = await supabase.from('budgets').update(budgetPayload(input)).eq('id', id).eq('user_id', userId).select('id').single();
  if (error) raise(error, 'Could not update the budget.');
  return data;
}
export async function deleteBudget(userId, id) {
  requireUser(userId);
  const { data, error } = await supabase.from('budgets').delete().eq('id', id).eq('user_id', userId).select('id').maybeSingle();
  if (error) raise(error, 'Could not delete the budget.');
  if (!data) throw new Error('That budget was not found in your account.');
}

async function report(userId, name, args) {
  requireUser(userId);
  const { data, error } = await supabase.rpc(name, args);
  if (error) raise(error, `Could not load ${name.replaceAll('_', ' ')}.`);
  return data || [];
}
export async function getFinancialTotals(userId, month) {
  const rows = await report(userId, 'get_financial_totals', { p_month_start: monthStart(month) });
  const row = rows[0] || {};
  return { totalIncome: Number(row.total_income || 0), totalExpenses: Number(row.total_expenses || 0), monthIncome: Number(row.month_income || 0), monthExpenses: Number(row.month_expenses || 0) };
}
export async function getMonthlyCashflow(userId, month, count = 6) {
  const rows = await report(userId, 'get_monthly_cashflow', { p_month_start: monthStart(month), p_month_count: count });
  return rows.map((r) => ({ month: r.month_start, income: Number(r.income || 0), expenses: Number(r.expenses || 0) }));
}
export async function getLargestExpenses(userId, month) {
  const rows = await report(userId, 'get_largest_expenses', { p_month_start: monthStart(month), p_limit: 5 });
  return rows.map((r) => ({ id: r.transaction_id, date: r.transaction_date, description: r.description, amount: Number(r.amount || 0), category: r.category_name }));
}
export async function listRecentTransactions(userId) {
  requireUser(userId);
  const { data, error } = await supabase.from('transactions').select('id,type,amount,description,transaction_date,category:categories!transactions_category_matches_owner_and_type(id,name,type)').eq('user_id', userId).order('transaction_date', { ascending: false }).order('created_at', { ascending: false }).limit(5);
  if (error) raise(error, 'Could not load recent transactions.');
  return data || [];
}
