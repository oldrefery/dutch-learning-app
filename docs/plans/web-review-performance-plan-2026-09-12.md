# Web review performance implementation plan

## Execution contract

Read [the research](web-review-performance-research-2026-09-12.md) before the first stage. Use [the launch prompt](web-review-performance-launch-2026-09-12.md) to start implementation. This document is a plan, not evidence that any optimization has shipped.

The default executor is **GPT-5.6 Terra / High**. Execute stages W00–W11 sequentially. Each stage must leave a reviewable diff and record its tests and evidence. W10 contains explicitly conditional refinements: complete its assessment, implement only changes justified by the recorded measurements, and document why other refinements were skipped. Do not start an unfinished stage over after context compaction; consult the execution log.

The authorized implementation scope is local web code, additive read-only database migrations, isolated tests and documentation. Keep existing application behavior except for the identified Audio Review wiring defect and explicitly specified performance/lifecycle changes. Production deployment, hosted migration application, account changes, publishing, push and merge are separate release actions. Do all local preparation before requesting release approval. Missing production access does not prevent the local implementation.

### Repository startup

Read root `AGENTS.md`, `.claude/CLAUDE.md` as read-only, `apps/web/AGENTS.md`, relevant local Next.js documentation and this plan. Apply Context7 for third-party API changes. Follow repository language rules: Russian explanations; English code, comments, docs, commands and logs.

Record `git status --short`, branch and HEAD. If starting from an unchanged main checkout, update it with `git pull --ff-only origin main`, then create `feature/web-review-performance`. If these plan documents are untracked, preserve them when creating the branch. Do not overwrite unrelated changes or use reset/clean/stash without understanding what would move. If resuming on the feature branch, continue there; do not switch to main and discard work. Branch creation and normal local implementation do not need another confirmation.

Use the repository's Node 24 and npm 11 runtime. The exploratory Node 20 benchmark is not the implementation runtime. Do not run Expo/EAS for this web task. Any exceptional Expo/EAS remote work remains subject to the `oldrefery` identity rule; `guardia` is forbidden.

Create `docs/plans/web-review-performance-execution-2026-09-12.md` at implementation start with:

- Base/current commit and branch; runtime versions.
- Current stage and completed checklist.
- Files changed per stage; exact commands and outcomes.
- Baseline/after measurements and artifact paths.
- Deferred hypotheses, failures, migration readiness and release status.
- The exact next action, so a new context or model can resume.

### Non-negotiable invariants

1. Web `saved` still means an authoritative server acknowledgement. No optimistic SRS or next-card progression before acknowledgement in this plan.
2. Unknown save outcomes retain the entire retry command: event ID, assessment, mode, correctness, original timestamps and response time. One logical assessment produces one event.
3. Questions/history keep immutable word and option snapshots. Corrections update effective results and canonical future-session data without mutating the original question or adding a review.
4. Recognition retains language fallback, semantic-overlap exclusion, same-part-of-speech preference, one correct option and at least two distractors. Exact distractor identities may change, but must remain deterministic for the same vocabulary/word and stable during a session.
5. Keep every eligible word. No hidden session cap, smaller adaptive-history limit, arbitrary distractor sample or silent truncation.
6. Preserve the 600 ms minimum feedback interval from answer selection; save latency overlaps that interval. Details/history/backgrounding revoke automatic advancement. Foregrounding does not silently resume it.
7. Assisted attempts keep Again/Skip restrictions. History browsing never writes, skips or replaces the active question.
8. All caches and asynchronous ownership are account-scoped. Logout, account changes and unmount reject stale completions. Backend access remains authenticated and RLS protected.
9. Keep existing `getUser` revocation semantics. Do not replace authentication with trusted cookies, decoded JWT claims or `getSession().user`.
10. Do not modify existing migrations, SRS formulas, correction RPC protocols or the mobile implementation as a shortcut.

## Measurement contract

### Fixtures

Use deterministic synthetic IDs and content, with 0, 1, 100, 500, 1,000, 2,500 and 5,000 words. Make vocabulary size and selected queue size independent: include 20 selected words in a 5,000-word vocabulary. Include unique translations, extensive overlap, missing/invalid JSON translations, English-only, Russian-only, mixed parts of speech and words without collections. Event sets: 0, 499, 500, 501, 4,999, 5,000 and 5,001, including tied timestamps and corrected ratings. Event records can be distributed across selected and unselected words.

For long-session rendering, prepare history at positions 0, 100, 1,000 and 2,499 using real domain transitions or validated synthetic flow fixtures. Do not automate thousands of production writes to reach the end of a session.

