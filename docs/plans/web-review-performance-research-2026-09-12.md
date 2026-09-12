# Web review performance research

## Decision

Fix the synchronous question-preparation algorithm first, then remove repeated route refreshes from the assessment path without weakening persistence guarantees. Reduce initial database round trips with read-only aggregate RPCs and decouple navigation chrome from statistics. Treat detail loading, long-session rendering, and media as separate workloads.

Use GPT-5.6 Terra with High reasoning to implement the companion plan in small, verified stages. This is an engineering recommendation, not a benchmark of models on this repository. The detailed execution contract is in [the implementation plan](web-review-performance-plan-2026-09-12.md); the copyable task is in [the launch prompt](web-review-performance-launch-2026-09-12.md).

## Scope and evidence

The inspected checkout was `main` at `8536d8e`. The web application declares Next.js 16.3.3, React 19.2.8, `@supabase/ssr` 0.9.0 and `@supabase/supabase-js` 2.98.0. It is separate from Expo in `apps/mobile`. Cache Components is not enabled in `apps/web/next.config.ts`. Documentation was checked on 2026-09-12. Some live Next.js pages describe 16.3.5 or canary; the installed 16.3.3 documentation and implementation take precedence for exact behavior.

Evidence categories used below:

- **Measured:** a browser or Node observation on a described fixture.
- **Code-confirmed:** behavior directly visible in this checkout, without a production duration claim.
- **Hypothesis:** requires a trace, query plan, deployment inspection or field sample.

No application code, database, deployment, production learning result, authentication configuration or account was changed during this investigation. No authenticated production waterfall or field p50/p95 was collected. Browser microbenchmarks execute the actual transpiled preparation modules on synthetic data, not the complete mounted application. The anonymous site check does not represent authenticated Collections or Review performance.

## Observed preparation costs

Synthetic words had unique UUIDs, noun part of speech, distinct English and Russian translations, and no review history. Therefore all Adaptive questions selected Recognition. The selected set and vocabulary had the same size. Module loading was outside the measured preparation interval. Measurements were exploratory single observations, without CPU throttling or repeated-run percentiles.

| Runtime                   | Words | Meaning recall preparation | Adaptive preparation |
| ------------------------- | ----: | -------------------------: | -------------------: |
| Chrome 152, macOS         |   100 |                       1 ms |                43 ms |
| Chrome 152, macOS         |   500 |                       2 ms |               794 ms |
| Chrome 152, macOS         | 1,000 |                       4 ms |             3,404 ms |
| Chrome 152, macOS         | 2,500 |                      10 ms |            24,573 ms |
| Node 20.19.5, local shell |   500 |                       2 ms |             1,336 ms |
| Node 20.19.5, local shell | 1,000 |                       6 ms |             6,425 ms |
| Node 20.19.5, local shell | 2,500 |                       9 ms |            41,773 ms |

The existing mobile indexed builder, adapted only to its input field names and executed in the same Chrome context, built options for 2,500 words in 16 ms. That measurement includes index construction and option generation, but not all question preparation, controller creation or rendering. It establishes a useful algorithmic direction, not a promised full-session speedup. The Node observation also uses an older runtime than the repository's required Node 24; implementation acceptance must use Node 24 and actual browsers.

The 2,500 synthetic web words serialized to approximately 990 KB of uncompressed JSON, excluding events and RSC framing. This is a fixture size, not measured production transfer size.

One anonymous navigation to `https://woordenaar.app` redirected to login: redirect time 316 ms, first contentful paint 1,104 ms, load 1,116 ms. It provides no evidence that authenticated navigation is fast or that production infrastructure is correctly placed.

## Findings by interaction

### F1. Start Review blocks the main thread

**Measured and code-confirmed; highest priority.** `apps/web/src/features/review/session-questions.ts` maps every selected word synchronously. `review-domain.ts:buildRecognitionOptions` normalizes and filters the whole vocabulary for each Recognition question, sorts candidates, repeatedly calculates pair-specific hashes inside the comparator, then filters the whole candidate array before taking three options. For Q Recognition questions and V vocabulary entries, the dominant work is approximately O(Q × V log V), plus repeated allocations and normalization.

`session-controller.ts:start` performs this work before publishing the new flow. There is no preparation state, progress, cancellation or retry UI. Merely marking the handler `async`, wrapping it in a Promise, or using `startTransition` will not make its synchronous CPU work interruptible. React calls the transition function immediately.[^1] Browsers need real task boundaries to handle input and paint.[^2]

The native application already has `createRecognitionOptionBuilder` and batched question preparation. Reuse the algorithmic design through a web-specific adapter, preserving web JSON validation, English/Russian fallback and immutable question snapshots. Avoid a native import into the web bundle or an unnecessary mobile refactor.

