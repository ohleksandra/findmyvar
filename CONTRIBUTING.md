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
- Add an entry to CHANGELOG for user-impacting changes.

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

- PR titles and descriptions must follow the project's conventions. The repository runs an automated PR lint workflow that validates PR titles (Conventional Commits style) and requires a meaningful description.
- Use clear, imperative titles (examples in the `Commit Messages` section apply). Include related issue references (e.g., `Closes #123`).
- A PR template is available to guide authors — fill it in with motivation, change summary, and verification steps.

### Branch protection & required checks

NOTE: At the moment this repository does not enforce branch protection or require status checks for merging. The CI workflows (PR lint, tests, lint/format) run on PRs and pushes, but GitHub will not block merges automatically.

Recommended practice:
- Treat the CI checks as required: ensure PR lint and local tests pass before requesting review.
- If you are a maintainer, consider enabling branch protection in the repository settings to require specific status checks before merging.

If a status check is failing, fix the issue and push a new commit. Maintainers may re-run CI or perform the necessary checks locally before merging.

### Local verification

Before opening a PR, please run the following locally to catch issues early:

```bash
# install deps (only once)
npm install

# format & lint
npm run format
npm run lint

# run unit tests
npm run vitest

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

- Since branch protection is not enforced, maintainers may merge PRs after verifying that changes are safe. However, the preferred workflow is:
	- Ensure CI (PR lint) passes and local tests/lint/format succeed.
	- Obtain the required reviews.
	- Merge using the repository's preferred strategy (squash or rebase+merge).

If your PR cannot run certain checks because it's from a fork, request a maintainer to run the workflow or open the PR from a branch in this repository.

Thank you for helping improve the project!