### Measures and provisional targets

These are engineering targets to test, not achieved results or production SLAs. Freeze the fixture, machine, browser version, CPU throttle and network profile before comparing changes. Report five-run median and min/max for lab timing. Use enough field samples before reporting production tail percentiles.

| Measure                           | Boundary                                       | Initial acceptance target                                                                                           |
| --------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Start feedback                    | Click to visible preparation state/first card  | At most 100 ms median on unthrottled desktop; at most 200 ms with 4× Chromium CPU throttle                          |
| First usable card, preloaded data | Click to mounted and keyboard-ready first card | 2,500 Adaptive words: at most 1 s median desktop; at most 3 s at 4× CPU                                             |
| Large queue retention             | Requested to prepared question count           | Exact equality for 2,500/5,000 eligible words                                                                       |
| Preparation task size             | Main-thread chunks                             | No repeated preparation tasks over 50 ms on desktop; record unavoidable index-build/single-operation outliers       |
| Local navigation                  | Previous/return to current/skip to next paint  | At most 100 ms median desktop at beginning and end of session                                                       |
| Manual next card                  | Acknowledgement to next usable card            | At most 100 ms median desktop                                                                                       |
| Fast Recognition                  | Answer to next card                            | Approximately max(600 ms, acknowledgement latency), plus measured render overhead                                   |
| Save request work                 | Per successful ordinary assessment             | One persistence RPC; no vocabulary/history reread or routine route rerender caused by explicit invalidation         |
| Cached full details               | Reopen unchanged word in same session          | No second data request; at most 100 ms median desktop                                                               |
| Initial data request counts       | After auth, server-to-database                 | Collection summary: one RPC; Review snapshot: one RPC on migrated backend                                           |
| Overall loading                   | Cold authenticated Collections and Review      | Record TTFB, fallback paint, usable content and payload; target at least 50% improvement where paged reads dominate |

A fast loader cannot satisfy the first-card target. A fast acknowledgement cannot satisfy the next-card target if rendering remains slow. Do not use `networkidle` as the only completion marker: prefetch and telemetry can continue after the application is usable.

Record separate marks/spans for auth, access lookup, capability discovery, database pages/RPCs, mapping, session preparation, index construction, controller creation, first-card commit, assessment request, acknowledgement, next-card commit, detail read and playback start. Use `performance.now()` within one process; do not subtract server and browser clocks. Correlate requests with opaque diagnostic IDs. Avoid words, translations, emails, tokens and raw URLs in telemetry.

## Stage map

| Stage | Result                                               | Dependencies         | Relative scope                    |
| ----- | ---------------------------------------------------- | -------------------- | --------------------------------- |
| W00   | Reproducible baseline and fixture harness            | None                 | Medium                            |
| W01   | Correct Audio Review account and mode                | W00                  | Small                             |
| W02   | One recognition index per web session                | W00                  | Medium                            |
| W03   | Responsive, cancellable preparation                  | W01, W02             | Medium                            |
| W04   | Compact assessment path and boundary freshness       | W03                  | Large; two sub-stages             |
| W05   | Identity-only authentication where appropriate       | W04                  | Small                             |
| W06   | Aggregate collection statistics and streaming chrome | W05                  | Medium; migration plus UI         |
| W07   | Single read-only Review snapshot                     | W06                  | Medium; migration plus repository |
| W08   | Account-scoped full-detail cache                     | W04, W07             | Medium                            |
| W09   | Long-session rendering and audio lifecycle           | W03, W08             | Medium                            |
| W10   | Measured bundle/hosting refinements                  | W06–W09              | Conditional                       |
| W11   | Full validation and release handoff                  | All preceding stages | Medium                            |

## W00 — Capture an honest baseline

**Read:** `apps/web/package.json`, `playwright.config.ts`, `playwright.fixtures.config.ts`, `jest.config.mjs`, existing review fixtures/tests, `scripts/postgres-tests/cluster.mjs`, and the research measurement limitations.

**Implement:** a small reproducible performance harness under `scripts/web-performance/` and browser fixtures under `apps/web/e2e/` with a separate configuration. Reuse actual preparation, controller and review components; do not duplicate the algorithm into a standalone benchmark that can drift. Keep benchmark support out of production routes and bundles.

