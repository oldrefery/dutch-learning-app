# Bounded Native Session Startup

Follow-up: [native Auth transport QA](native-auth-transport-qa-2026-09-06.md)
reproduces and fixes a controlled stalled-request failure. The historical
full-stack restart did not have a transport trace; its exact cause is unproven.

## Change

Follow-up to [Settings/reset QA](native-settings-reset-qa-2026-09-05.md), based
on `27bc6fa`. The prior offline UI timeout had two distinct waiting points:
the entry route awaited `initializeApp()` (including a network access lookup),
and both the entry route and tab layout awaited SDK session checks without an
unavailable state. An expired token can make `getSession()` refresh over the
network; the installed Auth SDK retries retryable refresh errors.

- Entry routing no longer awaits network access hydration. The initializer
  sets user identity synchronously; local SQLite reads proceed independently.
- Tabs no longer wait for `userAccessLevel` to become non-null. Add Word remains
  hidden unless the server-confirmed value is `full_access`.
- A shared session gate bounds each checking attempt to eight seconds of UI
  loading. Error/timeout renders an accessible retry screen, not a login
  redirect. A successful SDK result without a session or explicit `SIGNED_OUT`
  still routes to login.
- Retry reuses pending SDK work; it does not cancel token rotation or queue
  duplicate refresh requests. Reconnect retries unresolved checks but does not
  unmount an already admitted screen. Late results cannot override newer auth
  events, and unmounted subscribers/timers are cleaned up.
- The auth provider no longer treats thrown startup checks or a null
  `INITIAL_SESSION` notification as logout. Confirmed absence and explicit
  sign-out still clear application state. Successful initial/sign-in/refresh
  events restore identity; stale startup results are ignored.

This is a routing/recovery change, not a persistent offline authorization
system. Session metadata never grants server permissions. It neither changes
SDK refresh semantics nor promises immediate offline access after token expiry.
Underlying SDK work can outlive the eight-second UI deadline; the UI may accept
a later successful result automatically.

## Automated Validation

99 mobile suites / 1187 tests / 18 snapshots pass. This adds 22 regression
cases, including light/dark retry screens, real entry/tab rendering, stalled
initialization, expired-session-shaped failures, pending refresh reuse,
reconnect, sign-out, stale results and unmount. Typecheck and ESLint pass.
Unit tests establish the exact eight-second state transition; they do not
measure native boot time or reproduce the network stack by themselves.

## Native Evidence And Remaining Gap

The same isolated setup as the preceding report was used: a fresh local
Supabase stack and one new synthetic account, an ARM64 fixed-bundle QA APK,
and a temporary read-only `WoordenaarSDK57QA20260905` emulator on port 5580.
Packaged config and bundle were checked: localhost backend only, OTA disabled,
QA Sentry initialization disabled. Native package metadata is still 2.1.0 (80)
while the current JS Settings screen displays 2.2.0 (81); this is not a store
artifact. No existing or hosted application account was used.

- Initial offline startup displayed the unavailable screen, then accepted a
  late successful SDK result and displayed the stored email with Read Only.
  That entire Settings flow took 32 seconds. This is bounded feedback, not a
  claim that underlying SDK work always finishes within eight seconds.
- Auth container configuration was verified as `GOTRUE_JWT_EXP=180`. After
  more than 180 seconds of confirmed airplane mode, with the app stopped,
  cold launch displayed `session-unavailable` within a 15-second assertion
  window. The complete flow took 12 seconds and confirmed no login form.
- Re-enabling network restored collections, the same email and Full Access
  without credentials, manual retry or app restart (5-second recovery flow).
  Assertions compared SQLite before/after: same user/word, SRS values, review
  history and command queue. No progress was altered by this test.
- A subsequent 15-second cold-start assertion with the short JWT failed.
  The installed Auth SDK has a 90-second early-refresh margin, so this run
  does not establish a clearly non-refreshing token case.
- For a separate valid-token case, only the disposable backend was stopped
  with data preserved, configured with a verified 600-second JWT lifetime and
  restarted. The APK's public key still matched the stack, and a fixture HTTP
  login/read confirmed that the backend and account were healthy.
- **OPEN:** automatic recovery across that backend restart remained on the
  unavailable screen beyond the 45-second collection-screen wait. Device and
  host clocks matched. The underlying cause (pending transport/SDK work versus
  another lifecycle race) was not established. Do not classify this as fixed.
- Restarting the app online, without clearing its data or entering credentials,
  restored the same profile and Full Access (11-second flow). Immediately
  disabling network and cold-starting with the longer token passed the
  15-second collection-screen assertion and displayed the saved email
  (15-second complete flow). Screenshots were inspected.

Flow durations include automation and UI interactions, not just app startup.
The later backend-restart run reuses the `recovered` flow label; its latest
top-level report records the failure. Earlier timestamped artifacts and the
observed 5-second successful recovery are separate evidence, not overwritten
claims of a fully green native suite.

Next: reproduce the backend-restart case with bounded transport diagnostics,
test manual retry while SDK refresh remains pending, and determine whether
request deadlines or auth coordination need changing. Do not clear saved
sessions or weaken authorization to make this test pass. iOS, physical devices,
long-duration offline behavior and coordinated hosted rollout remain separate.
PostgreSQL/HTTP suites and Stryker were not rerun in this follow-up.

## Cleanup

Private flows, logs, snapshots and the non-distributable APK are retained at
`/private/tmp/woordenaar-sync-v2.h0ad3f`; raw files contain disposable credentials
and must not be published. The generated account was deleted, the QA stack
stopped with its disposable volume removed, and the read-only emulator stopped
without saving state. The original APK output and Android manifest were restored.
Existing containers and the iOS session were untouched; no global cache pruning,
hosted writes, EAS commands, push or PR were performed.

Commit message: `fix(auth): bound native session checks`
