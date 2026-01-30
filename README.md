# FindMyVar

FindMyVar is a Figma plugin that helps designers and developers locate where design variables (colors, typography, numeric values, booleans, and strings) are used across a Figma file. It provides a responsive, incremental search UI and direct navigation to matching nodes.

---

## Overview

FindMyVar searches a Figma document for variable usages and surfaces results with navigation and progress updates.

## Key features

- Search variable usages across All pages, Current page, or Selection
- Real-time progress updates and incremental results
- Click results to navigate to matching nodes
- Caching for faster repeated searches
- Supports variable types: BOOLEAN, FLOAT, STRING, COLOR

## Install / Try in Figma

1. Build or run the development bundle (this generates `dist/`):

```bash
npm install
npm run dev    # development (live reload)
# or
npm run build   # production bundle
```

2. In the Figma desktop app:
    - Open a file.
    - Press `Cmd/Ctrl + K` and search for **Import plugin from manifest...**
    - Select `dist/manifest.json`.

3. Run the plugin from the Actions menu.

## Quick usage

- Open the plugin and type a variable name or partial term.
- Select the search scope (All pages / Current page / Selection).
- Click a result to navigate to the node in the document.

---

# Development

## Requirements

- Node.js (recommended LTS)
- Figma desktop app (for local testing)

## Development & build

- Start dev server (Plugma):

```bash
npm run dev
```

- Build production bundle:

```bash
npm run build
```

- Create a release:

```bash
npm run release
```

## Scripts

- `npm run dev` — development server with live rebuilds
- `npm run build` — production build
- `npm run release` — release packaging
- `npm run format` — format code (Prettier)
- `npm run lint` — lint code (ESLint)
- `npm run vitest` — unit tests (Vitest)
- `npm run playwright` — E2E tests (Playwright)

## Testing

- Unit tests: `npm run vitest`
- E2E tests: `npm run playwright`

## Formatting & pre-commit checks

- Format: `npm run format` (Prettier)
- Lint: `npm run lint` (ESLint)
- Pre-commit hooks: Husky + lint-staged are configured. Ensure the `prepare` script is present in `package.json` and run `npm install` to enable hooks locally.

## Contributing & commit rules

See `CONTRIBUTING.md` for contribution guidelines, Conventional Commits rules, and examples. The repository enforces commit messages via `commitlint` and Husky hooks.

## Architecture

The plugin is split into two processes:

- Main process (`src/main/`) — runs in Figma's main thread and contains RPC handlers and the variable search service.
- UI process (`src/ui/`) — React UI running in an iframe; communicates with main via the RPC client.

Shared types and RPC contracts live in `src/shared/`.

## License & contact

See `LICENSE`. Open issues or PRs on this repository for questions or contributions.

---
