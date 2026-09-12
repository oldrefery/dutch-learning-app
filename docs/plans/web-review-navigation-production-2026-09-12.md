# Production Review navigation baseline and N03 region candidate

## Outcome

The remaining delay is reproducible on production, including repeated navigation. On a dedicated account with 2,105 newly imported words, usable setup took a median 1,604 ms from Settings and 1,563 ms on repeat navigation. Start remained fast: 82 ms and 65 ms respectively.

The deployed Review snapshot RPC is confirmed in correlated Sentry traces. The dominant observed server span is the snapshot read, with additional sequential user/access requests. The function executes through `iad1` while the linked Supabase pooler is in `eu-central-1`. Prepare a single-region `fra1` deployment candidate; do not claim it improves production until the changed deployment is measured.

## Account preparation and safety

- The user supplied dedicated `WEB_E2E_EMAIL` / `WEB_E2E_PASSWORD` credentials locally. The existing credential preflight rejected main-account use and passed for the configured account. Credentials and cookies were never printed or written to artifacts.
- Initial production UI showed zero collections, zero words and disabled Start. Under the user's earlier authorization to load all decks into the test account, the normal Starter Pack UI imported Essentials plus all 21 online packs, using its normal duplicate handling.
- Result: 22 collections, 2,105 words and zero review events. An authenticated snapshot read verified these counts. The words and collections remain in the dedicated account for later comparable measurements; no cleanup or deletion was performed.
- No assessment, correction, password change, user-role change, organization configuration, hosted migration or production deployment was performed. Import was the only vocabulary mutation; measurement contexts blocked non-read requests except the application's existing Sentry telemetry.
- Imported counts by pack: Essentials 60; A1-01 116; A2-01 98 and A2-02–05 100 each; B1-01–04 99 each, B1-05–08 98 each, B1-09 97; B2-01–02 100 each, B2-03–04 101 each, B2-05 98; C1-01 46.

## Method and served build

- Domain: `https://woordenaar.app`.
- Settings displayed production / main / `3cfdebb`, Next.js 16.3.3, host `woordenaar-l4finaqri-rustems-projects.vercel.app`.
- Browser: fresh test-owned Chromium 149.0.7827.55 contexts, desktop 1440 × 1000, no CPU or network throttling, on the same macOS machine as the lab runs.
- Reused the existing browser-clock readiness probe: actual mode/scope changes, enabled Start, then the first usable Adaptive card. Every measured session retained all 2,105 words. No answer was submitted.
- Five rounds, each containing cold document entry, first client navigation and repeat navigation. A direct preliminary read was excluded. Cold does not mean a Vercel function cold start.
- Settings was hydrated before client navigation. Repeat first opened Review and started a local session, exited without answering, returned to Settings, then navigated back. Same-document navigation was asserted.
- Router prefetch and router cache were left enabled. The safety routing guard disables browser HTTP cache, so this is not an untouched browser-cache benchmark. Background prefetch can contend with navigation; unlike N01, unrelated prefetch was not blocked.
- Browser cookies stayed in memory. No HAR, Playwright trace, screenshot, video, user text, email or response body was saved. Safe timing/size fields and opaque tracing identifiers were recorded.
- Scratch adapter and sanitized artifacts: `/private/tmp/review-live-Yd9QSa/measure.mjs`, `results.json`, `rpc.mjs`, `rpc-results.json`. The adapter is not production code or an automatic CI task. Historical preparation used explicit `--seed`; later reads must not repeat seeding. Raw temporary artifacts may expire; key results are preserved below.

## Browser measurements

Milliseconds are median [min, max]. Five samples are not a production p95.

| Boundary                              | Direct entry         | First client navigation | Repeat navigation    |
| ------------------------------------- | -------------------- | ----------------------- | -------------------- |
| Visible feedback                      | 718 [609, 788]       | 55 [54, 57]             | 13 [9, 14]           |
| Usable setup                          | 1,738 [1,723, 1,883] | 1,604 [1,571, 1,780]    | 1,563 [1,422, 1,702] |
| Start to first card                   | 74 [72, 76]          | 82 [74, 103]            | 65 [61, 72]          |
| Navigation to first card              | 1,811 [1,799, 1,959] | 1,682 [1,655, 1,860]    | 1,631 [1,483, 1,774] |
| Review document/RSC response complete | 1,644 [1,578, 1,794] | 1,556 [1,520, 1,731]    | 1,509 [1,375, 1,660] |

All 15 measurements completed with zero browser errors, zero observed long tasks and no attempted prohibited write. The Start count and first-card queue length matched in every run. Absence of long tasks in this desktop sample does not establish mobile performance.

Median Review transfer size: 205,327 bytes for direct entry; 192,036 bytes for client navigation; 192,030 bytes for repeat. Decoded sizes: 1,166,878 / 1,004,721 / 1,004,721 bytes respectively. These are the actual document/RSC resource sizes, not the RPC JSON serialization size. Most observed click-to-ready time preceded response completion; do not attribute that interval entirely to SQL or hydration.

