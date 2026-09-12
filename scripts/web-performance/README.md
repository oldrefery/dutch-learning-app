# Isolated Review navigation measurements

The browser harness builds and serves the real Next application in a private temporary directory. It supplies an HTTP Supabase fixture upstream on loopback, uses a fresh test-owned Chromium context and generates synthetic auth cookies using the installed SSR client. It never loads application `.env` files, saved browser sessions, production account data or service-role credentials.

## Commands

Use the repository's Node 24 runtime and installed Playwright Chromium:

```sh
npm run web:performance:navigation:test
npm run web:performance:navigation -- --smoke
npm run web:performance:navigation
WEB_PERF_CPU_RATE=4 npm run web:performance:navigation
WEB_PERF_CPU_RATE=4 npm run web:performance:navigation -- --core
WEB_PERF_LATENCY_MS=0 npm run web:performance:navigation
node scripts/web-performance/sql.mjs
```

The SQL command additionally requires PostgreSQL binaries on PATH (or `WOORDENAAR_PG_BIN`). It uses the existing disposable migration-test cluster with no network listener. Run SQL, builds and CPU-heavy checks **separately** from browser timing runs to avoid competing for resources.

Default upstream delay is 40 ms **per request**, without simulated bandwidth limits. This exposes sequential round trips; it is not a measured production RTT. CPU slowdown accepts 1 or 4. Smoke uses one pair per navigation kind and is a harness check, not a performance conclusion.

`--core` keeps five pairs for the 2,500-word and both 5,000-word datasets, restricted to cold entry and first client navigation. It is useful for the additional CPU-throttled check after the full desktop matrix; it does not replace the full matrix.

## What is measured

- Four datasets: 500/0, 2,500/501, 5,000/5,000 words/events, plus 20 due words in a 5,000-word vocabulary with 5,000 events. All selected words belong to the same synthetic collection; the last case selects by due date, not by reducing the vocabulary.
- Five paired samples, alternating legacy/snapshot order, after excluded warmups. `legacy` simulates both new RPCs being unavailable while retaining correction support. This compares the two paths in the **same shipped implementation**, not pre-PR source versus post-PR source.
- `cold`: fresh browser context and direct entry; application server already running. Not a Vercel function cold start.
- `client`: first client navigation from hydrated Settings, with prefetch blocked.
- `auto-prefetch`: the same navigation after the application's existing Review prefetch/hover settles. Partial shell prefetch must not be described as full-data prefetch. Upstream preparation requests are recorded separately.
- `repeat`: return to Settings after opening Review, then navigate to Review again with the same router cache. No assessment is submitted.
- Browser-clock navigation feedback, usable setup, Start-to-card and combined navigation-to-card. Setup readiness requires real mode and scope changes, a matching due count and an enabled Start button. The probe's verification costs several animation frames and is included consistently. It then presses Start immediately. First card requires an enabled answer/reveal control.
- Actual browser `PerformanceObserver` long tasks and resource/navigation timings, including transfer, encoded and decoded sizes. HTTP interception disables browser HTTP cache; application router cache remains enabled. Unrelated route prefetch is blocked in every scenario to isolate Review.
- Backend-clock request start/end, method, path, status, page offset and response bytes. No response bodies, headers, tokens or words are included. Clocks from different processes are not subtracted. Overlapping requests are not summed as elapsed time.

Build-time public font download may use the network. During browser measurements all non-fixture origins are blocked and fail the run. The isolated source retains the normal build configuration except Sentry upload and build-plugin telemetry are disabled; runtime Sentry has no DSN. No benchmark flag or diagnostic endpoint is added to the deployed application.

## Limits and interpretation

Browser totals include repository mapping, serialization, transfer, parsing and hydration; these are **not individually attributed** by subtraction. Auth fixtures exercise the application flow but do not measure cryptographic verification or live auth latency. The separate SQL harness records authenticated `EXPLAIN (ANALYZE, BUFFERS)` for both the function and its exact body, with real triggers, corrections and two owners. Its warm-buffer times do not model hosted contention or network transfer.

All artifacts are under ignored `apps/web/output/performance/`. Preserve selected sanitized findings in the execution report. Five samples give median and min/max, not a reliable production p95. A faster local snapshot does not establish that live navigation improved by the same amount.

Temporary build directories and fixture processes are cleaned up after success or failure. Do not launch the normal authenticated E2E configuration or point this harness at a remote origin.
