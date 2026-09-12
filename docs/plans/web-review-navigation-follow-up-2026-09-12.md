# Review navigation performance: sequential follow-up plan

## Objective and scope

Reduce the reported approximately three-second transition to usable Review setup. Execute this plan after the implementation in PR #120; do not repeat its completed changes. This document authorizes no implementation or release by itself. It is a plan for subsequent tasks.

Keep explanations in Russian and code, logs, commits and documents in English. Use Node 24/npm 11 and the installed Next.js documentation (currently package.json specifies Next.js 16.3.3). Use Context7 for framework/API changes and verify applicability to the installed version. No mobile or Expo/EAS work is needed.

Before implementation, inspect worktree state, update an appropriate clean checkout from origin/main and create `feature/web-review-navigation`. Preserve unrelated changes and these documents. Do not continue adding implementation commits to an already merged branch. Record progress in `docs/plans/web-review-navigation-execution-2026-09-12.md`.

## Verified starting point and uncertainty

- PR #120 was merged at 2026-09-12 13:23:18 UTC (15:23:18 CEST). Merge commit: `3cfdebbd2ca5da91313b8926db7f466a47391002`.
- GitHub deployment `6410110691` reports `Production`, that same commit, and `success` at 13:24:50 UTC. This verifies the production deployment record; verify the custom domain's served build separately in N00.
- The previous claim that production necessarily still ran pre-PR code was incorrect. A deployed application does not establish that its database migrations were applied or that the new RPC path is active.
- `repository.ts` tries `get_web_review_snapshot_v1()` and falls back to paged reads for `PGRST202` / `42883`. The production migration state and actual request path have not been verified.
- `review/page.tsx` awaits `requireAuthContext()` before `getReviewWorkspaceData()`. `requireAuthContext()` awaits verified identity and then a separate access-level lookup. This dependency is visible in code; its share of the reported delay is unmeasured.
- The snapshot still includes every active word and up to 5,000 effective events. Consolidating requests did not eliminate serialization, transfer, parsing or hydration cost.
- `ReviewWorkspace.tsx` statically imports full details and session components. Bundle attribution is needed before calling these imports a major bottleneck.
- `loading.tsx` and streamed navigation statistics already exist. Adding another loading label alone will not make setup usable earlier.
- The existing performance harness measures synchronous `prepareReviewQuestions()` in Node after the data already exists. Its `bytes` field is serialized synthetic workspace size, not actual compressed RSC traffic. Its `longTask` boolean is a duration threshold, not a browser long-task observation.
- Earlier repeated preparation measurements ran the already optimized implementation twice. They are neither a pre-PR comparison nor navigation evidence. The earlier browser observations showed loading UI but did not provide reliable click-to-ready timing.
- The old execution log contains historical sections contradicting later completion updates. Use source, tests and new measurements as the current evidence; keep that log as history.

