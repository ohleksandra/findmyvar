# FindMyVar project review

FindMyVar has a clean, focused product and a healthy engineering baseline. The current implementation is suitable for direct local-variable searches, but several correctness gaps undermine the promise to find “every place” a variable is used.

## Highest-priority findings

### 1. Overlapping searches can terminate the newer search

Cached result streaming yields between batches, then unconditionally clears the shared active search ID. If another search starts during that interval, the older run can cancel it. Cancellation also does not stop cached streaming.

Evidence: [`src/main/services/variableSearchService.ts`](../src/main/services/variableSearchService.ts#L45)

**Recommendation:** Deepen the variable search run so each run owns its cancellation, cached and uncached execution, progress, and completion lifecycle.

### 2. Targeted cache clearing does not work

Entries use composite keys such as `variableId:scope:page`, but `clear(variableId)` deletes only the raw variable ID. The test suite explicitly preserves this as a known limitation.

Evidence:

- [`src/main/services/search-cache.ts`](../src/main/services/search-cache.ts#L52)
- [`vitest/search-cache.test.ts`](../vitest/search-cache.test.ts#L76)

**Recommendation:** Make the cache own key creation, scope identity, validity, and invalidation instead of exposing those rules to callers.

### 3. Search completeness is narrower than the product claim

The search scans direct `SceneNode.boundVariables` only and skips invisible instance children. It does not inspect variable bindings held by paint, text, effect, or grid styles, although Figma supports bindings on styles.

Evidence:

- [`src/main/services/variableSearchService.ts`](../src/main/services/variableSearchService.ts#L91)
- [Figma: Working with Variables](https://developers.figma.com/docs/plugins/working-with-variables/)

**Recommendation:** Either describe the feature as “direct visible node usage” or add style-mediated and hidden-instance usage support.

### 4. Enabled library variables cannot be searched

The variable picker calls `getLocalVariablesAsync()`, so users cannot select variables from enabled team libraries even when their bindings appear in the file. Figma exposes library variables through `figma.teamLibrary`, with an additional manifest permission.

Evidence:

- [`src/main/handlers/get-variables.ts`](../src/main/handlers/get-variables.ts#L5)
- [Figma: Team Library API](https://developers.figma.com/docs/plugins/api/figma-teamlibrary/)

### 5. Search errors are stored but never displayed

The store records failures, but the search pane only supports idle, searching, results, and empty states. A failure can therefore look like the introductory screen or stale content. Cancellation similarly becomes “no results.”

Evidence:

- [`src/ui/components/search-pane.tsx`](../src/ui/components/search-pane.tsx#L7)
- [`src/ui/store/plugin-store.ts`](../src/ui/store/plugin-store.ts#L126)

## Additional improvements

- Group results by `pageId`, not `pageName`. Duplicate page names currently merge into one accordion section and undercount pages.
- Distinguish nodes, bindings, and occurrences. A node bound in both fill and stroke currently counts as two “instances.”
- Replace the manually maintained `NodeType` union. It omits newer Figma types such as `TEXT_PATH`, `SLOT`, and slide nodes; the current cast hides this drift. See [`src/shared/rpc-types.ts`](../src/shared/rpc-types.ts#L15).
- Make the scope tabs controlled by persisted state. They currently always render the default scope initially, even when another scope was restored. See [`src/ui/components/scope-selector.tsx`](../src/ui/components/scope-selector.tsx#L17).
- Replace the UI’s combination of booleans and nullable fields with one explicit search-session state: idle, running, results, empty, failed, or cancelled.
- Reconsider loading every page during initialization. Figma requires it for the global `documentchange` event under dynamic-page access, but documents more granular alternatives that may reduce startup cost. See [Figma event documentation](https://developers.figma.com/docs/plugins/api/properties/figma-on/).
- Normalize binding locations as structured data rather than strings such as `fills[0]`, followed by later string replacement.
- Investigate the 814 KB UI artifact, including 280 KB of bundled font files. Measure startup impact before optimizing or subsetting.
- Add a domain glossary and architecture decision records. There is currently no `CONTEXT.md` or `docs/adr/`, making important choices such as hidden-instance exclusion implicit.
- Correct documentation drift: the Tailwind path in `INTEGRATIONS.md` is wrong, and the contribution guide says the production audit blocks CI while both audit steps use `continue-on-error`.

## Testing and security

The functional baseline is strong:

- 87 tests pass.
- Type checking, linting, formatting, and production build pass.
- Search traversal, batching, caching, binding extraction, and store behavior have useful unit coverage.

Important gaps:

- No overlapping-search or cached-cancellation tests.
- No UI rendering tests for error, cancellation, persisted scope, keyboard focus, or duplicate page names.
- No tests for style bindings, library variables, invisible instance children, or newer node types.
- Tests are excluded from linting, weakening their value as maintained code.
- The dependency audit currently reports three high-severity production findings and six high-severity findings overall. CI tolerates them, so the green badge does not represent a clean security audit.

## Architecture recommendations

1. **Strong:** Deepen the variable search run.
2. **Strong:** Make the search cache own scope identity and invalidation.
3. **Worth exploring:** Deepen binding discovery into a reusable usage-index module.
4. **Worth exploring:** Deepen UI state into an explicit search-session module.

## Potential new features

| Priority | Feature                   | Value                                                                                                                            |
| -------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 1        | Variable audit dashboard  | Usage counts, unused variables, pages, fields, collections, and types in one scan                                                |
| 2        | Bulk variable replacement | Preview and migrate usages from an old token to a replacement; Figma supports binding and unbinding through its variable helpers |
| 3        | Style-aware search        | Find variables indirectly applied through paint, text, effect, and grid styles                                                   |
| 4        | Library-variable search   | Include variables from enabled team libraries                                                                                    |
| 5        | Mode consistency audit    | Highlight unexpected explicit or resolved variable modes across frames and pages                                                 |
| 6        | Suggested bindings        | Find raw values matching variables through Figma’s inferred-variable data, then offer safe binding                               |
| 7        | Exportable audit report   | CSV or JSON export for design-system cleanup and migration tracking                                                              |
| 8        | Multi-variable comparison | Compare two tokens by location, property, scope, and overlap                                                                     |

## Recommended roadmap

The best sequence is:

1. Correct search lifecycle and cache trustworthiness.
2. Establish a structured usage index.
3. Add style and library completeness.
4. Build audits and bulk migration on top of that foundation.
