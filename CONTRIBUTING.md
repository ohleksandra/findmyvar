# Contributing

Thanks for your interest in contributing! This document explains how to contribute in a clear, consistent way.

## Code of Conduct

Be respectful, inclusive, and professional. Treat others with courtesy in issues, PRs, and discussions.

## Getting Started

- Fork the repository and create a branch named: `type/short-description` (e.g., `fix/null-pointer` or `feat/user-auth`).
- Keep branches small and focused.

## Issues

- Search existing issues before opening a new one.
- Provide a clear title, steps to reproduce, expected vs actual behavior, environment, and logs if applicable.
- Use labels if you have permission; otherwise maintainers will categorize.

## Pull Requests

- Open PRs against the `main` (or specified) branch.
- Include a concise description of the change, motivation, and related issue number (e.g., `Closes #123`).
- Keep commits atomic and focused; rebase/squash locally if requested.
- Ensure all tests pass and CI is green before requesting review.
- Add or update tests and documentation for new behavior.
- Use imperative commit messages (e.g., "Add validation for email input").
- Be responsive to review feedback; update PRs promptly.

## Commit Messages

Commit messages must follow Conventional Commits and the project's rules enforced by `commitlint`.

- **Format:** `type: short description` (e.g., `feat: add validation for email input`).
- **Allowed types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`.
- **Subject:** non-empty, sentence-case, and written in the imperative mood.

Hooks are enforced with Husky. Make sure hooks are installed for contributors by keeping the `prepare` script in `package.json` (for example: `"prepare": "husky install"`) so running `npm install` enables the hooks automatically.

If a commit is rejected by the commit hook locally, run:

```bash
npx --no-install commitlint --edit "$1"
```

Commit the `.husky/` directory so hooks remain consistent across contributors (do not commit your local `.git/hooks/`).

### Examples

Here are example commit messages that follow the project's Conventional Commits rules:

- `feat: add search-by-scope support`
- `fix: handle null pointer in variable lookup`
- `docs: update README with new CLI options`
- `style: format files with Prettier`
- `refactor: simplify rpc-server startup sequence`
- `perf: reduce unnecessary re-renders in UI`
- `test: add unit tests for variableSearchService`
- `chore: bump eslint to ^8.0.0`
- `feat(scope): add optional scope parameter to find API` (type with scope)
- `fix(search): escape user input before building regex` (type with scope)
- `feat!: change RPC signature for findVariables` (breaking change indicated with `!`)
- `chore: release patch v1.2.3` (maintenance/release commits)

For breaking changes, include either a `!` after the type/scope (e.g., `feat!:`) or add a `BREAKING CHANGE:` footer in the commit body describing the incompatibility and migration steps.

## Code Style & Quality

- Follow the project's style guidelines (formatting, naming, patterns).
- Run linters, formatters, and pre-commit hooks before committing.
- Write unit/integration tests for non-trivial changes.
- Document public APIs and configuration changes.

## Tests & CI

- Run the test suite locally and ensure coverage does not decrease for relevant modules.
- Address CI failures quickly; they may block merging.

## Documentation & Changelog

- Update README, docs, and examples when behavior or APIs change.
- CHANGELOG.md is generated automatically by [release-please](https://github.com/googleapis/release-please) from conventional commits. You do not need to edit it manually.

## Release process

Releases are fully automated. The flow:

1. Merge PRs to `main` using the conventional-commit conventions above. Commits with `feat:`, `fix:`, `perf:`, or `revert:` prefixes are "releasable"; `chore:`, `docs:`, `test:`, `refactor:`, `style:`, `build:`, `ci:` are not.
2. On every push to `main`, the **Release Please** workflow (`.github/workflows/release-please.yml`) runs the release-please bot. If it detects releasable commits, it opens (or updates) a **Release PR** that:
    - Bumps `version` in `package.json` (patch for `fix:`, minor for `feat:`, major for `feat!:` or `BREAKING CHANGE:`)
    - Regenerates `CHANGELOG.md` from conventional commits grouped by type
    - Updates `.release-please-manifest.json` to track the current version
3. Review the Release PR. The PR title is the next version (e.g., `chore(main): release 1.2.0`). The body is the changelog. Edit the body if you want to call out a specific change.
4. Merge the Release PR. release-please creates a GitHub release with the matching git tag.
5. **Publishing to Figma is a manual step.** Once a GitHub release is published:
    - `npm run build` — produces `dist/`
    - `npm run package` — zips `dist/` into `findmyvar-v<version>.zip` at the repo root
    - Upload that zip to the Figma plugin marketplace

    (A CI workflow for this is on the roadmap but needs a Personal Access Token to bypass branch protection.)

Versioning rules:

- `fix:` → patch bump (1.0.0 → 1.0.1)
- `feat:` → minor bump (1.0.0 → 1.1.0)
- `feat!:` or a commit body containing `BREAKING CHANGE:` → major bump (1.0.0 → 2.0.0)
- Pre-1.0.0, `feat:` still bumps minor; `bump-minor-pre-major: false` in `release-please-config.json` keeps patch bumps for fixes until 1.0.0.

No manual tagging, no manual `npm version`, no manual CHANGELOG editing.

## Security Issues

- Do not open public issues for sensitive security vulnerabilities.
- Report security issues privately to maintainers via the repository's defined channel (e.g., security policy or private email).

## Licensing & Contributor Agreement

- By contributing, you agree to license your contributions under the project's license.
- If a Contributor License Agreement (CLA) or Developer Certificate of Origin (DCO) is required, follow the project’s process.

## Review Process

- Maintain a constructive tone in reviews. Provide rationale for requested changes.
- Maintainers may close or modify PRs that do not follow contribution guidelines.

## Pull Requests, Titles & Automated Checks

- PR titles and descriptions must follow the project's conventions. The CI workflow validates PR titles indirectly (via `commitlint` running on the head commit) and runs the full check suite on every PR.
- Use clear, imperative titles (examples in the `Commit Messages` section apply). Include related issue references (e.g., `Closes #123`).
- A PR template is available to guide authors — fill it in with motivation, change summary, and verification steps.