### F2. Audio Review accidentally uses Adaptive preparation

**Code-confirmed defect.** `AudioReviewWorkspace.tsx` calls `useReviewSession(data, 'all-due', null, 'meaning-recall')`. The fourth argument is the user ID, and the fifth argument defaults to Adaptive. Its page authenticates the user but does not pass that identity into the component.

Consequences: the audio flow stores the literal mode name as its account identity and can run the expensive Recognition preparation despite being presented as a recall exercise. Server persistence still authenticates independently; this finding does not establish a server authorization bypass. Correct the argument wiring and add a mounted component regression before changing the shared hook lifecycle.

### F3. Assessments invalidate the current route

**Code-confirmed; production contribution not measured.** `actions.ts:submitReviewAssessment` performs authentication, calls the atomic RPC and invokes `revalidatePath` for both Collections and Review. Correction actions invalidate four routes. The controller only advances after its persistence promise confirms success.

Installed Next.js code in `node_modules/next/dist/server/app-render/action-handler.js` checks whether the action revalidated, not whether the application merely removed one particular path. The client reducer also clears navigation caches on relevant revalidation. Official documentation describes a response containing both the action result and refreshed server component data.[^3] Removing only the Review invalidation while retaining the Collections invalidation is therefore not an adequate fix.

**Attribution correction:** redundant server work is established, but it is not established that every millisecond of full RSC regeneration delays the awaited action result. The framework streams the response and resolves the action value separately from committing navigation. Measure RPC completion, client acknowledgement, RSC completion and next-card paint separately. Do not report the whole response duration as save latency without that evidence.

The preferred first implementation keeps Server Actions, atomic server acknowledgement, exact retry identity and server-authoritative SRS. Move freshness work to explicit session boundaries. Do not substitute `refresh`, `updateTag`, an unawaited invalidation or a per-answer cookie write. Do not introduce persistent tagged caches just to use a different invalidation API. The stale-while-revalidate form of `revalidateTag` has different semantics and does not automatically solve this application's uncached Supabase reads.[^4]

### F4. Database reads form multiple waterfalls

**Code-confirmed.** The authenticated layout waits for `requireAuthContext`, then complete collection overviews. These overviews fetch every active word's summary to calculate counters. Review separately loads a richer vocabulary and up to 5,000 effective review events. Collection selection only changes the browser-side selected set; it does not narrow initial Review loading.

`fetch-all-rows.ts` reads sequential pages of 500. At exactly 2,500 words it makes six requests, including the empty terminating page. At 5,000 events, the explicit limit ends after ten full pages. These are server-to-Supabase requests, not ten separate browser fetches. Collections, words and events partly overlap through `Promise.all`, so adding every request duration together would overstate wall time. Capability discovery precedes all three streams even though only the event source depends on it.

`listCollectionOverviews` uses React `cache`, which deduplicates within the relevant server request; layout and Collections page do not necessarily duplicate that query in one render. It is not a persistent cache across all navigations.[^5] A retained layout may also be reused during client navigation. Measure cold entry and warm navigation separately.

The recommended database changes are additive, read-only RPCs: compact collection aggregates, followed by a versioned Review snapshot. They reduce HTTP round trips without truncating words or changing the adaptive algorithm. They must execute with caller permissions, explicit ownership predicates and appropriate grants.[^6] Long-lived user-data caching and an incremental adaptive-state table are separate architectural changes, not prerequisites.

### F5. Loading boundaries are below blocking layout work

**Code-confirmed.** `app/app/review/loading.tsx` exists, but a page loading boundary does not cover preceding asynchronous work in its parent layout. Move the statistics dependency into an independently suspended navigation slot so authenticated chrome and the page fallback can appear first. Keep the verified identity boundary. Streaming improves perceived responsiveness; it does not reduce the underlying query time.[^7]

Existing Next `Link` usage already provides framework prefetch behavior. The extent depends on dynamic rendering, loading boundaries and configuration. Do not set `prefetch={true}` on every collection link: a large list can generate speculative server work. Measure current production behavior and use intentional prefetch only where it helps.[^8]

### F6. Authentication has real network cost and real semantics

**Code-confirmed.** Proxy uses `getClaims`; page/action authentication uses `getUser` and then reads `user_access_levels`. `getUser` performs a network lookup. With asymmetric signing keys, `getClaims` can verify locally using cached public keys; symmetric signing uses a server validation path.[^9]

The methods are not interchangeable for checking an ended server-side session.[^10] Keep current revocation semantics. A smaller safe improvement is to expose a verified identity helper based on the existing `getUser` check, then omit the unused access-level lookup in operations that require only authenticated ownership. Preserve `requireAuthContext` for UI permissions and gated mutations. Do not reject read-only learners merely because they can still review existing words.

