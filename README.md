# SpendWise

SpendWise is a personal finance application built with React, JavaScript, Vite, React Router, and Supabase Auth. It is being developed in stages; the current build contains the client and authentication context, while account forms and the user-isolated finance database are next.

## Current structure

- `src/components/layout` contains the marketing and workspace layouts.
- `src/components/ui` contains shared interface elements.
- `src/pages` contains route-level pages.
- `src/context` will hold shared authentication state.
- `src/lib` will hold configured clients and shared utilities.
- `src/services` will hold finance data access and calculations.

The current build includes the public landing page and route placeholders. It does not yet connect an account or display financial records.

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

## Build and lint

```sh
npm run build
npm run lint
```