### CI workflow

The `CI` workflow (`.github/workflows/ci.yml`) runs on every PR and on every push to `main`. It executes the following checks in order:

1. `npm ci --ignore-scripts` — clean install from lockfile
2. `npm audit --omit=dev --audit-level=high` — production-dependency security audit (fails the build on high-severity CVEs)
3. `npm audit --include=dev --audit-level=moderate` — dev-dependency audit (advisory only)
4. `tsc --build` — type check for both main and UI projects
5. `npm run format:check` — Prettier
6. `npm run lint` — ESLint
7. `vitest run` — unit tests
8. `npm run build` — plugma production build

All jobs run on `ubuntu-latest` with Node 20.

### Branch protection & required checks

Recommended branch-protection settings for `main` (Settings → Branches → Branch protection rules):

- Require a pull request before merging
- Require approvals: 1
- Require status checks to pass before merging: select `CI / ci`
- Do not allow bypassing the above settings

This project does not enforce branch protection by default; maintainers should enable it in repository settings.

If a status check is failing, fix the issue and push a new commit. Maintainers may re-run CI or perform the necessary checks locally before merging.

### Local verification

Before opening a PR, please run the following locally to catch issues early:

```bash
# install deps (only once)
npm ci

# format & lint
npm run format
npm run lint

# run unit tests
npm run vitest

# type check
npx tsc --build

# build (optional, but matches CI)
npm run build

# run commit message check against last commit (example)
npx --no-install commitlint --from HEAD~1 --to HEAD --verbose
```

If a commit is rejected by the local commit-msg hook, amend the commit message and re-run:

```bash
npx --no-install commitlint --edit "$1"
# or
git commit --amend
```

### Merging

- Ensure CI passes and local tests/lint/format/typecheck succeed.
- Obtain the required reviews.
- Merge using the repository's preferred strategy (squash or rebase+merge).
- After merge, Dependabot will open weekly PRs for minor/patch updates; review and merge promptly to keep the dependency surface small.

If your PR cannot run certain checks because it's from a fork, request a maintainer to run the workflow or open the PR from a branch in this repository.

Thank you for helping improve the project!