1. Add deterministic vocabulary/event generators with distinct Q and V sizes.
2. Establish pure preparation timing plus a mounted browser scenario for Start, correct/wrong Recognition, manual assessment, previous word, full details and return to current.
3. Inject a persistence transport with immediate, 100 ms, 500 ms and 2,000 ms acknowledgements, failure, and lost-response scenarios. Capture acknowledgement and next-paint separately.
4. For server rendering and RSC request counts, use a disposable local app build and a local fake Supabase HTTP upstream or a dedicated local backend. Browser `page.route` cannot intercept requests made by the Next server. Keep production environment files and saved sessions out of the isolated harness. Fail closed if the upstream points outside loopback.
5. In the production-build fixture, capture three action cases: baseline invalidations, only the Review invalidation removed, and both routine invalidations absent. The fixture variation must be outside shipped code. Observe action-result timing and server read counts; do not infer them from response size alone.
6. Use `next build --webpack`/`next start` for route performance because that is the production bundler. Existing dev-mode E2E timings are not acceptance numbers. Build in an isolated directory; do not overwrite a running developer's `.next` output. Disable telemetry/upload behavior in that isolated build and provide fake public backend settings. A fixture-specific Sentry configuration can set `sourcemaps.disable: true`; do not assume a made-up environment variable disables uploads.

**Outputs:** baseline JSON/Markdown with browser/runtime versions, fixture revision, durations, long-task counts, bytes and request counts. Store sanitized fixture artifacts under a documented ignored output directory. Do not commit real HAR credentials or personal word content.

**Gate:** reproduction shows the Adaptive scaling problem and distinguishes action acknowledgement from RSC work. Missing authenticated production access is recorded, not treated as a reason to skip local measurements. No fixed wall-clock assertions in ordinary Jest tests.

## W01 — Repair the Audio Review call contract

**Files:** `app/app/review/audio/page.tsx`, `features/review/AudioReviewWorkspace.tsx`, a new adjacent component test, and only necessary call sites.

1. Pass `auth.userId` from the page into the audio workspace.
2. Call `useReviewSession` with that user ID and explicit fifth argument `'meaning-recall'`.
3. Key the mounted account workspace by user ID, as standard Review does, so changing accounts cannot reuse a controller created for another account.
4. Preserve existing audio controls and per-word playback behavior.

**Tests:** flow userId is authenticated identity; every prepared question is Meaning recall; recognition option building is not invoked; one rating submits the correct mode; changing user remounts and ignores old callbacks. Do not assert a server security bypass existed.

**Gate:** Audio Review does no recognition preparation and retains its original intended UI behavior.

## W02 — Build recognition candidates once

**Files:** `features/review/review-domain.ts`, `session-questions.ts`, a focused `recognition-options.ts` if it improves separation, and adjacent tests. Read the native `utils/reviewDistractors.ts`; do not import it into web.

1. Extract a factory accepting the complete web vocabulary. Normalize candidate labels and semantic translation keys once; compute stable per-candidate rank once; sort once; index by part of speech.
2. Per word, choose a deterministic rotated starting position, inspect preferred candidates first, fall back to the whole pool and stop as soon as enough distinct alternatives are found. Never select the current word or candidates overlapping any already chosen translation key.
3. Keep the existing web handling of arbitrary `Json`: malformed objects, missing arrays, blank labels and language fallback. Do not directly assume the stricter native Word shape.
4. Keep `buildRecognitionOptions` as a convenience wrapper if existing callers/tests need it, but the session preparation path must use one factory instance for the whole session.
5. Compute adaptive decisions only in Adaptive mode. Keep decision ordering and history limits unchanged.
6. Preserve translations as immutable payload snapshots. Do not remove cloning merely because it appears in a profiler; first prove equivalent snapshot isolation.

**Tests:** option correctness, semantic duplicates across languages, deterministic output with shuffled vocabulary, tie handling, mixed parts of speech, insufficient distinct options, invalid JSON, 2,500/5,000 full queues, and exactly one factory/index construction per preparation. Compare behavioral invariants, not old distractor identities.

**Gate:** full queue retained; same input gives stable options; browser preparation improves substantially on the original fixture. Record adversarial overlap timing too: the indexed builder can still scan many candidates when distinct distractors are scarce. Do not claim a strict linear worst-case bound.

## W03 — Make preparation asynchronous and cancellable

**Files:** `session-questions.ts`, a small `session-preparation.ts` adapter if needed, `session-controller.ts`, `useReviewSession.ts`, `ReviewWorkspace.tsx`, `AudioReviewWorkspace.tsx`, review CSS and adjacent tests.

