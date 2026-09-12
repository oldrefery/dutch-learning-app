# N01: isolated Review navigation baseline

## Scope and status

The full desktop browser matrix and additional CPU-throttled check completed successfully: 220 measured samples, plus four excluded warmups. Disposable SQL checks also completed. This report measures the two loading paths in the code shipped at `3cfdebbd2ca5da91313b8926db7f466a47391002`; it is **not** a pre-PR source comparison or a production latency measurement.

The missing hosted RPC migrations were activated in N00. No further application, database or hosting change is included in this benchmark work.

## Environment and method

- Apple M1 Pro, macOS arm64, Node 24.9.0, Chromium 149.0.7827.55, Next 16.3.3 webpack production build.
- Real route, auth flow, repositories, components and asynchronous session preparation. Loopback HTTP fixture upstream with a fixed 40 ms delay per request; no bandwidth throttle. This delay is synthetic, not a measured production RTT.
- Fresh browser context per sample. Both loading paths share one build and dataset. Five paired samples per cell, alternating order. Application server is already running; cold means browser entry, not a serverless cold start.
- Runtime telemetry has no DSN; build telemetry and source-map upload are disabled in the temporary copy. Public font downloads are build-time only. Production credentials, env files and browser sessions are not loaded.
- Usable setup requires accepted mode/scope changes and the expected enabled Start count. This verification adds several animation frames consistently. Start is pressed immediately; no assessment is submitted.
- Browser resource and long-task observations use browser clocks. Upstream requests use a separate backend clock and run ID. Cross-process clocks are never subtracted. No response bodies, auth headers, tokens or real vocabulary appear in the report.
- Interception disables browser HTTP cache, not router cache. Unrelated route prefetch is blocked. The client scenario additionally blocks Review prefetch; automatic-prefetch and repeat cases allow the application's existing behavior.

Reproduction commands and caveats: `scripts/web-performance/README.md`.

## Desktop results

Usable setup, milliseconds; median [minimum–maximum], five samples each.

| Words / events / selected | Navigation | Legacy          | Snapshot RPC  | Upstream requests: legacy → snapshot |
| ------------------------- | ---------- | --------------- | ------------- | ------------------------------------ |
| 500 / 0 / 500             | Cold       | 528 [525–572]   | 531 [509–541] | 13 → 5                               |
| 500 / 0 / 500             | Client     | 396 [396–403]   | 397 [396–404] | 9 → 4                                |
| 2,500 / 501 / 2,500       | Cold       | 565 [552–830]   | 529 [517–544] | 22 → 5                               |
| 2,500 / 501 / 2,500       | Client     | 538 [513–538]   | 396 [395–397] | 14 → 4                               |
| 5,000 / 5,000 / 5,000     | Cold       | 873 [845–1,140] | 529 [525–540] | 40 → 5                               |
| 5,000 / 5,000 / 5,000     | Client     | 805 [772–820]   | 397 [395–397] | 27 → 4                               |
| 5,000 / 5,000 / 20        | Cold       | 890 [867–1,145] | 530 [517–537] | 40 → 5                               |
| 5,000 / 5,000 / 20        | Client     | 804 [796–805]   | 397 [396–406] | 27 → 4                               |

For the 5,000-word/5,000-event full queue, automatic-prefetch setup medians were 814 ms legacy versus 347 ms snapshot; repeated navigation was 820 ms versus 346 ms. Both still made 27 versus 4 upstream requests after the click: this is not evidence of full-data prefetch or reuse of a cached snapshot.

First client navigation, Start-to-card medians:

| Selected queue / vocabulary | Legacy | Snapshot |
| --------------------------- | ------ | -------- |
| 500 / 500                   | 26 ms  | 27 ms    |
| 2,500 / 2,500               | 62 ms  | 64 ms    |
| 5,000 / 5,000               | 108 ms | 111 ms   |
| 20 / 5,000                  | 20 ms  | 21 ms    |

The large-queue setup benefit does not reappear as a substantial extra wait at Start. The small workspace shows no meaningful setup improvement despite fewer requests. Do not summarize this as a universal speedup.

Local raw artifacts: `apps/web/output/performance/navigation/1789223352942-1x/`. These are intentionally ignored; this report preserves the key findings. Failed harness-development runs and smoke samples are not included in the table.

## Attribution and next decisions

1. **Request waterfall is demonstrated.** The snapshot path performs one complete workspace RPC instead of sequential word/event pages. At 5,000 words and 5,000 events, the measured client setup median falls by about 51% under the fixed-delay profile. This is a laboratory path comparison, not a claim that production became 51% faster.
2. **The auth/access dependency is present.** A representative client trace shows two auth fixture calls, then access lookup, then snapshot. The fixture uses HS256 and does not establish the number or cost of production auth calls. Overlapping access with the snapshot could save at most one approximately 40 ms injected wait here, not the whole navigation duration.
3. **Client readiness is not response completion.** In a representative 500-word snapshot trace, the RSC response finishes around 184 ms after the click while interaction-verified setup is around 396 ms. No browser long tasks were observed in that particular sample. The gap includes scheduling/streaming/hydration and the probe's checks; it must not all be labeled CPU work. Installed React contains fallback timing behavior consistent with a scheduling floor, but this run does not isolate it causally.
4. **Production attribution remains open.** Neither lab SQL nor fixture network times determine Vercel/Supabase region latency, live authentication cost, real payload size or telemetry overhead. No organization settings were accessed or changed. A fresh real navigation trace is needed if the reported three seconds persists after N00 activation.
5. **Do not introduce broad architectural changes on this evidence.** The current snapshot path meets the provisional desktop setup and Start targets in this environment. N02's small potential saving, N04 bundle changes, N05 full prefetch, N06 split snapshots and N07 batching need additional evidence of an unmet target before implementation. This does not claim those techniques cannot help production.

