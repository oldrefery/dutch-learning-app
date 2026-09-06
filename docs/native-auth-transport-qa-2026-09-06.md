# Native Auth Transport Recovery

Follow-up to [bounded session startup](native-session-startup-qa-2026-09-05.md),
based on `9ebe4d6`. Work stayed on `codex/app-quality-session-sync-tests`.

## Finding And Fix

The eight-second routing deadline bounds the loading screen, not the underlying
SDK operation. In the installed Auth SDK (`@supabase/auth-js` 2.98.0), refresh
retry budgets are checked after a request finishes. The installed Android
React Native transport defaults to no connect/read/write timeout. A request
that never completes can therefore hold initialization and all session readers
indefinitely. Manual routing retry correctly reuses that work, but cannot make
it finish. The generic `fetch-retry` wrapper also added a second retry layer.

The primary mobile Supabase client now uses `createSupabaseFetch`:

- First-party `/auth/v1/` requests get a ten-second `AbortController` deadline.
  Native cancellation closes the underlying request; this is not merely a
  `Promise.race` that abandons it while issuing another refresh.
- Auth SDK retry/rotation and error classification remain authoritative. The
  generic retry wrapper is bypassed for Auth. A timeout/network failure remains
  retryable and does not clear the saved session. Definitive token rejection
  still removes it.
- Caller cancellation, Request/URL inputs, payloads and HTTP errors are
  preserved. Timers and abort listeners are released on completion/failure.
- Non-Auth requests retain their existing retry behavior; database writes and
  SRS calculations are unchanged. No permission is granted from cached metadata.

The deadline is per transport attempt, not a ten-second guarantee for the whole
SDK refresh/retry sequence. JavaScript timers depend on the native application
lifecycle. This change targets the primary native client, not the separate
password-recovery client, web fetch bodies or every possible offline condition.

## Controlled Native Comparison

One fresh local Supabase project and one new `sync-<uuid>@example.invalid`
account were used. No existing/hosted application account was opened. A temporary
read-only `WoordenaarSDK57QA20260905` Android instance ran on port 5580.

1. A normal Auth-container stop/start recovered automatically on the original
   client. A manual-retry flow failed because the button was already gone;
   server refresh and subsequent UI/sync confirmed recovery. This does **not**
   reproduce or retroactively explain every detail of the previous full-stack
   restart failure.
2. A loopback-only fault proxy at port 55325 forwarded to the isolated backend
   at 55321. In fault mode it consumed one refresh request without forwarding
   or answering it. Returning to pass mode allowed new requests but deliberately
   did not release the old one. Only request IDs, times and durations were
   logged; no headers, tokens or bodies were logged by the proxy.
3. An original-client APK, with only its local endpoint changed, launched with
   a genuinely expired saved JWT: last token issuance `2026-09-05T22:14:23Z`,
   configured TTL 180 seconds, held refresh started `22:17:37Z`. The unavailable
   screen appeared. After pass mode resumed at `22:18:10Z`, Auth health through
   the same proxy returned 200, but manual retry still failed its 45-second
   collection-screen assertion (56-second total flow). The original request
   stayed open for **147.659 seconds**, until the app was force-stopped.
4. The fixed APK was installed without clearing app data or entering credentials.
   The same fault was enabled before launch. Three held requests closed after
   **9.799, 10.003 and 10.011 seconds**. Pass mode resumed at `22:20:36Z` while
   a request remained held; a new refresh started at `22:20:39Z` and completed
   in 62 ms. The app recovered automatically, without retry, network toggle or
   another restart. The collections/Settings/email/Full Access flow passed
   in six seconds; this is automation duration, not a cold-start benchmark.
5. Executable SQLite comparisons confirmed the same user, collection, word,
   repetition count, interval, ease factor, next review date and last review
   timestamp. The fixture was unreviewed; its empty history and command queue
   remained empty. This run does not replace the earlier non-empty reset and
   two-client conflict tests. Screenshots were inspected.

Both newly built APKs were checked for the local proxy endpoint, absence of the
hosted Supabase project URL, `extra.qaBuild=true` and OTA disabled. Environment
files were excluded; Sentry auto-upload and QA initialization were disabled.
The retained native project still labels these non-distributable APKs 2.1.0 (80),
while Settings displays JS version 2.2.0 (81). They are not store artifacts.

## Automated Validation

- **101 mobile suites / 1207 tests / 18 snapshots** pass.
- Twenty new cases cover deadline boundaries, cleanup, cancellation, Request
  overrides, HTTP/network errors, unchanged data retries and origin scoping.
- Five of those cases exercise the **real installed Auth SDK**, not a mocked
  `getSession`: concurrent readers, cold-start initialization/auth notification,
  exhausted rejected/stalled requests with preserved session and later recovery,
  and definitive refresh-token rejection.
- Mobile test typecheck, ESLint and diff checks pass.

PostgreSQL/HTTP suites, Stryker, iOS and physical devices were not rerun here.
The controlled stalled-transport failure is reproduced and fixed; the earlier
full-stack-restart incident had no transport trace, so its exact cause remains
unproven. Do not describe this as complete native or release sign-off.

## Cleanup And Next Work

Private flows, diagnostics and APKs are retained at
`/private/tmp/woordenaar-sync-v2.idvH3D`; fixture files contain disposable
credentials and must not be published. The generated account and disposable
backend volume were deleted. The proxy and read-only emulator were stopped.
Original APK output and Android manifest were restored byte-for-byte. Existing
containers and the unrelated staged/deleted native plugin were preserved.

Next: verify the same recovery/lifecycle scenarios on an isolated iOS client
and physical devices. Long-duration offline behavior and coordinated protocol-2
hosted rollout remain separate work. No push, PR, merge, EAS operation, hosted
migration or deployment was performed.

Commit message: `fix(auth): time out stalled native requests`