Define preparation as a discriminated state: idle, preparing with completed/total, or error. Keep it distinct from an active flow and from persistence saving/failed state.

1. Publish preparing immediately, then yield before expensive setup so feedback can paint. Build and measure the one-time index separately.
2. Prepare at most 50 questions or approximately 8 ms of question work per batch, checking elapsed time after each question. Use `scheduler.yield()` when available with a `setTimeout(0)` Promise fallback. An already-resolved Promise is not an equivalent task boundary. Do not require the Scheduler API in Safari/Firefox.
3. Treat 8 ms as a cooperative budget, not a hard bound on one normalization, sort or question. If the one-time index exceeds the long-task target at 5,000 words, record it for W10 rather than disguising it.
4. Claim a preparation generation synchronously before starting; disable duplicate Start. Capture scope/mode/collection/manual preference for that generation. Scope changes during preparation must explicitly cancel/restart or remain disabled; do not mix settings from two requests.
5. Cancel on explicit Cancel, hide, unmount, account change and a superseding start. Use both `AbortSignal` and current generation/account ownership when publishing results. Stale completion must not install a flow.
6. Publish a complete valid flow atomically. The first question's `startedAt` must be set after preparation completes, so response time excludes preparation latency. Do not expose a partially prepared queue or mark a failed/aborted session cached.
7. Show accessible preparation progress, Cancel and retryable failure. Preserve previous settings on cancellation. Do not return a boolean when a promise is now required; use an explicit async start result and update all callers/tests.
8. Audio Review must play the first prompt only after a successful start. After an async boundary, playback may lose user activation; show Replay on policy rejection and keep the card usable.

**Tests:** duplicate starts, cancel before index/after yield/near completion, error then retry, account switch, hidden tab, StrictMode attach/detach, stale completion after newer start, no partial flow, all words retained, initial response time, audio startup and fallback. Scheduler fallback must run in a real browser as well as a controlled unit scheduler.

**Gate:** Start feedback and first-card targets; cancellation stays usable at 5,000 words; existing assessment/history/correction invariants remain intact.

## W04 — Remove per-answer route work and preserve freshness

This is one feature with two sub-stages. Do not ship W04a without W04b. Keep the existing Server Action transport first; changing every mutation to a Route Handler is unnecessary for the established bottleneck.

### W04a: mutation result only

**Files:** `features/review/actions.ts`, `correction-actions.ts`, their behavior tests, controller transport integration and performance fixtures.

Remove routine `revalidatePath` calls from successful ordinary assessments and corrections. Keep the atomic RPC, validated authoritative acknowledgement, error classification, exact retry payload and correction capability checks. Do not replace invalidation with another immediate refresh API or per-answer cookie mutation. Legitimate auth refresh can still set session cookies; preserve it and measure it as an exceptional auth path.

Mark relevant account data dirty through an account-scoped coordinator owned above the review route. Wrap the transport so this notification is not lost when the review component unmounts. A confirmed success marks dirty; an unknown outcome can conservatively mark possibly dirty because the server may have committed. Failed validation with no attempted persistence need not mark dirty. Track in-flight attempts so boundary refresh cannot race ahead of a possibly committing request.

**Tests:** one assessment RPC, no routine refresh, one identical retry, no double write, late response after route leave, correction acknowledgement behavior, expired-auth path. Update tests that currently expect exactly two invalidations; replace that implementation expectation with the new observable contract.

### W04b: refresh at session boundaries

**Files:** a small account-scoped freshness coordinator/provider under `components/app/` or `features/review/`, `AuthenticatedShell.tsx`, review completion/exit call sites, one authenticated boundary Server Action, and focused tests.

Use a monotonic dirty revision and track the current account. Coalesce successful attempts during a review into one boundary flush. A flush may run after explicit settled Exit, completed session, or navigation away from review once attempts settle. Do not perform it between answers. Do not rely on an async unmount cleanup or `beforeunload` for correctness.

The initial boundary action may conservatively call `revalidatePath('/app', 'layout')` once for the completed dirty revision. This deliberately trades one broader refresh at a boundary for eliminating one after every answer, and refreshes Collections/detail pages, Review/audio, History, Insights and the shared badge. Do not add a second `router.refresh()` if the action already refreshes the current route. Narrow invalidation later only with equivalently complete freshness tests.

Rules:

- Never start a boundary flush while a tracked assessment/correction attempt can still commit; when it settles after navigation, the account-level coordinator must re-evaluate the pending boundary.
- Clear only the revision actually flushed. A mutation that finishes during a flush must remain dirty and cause a subsequent boundary flush.
- On failure retain dirty state for a later boundary/retry; do not replay the assessment to refresh statistics.
- A refresh is not proof that an uncertain assessment failed or succeeded. If the transport outcome is unknown, retain that uncertainty and the existing same-command retry path; do not label progress confirmed merely because a later read completed. Reload/crash recovery remains the existing non-durable web-session limitation, outside this plan. Browser navigation tests must distinguish confirmed late acknowledgements from permanently unknown outcomes.
- Reset coordinator state on account change and never apply an old account's callback to a new account.
- The active session, current question and history cannot be recreated from refreshed page props. On settled Exit, a fresh setup may adopt new canonical data; while active, preserve its immutable question snapshot.
- The navigation badge may remain the entry value while the learner is actively reviewing. It must refresh after a settled boundary. Do not decrement it blindly: Again can remain due, some words lack a collection, and corrections can reverse counts.
- Session refresh and full-detail invalidation are different: an edited word's detail cache must be invalidated immediately within the session, as specified in W08.

**Browser tests:** ten ratings produce ten persistence RPCs and zero routine Review reloads; completion/exit produces one coalesced refresh; sidebar and browser Back/Forward destinations show updated counts; prefetched destinations do not display persistent stale data; completion history remains usable; refresh failure is retryable; logout/account switch discards old coordinator state; a late commit after route leave results in a fresh destination.

**Gate:** authenticated production-build fixture proves request counts and fresh destination UI. If the coordinator cannot pass these tests, stop this stage with the failing trace; do not ship only the removed invalidations or weaken save semantics.

## W05 — Avoid unused access-level lookups

**Files:** `lib/auth/session.ts`, review mutation/detail authentication call sites, auth and action tests.

Expose an authenticated identity helper using the existing request-memoized `getUser` result. Have `requireAuthContext` compose identity plus access level, preserving its existing result and redirect behavior. Use the identity-only helper in review operations where the access level is not read and authenticated ownership is the actual permission requirement.

Keep full access checks on AI reanalysis and other gated actions. Do not change Proxy's token strategy, JWT keys, session policy or user permission source. Do not add a global auth cache. Request-level deduplication is enough for this stage.

**Tests:** unauthenticated and revoked-user paths prevent RPC/data reads; full/read-only learners keep existing review eligibility; access-gated AI remains gated; one request shares the verified identity lookup; routine assessment does not query `user_access_levels` unnecessarily.

**Gate:** unchanged authentication semantics with fewer hot-path database reads. Any proposed `getClaims` replacement is outside this stage.

## W06 — Aggregate counters and unblock the shell

### W06a: read-only collection overview RPC

**Files:** new migration, `features/collections/repository.ts`, a typed RPC contract adapter, `scripts/postgres-tests/web-collection-overviews.test.mjs`, repository tests. Existing migrations remain unchanged.

Add `get_web_collection_overviews_v1(p_today date)` returning the collection metadata and counts consumed by `CollectionOverview`. Use `SECURITY INVOKER`, fully qualified relations, explicit `(select auth.uid())` ownership, and least-privilege execute grants. Revoke default PUBLIC/anon execution. It must not accept an authoritative user ID from the browser.

Preserve current collection ordering and these rules: active words only; empty collections retained; unassigned words excluded from collection totals; established count uses the current domain threshold of three repetitions; difficult threshold is 2.1; new count uses zero repetitions; due count uses the supplied calendar date. Compute percentage consistently with current nonnegative `Math.round` behavior, or return integer counts and continue computing percentage in TypeScript.

For initial parity, pass the same server-local calendar date the current overview builder uses. Cover different dates explicitly. Do not introduce a new timezone cookie or silently replace the contract with database CURRENT_DATE in this migration. A later intentional browser/server date alignment belongs to W10 with dedicated tests.

Use an additive web-local typed extension if generated shared database types are not updated until rollout, following the existing correction contract pattern. Missing RPC (`PGRST202`/`42883` with the expected operation) may fall back to the original repository path; permission, timeout or malformed response errors must remain errors. Do not catch all failures and silently serve empty statistics.

**SQL tests:** empty account, empty collections, deleted words, unassigned words, two users, unauthenticated execution, thresholds, future/today/past dates, 2,500/5,000 words, and parity against the existing pure overview builder on an equivalent fixture. Use the private cluster helper with authenticated roles; no hosted database.

### W06b: streaming navigation statistics

