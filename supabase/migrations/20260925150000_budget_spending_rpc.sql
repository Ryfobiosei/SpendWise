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