Evidence: [PR #120](https://github.com/oldrefery/dutch-learning-app/pull/120), [production deployment record](https://api.github.com/repos/oldrefery/dutch-learning-app/deployments/6410110691), [deployment statuses](https://api.github.com/repos/oldrefery/dutch-learning-app/deployments/6410110691/statuses).

## Measurement and acceptance contract

Measure these boundaries independently:

1. Click to visible navigation feedback.
2. Click to **usable setup**: scope/mode controls accept input, current counts are available, and Start is enabled when eligible words exist.
3. Start to first usable card, including any deferred data loading and preparation.
4. Click to first usable card when Start is pressed as soon as setup allows it. This prevents moving the same delay to a different button and calling it a full improvement.

Provisional targets, to freeze after N01 establishes the environment:

| Scenario                                            | Target                                                                                                                  |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Warm same-account navigation, desktop               | Usable setup median <= 1 second                                                                                         |
| Cold authenticated entry, desktop                   | Usable setup median <= 1.5 seconds, or >= 50% reduction from the paired baseline if infrastructure prevents that target |
| Navigation feedback                                 | Median <= 100 ms desktop; <= 200 ms at 4x CPU slowdown                                                                  |
| Start, already loaded 2,500-word Adaptive queue     | First usable card median <= 1 second desktop, <= 3 seconds at 4x CPU slowdown                                           |
| End-to-end navigation followed immediately by Start | Improves or remains within measured baseline variation; report separately if a design trades this for earlier setup     |
| Correctness                                         | All eligible words retained; unchanged learning, retry, correction and account-isolation contracts                      |

Use at least five paired runs for controlled comparisons; record median and min/max. Record cold entry, first client navigation, prefetched navigation and repeated navigation separately. Five samples do not establish production p95. Record device/browser/build, network conditions, cache state, vocabulary/event counts, selected queue and mode.

Use production builds, not development server timing. Create isolated build output and a loopback-only fake Supabase HTTP upstream or disposable backend for repeatable server-side reads. Browser request interception cannot intercept the Next server's database calls. Include 500, 2,500 and 5,000 words; 0/501/5,000 events; and 20 selected words in a 5,000-word vocabulary. Do not create real production learning events for benchmarks.

Trace proxy authentication, verified identity, access lookup, RPC/fallback pages, mapping, RSC serialization/response completion, JS loading, hydration and setup readiness. Use monotonic clocks within each process and opaque correlation IDs across processes. Do not add unrelated overlapping span durations together. Record browser transfer bytes and decoded payload bytes independently. Never log credentials, emails, words or translations. Do not expose a public diagnostics endpoint containing account data.

## N00 — Verify the live code and database path

**Purpose:** determine whether production actually uses the optimization already shipped.

1. Check the build information rendered on Settings at `woordenaar.app` against merge commit `3cfdebbd`; record the currently served commit if newer.
2. Resolve the exact linked Supabase project using this repository's configuration. Restrict diagnostics to this personal project.
3. Verify applied migration versions and definitions for `20260912100000_add_web_collection_overviews_rpc.sql` and `20260912110000_add_web_review_snapshot_rpc.sql`, their prerequisites, grants and caller-security behavior.
4. Confirm an ordinary authenticated Review read uses the snapshot RPC. Prefer a scoped trace of the actual repository request, including a safe `snapshot`/`legacy` path marker. Metadata inspection alone cannot demonstrate the application path.
5. If the RPC is absent, prepare a release step listing exact pending migrations and project identity. Do not apply unrelated pending migrations automatically. Preserve fallback for staged rollout. Verify the new path and remeasure after the separately authorized application.

**Files:** `apps/web/src/lib/build-info.ts`, `apps/web/src/features/review/repository.ts`, `apps/web/src/features/collections/repository.ts`, the two migrations.

**Gate:** record served SHA, backend identity, applied migrations, actual path and request count. If deployment evidence is inaccessible, mark it unknown and continue isolated N01; do not assume a missing migration.

## N01 — Establish the real navigation baseline

**Purpose:** locate the dominant portion of the three seconds before changing architecture.

1. Add the isolated browser/server harness missing from W00 of the original plan. Reuse real route/repository/components and session preparation.
2. Add minimal diagnostic spans and a test-side setup-ready marker. Prefer existing observability; do not create a second analytics pipeline. Browser readiness needs hydrated interaction, not just server-rendered text.
3. Capture the scenarios and fields in the measurement contract. Include a delayed backend profile so waterfalls are visible, then a disposable PostgreSQL run to measure real SQL separately.
4. Test migrated and legacy backends. Count server-side database calls explicitly.
5. Use a read-only live navigation trace when available to correlate lab findings with the report. Keep production HARs/tokens out of committed artifacts.

**Files:** `scripts/web-performance/`, an isolated `apps/web/e2e/` configuration, review route/repository instrumentation, existing `performance-harness.test.ts` for CPU-only context.

**Gate:** a sanitized report attributes the delay to auth/SQL/network/payload/client work and identifies the next justified optimization. Record the shipped commit as the new baseline; do not present it as the original pre-PR baseline.

## N02 — Remove unnecessary auth/read serialization

**Purpose:** overlap independent work after verified identity.

1. Retain the existing authenticated `getUser()` boundary and revocation behavior.
2. After `requireAuthenticatedIdentity()` succeeds, start the access lookup and owned Review snapshot concurrently. Reuse request-scoped identity verification through existing React cache where applicable.
3. Await the access result before enabling AI controls. The snapshot reader must remain caller-authenticated and RLS protected.
4. Inspect layout and page traces for duplicate work; multiple client constructors alone are not evidence of duplicate requests. Keep shared auth changes narrow.
5. If N01 shows sequential fallback reads or avoidable capability waits dominate instead, remove only proven unnecessary dependencies while preserving capability-dependent event-source selection.

**Files:** `apps/web/src/app/app/review/page.tsx`, audio page if it shares the measured problem, `apps/web/src/lib/auth/session.ts`, `features/review/repository.ts`.

**Verification:** revoked/expired session, read-only user, access lookup failure, full-access controls, account isolation and request concurrency; compare paired route traces.

**Gate:** dependency chart changes from `identity -> access -> snapshot` to `identity -> (access || snapshot)` without weaker authorization. Expected saving is bounded by the overlapped work, not the sum of both requests. Skip if measurement shows negligible benefit.

## N03 — Optimize the measured server/database bottleneck

**Purpose:** make the snapshot itself cheap if it dominates after N02.

1. Capture authenticated-role `EXPLAIN (ANALYZE, BUFFERS)` on a disposable database with realistic fixture sizes and corrections. Inspect the effective-events lateral correction lookup, ordering, limit, ownership filtering and JSON aggregation.
2. Verify existing indexes before proposing one. Add an index or adjust a read-only query only when the plan identifies the cost; retain deterministic tie ordering and exact global newest-5,000 event selection.
3. Compare SQL execution time to RPC end-to-end time. If SQL is fast but round trips are slow, verify the actual server-function and database regions through project-scoped configuration/telemetry. A browser edge location is not proof of a function's region.
4. If geographic placement is the demonstrated issue, prepare the exact project-level hosting change and rollback. Do not alter organization settings or assume a region from the user's location. Apply remote changes only within release authorization.

**Files:** snapshot migration successor if needed; `scripts/postgres-tests/web-review-snapshot.test.mjs`; project hosting configuration only if justified.

**Verification:** old/new workspace parity, two-account RLS, anon denial, corrections, deleted/unassigned words, 5,000/5,001 cutoff, tied timestamps and selected Adaptive outputs.

**Gate:** lower measured snapshot/route latency without changed data semantics. If SQL/region costs are small, record a skip and proceed.

## N04 — Reduce initial client work

**Purpose:** remove code needed only after the setup screen if download/parse/hydration is material.

1. Attribute initial route chunks using the same webpack production build as deployment.
2. Evaluate lazy-loading `ReviewDetails` and its `WordDetailCard` subtree first. Evaluate the active session UI only if it contributes substantial initial cost.
3. Keep setup controls immediately usable; avoid shifting a large serial chunk/data delay to the first wrong Recognition answer or Start. Compare first and cached detail opening.
4. Profile setup render and hydration, including `selectReviewWords`. Optimize only measured repeated work. Inspect telemetry startup only if profiles attribute cost to it; `tracesSampleRate: 1` alone does not prove it is slow.

**Files:** `ReviewWorkspace.tsx`, `ReviewDetails.tsx`, `useReviewSession.ts`, the measured dependency subtree.

**Gate:** lower initial transferred JS or main-thread cost and a measurable setup benefit; first card/detail latency remains acceptable. Skip if the server wait dominates and this has negligible impact.

## N05 — Prefetch Review selectively, with freshness tests

**Purpose:** improve a common warm navigation without creating broad background reads.

1. Measure current Next Link behavior on the installed version. `loading.tsx` can enable partial prefetch; it does not prove the complete authenticated snapshot was prefetched.
2. Test an intent-triggered full Review prefetch on the principal Review link (pointer intent and keyboard focus), with a bounded request lifetime/deduplication. Compare ordinary navigation and an immediate touch tap with no prefetch lead time.
3. Reuse framework navigation caching first. Do not add a global private-data cache or prefetch every collection/audio variation. Do not enable Cache Components/PPR as an incidental change.
4. Cover assessment/correction followed by Exit, prefetched destination, Back/Forward, new word/import/delete, logout/account switch and late requests. Inspect `ReviewFreshnessProvider` races before relying on its invalidation. Fix demonstrated race regressions before enabling the optimization.
5. Record speculative request counts and wasted bytes alongside click latency. Prefetch moves work earlier; it does not reduce cold backend execution time.

**Files:** `apps/web/src/components/app/AppNavigation.tsx`, `ReviewFreshnessProvider.tsx`, `features/review/freshness-actions.ts`, focused browser tests.

**Gate:** faster warm setup, bounded extra traffic, current counts/data after mutations, no cross-account reuse. Cold navigation remains independently measured.

## N06 — Consider a compact setup only if the full payload still dominates

**Purpose:** address remaining large RSC payloads after smaller improvements.

This is a conditional design stage with a wider data contract. Do not start implementation until its contract and tradeoff are recorded.

1. Measure the contribution of words, translations, media URLs and effective events to real transferred/decoded bytes, server serialization and browser parsing.
2. Design a lightweight setup response (collections and exact scope counts/capabilities), with full session data loaded in the background or on Start. Scope counts must retain browser-local due-date semantics, difficult-word rules and unassigned words.
3. Preserve a complete, consistent session snapshot when Start commits to a session. If summary and session data were read at different times, define how counts are refreshed and the final eligible queue is selected; never silently mix them.
4. Keep the entire candidate vocabulary, exact adaptive evidence selection, required translations and immutable question snapshots. Do not obtain speed by restricting sessions or history. Any compact event/candidate format needs parity tests.
5. Give errors, cancellation, scope changes, account changes and duplicate Start explicit ownership. Measure navigation-to-first-card as well as setup readiness; report any shift of waiting time to Start honestly.

**Files:** review page/setup/workspace, repository and versioned read contracts, controller initialization, a new additive RPC/owned reader only if necessary.

**Gate:** a materially faster usable setup plus acceptable end-to-end first-card timing, exact eligibility/learning parity and a clear snapshot-consistency contract. Stop at a separate design proposal if these cannot be satisfied without changing product behavior.

## N07 — Profile Start and later-card responsiveness separately

**Purpose:** finish remaining interaction work without confusing it with page navigation.

- `prepareReviewQuestionsAsync` publishes progress for every word and builds the recognition index even for pure recall/production sessions. Measure render notifications and unnecessary index cost; publish progress at useful batch boundaries and avoid an unused index when justified. Keep cancellation and final progress correct.
- Profile one-time adaptive decisions/index construction for main-thread tasks exceeding 50 ms. Batch that work before considering a worker.
- `useReviewSession` recomputes the flow summary and `ReviewSessionNavigation` maps the full history into options. Measure beginning, 100, 1,000 and 2,499 history entries; memoize by actual stable inputs if the profile justifies it.
- Exercise full-detail cache invalidation, failed/aborted requests and reopen after an unrelated word's assessment. Optimize revision granularity only with freshness tests.

**Gate:** preloaded Start and local navigation budgets from the measurement contract; all queued words and keyboard/history behavior retained. No claim that these changes fixed initial server loading.

## N08 — Validate, release in bounded steps, remeasure

1. After each implemented stage, record files, exact checks, paired measurements, decision and next action. Skipped conditional stages need evidence, not implementation for its own sake. Stop adding performance changes when targets are met and remaining cost is acceptable.
2. Run focused behavior tests while iterating. Before a code PR run web lint, typecheck, tests, production build and the isolated navigation scenarios. Run database tests for SQL changes. Keep existing required CI gates, including mutation tests, intact.
3. Package small independent improvements separately where practical. For each release identify the exact commit, migration prerequisites/order, project, verification procedure and rollback build. Leave new read-only RPCs in place on code rollback.
4. Verify the actual domain build and active RPC path after deployment, then repeat cold/warm live reads under comparable conditions. Do not report green CI or a loader paint as performance evidence.

Final report fields: before/after setup median and range, first-card timing, auth/RPC/SQL breakdown, actual payload/JS bytes, server request counts, browser long tasks, freshness/correctness results, deployment SHA and unresolved limitations.

## Resume prompt

```text
Execute the next unfinished stage of docs/plans/web-review-navigation-follow-up-2026-09-12.md.
Read AGENTS.md, apps/web/AGENTS.md and the navigation execution log first.
Inspect the current branch, worktree, served release and completed evidence; do not repeat completed work.
Explain progress in Russian and keep code, commands, logs and documents in English.
Record measurements and validation for this stage, then identify the next stage.
Preserve authentication, all eligible words, adaptive evidence, immutable history and server-acknowledged saves.
Honor existing authorization; do not infer permission for new hosted migrations or deployment from this plan alone.
```

## Documentation consulted

- [Next.js linking and navigation](https://nextjs.org/docs/app/getting-started/linking-and-navigating): loading boundaries, streaming and dynamic navigation.
- [Next.js Link reference](https://nextjs.org/docs/app/api-reference/components/link): prefetch controls; verify the installed 16.3.3 behavior rather than importing newer configuration assumptions.
- [Next.js loading convention](https://nextjs.org/docs/app/api-reference/file-conventions/loading): feedback versus completion of server-rendered content.