**Files:** `app/app/layout.tsx`, `components/app/AuthenticatedShell.tsx`, `AppNavigation.tsx`, a small async statistics component, and render/browser tests.

Remove the full statistics await before returning the shell. Keep verified authentication first. Put the asynchronous badge/statistics content under its own Suspense boundary and pass it as a renderable slot where the client navigation needs it. Keep navigational links usable while the count loads. The fallback must mean loading/unavailable rather than a false zero. Statistics failure must not crash the entire authenticated shell; page-specific failures can still use their normal error UI.

Reuse a request-memoized overview query between the page and badge. Do not add a second browser-to-server fetch merely to duplicate data that the same server render already loads.

**Gate:** deliberate 2-second stats delay does not prevent authenticated chrome and the page loading UI from appearing; summary uses one RPC; account isolation and both desktop/mobile navigation layouts pass. A migration-missing backend remains functional through the measured fallback.

## W07 — Replace paged Review hydration with a consistent snapshot

**Files:** new migration, `features/review/repository.ts`, versioned contract/mapping tests, `scripts/postgres-tests/web-review-snapshot.test.mjs`. Review page props and the active controller interface should initially remain unchanged.

Add `get_web_review_snapshot_v1()` as a read-only, caller-security RPC returning one versioned JSON object containing `protocolVersion`, `correctionsAvailable`, `collections`, `words` and `events`. Include complete active-word fields currently selected by the repository and the current bounded effective event set. The new migration follows the existing correction migration, so advertise correction support only when that contract is present; older backends retain the capability-aware fallback. This is a transport consolidation, not a new adaptive algorithm. Preserve the full vocabulary because arbitrary narrowing changes distractor choices and available modes.

Contract:

- Derive ownership exclusively from authenticated database context; no authoritative `p_user_id`.
- Collections retain current name order. Words retain `next_review_date`, then `word_id` order and all fields required by current ReviewWord mapping.
- Events preserve global newest-5,000 selection, descending reviewed time/event ID, before any browser per-word filtering. Use effective assessments from the existing correction view. Do not discard events for deleted/unselected words before the existing global limit, because that would change which events survive.
- Return empty arrays instead of JSON null. Expose an explicit protocol version; validate the response shape and mapping on the server. Do not expose unexpected sensitive columns via `row_to_json(words.*)`.
- The scalar JSON envelope avoids truncation by the REST row-page limit; nevertheless measure total bytes and SQL memory/time on the 5,000-word fixture. Do not promise that it solves unlimited vocabulary growth.
- One SQL statement should assemble the snapshot so its reads observe one statement snapshot. Do not emulate atomicity with several HTTP requests.
- Preserve additive rollout: when the snapshot RPC is missing, use the existing capability-aware paged implementation. On the migrated path, do not make a second capability query. Generic errors must not trigger a misleading fallback success.

In the legacy fallback only, start independent word/collection requests before awaiting correction capability; events still wait for the source decision. Retain the existing helper's full-row behavior. Do not raise the global Supabase API row limit or parallelize unbounded offset pages as the fix.

**SQL/repository tests:** two-account isolation, anon denial, deleted/unassigned words, 499/500/501 boundaries, 5,000/5,001 event cutoffs, equal timestamps, corrections, all current word fields, null normalization, capability missing, malformed result and permission failure. Compare old and new mapped workspace values exactly on fixtures, then compare prepared Adaptive modes/options using the same web builder.

**Query-plan gate:** capture authenticated-role `EXPLAIN (ANALYZE, BUFFERS)` for the read RPC on a disposable cluster. Existing review-event and correction indexes should be inspected before adding more. Add a word composite/partial index only if the plan and measured runtime show a benefit; document write/storage cost. Never modify assessment triggers to improve a read benchmark.

**Gate:** one snapshot RPC after auth on the migrated path, all eligible words retained, same effective learning behavior and a recorded reduction in setup latency/round trips. Keep the large-payload redesign deferred if this meets the loading targets.

## W08 — Cache full details without blocking mutations

**Files:** `ReviewDetails.tsx`, `details-action.ts`/shared server detail reader, new `app/api/review/words/[wordId]/route.ts`, a small session cache, session invalidation hooks, and tests.

Use an authenticated GET Route Handler for full-card reads so they have normal request cancellation and do not join the Server Action dispatch queue. Keep the database query logic in a server-only helper; Server Components should call it directly rather than making HTTP calls to their own route. This API route is outside the current `/app` Proxy matcher, so it must verify identity itself. Validate word ID and ownership and return private/no-store responses with typed success/error data. Do not rely on a client-supplied userId.

