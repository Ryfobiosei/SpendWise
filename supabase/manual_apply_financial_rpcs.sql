-- SpendWise budget and reporting RPC setup
-- Safe to re-run: functions are created or replaced, and the index uses IF NOT EXISTS.
-- Run this whole script in the SQL Editor for the Supabase project used by SpendWise.

-- Aggregate one user's expense totals per category for a selected month.
-- SECURITY INVOKER keeps the caller's RLS policies in force.
create or replace function public.get_budget_spending(p_month_start date)
returns table (category_id uuid, spent numeric)
language sql
stable
security invoker
set search_path = ''
as $function$
  select
    transactions.category_id,
    sum(transactions.amount)::numeric as spent
  from public.transactions as transactions
  where transactions.user_id = (select auth.uid())
    and transactions.type = 'expense'
    and transactions.transaction_date >= p_month_start
    and transactions.transaction_date < (p_month_start + interval '1 month')::date
  group by transactions.category_id;
$function$;

revoke all on function public.get_budget_spending(date) from public, anon;
grant execute on function public.get_budget_spending(date) to authenticated;


-- Reporting queries run as the caller, so row-level security remains active.
create index if not exists transactions_user_type_date_idx
  on public.transactions (user_id, type, transaction_date desc);

create or replace function public.get_financial_totals(p_month_start date)
returns table (
  total_income numeric,
  total_expenses numeric,
  month_income numeric,
  month_expenses numeric
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select
    coalesce(sum(transactions.amount) filter (where transactions.type = 'income'), 0)::numeric,
    coalesce(sum(transactions.amount) filter (where transactions.type = 'expense'), 0)::numeric,
    coalesce(sum(transactions.amount) filter (
      where transactions.type = 'income'
        and transactions.transaction_date >= p_month_start
        and transactions.transaction_date < (p_month_start + interval '1 month')::date
    ), 0)::numeric,
    coalesce(sum(transactions.amount) filter (
      where transactions.type = 'expense'
        and transactions.transaction_date >= p_month_start
        and transactions.transaction_date < (p_month_start + interval '1 month')::date
    ), 0)::numeric
  from public.transactions as transactions
  where transactions.user_id = (select auth.uid());
$function$;

create or replace function public.get_monthly_cashflow(p_month_start date, p_month_count integer default 6)
returns table (month_start date, income numeric, expenses numeric)
language sql
stable
security invoker
set search_path = ''
as $function$
  with months as (
    select generate_series(
      p_month_start - ((least(greatest(p_month_count, 1), 24) - 1) * interval '1 month'),
      p_month_start,
      interval '1 month'
    )::date as month_start
  )
  select
    months.month_start,
    coalesce(sum(transactions.amount) filter (where transactions.type = 'income'), 0)::numeric as income,
    coalesce(sum(transactions.amount) filter (where transactions.type = 'expense'), 0)::numeric as expenses
  from months
  left join public.transactions as transactions
    on transactions.user_id = (select auth.uid())
    and transactions.transaction_date >= months.month_start
    and transactions.transaction_date < (months.month_start + interval '1 month')::date
  group by months.month_start
  order by months.month_start;
$function$;

create or replace function public.get_category_spending(p_month_start date)
returns table (category_id uuid, category_name text, spent numeric)
language sql
stable
security invoker
set search_path = ''
as $function$
  select
    transactions.category_id,
    categories.name,
    sum(transactions.amount)::numeric as spent
  from public.transactions as transactions
  join public.categories as categories
    on categories.id = transactions.category_id
    and categories.user_id = transactions.user_id
  where transactions.user_id = (select auth.uid())
    and transactions.type = 'expense'
    and transactions.transaction_date >= p_month_start
    and transactions.transaction_date < (p_month_start + interval '1 month')::date
  group by transactions.category_id, categories.name
  order by sum(transactions.amount) desc, categories.name;
$function$;

create or replace function public.get_daily_spending(p_month_start date)
returns table (transaction_date date, spent numeric)
language sql
stable
security invoker
set search_path = ''
as $function$
  select
    transactions.transaction_date,
    sum(transactions.amount)::numeric as spent
  from public.transactions as transactions
  where transactions.user_id = (select auth.uid())
    and transactions.type = 'expense'
    and transactions.transaction_date >= p_month_start
    and transactions.transaction_date < (p_month_start + interval '1 month')::date
  group by transactions.transaction_date
  order by transactions.transaction_date;
$function$;

create or replace function public.get_largest_expenses(p_month_start date, p_limit integer default 5)
returns table (
  transaction_id uuid,
  transaction_date date,
  description text,
  amount numeric,
  category_name text
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select
    transactions.id,
    transactions.transaction_date,
    transactions.description,
    transactions.amount,
    categories.name
  from public.transactions as transactions
  join public.categories as categories
    on categories.id = transactions.category_id
    and categories.user_id = transactions.user_id
  where transactions.user_id = (select auth.uid())
    and transactions.type = 'expense'
    and transactions.transaction_date >= p_month_start
    and transactions.transaction_date < (p_month_start + interval '1 month')::date
  order by transactions.amount desc, transactions.transaction_date desc, transactions.created_at desc
  limit least(greatest(p_limit, 1), 10);
$function$;

revoke all on function public.get_financial_totals(date) from public, anon;
revoke all on function public.get_monthly_cashflow(date, integer) from public, anon;
revoke all on function public.get_category_spending(date) from public, anon;
revoke all on function public.get_daily_spending(date) from public, anon;
revoke all on function public.get_largest_expenses(date, integer) from public, anon;

grant execute on function public.get_financial_totals(date) to authenticated;
grant execute on function public.get_monthly_cashflow(date, integer) to authenticated;
grant execute on function public.get_category_spending(date) to authenticated;
grant execute on function public.get_daily_spending(date) to authenticated;
grant execute on function public.get_largest_expenses(date, integer) to authenticated;