## CPU slowdown ×4

Five paired samples per cell, same 40 ms upstream delay; 60 measured samples across cold/client navigation and the three larger datasets. Setup values are median [min–max] in milliseconds; Start and combined values are medians for the snapshot path.

| Words / selected | Navigation | Legacy setup        | Snapshot setup | Snapshot Start → card | Snapshot navigation → card |
| ---------------- | ---------- | ------------------- | -------------- | --------------------- | -------------------------- |
| 2,500 / 2,500    | Cold       | 680 [669–709]       | 659 [634–676]  | 297                   | 962                        |
| 2,500 / 2,500    | Client     | 581 [575–597]       | 449 [433–474]  | 297                   | 748                        |
| 5,000 / 5,000    | Cold       | 1,093 [1,077–1,159] | 771 [734–825]  | 529                   | 1,300                      |
| 5,000 / 5,000    | Client     | 850 [849–867]       | 433 [432–444]  | 479                   | 916                        |
| 5,000 / 20       | Cold       | 1,082 [1,071–1,162] | 726 [705–743]  | 83                    | 809                        |
| 5,000 / 20       | Client     | 857 [850–885]       | 433 [431–438]  | 79                    | 513                        |

Snapshot client-navigation feedback medians were 90–98 ms at ×4, compared with 63–64 ms on desktop. Direct-entry feedback starts from document navigation rather than a click and is recorded separately (desktop roughly 166–174 ms; ×4 roughly 186–199 ms). Do not compare that cold metric to the in-app click-feedback target.

The browser observer recorded up to five long tasks in an individual CPU-throttled cold sample and up to two in a client sample; none were recorded in the desktop snapshot samples. Passing total-duration targets does not mean that main-thread work is zero. No production p95 is inferred.

The ×4 run also asserts that client transitions keep the same document time origin and that the first card's session count retains every selected word. Artifacts: `apps/web/output/performance/navigation/1789223815937-4x-core/`.

## Disposable PostgreSQL results

PostgreSQL 15.14 (Homebrew), authenticated role, real migrations and real assessment/checkpoint/correction triggers. Each scenario includes a second owner with the same vocabulary/history volume. ANALYZE and an excluded warmup precede five measured function executions; no browser timing run or heavy check was running concurrently. CI uses PostgreSQL 16; these local timings do not assert hosted-version parity.

| Owned words / seeded events | Function execution median [min–max] | JSONB text bytes |
| --------------------------- | ----------------------------------- | ---------------- |
| 500 / 0                     | 6.70 [6.29–6.85] ms                 | 202,543          |
| 2,500 / 501                 | 26.37 [24.92–27.29] ms              | 1,142,043        |
| 5,000 / 5,001               | 65.82 [64.90–67.82] ms              | 3,293,541        |

The largest snapshot returns exactly 5,000 owned words, the newest 5,000 effective events and two owned collections (signup creates My Words). There are 500 corrected current events for the selected owner. Deterministic newest-event ordering matches the relational query, including timestamp ties at the 5,000/5,001 cutoff. The second owner's rows are excluded.

Both the function and its exact `pg_proc.prosrc` body were explained with `ANALYZE, BUFFERS, FORMAT JSON`. A representative body plan uses `idx_words_user_id`, `idx_review_events_user_reviewed`, and the existing `(event_id, revision)` unique correction index. Word scan time is about 1.6 ms, the indexed event scan about 0.7 ms, while JSON aggregation accounts for much of the total. These nested timings overlap and must not be summed.

This does not justify adding another index in N03. The result does not measure hosted CPU/IO contention, network transfer, HTTP compression or authentication. The seed initially exceeded the migration harness's 10-second statement limit in one large write; batching synthetic writes into 500-event transactions fixed fixture preparation without changing the measured function or its timeout.

Artifacts: `apps/web/output/performance/sql/1789223758791/`.

## Validation

- Isolated fixture contracts: 3/3 passed. Snapshot/paged parity uses the real pagination helper and installed Supabase client at 500/2,500/5,000 word boundaries and 0/501/5,000 event boundaries. Unknown RPCs, unscoped reads and table writes fail the fixture run.
- Full desktop browser matrix: 160/160 completed; real setup interactions and first cards for every scenario, with no unexpected browser origin or uncaught application error.
- New script lint: zero warnings/errors.
- Disposable SQL: all three sizes passed owner isolation, corrected-event presence, count and deterministic cutoff assertions; five timing samples per size.
- CPU ×4 core matrix: 60/60 completed, including same-document client transitions and full selected-queue counts.
- Existing SQL RPC regressions: 4/4 passed.
- Web typecheck: passed.
- Mobile Jest: 134 suites, 1,556 tests, 22 snapshots passed.
- Web Jest: 62 suites / 566 tests passed; the opt-in CPU microbenchmark remains skipped by design.
- Existing offline Playwright fixtures: 3/3 passed.
- Root lint, web lint, repository formatting, explicit `.mjs` formatting and `git diff --check`: passed.
- Production build: passed in both completed browser runs; temporary config differences are described above. Hosted CI status is reported on the PR separately.
