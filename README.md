# SpendWise

SpendWise is a responsive personal finance application built with React, JavaScript, Vite, React Router, CSS, and Supabase. It helps people record income and expenses, organize transactions, plan category budgets, and review their financial patterns.

## Features

- Supabase email and password registration, resendable email confirmation returning to the signed-in dashboard, sign-in, sign-out, password recovery, and password changes.
- Protected workspace routes that wait for Supabase session initialization.
- User-owned profiles, categories, transactions, and monthly budgets, protected with Row Level Security.
- Transaction create, edit, delete, search, filters, sorting, pagination, validation, and useful empty/loading/error states.
- Category create, edit, search, and delete, with database protection for categories used by financial records.
- Monthly expense budgets with progress, remaining or overspent amounts, month selection, and database-enforced duplicate prevention.
- Dashboard summary, recent transactions, six-month cash-flow chart, budget progress, and deterministic insights.
- Analytics for monthly cash flow, category spending, daily spending, largest expenses, budget usage, and data-based insights.
- Profile name and currency settings, email change confirmation, and password change/reset flows.
- Currency formatting for Ghanaian cedi, US dollar, euro, and British pound.
- Mobile-friendly layouts and direct links to each workspace area.

## Technology and architecture

- **Frontend:** React 19, JavaScript, Vite, React Router, and CSS.
- **Authentication and database:** Supabase Auth and Postgres.
- **Authorization:** Row Level Security on every application table. Browser requests use the signed-in user's access token and the public publishable key.
- **Data access:** `src/services` contains validation and Supabase queries. Reporting totals are grouped in Postgres functions that run as the caller, so table RLS remains active and large transaction histories are not downloaded for charts.
- **Presentation:** Route pages are lazy-loaded. Reusable reporting visuals live in `src/components/dashboard`.

Passwords remain with Supabase Auth. No password fields are stored in the SpendWise tables. Never put a Supabase secret or service-role key in browser code or a `VITE_` variable.

## Requirements

- Node.js 20.19+ or 22.12+
- npm
- A Supabase project

## Local setup

```sh
npm install
```

Copy `.env.example` to `.env.local` and fill in the Supabase project URL and publishable key:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

`.env.local` is ignored by Git. Restart the Vite server after changing it.

Start the app:

```sh
npm run dev
```

Vite prints a local URL, usually `http://localhost:5173`. In Supabase Auth URL settings, set the Site URL for the environment and add the local redirect patterns you use, such as `http://127.0.0.1:5173/**` and `http://localhost:5173/**`. The wildcard allows the confirmation, password-reset, and email-change paths to return to the app.

After signup, the email confirmation redirects to `/auth/callback`. The Supabase browser client restores the confirmed session there and SpendWise opens the authenticated dashboard.

The built-in Supabase email sender is for testing only: it is limited to project team addresses and a very low hourly rate. Before public deployment, configure a custom SMTP provider and a verified sender domain in Supabase Auth settings. Delivery limits then depend on both Supabase and the selected provider.

## Database setup

The initial schema migration has already been applied to the project's Supabase database. Two additional migrations add the budget and reporting functions. In Supabase Studio, open **SQL Editor**, paste and run these files in order:

1. `supabase/migrations/20260925150000_budget_spending_rpc.sql`
2. `supabase/migrations/20260925160000_financial_reporting_rpc.sql`

The reporting functions use `SECURITY INVOKER`, explicitly scope results to `auth.uid()`, and are executable only by authenticated users. Check `docs/VERIFICATION.md` for the later manual walkthrough.

The original table and RLS migration is `supabase/migrations/20260925130000_initial_spendwise_schema.sql`. For a new Supabase project, run it before the two reporting migrations. If using the Supabase CLI on the already-configured project, first synchronize its migration history with the schema already applied in Studio.

## Database model

- `profiles`: Auth user ID, display name, preferred currency, and timestamps.
- `categories`: user-owned income and expense categories.
- `transactions`: positive amount, type, date, optional description, and an owner-matched category.
- `budgets`: positive monthly expense limits, unique per owner, category, and month.

User references cascade when an Auth user is removed. Category references use `NO ACTION`, so a category in use by a transaction or budget cannot be removed or changed to the wrong type. Database constraints complement frontend and service validation.

## Useful commands

```sh
npm run dev      # start local development
npm run lint     # run Oxlint
npm run build    # create the production bundle in dist/
npm run preview  # preview the production bundle locally
```

## Deployment

Vercel and Netlify SPA route rewrites are included. To deploy:

1. Push the repository to a private or public GitHub repository.
2. Import it into Vercel or Netlify and use the default Vite build command, `npm run build`, with output directory `dist`.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` as deployment environment variables.
4. Set the Supabase Auth Site URL to the production domain and add its redirect pattern (for example, `https://your-domain.example/**`) to allowed redirect URLs.
5. Configure custom SMTP and a verified sender domain in Supabase Auth settings before allowing public signups.
6. Apply the two additional SQL migrations above if they have not been applied.
7. After publishing, run the production checks in `docs/VERIFICATION.md`, including sign-in, RLS isolation, and CRUD flows.

Only the browser publishable key belongs in the frontend deployment environment. Keep Supabase secret and service-role keys out of GitHub and the deployment settings used to build the browser app.

## Project map

```text
src/
  components/dashboard/  Shared reporting visuals
  components/layout/     Workspace shell, route protection, error boundary
  context/               Supabase authentication context
  lib/                   Supabase client and currency/date formatting
  pages/                 Landing, auth, dashboard, transactions, categories, budgets, analytics, settings
  services/              Profile, transaction, category, budget, analytics, and insight logic
supabase/migrations/     Database schema and secure reporting functions
docs/                    Manual verification checklist
```

## Status

The application features and production setup are implemented. Automated and live user-flow verification is intentionally pending so it can be completed as a separate pass; use `docs/VERIFICATION.md` for the exact checklist. Deployment still requires connecting this repository and configuring the user's Supabase and hosting accounts.