### F7. Full details are an independent read workload

**Code-confirmed.** `ReviewDetails` fetches through a Server Action on each mount, including reopening the same word. Its key changes with account, word and correction revision. Wrong Recognition answers also open details, so this read is on a frequent interaction path, not only an optional sidebar.

Client Server Actions are dispatched sequentially; concurrent-looking calls can serialize.[^3] A read-only Route Handler is appropriate if cancellation and concurrent detail reads are needed. Cache successful details within the mounted account/session, deduplicate in-flight requests, and preserve invalidation after correction, conflict reconciliation, AI reanalysis or deletion. Failed reads must remain retryable. Do not cache user data across accounts or use persistence for this small cache.

### F8. Long-session rendering grows with history

**Code-confirmed scaling; user-visible cost unmeasured.** `useReviewSession` rebuilds `sessionWords`, summary values and option arrays on many state changes. `ReviewSessionNavigation` renders an option for every history entry. Flow advancement copies history and remaining arrays. At 2,500 completed words, the selector alone contains thousands of options.

Profile commits at history positions 0, 100, 1,000 and 2,499. Memoize derived values against stable state references, isolate the history options from selection-only updates, and use an O(1) session count where only a count is needed. Retain all history and keyboard access. Only redesign the selector if browser traces show that its DOM size still breaches the interaction budget; do not add virtualization or change the shared domain representation speculatively.

### F9. Standard review pronunciation lacks lifecycle control

**Code-confirmed.** Standard `ReviewWorkspace` creates a new `Audio` object without storing it and lets a rejected old playback fall back to speech. There is no generation guard or cleanup like the dedicated audio-review hook. Rapid navigation can therefore leave old playback or stale fallback work active. It does not block card advancement by itself because playback is not awaited, but overlapping sound can make the transition feel wrong.

Use one lifecycle owner with account/word generation guards and stop old playback on navigation, hide and unmount. Test browser autoplay rejection. Do not prefetch every audio file or postpone the next question until audio finishes. `play()` is asynchronous and may reject due to browser policy.[^11]

### F10. Bundle, images, fonts, telemetry and hosting need measurement

**Hypotheses, not established root causes.** Full details are eagerly imported into the standard review workspace. Deferring that component may reduce initial JavaScript, but can create a later code/data waterfall; measure both. Normal ReviewCard has no image, so image optimization is not a plausible explanation for every standard card transition. Root fonts already use `next/font` and `display: swap`; do not replace them without a measured gain.[^12]

Sentry tracing is configured at 100% when a DSN is enabled, but no dedicated web review phase spans were found. This is a monitoring-cost and attribution question, not evidence that Sentry caused the 24-second CPU stall. Add low-cardinality phase measurements and compare equivalent builds. Do not disable monitoring as the performance fix.

No authoritative deployed Vercel function region or Supabase database region was obtained. Vercel recommends keeping functions close to their data source.[^13] Check the actual project settings before proposing a region change; a CDN edge header is not sufficient proof of the executing function's location. Do not move the database or switch runtimes based on an assumption.

## Database and correctness constraints

Existing indexes already cover user/reviewed-time/event ID for review events, user/deleted state for words, and event/revision uniqueness for corrections. `effective_review_events` uses a caller-security view and a lateral lookup of the latest correction. Do not add duplicate indexes before examining authenticated-role query plans. `EXPLAIN ANALYZE` executes the statement, so use it for read queries on a disposable database, not production assessment mutations.[^14]

Preserve the current initial adaptive evidence contract: newest 5,000 events globally, ordered by `reviewed_at DESC, event_id DESC`, then at most 100 events per word for the existing decision function. Filtering by collection or due words **before** this global limit changes semantics. Corrections affect effective assessments. A materialized mode, a last-three-events shortcut, a smaller history limit or a restricted distractor vocabulary requires separate product/algorithm validation.

`next_review_date` is a SQL DATE. Collection statistics currently use the server's local date while the review selection uses the browser's local date. An aggregate migration must take an explicit date argument with tests, rather than silently using database `CURRENT_DATE`. Initial parity and any deliberate timezone correction must be distinguished. Null-collection words are excluded from collection totals but remain eligible for all-due Review; preserve that distinction.

Web `saved` means server confirmation; native `saved` means a durable SQLite commit. Do not copy native optimistic behavior into web without a durable, account-scoped outbox. Retry the identical event ID, assessment and timestamps. Preserve correction revisions, immutable history, assisted-answer restrictions, the 600 ms feedback rule and cancellation on hide/history/details. An unload callback or beacon is not a durable persistence protocol.[^15]

## Success measurements

