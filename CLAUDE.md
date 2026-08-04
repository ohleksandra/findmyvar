# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server with live reload (uses plugma)
npm run build        # Production build → dist/
npm run lint         # ESLint
npm run format       # Prettier (write)
npm run format:check # Prettier (check only)
npm run vitest       # Unit tests (Vitest)
npm run playwright   # E2E tests (Playwright)
```

Run a single Vitest test file:

```bash
npx vitest run vitest/<file>.test.ts
```

Run a single Playwright test:

```bash
npx playwright test playwright/<file>.spec.ts
```

## Architecture

This is a **Figma plugin** with a two-process model — Figma requires plugins to split logic between a sandboxed main thread and a UI iframe:

### Main Process (`src/main/`)

Runs in Figma's main thread. Has full access to the Figma API. Contains:

- `main.ts` — plugin entry point, registers RPC handlers
- `services/variableSearchService.ts` — core search logic: traverses nodes, reads `boundVariables`, batches results (50/batch), caches with 5-min TTL, supports cancellation
- `handlers/` — RPC procedure implementations
- `lib/rpc-server.ts` — receives `postMessage` from UI, dispatches to handlers, sends responses/notifications

### UI Process (`src/ui/`)

React app running in a sandboxed iframe. Cannot access Figma API directly. Contains:

- `store/plugin-store.ts` — Zustand store, single source of truth for all UI state
- `hooks/` — `use-variable-search.ts` orchestrates search flow; `use-rpc-mutation.ts` / `use-rpc-query.ts` wrap RPC calls
- `lib/rpc-client.ts` — sends `postMessage` to main, matches responses by ID, handles notifications
- `components/` — React components; `ui/` subdir contains shadcn/ui primitives

### Shared (`src/shared/rpc-types.ts`)

Defines all typed RPC contracts: procedures (request/response) and notifications (main → UI push events). **Always update this file when adding new communication between processes.**

### RPC Communication Pattern

- **Procedures**: UI calls main, waits for response (e.g., `get-variables`, `variableSearch.start`)
- **Notifications**: Main pushes to UI without a request (e.g., `variableSearch.results`, `variableSearch.progress`)
- Message format uses `__rpc: true` / `__rpcNotification: true` discriminators

### Streaming RPC Contract

The `variableSearch.start` procedure is a **streaming RPC**:

1. **Procedure call**: UI calls `variableSearch.start` with `{ variableId, scope }`. The handler returns `{ started: true }` immediately (fire-and-forget). The search runs asynchronously in the main process.

2. **Streaming results**: As the search progresses, the main process sends `variableSearch.results` notifications with batches of results. Each notification includes a `searchId` to correlate with the originating request.

3. **Completion**: When the search finishes, a final `variableSearch.results` notification is sent with `isComplete: true`. The store's `_appendResults` method handles this terminal state.

4. **Stale-notification guard**: The store maintains an `activeSearchId`. When a search is cancelled or a new search starts, the `activeSearchId` is updated. Incoming notifications with a mismatched `searchId` are ignored, preventing stale data from updating the UI after cancellation.

5. **Error handling**: If the search fails, a `variableSearch.error` notification is sent with the error message and `searchId`.

## Key Conventions

- **Path alias**: `@/` resolves to `src/ui/`
- **Prettier**: tabs, single quotes, 100 char width, semicolons
- **Commits**: Conventional Commits enforced by commitlint (`feat:`, `fix:`, `chore:`, etc.)
- **Branches**: `type/short-description` (e.g., `fix/cache-invalidation`)
- **Tailwind + shadcn/ui**: UI uses shadcn "new-york" style; add components via `npx shadcn@latest add <component>`
- **ESLint 9**: Flat config in `eslint.config.js`; separate configs for main (no JSX) and UI (React) processes

## Testing Setup

- **Vitest** (`vitest/`): Unit tests for pure logic (search service, utilities)
- **Playwright** (`playwright/`): E2E tests; plugma provides Figma plugin testing utilities for both UI and main contexts
