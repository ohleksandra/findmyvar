# FindMyVar findings implementation plan

This plan addresses the findings in the [project review](./project-review.md). It deliberately separates correctness work from new product features so that later features are built on a trustworthy variable-usage model.

## Goals

- Make concurrent and cancelled searches deterministic.
- Make cached results correct for every search scope.
- Represent search state explicitly in the UI.
- Define and deliver an honest, testable meaning of “variable usage.”
- Support style-mediated, hidden-instance, and library-variable usage where feasible.
- Improve dependency, CI, documentation, and release confidence.

## Product decisions required before implementation

Record these decisions before starting the completeness work. They do not block the lifecycle and cache fixes.

1. **Usage completeness:** Treat “every usage” as all direct and style-mediated bindings, including hidden instance children.
2. **Result semantics:** Display separate counts for unique nodes and individual bindings.
3. **Style usage:** Decide whether a variable bound to a shared style should appear as the style itself, every node consuming that style, or both. Recommended: show the style once with an expandable consumer list.
4. **Hidden content:** Recommended: include hidden instance children by default and provide a performance-oriented “visible content only” option if benchmarks justify it.
5. **Library variables:** Recommended: list variables from enabled libraries without silently importing or modifying variables in the file.

## Delivery strategy

Implement the work as eight focused pull requests. Each pull request should leave the plugin releasable and include tests for its own behavior.

## PR 1 — Make each search run own its lifecycle

**Priority:** Critical  
**Depends on:** Nothing

### Scope

- Introduce one search-run module that owns:
    - Search identity.
    - Scope snapshot.
    - Cancellation state.
    - Cached or scanned result production.
    - Progress and completion events.
    - Cleanup of temporary Figma state.
- Keep only one current run in the search coordinator.
- Ensure an old run can never clear, complete, or cancel a newer run.
- Apply cancellation checks to cached streaming as well as document traversal.
- Use the same completion path for cached and uncached results.
- Ensure initialization and document-change tracking cannot race with the first search.

### Tests

- Start uncached search A, then start search B before A completes.
- Start cached search A, then start search B between cached batches.
- Cancel an uncached search during traversal.
- Cancel a cached search between batches.
- Deliver stale progress, result, error, and completion events after a newer run starts.
- Throw during traversal and confirm Figma state is restored.
- Confirm every run emits at most one terminal event.

### Acceptance criteria

- Only the newest search can update active search state.
- Cancellation stops both cached and uncached result production.
- A stale run cannot clear the current run’s identity.
- Search cleanup runs on completion, cancellation, and failure.
- Existing batching and progress behavior remains functional.

## PR 2 — Make cache identity and invalidation self-contained

**Priority:** Critical  
**Depends on:** PR 1

### Scope

- Define an immutable search-scope snapshot containing the variable, scope, page, selection, and document revision needed for cache identity.
- Move cache-key creation inside the cache module.
- Move validity checks inside the cache module.
- Make targeted variable clearing remove all entries for that variable across every scope.
- Preserve LRU eviction and TTL behavior.
- Remove tests that preserve known limitations and replace them with expected behavior.
- Confirm document-change tracking invalidates all affected search entries.

### Tests

- Clear one variable with entries for all-pages, current-page, and selection scopes.
- Retain entries belonging to other variables.
- Switch current pages and confirm entries are isolated by page identity.
- Change selection order without invalidating an equivalent selection.
- Change selection membership and invalidate the selection entry.
- Apply relevant and irrelevant document changes.
- Exercise TTL expiry and LRU promotion through the public cache interface.

### Acceptance criteria

- Callers never construct cache keys.
- `clear(variableId)` removes every cached search for that variable only.
- Page and selection identity are captured when the search starts.
- Cache tests do not read or mutate internal keys.

## PR 3 — Replace UI flags with an explicit search session

**Priority:** High  
**Depends on:** PR 1

### Scope

- Replace combinations of `isSearching`, `isSearchCompleted`, `error`, `activeSearchId`, and nullable search data with explicit session states:
    - Idle.
    - Running.
    - Results.
    - Empty.
    - Failed.
    - Cancelled.