Use two families of measures. First, response feedback and browser responsiveness: click-to-preparing feedback, maximum long task and field INP. Second, workflow completion: setup ready, first usable card, acknowledgement and next usable card. INP measures response to interaction, not all later asynchronous network work.[^16] A fast spinner does not prove a fast session.

Collect at least five fresh-context browser runs per fixture for a lab median and range; do not call five runs a meaningful p95. Production p75/p95 requires enough real samples and device/network separation. Browser network mocks cover browser requests, not Next server-to-Supabase traffic; the latter needs a local fake upstream or isolated backend.[^17]

## Model recommendation

**Default: GPT-5.6 Terra, High reasoning, one stage at a time.** It is available in the current host's model catalog. Official guidance places Terra in the balanced tier and Luna in clear, repeatable work.[^18] The stages involving async ownership, cache freshness and SQL require more judgment than mechanical edits. High is a task-specific recommendation supported by the multi-step nature of the work, not an assertion that it always costs less than Medium.

Luna can handle narrowly specified documentation updates or a single already-designed regression fixture, with the same checks. Do not assign the entire migration and concurrency plan to Luna in one prompt. Escalate an unresolved architecture or failing correctness gate to Sol or Astra with the failing evidence. API per-token prices do not establish Codex subscription quota consumption.[^19]

## Sources

All sources below were accessed on 2026-09-12. Titles and publishers identify the original source. Live documentation is version-sensitive; the local framework source was used to cross-check behavior. Repository findings and benchmark observations above are original analysis rather than external performance guarantees.

[^1]: React, [startTransition](https://react.dev/reference/react/startTransition). Immediate callback execution and transition limitations.

[^2]: Google web.dev, [Optimize long tasks](https://web.dev/articles/optimize-long-tasks), updated 2024-12-19; MDN, [Scheduler.yield](https://developer.mozilla.org/en-US/docs/Web/API/Scheduler/yield). Task yielding and cross-browser fallback.

[^3]: Next.js, [Server Actions and Mutations](https://nextjs.org/docs/app/guides/server-actions), updated 2026-06-17. Sequential dispatch and combined action/UI response; cross-checked against installed 16.3.3 sources.

[^4]: Next.js, [revalidatePath](https://nextjs.org/docs/app/api-reference/functions/revalidatePath) and [revalidateTag](https://nextjs.org/docs/app/api-reference/functions/revalidateTag). Distinct invalidation behavior.

[^5]: React, [cache](https://react.dev/reference/react/cache). Server request memoization scope.

[^6]: Supabase, [Database Functions](https://supabase.com/docs/guides/database/functions) and [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security). RPC permissions and caller-security views.

[^7]: Next.js, [loading.js](https://nextjs.org/docs/app/api-reference/file-conventions/loading). Loading boundaries and streaming.

[^8]: Next.js, [Prefetching](https://nextjs.org/docs/app/guides/prefetching). Route prefetch behavior and costs.

[^9]: Supabase, [getClaims](https://supabase.com/docs/reference/javascript/auth-getclaims). Asymmetric verification and symmetric fallback.

[^10]: Supabase, [Server-side authentication advanced guide](https://supabase.com/docs/guides/auth/server-side/advanced-guide). Server session validation and logout distinctions.

[^11]: MDN, [HTMLMediaElement.play](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play). Promise behavior and playback policy.

[^12]: Next.js, [Lazy Loading](https://nextjs.org/docs/app/guides/lazy-loading) and [Production](https://nextjs.org/docs/app/guides/production-checklist). Production measurement and deferred code loading.

[^13]: Vercel, [Configuring regions for Vercel Functions](https://vercel.com/docs/functions/configuring-functions/region). Function/data-source placement.

[^14]: Supabase, [Query Optimization](https://supabase.com/docs/guides/database/query-optimization); PostgreSQL 18, [EXPLAIN](https://www.postgresql.org/docs/current/sql-explain.html). Query-plan evidence and execution caveats.

[^15]: MDN, [Navigator.sendBeacon](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon). Unreliable unload events; not an acknowledgement protocol.

[^16]: Google web.dev, [Interaction to Next Paint](https://web.dev/articles/inp), updated 2025-09-02; MDN, [Performance.measure](https://developer.mozilla.org/en-US/docs/Web/API/Performance/measure). Responsiveness versus completion measurements.

[^17]: Playwright, [Mock APIs](https://playwright.dev/docs/mock). Browser request interception and fixture isolation.

[^18]: OpenAI, [Codex models](https://learn.chatgpt.com/docs/models). Terra/Luna roles and reasoning selection; task recommendation is analysis.

[^19]: OpenAI, [GPT-5.6 Terra](https://developers.openai.com/api/docs/models/gpt-5.6-terra) and [GPT-5.6 Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna). API model descriptions, distinct from desktop quota accounting.