Maintain a bounded in-memory cache owned by the mounted account/session, initially 50 successful entries. Deduplicate concurrent same-key requests. Use a key containing account, word and a per-word detail revision. Failed or aborted requests are evicted and can retry; a late request cannot restore a previous revision. Dispose on session/account teardown. Abort browser GET reads on cancellation where appropriate, while retaining generation checks because abort does not guarantee backend cancellation.

Invalidate a word after confirmed ordinary assessment, correction, server-version reconciliation, deletion or AI reanalysis. Existing history question snapshots remain untouched. Do not let cached full details claim old progress is current. Preserve error UI, Retry and account-switch behavior.

Start with demand loading. Do not prefetch all detail cards. A future one-card prefetch must demonstrate reduced wrong-answer/detail latency without delaying saves or leaking data across accounts.

**Tests:** reopen unchanged word makes no extra request; parallel openings share one request; after each mutation/reconciliation the next read is fresh; failed read retries; late old revision and old account results ignored; capacity eviction; owner mismatch/anon API denial; invalid word IDs; wrong Recognition answer still opens correct details and permits only intended ratings.

**Gate:** detail work does not serialize ahead of an assessment, cached reopen meets the target, and the cache cannot display stale confirmed progress after a local change.

## W09 — Keep later words as responsive as early words

### Rendering

Profile `useReviewSession`, `ReviewSessionNavigation`, summary derivation and card commits with beginning/end-of-session fixtures. Add a numeric session total instead of building the entire `sessionWords` list where only `.length` is used. Remove the list only after checking all consumers, including Audio Review.

Memoize history-derived summaries and option elements against the actual history reference; selection-only changes must not regenerate thousands of option nodes. Split narrowly scoped components/props so an outer `session` object recreated on every render does not defeat memoization. Preserve a native accessible selector and all entries initially. Do not spread memo everywhere or rewrite shared domain arrays without measured need.

**Tests:** summaries after correction, skips versus ratings, completion, previous/current navigation, stable pending question, keyboard focus and first/last history entries. Compare render durations at 100 and 2,499 entries. If DOM size alone still fails the budget, record the measured case for W10.

### Pronunciation lifecycle

Give standard Review the generation-guarded audio lifecycle already modeled by `useAudioReviewPlayback`, adapting it without changing auto-play preferences. Stop/dispose the previous audio when the word changes, details/history takes over where appropriate, the tab hides, the account changes or the component unmounts. An old failed `play()` must never speak the old word over the current one.

Preserve immediate keyboard/card interaction regardless of sound readiness. Handle missing URL, HTTP failure, rejected autoplay, speech fallback and repeated Replay. Do not silently auto-play history entries or resume hidden-tab playback. Do not download the whole session's audio.

**Gate:** long-session local navigation target; one active pronunciation source; no old-word fallback after navigation; both review modes retain keyboard/accessibility behavior.

## W10 — Assess remaining bottlenecks and apply only measured refinements

This assessment is required; the following changes are conditional. For each item record evidence, decision and result in the execution log. Do not convert this section into a blanket dependency upgrade.

| Candidate                         | Evidence needed                                                       | Allowed next step                                                                                                                                              |
| --------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lazy full-details code            | Production bundle attribution shows meaningful initial cost           | Dynamic-load the full details component with accessible fallback; measure first wrong-answer/detail opening to avoid a new serial code/data waterfall          |
| History selector DOM              | W09 still exceeds navigation budget due to option count               | Design a bounded-window or paginated selector preserving access to every entry and keyboard behavior; add end-of-session browser tests before replacement      |
| Very large preparation index      | One-time index task breaches responsiveness targets                   | Batch normalizing/indexing first; consider a Web Worker only after measuring clone/startup overhead and implementing cancellation/ownership tests              |
| Server/database region distance   | Authoritative Vercel and Supabase region settings plus network timing | Prepare the exact Vercel configuration change close to the database; no hosted change until release authorization                                              |
| Cold starts/bundle initialization | Several cold/warm traces isolate init cost                            | Reduce proven startup imports; inspect existing Fluid Compute settings before recommending an account/plan change                                              |
| Fonts/CSS/images                  | Measured render-blocking/layout/image cost                            | Adjust only identified resources, preserving theme and dimensions; normal ReviewCard does not load images                                                      |
| Sentry overhead/sampling          | Equivalent build measurements and actual event volume                 | Propose explicit environment sampling with preserved errors and useful review phase data; no blind SDK removal                                                 |
| Local-date discrepancy            | Reproduction near midnight in multiple timezones                      | Add an explicit tested client-date/timezone contract for counters; keep it separate from auth cookies and avoid per-answer cookie writes                       |
| Snapshot size still dominates     | Post-W07 bytes/parse time exceed loading targets                      | Design compact candidate metadata and selected-card hydration as a separate follow-up; preserve the entire candidate semantics and active snapshot consistency |

