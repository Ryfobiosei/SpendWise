# SpendWise

SpendWise is a personal finance application built with React, JavaScript, Vite, and React Router. It is being developed in stages, with Supabase Auth and the user-isolated finance database planned for the next stages.

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

## Build and lint

```sh
npm run build
npm run lint
```
