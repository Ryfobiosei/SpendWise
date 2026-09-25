# SpendWise

SpendWise is a personal finance app built with React, JavaScript, Vite, React Router, CSS, and Supabase. It is being developed in stages. The current version includes the public landing page, Supabase Auth client/context, registration and sign-in forms, password reset flows, logout, and protected dashboard routing. The finance pages are still placeholders; database schema, user-isolated data access, transactions, budgets, and analytics are not implemented yet.

## Current structure

- `src/components/layout` contains the marketing and workspace layouts.
- `src/components/ui` contains shared interface elements.
- `src/pages` contains route-level pages.
- `src/context` holds shared authentication state.
- `src/lib` holds the configured Supabase client.
- `src/services` will hold finance data access and calculations.

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

## Current verification

The production bundle and lint checks pass with `npm run build` and `npm run lint`. Registration and sign-in routes render in the browser, and unauthenticated access to `/dashboard/transactions` redirects to sign-in. A real account flow still needs to be completed with an email address you can access; this project has not created an account or sent a reset email on your behalf.

## Build and lint

```sh
npm run build
npm run lint
```

## Planned work

1. Add the database schema and row-level security policies.
2. Build categories and real transaction CRUD.
3. Add budget management, analytics, and data-based insights.
4. Complete settings, responsive review, and security checks.
5. Prepare deployment and verify the live application.