- Centralize transitions caused by start, progress, results, completion, failure, cancellation, and retry.
- Render a dedicated error state with retry guidance.
- Render cancellation separately from “no usages found.”
- Make the scope tabs controlled by the persisted scope.
- Reset stale progress, result, cache, and completion data when a new search begins.
- Disable or explicitly replace an active search when the user chooses another variable.

### Tests

- Test every allowed session transition.
- Confirm stale events cannot change the current session.
- Restore a persisted non-default scope and verify the selected tab.
- Render error, cancelled, empty, running, and results states.
- Start a second search while the first is running.
- Retry after a failed search.

### Acceptance criteria

- Impossible combinations of search flags are no longer representable.
- Every stored error is visible to the user.
- Cancellation never renders as an empty successful result.
- Persisted scope and the visible tab always agree.

## PR 4 — Introduce a structured variable-usage index

**Priority:** High  
**Depends on:** PRs 1–2

### Scope

- Replace field strings such as `fills[0]` with structured binding-location data.
- Keep Figma alias parsing, array indexes, property names, and display formatting inside the usage-index module.
- Distinguish:
    - Unique usage node.
    - Individual binding.
    - Page identity.
    - Binding source, such as direct node or style.
- Group pages by `pageId`; use `pageName` only as display data.
- Report unique-node and binding counts separately.
- Remove the manually duplicated node-type list or establish an exhaustive conversion that fails compilation when Figma adds a type.
- Add display fallbacks for unknown future node kinds.

### Tests

- Multiple bindings on one node.
- Multiple paint indexes and text ranges.
- Duplicate page names with distinct IDs.
- Empty and renamed nodes or pages.
- Every node type in the installed Figma typings.
- Stable formatting of structured binding locations.
- Deduplication of repeated discovery paths.

### Acceptance criteria

- Search, grouping, summary counts, and navigation consume structured usage data.
- No core search behavior depends on string replacement.
- Duplicate page names never merge.
- “Nodes” and “bindings” have distinct, accurate counts.

## PR 5 — Close direct and style-mediated completeness gaps

**Priority:** High  
**Depends on:** PR 4

### Discovery checkpoint

Before implementation, build representative Figma fixtures for:

- Direct node bindings.
- Paint, text, effect, and grid styles containing variable bindings.
- Nodes consuming those styles.
- Hidden instance children.
- Text-range variable bindings.
- Component properties and nested arrays.

Use the fixtures to confirm what Figma exposes for style consumers and hidden instance children, then record the chosen behavior in an architecture decision record.

### Scope

- Extend the usage index to discover supported style bindings.
- Associate styles with their consuming nodes when the product decision requires it.
- Include hidden instance children for comprehensive searches, or expose the agreed explicit option.
- Update progress reporting for the additional work.
- Add a clear indicator for direct versus style-mediated usage.
- Benchmark small, medium, and large documents before and after the change.

### Tests

- Each supported style-binding type.
- A style with zero, one, and many consumers.
- Hidden instance children included and excluded according to the selected mode.
- A node with both a direct binding and a style-mediated binding.
- Cancellation during style-consumer discovery.
- Large synthetic document performance and yielding behavior.

### Acceptance criteria

- The documented completeness claim matches actual search behavior.
- Direct and style-mediated results are distinguishable.
- Hidden-content behavior is explicit and tested.
- Large searches remain cancellable and keep the UI responsive.

## PR 6 — Add enabled-library variable discovery

**Priority:** Medium  
**Depends on:** PR 4

### Discovery checkpoint

Confirm how enabled-library descriptors, keys, imported variables, and bound alias IDs relate without mutating the document. Do not silently import variables as part of listing or searching.

### Scope

- Add the required Team Library manifest permission.
- Load local and enabled-library variables into a common picker model.
- Label variable origin and collection in search suggestions.
- Handle inaccessible, disabled, or removed libraries gracefully.
- Preserve recent searches when a library variable later becomes unavailable.
- Avoid importing a library variable unless the user explicitly performs a future mutation action.

### Tests

- Local-only file.
- One and multiple enabled libraries.
- Duplicate variable names across local and library collections.
- Revoked library access.
- Unavailable recent-search item.
- Search results for a library-origin variable already used in the document.

