-- SpendWise initial schema
-- Application records are owned by the Supabase Auth user that created them.

create schema if not exists spendwise_private;
revoke all on schema spendwise_private from public;
revoke all on schema spendwise_private from anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default 'SpendWise user',
  currency text not null default 'GHS',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_full_name_length check (
    char_length(btrim(full_name)) between 1 and 80
  ),
  constraint profiles_currency_supported check (
    currency in ('GHS', 'USD', 'EUR', 'GBP')
  )
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  type text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_type_valid check (type in ('income', 'expense')),
  constraint categories_name_length check (
    char_length(btrim(name)) between 1 and 60
  ),
  constraint categories_owner_identity_type_unique unique (user_id, id, type)
);

create unique index categories_user_type_name_ci_key
  on public.categories (user_id, type, lower(btrim(name)));

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id uuid not null,
  type text not null,
  amount numeric(12, 2) not null,
  description text not null default '',
  transaction_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transactions_type_valid check (type in ('income', 'expense')),
  constraint transactions_amount_positive check (amount > 0),
  constraint transactions_description_length check (char_length(description) <= 500),
  constraint transactions_category_matches_owner_and_type
    foreign key (user_id, category_id, type)
    references public.categories (user_id, id, type)
    on delete no action
);

create index transactions_user_date_idx
  on public.transactions (user_id, transaction_date desc, created_at desc);

create index transactions_category_owner_type_idx
  on public.transactions (user_id, category_id, type);

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id uuid not null,
  amount numeric(12, 2) not null,
  budget_month date not null,
  category_type text not null default 'expense',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budgets_amount_positive check (amount > 0),
  constraint budgets_month_starts_on_first check (extract(day from budget_month) = 1),
  constraint budgets_only_expense_categories check (category_type = 'expense'),
  constraint budgets_category_matches_owner_and_type
    foreign key (user_id, category_id, category_type)
    references public.categories (user_id, id, type)
    on delete no action,
  constraint budgets_user_category_month_unique unique (user_id, category_id, budget_month)
);

create index budgets_user_month_idx
  on public.budgets (user_id, budget_month desc);

create index budgets_category_owner_type_idx
  on public.budgets (user_id, category_id, category_type);

create or replace function spendwise_private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.updated_at = statement_timestamp();
  return new;
end;
$function$;

revoke all on function spendwise_private.set_updated_at() from public, anon, authenticated;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function spendwise_private.set_updated_at();

create trigger categories_set_updated_at
before update on public.categories
for each row execute function spendwise_private.set_updated_at();

create trigger transactions_set_updated_at
before update on public.transactions
for each row execute function spendwise_private.set_updated_at();

create trigger budgets_set_updated_at
before update on public.budgets
for each row execute function spendwise_private.set_updated_at();

create or replace function spendwise_private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  new_full_name text;
begin
  new_full_name := left(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), 80);

  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new_full_name, 'SpendWise user'))
  on conflict (id) do nothing;

  insert into public.categories (user_id, name, type)
  values
    (new.id, 'Food', 'expense'),
    (new.id, 'Transport', 'expense'),
    (new.id, 'Bills', 'expense'),
    (new.id, 'Shopping', 'expense'),
    (new.id, 'Entertainment', 'expense'),
    (new.id, 'Education', 'expense'),
    (new.id, 'Health', 'expense'),
    (new.id, 'Housing', 'expense'),
    (new.id, 'Other', 'expense'),
    (new.id, 'Salary', 'income'),
    (new.id, 'Freelance', 'income'),
    (new.id, 'Other Income', 'income')
  on conflict do nothing;

  return new;
end;
$function$;

revoke all on function spendwise_private.handle_new_auth_user() from public, anon, authenticated;

create trigger on_auth_user_created_spendwise
after insert on auth.users
for each row execute function spendwise_private.handle_new_auth_user();

-- Backfill accounts created before this migration was applied.
insert into public.profiles (id, full_name)
select
  users.id,
  coalesce(left(nullif(btrim(users.raw_user_meta_data ->> 'full_name'), ''), 80), 'SpendWise user')
from auth.users as users
on conflict (id) do nothing;

insert into public.categories (user_id, name, type)
select users.id, defaults.name, defaults.type
from auth.users as users
cross join (
  values
    ('Food', 'expense'),
    ('Transport', 'expense'),
    ('Bills', 'expense'),
    ('Shopping', 'expense'),
    ('Entertainment', 'expense'),
    ('Education', 'expense'),
    ('Health', 'expense'),
    ('Housing', 'expense'),
    ('Other', 'expense'),
    ('Salary', 'income'),
    ('Freelance', 'income'),
    ('Other Income', 'income')
) as defaults(name, type)
on conflict do nothing;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;

-- Supabase projects may grant table access to these roles by default. Set the
-- grants explicitly as well as using RLS policies.
revoke all on table public.profiles, public.categories, public.transactions, public.budgets
  from anon, authenticated;

grant select on table public.profiles to authenticated;
grant update (full_name, currency) on table public.profiles to authenticated;
grant select, insert, update, delete on table public.categories to authenticated;
grant select, insert, update, delete on table public.transactions to authenticated;
grant select, insert, update, delete on table public.budgets to authenticated;

create policy profiles_select_own
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy profiles_update_own
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy categories_select_own
  on public.categories for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy categories_insert_own
  on public.categories for insert to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy categories_update_own
  on public.categories for update to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy categories_delete_own
  on public.categories for delete to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy transactions_select_own
  on public.transactions for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy transactions_insert_own
  on public.transactions for insert to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy transactions_update_own
  on public.transactions for update to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy transactions_delete_own
  on public.transactions for delete to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy budgets_select_own
  on public.budgets for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy budgets_insert_own
  on public.budgets for insert to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy budgets_update_own
  on public.budgets for update to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy budgets_delete_own
  on public.budgets for delete to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