The user's working-account report exceeds two seconds. This dedicated account has no history and is not identical to that account. These measurements demonstrate a live delay but neither contradict the report nor establish its exact duration under the user's conditions.

## Correlated server evidence

First client sample trace: [1b0f1e95749f40f0ae987620b24d4698](https://oldrefery.sentry.io/explore/traces/trace/1b0f1e95749f40f0ae987620b24d4698?project=4512005023596544).

- Web project verified by span details: `dutch-learning-app-web`, project ID `4512005023596544`.
- `GET /app/review` server span: 936.69 ms.
- Verified `GET /auth/v1/user`: 122.71 ms.
- `GET /rest/v1/user_access_levels`: 118.83 ms, started after user verification completed.
- `POST /rest/v1/rpc/get_web_review_snapshot_v1`: 642.10 ms, started after access lookup completed. No fallback paging in this captured route transaction.
- Proxy middleware: approximately 28 ms, including approximately 24 ms for its auth request.
- A second [client trace](https://oldrefery.sentry.io/explore/traces/trace/9c6b75492ef544dbb83efffc6b5cccb8?project=4512005023596544) showed a 991 ms server span and a 620 ms POST span.

The SDK navigation span is not the same boundary as the interactive readiness probe. Browser fetch spans can finish at streamed headers before server/response-body work ends. Do not add parent and child durations together or substitute the SDK navigation duration for click-to-ready.

The earlier generic Sentry search was scoped incorrectly. Exact captured trace IDs and span lookups worked without new permissions. The previous inability to query by the generic project filter is not a current blocker to these trace lookups.

## Region evidence and direct RPC check

- All measured Review responses contained `x-vercel-id` beginning `fra1::iad1::`. Vercel documents that this header includes the regions traversed and the function execution region; this is evidence of an `iad1` function path, not merely the browser's nearest edge.
- Linked project metadata still identifies `josxavjbcjbcjgulwcyy`, the same host in the RPC spans. Its pooler hostname is `aws-1-eu-central-1.pooler.supabase.com`. Only the hostname was read, not credentials. No management-API project inventory or organization dashboard was opened.
- Direct caller-authenticated reads from the current machine, same account and RPC, with one excluded warmup and five measured requests: RPC median 304.86 ms [195.13, 425.19]; getUser median 82.57 ms [44.97, 162.22]; access median 73.70 ms [48.95, 124.39]. Each RPC returned 2,105 words, zero events, 22 collections and 1,038,559 serialized JSON bytes.
- These are different execution environments and not simultaneous region A/B measurements. The difference does not isolate geography from compute, connection reuse, serialization or load. No exact production saving is promised.

## N03 candidate, verification and rollback

`apps/web/vercel.json` selects only `fra1`. The release runbook identifies `apps/web` as the Vercel project root. This is a repository-controlled setting for `woordenaar-web`, not an organization-wide configuration change. It does not request extra regions, a plan upgrade, CPU/memory changes, caching changes or an auth bypass. Middleware placement remains platform-controlled.

This is preferable to further changing the Review data contract before checking placement: it leaves the complete snapshot, loading boundaries, request order, learning behavior and fast Start unchanged. The rejected N02 candidate stays removed.

Verification gate before calling this a production improvement:

1. Let the existing Git integration build the branch preview. Confirm that the preview serves the intended commit and the target route actually runs in `fra1`; a green deployment alone is insufficient.
2. If preview protection prevents the dedicated-account measurement, do not disable protection or request organization access. Obtain scoped access or a separately authorized production release.
3. Confirm the linked database placement remains `eu-central-1` before release. No database migration is required.
4. Repeat the same 15 live reads on the same unchanged test account. Compare setup and navigation-to-card, Start, full response completion, payload size and correlated auth/RPC spans; also exercise authentication and read-only access checks.
5. Merge/promote only with release authorization. Keep the prior verified deployment available. If placement does not materially improve latency, inspect hosted RPC/SQL and transfer cost before N04/N05/N06.

Rollback: remove this single project configuration file and redeploy the prior verified configuration, or restore the prior production deployment through the normal release workflow. Do not drop RPCs or delete benchmark vocabulary. No production switch has been made in this task.

## Configuration validation

- JSON parsing, exact expected key set and the `regions` field against Vercel's current public schema passed. Formatting and diff whitespace checks passed.
- A full-schema check with the installed Ajv 6 failed because the upstream schema declares Draft 4 while unrelated experimental-trigger fields use numeric `exclusiveMinimum`. The scoped field check is not a claim that the complete upstream schema validated; the platform preview build remains the authoritative configuration gate.

References: [Vercel response headers](https://vercel.com/docs/headers/response-headers#x-vercel-id), [function region configuration](https://vercel.com/docs/functions/configuring-functions/region), [region list](https://vercel.com/docs/regions).
