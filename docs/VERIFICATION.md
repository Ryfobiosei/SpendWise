# SpendWise verification checklist

Run this checklist after the application work is complete. Use a development Supabase project and test accounts with sample data. Do not use real financial information.

## 1. Apply database functions

The initial tables, RLS policies, and starter categories were applied earlier. In Supabase Studio, open **SQL Editor** and run these migrations in order:

1. Copy all of `supabase/migrations/20260925150000_budget_spending_rpc.sql`, paste it into a new query, and run it.
2. Copy all of `supabase/migrations/20260925160000_financial_reporting_rpc.sql`, paste it into a new query, and run it.

The budget page and report pages call these functions. A missing function is shown as a setup error in the app.

## 2. Start the application

1. Confirm `.env.local` contains the correct Supabase URL and publishable key. Do not paste those values into chat or commit them.
2. In Supabase Auth URL configuration, allow the local return URL pattern, for example `http://127.0.0.1:5173/**`.
3. In a terminal opened at the project folder, run `npm run dev`.
4. Open the local URL printed by Vite and create a test account. Confirm the email first if Supabase Auth requires it.

## 3. Account and access

- Sign out, then open `/dashboard`, `/dashboard/transactions`, `/dashboard/categories`, `/dashboard/budgets`, `/dashboard/analytics`, and `/dashboard/settings` directly. Each should send you to sign-in.
- Sign in, refresh the page, and confirm the session remains active. Sign out and confirm protected URLs no longer open.
- Request a password reset, open the email link, set a new password, and sign in with it.
- In Settings, request an email change and confirm it through the email Supabase sends. Change a password from Settings as well.

## 4. Transactions and categories

- Add income and an expense with different categories. Confirm they appear with correct signs and formatted amounts.
- Try zero, a negative amount, more than two decimal places, a mismatched category type, and an invalid date. Each must be rejected.
- Edit a transaction and confirm the editor opens at the form. Search by description, filter by type/category/date/amount, change sort order, load more, and delete a transaction.
- Add, rename, search, filter, and delete an unused category. Confirm Edit scrolls to the form and focuses the name field.
- Try deleting or retyping a category used by a transaction or budget. The operation should be blocked with a clear message.

## 5. Budgets and calculations

- Create a monthly budget for an expense category. Create an expense dated inside that month and confirm the spent, remaining, and percentage values update.
- Add an expense that exceeds the limit and confirm the over-budget amount and progress color update without exceeding the bar width.
- Attempt a second budget for the same category/month. It should be rejected. A different month or category should be allowed.
- Change the month, edit a budget, then delete it. Confirm the selected month's figures refresh.
- Change preferred currency in Settings and confirm displayed values update on the dashboard, transactions, budgets, and analytics.

## 6. Dashboard and analytics

- With mixed income and expenses, confirm the all-time balance equals total income minus total expenses and month net equals this month's income minus expenses.
- Confirm recent transactions and the six-month chart use the saved records.
- Check category totals, daily totals, largest expenses, and budget usage against the transaction list for a selected month.
- Add activity in a prior month and compare it with the current month. Confirm any increase insight is derived from those values.
- Check weekend spending, near-limit budgets, and over-limit budgets. Insights should only appear when enough real data exists.
- Check an empty account, income-only account, expense-only account, and negative-net month. No page should show sample financial figures or divide-by-zero errors.

## 7. User isolation

1. Create a second test account in a separate browser profile or private window.
2. Add categories, transactions, and budgets in the first account.
3. Sign in as the second account. It should see only its own starter categories and records; the first account's data must not appear in lists, totals, charts, or insights.
4. Check Supabase table policies for `profiles`, `categories`, `transactions`, and `budgets`. RLS must remain enabled.

## 8. Responsive and production review

- Inspect the landing page and every workspace route at desktop, tablet, and narrow mobile widths. Confirm navigation remains reachable, cards stack cleanly, forms fit, and tables scroll horizontally where needed.
- Run `npm run lint` and `npm run build`; both should finish without errors.
- Preview the production build with `npm run preview` and open nested routes directly to confirm host rewrites work after deployment.
- In the browser console, check for unhandled errors. Confirm `.env.local` is not tracked and no secret/service-role key appears in the built assets or repository.