### Acceptance criteria

- Users can distinguish local and library variables with the same name.
- Listing and searching do not modify the Figma document.
- Permission and access failures produce actionable UI states.

## PR 7 — Resolve dependency and CI trust gaps

**Priority:** High  
**Depends on:** Can run after PR 2

### Scope

- Upgrade or override the dependencies responsible for current high-severity findings.
- Review direct and transitive changes rather than applying an unreviewed blanket upgrade.
- Re-run the complete functional and production-build verification after each dependency group.
- Make the production high-severity audit blocking once the baseline is clean.
- Keep development-only audit findings visible with an explicit policy and tracking issue if they cannot immediately block.
- Add tests to lint coverage or document a narrow reason for any exclusion.
- Record the UI bundle’s raw and compressed size in CI.
- Investigate font subsetting and dependency weight only after measuring startup behavior.

### Tests and checks

- Production dependency audit.
- Full dependency audit.
- Type checking, linting, formatting, unit tests, and production build.
- Plugin startup and one complete search in Figma.
- Bundle-size comparison against the current 814 KB raw and 324 KB compressed baseline.

### Acceptance criteria

- No known high-severity production finding is tolerated by CI.
- CI documentation matches actual blocking behavior.
- Dependency changes do not alter search results or UI behavior.
- Bundle growth beyond the agreed threshold fails or warns explicitly.

## PR 8 — Align product and engineering documentation

**Priority:** Medium  
**Depends on:** PRs 1–7

### Scope

- Update the README with the precise definition of variable usage and supported sources.
- Document hidden-content and library behavior.
- Correct the Tailwind stylesheet path in `INTEGRATIONS.md`.
- Align contribution documentation with actual audit and CI behavior.
- Create `CONTEXT.md` with the project’s domain language, including:
    - Variable.
    - Binding.
    - Usage node.
    - Usage binding.
    - Search scope.
    - Search run.
    - Direct usage.
    - Style-mediated usage.
- Record architecture decisions for search-run ownership, cache identity, completeness, and library behavior.
- Document benchmark fixtures and expected performance ranges.

### Acceptance criteria

- Product claims match tested behavior.
- Contributors can identify the main modules and domain concepts without reconstructing them from code.
- CI, security, and release instructions match the repository configuration.

## Release checkpoints

### Patch release checkpoint — after PRs 1–3

Release when:

- Overlapping searches and cancellation are deterministic.
- Targeted cache clearing is correct.
- Errors and cancellation have explicit UI states.
- No search behavior regression appears in manual Figma verification.

### Minor release checkpoint — after PRs 4–6

Release when:

- Structured usage data drives results and summaries.
- Direct and style-mediated completeness is documented and tested.
- Library variables are available without document mutation.
- Performance benchmarks stay within the agreed budget.

### Maintenance release checkpoint — after PRs 7–8

Release when:

- The production audit is clean and blocking.
- Documentation and CI behavior agree.
- Bundle size and startup measurements are recorded.

## Feature roadmap after the findings are resolved

Do not begin bulk mutation features until PRs 1–5 establish trustworthy discovery and cancellation.

1. **Variable audit dashboard**
    - Build on the usage index.
    - Show unused variables, unique-node counts, binding counts, collections, pages, and fields.
2. **Exportable audit report**
    - Export the same indexed data as CSV or JSON.
3. **Mode consistency audit**
    - Add resolved and explicit mode information to indexed usages.
4. **Bulk variable replacement**
    - Require preview, explicit scope, compatibility validation, cancellation, and one undoable operation.
5. **Suggested bindings**
    - Find raw values matching variables and present non-destructive suggestions before applying changes.
6. **Multi-variable comparison**
    - Compare location, property, scope, overlap, and replacement readiness.

## Definition of done for every pull request

- Behavior is described in user terms.
- Tests cover success, failure, cancellation, and stale-event behavior where applicable.
- Type checking, linting, formatting, tests, and production build pass.
- No unrelated code or dependency change is included.
- Product documentation is updated when visible behavior changes.
- Performance is measured when traversal, page loading, style discovery, or bundle composition changes.