Do not implement a durable outbox, offline-first web rewrite, materialized adaptive-state table, Redis, a new query framework, PPR/Cache Components migration, framework upgrade or a shared mobile-state rewrite as an automatic performance improvement. They need an independent problem statement and design. Preserve the current full history limit and all words.

**Gate:** every candidate is implemented with measured evidence or explicitly deferred with its rationale. Lack of remote region access is a documented release investigation item, not a reason to guess a region or abandon completed local work.

## W11 — Validate, summarize and prepare release

Run checks proportionate to the actual diff. Root scripts are workspace-specific; use web commands. Run the shared/mobile suite only when shared runtime code was changed or a cross-client contract requires it. Do not run an Expo build for web validation.

```bash
npm run web:test -- --runTestsByPath apps/web/src/features/review/useReviewSession.test.tsx apps/web/src/features/review/ReviewWorkspace.test.tsx apps/web/src/features/review/actions.behavior.test.ts
npm run web:test
npm run web:lint
npm run web:typecheck
npm run test:db
git diff --check
```

Run new focused tests while implementing each stage, then the full web suite at completion. The SQL suite uses `scripts/postgres-tests/cluster.mjs`; discover local PostgreSQL binaries and use `WOORDENAAR_PG_BIN` when required. It creates a private local cluster and must not load hosted credentials. Add new tests to the runner's existing glob conventions.

Use the isolated production-build harness from W00 for browser/HTTP acceptance. Existing `web:e2e` may use credentials and mutating fixtures; do not run it blindly against a hosted URL. A local `web:build` must use the controlled environment described in W00 to avoid uploads/real backend access. Run Prettier on changed files; before a PR, honor the repository formatting gate and inspect any broad formatter diff rather than retaining unrelated churn.

Required browser matrix:

- Chromium desktop: cold/warm Collections, Review setup, Start in each mode, all rating paths, details/retry/reanalysis, corrections/conflicts, completion and next session.
- Chromium with 4× CPU throttle: 2,500/5,000-word preparation and cancellation; long-session navigation.
- WebKit and Firefox: task-yield fallback, keyboard navigation, timing cancellation, detail loading, audio policy failures, light/dark UI and 390 px layout.
- Simulated network: 100/500/2,000 ms saves, lost acknowledgement, failed retry, route leave during save, delayed full details, refresh failure and auth refresh.
- Freshness: entry badge, completion, explicit Exit, sidebar navigation, browser Back/Forward, prefetched destination and account switch.
- Local database: read RPC RLS, fallback rollout, old/new mapping parity, correction semantics and all existing assessment/idempotency tests.

Write final before/after measurements with identical methodology. Explicitly separate CPU preparation, full mounted first-card time, server data loading, acknowledgement, card paint and audio start. Report failures or unmeasured production claims instead of filling them with estimates.

Release preparation must include migration order, backward-compatible fallback, exact tested commit, deployment assumptions, rollback to the prior web build, and verification steps for the real domain. Roll back code without deleting the new read-only functions; do not roll back shared migrations destructively. Remote migration/deploy/promotion remains a separately authorized action.

### Definition of done

- [ ] All required stages have recorded outcomes; conditional refinements have explicit decisions.
- [ ] Audio Review uses the correct identity and Meaning recall mode.
- [ ] Large Adaptive sessions meet measured startup/responsiveness targets without losing words.
- [ ] No ordinary answer causes routine vocabulary/history reload or page invalidation.
- [ ] Save/retry/correction and account-isolation tests pass unchanged in meaning.
- [ ] Boundary freshness works for completion, exit and navigation races.
- [ ] Summary and Review data use additive one-RPC reads where available, with tested fallback.
- [ ] Details cache invalidation, long-session rendering and media cleanup pass.
- [ ] Web/SQL checks and real browser fixture runs are reported, including limitations.
- [ ] Application code is reviewable; no unrelated changes or unauthorized release actions.

If a required measurement target still fails, keep that stage incomplete and record the precise bottleneck and a bounded next fix. Do not label the task complete because the loader appears quickly, unit tests pass, or most files have been edited.
