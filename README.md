# SpendWise

SpendWise is a personal finance app built with React, JavaScript, Vite, React Router, CSS, and Supabase. The current version includes the public landing page and Supabase Auth flows. Its initial database schema and row-level security policies are defined in a versioned SQL migration; apply that migration to the Supabase project before connecting the finance screens. The dashboard finance pages are still placeholders.

## Current structure

- `src/components/layout` contains the marketing and workspace layouts.
- `src/components/ui` contains shared interface elements.
- `src/pages` contains route-level pages.
- `src/context` holds shared authentication state.
- `src/lib` holds the configured Supabase client.
- `src/services` will hold finance data access and calculations.
- `supabase/migrations` contains versioned database schema changes.

Dashboard routes require an authenticated Supabase user. Until the finance features are built, dashboard sections show setup placeholders instead of fabricated financial data.

## Requirements

- Node.js 20.19 or newer
- npm

## Run locally

```sh
npm install
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`).

## Supabase environment

Copy `.env.example` to `.env.local` and add the project's URL and publishable key. `.env.local` is ignored by Git. Never put a Supabase secret or service-role key in a `VITE_` variable.

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

After changing `.env.local`, restart the Vite server. In Supabase, allow the local app URL (`http://127.0.0.1:5173`) in the project's Auth URL configuration for confirmation and password-reset links. Add the production site URL there before deploying. The app only uses the publishable browser key; never put a service-role or secret key in a `VITE_` variable.

## Authentication behavior

- Registration uses Supabase Auth and stores the name as auth user metadata; it does not store passwords in an application table.
- Sign-in uses email and password. Successful sign-in opens the dashboard.
- Email confirmation may be required depending on the Supabase project's Auth settings.
- Password recovery sends a Supabase reset link and allows setting a new password after the link is opened.
- Protected dashboard routes wait for Supabase session initialization before rendering.
- Logout clears the local session.

## Database design

The initial migration is `supabase/migrations/20260925130000_initial_spendwise_schema.sql`. It defines:

- `profiles`: one row per Supabase Auth user, with name and preferred currency.
- `categories`: user-owned income and expense categories. New accounts receive 12 starter categories.
- `transactions`: positive amounts, an explicit income/expense type, date, description, and a category that must belong to the same user and type.
- `budgets`: positive monthly amounts for a user's expense categories, with a unique constraint per user, category, and month.

Each table has RLS enabled. The browser's `anon` role has no table privileges; authenticated users receive only the required table operations. Policies scope reads and writes to `auth.uid()`. Foreign keys cascade a user's records when their Auth user is removed, and prevent deleting a category while a budget or transaction still refers to it. The migration also backfills profiles and starter categories for accounts that already exist.

Apply the migration to the Supabase project once before using the finance data features. In Supabase Studio, open **SQL Editor**, create a query, paste the contents of the migration file, and run it. If you later deploy migrations with the Supabase CLI, first synchronize the CLI migration history with this already-applied schema.

## Current verification

The production bundle and lint checks pass with `npm run build` and `npm run lint`. Registration, sign-in, logout, and protected-route behavior were confirmed in the browser. The database migration is versioned locally but has not yet been applied to the Supabase project or tested against a PostgreSQL instance.

## Build and lint

```sh
npm run build
npm run lint
```

## Planned work

1. Connect categories and transaction services to the new schema.
2. Build transaction management and category editing.
3. Add budget management, analytics, and data-based insights.
4. Complete settings, responsive review, and database isolation tests.
5. Prepare deployment and verify the live application.
