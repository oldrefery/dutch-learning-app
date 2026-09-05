# Session, Sync And Release-Tool Quality

Date: 2026-09-05
Branch: `codex/app-quality-session-sync-tests`
Base: `8056d5e8797587e0b41d358bc454e1d91d95a730`

## Scope Delivered

- Web session refresh: preserve rotated and deleted cookies on authentication
  redirects; test the request/response cookie bridge and route matchers.
- Web authorization and OAuth callback: execute verified-user lookup, access
  defaults, safe return paths, code exchange and rejected-code handling.
- Web persistence: execute the review server action with authenticated and
  invalid inputs, RPC failure, authoritative server progress and same-event retry.
- Mobile session/sync: expiry safety boundary, failed refresh, offline-to-online
  recovery and already-expired refresh response.
- Real in-memory SQLite: stale acknowledgements cannot clear newer word or
  progress edits, unsynced pulls are preserved, acknowledged pulls apply,
  deleted words survive, review constraints roll back progress, duplicate local
  events cannot advance it twice, and cross-user reviews are denied.
- SRS: coefficients, rounding, bounds, knowledge thresholds, forgetting,
  relearning and persisted reset; mutation-test the shared domain calculator.
- OTA: verify account/project before publication, recognize the explicit
  personal-token identity, reject target/bundler overrides, work from either
  workspace, and distinguish failed publication from failed map upload.
- Release tooling/docs: fix workspace-relative guard loading, deprecate the
  misleading build-and-submit alias, document cloud-first release and native
  source-map recovery limitations, replace the obsolete testing proposal.

## Validation

| Check                                                     | Result                                                                                      |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Mobile Jest, non-watch, Watchman disabled                 | 90 suites / 1129 tests / 16 snapshots passed                                                |
| Web Jest with coverage                                    | 42 suites / 235 tests passed                                                                |
| Web configured coverage                                   | 43.41% statements/lines, 81% branches, 77.36% functions; thresholds passed                  |
| Full Stryker `--force`                                    | 96.98%, 14 selected modules; 474 mutations, zero cached results reused                      |
| Stryker outcomes                                          | 289 killed, 8 survived, 1 uncovered, 176 rejected by TypeScript; no timeouts/runtime errors |
| Mobile test typecheck and web typecheck                   | Passed                                                                                      |
| Mobile/root lint and web lint                             | Passed with no warnings                                                                     |
| Production Next.js build                                  | Passed with Sentry upload disabled; no deployment                                           |
| Changed-file formatting, shell syntax, `git diff --check` | Passed                                                                                      |

Selected auth navigation/session/proxy/callback and review action modules each
have a 100% mutation score. Shared SRS scores 96.23%. Two SRS survivors are
behaviorally equivalent: the hard/zero-interval branch and its fallback both
return one day; adding versus subtracting the Good adjustment of zero has the
same result. They remain visible; no exclusions or lower thresholds hide them.
The other six survivors and one uncovered mutation are in the existing semantic
duplicate, search and account-response helpers. They remain follow-up work,
not evidence of complete coverage.

## Verification Boundaries

No production/test account, provider configuration, remote database, EAS update
or store submission was changed during validation. No push, PR, merge or
deployment was performed. After validation, the user authorized local commits
on `codex/app-quality-session-sync-tests` only; work must remain on this branch.
Push, PR, merge and deployment still require separate permission.
The pre-existing staged/deleted
`apps/mobile/plugins/withRCTTurboModulePatch.js` was left untouched.

These checks do not replace real-provider expired-session/concurrency tests,
PostgreSQL RPC/RLS integration, or two-device/native network lifecycle tests.
See `docs/TESTING_PLAN.md` for the explicit boundary of each test layer.

Legacy native source-map re-export remains for compatibility and is explicitly
documented as unverified for repairing a shipped binary. Exact original build
artifacts or a fresh approved build are required; this task did not implement a
new native artifact-recovery pipeline.

Suggested commit message: `test: harden sessions sync and release safeguards`

## Commit-Gate Follow-up

The first commit attempt exposed a separate monorepo lint-staged issue: ESLint
9 selected the root Expo config for web files, although the two app-specific
lint commands passed. The staged command now enables per-file config lookup,
with executable regression tests for both workspaces. Hooks remain enabled.

## Follow-up: Word Persistence And Mutation Gaps

Continued on the same branch after the release status check. No application
account, cloud service, provider configuration or store state was changed.

- Added executable tests for all five word actions: reset, soft delete, move,
  image update and reanalysis. Authentication failures stop before data access.
- Recorded each query independently and asserted owner, collection and live-word
  filters. Missing results and errors cannot produce successful cache refresh or
  navigation. Exact update payloads protect unrelated fields and SRS state.
- Tested unique-key collision recovery: one restricted retry preserves the
  semantic key, original input and learning progress; a failed retry stays an error.
- Added complete analysis-to-database mapping assertions for conjugations,
  examples, usage contrasts, optional fields and initial SRS/date defaults.
- Expanded malformed account-response/search cases and semantic-key comparisons,
  including Unicode spellings that uppercasing would incorrectly collapse.
- Expanded Stryker from 14 to 16 modules, adding word actions and persistence
  mapping. Word actions now participate in the configured coverage denominator.

Validation: 45 web suites / 308 tests pass (73 additional tests). Web typecheck,
web lint and changed-file ESLint checks pass. Configured web coverage is 45.72%
statements/lines, 83.29% branches and 78.4% functions. Word actions cover 99.71%
lines / 98.52% branches; analysis mapping covers 100% of each metric.

The full forced Stryker run tested 745 mutants across 16 modules without reusing
cached results: 98.65%. It exposed a missing assertion for an analysis error
without a message. Two regression cases were added, then all six mutants in
that error-handling range were forcibly rerun. The combined report is 98.87%:
438 killed, four survived, one uncovered and 302 TypeScript compile errors;
zero timeouts or runtime errors. Other results in the combined report come from
the immediately preceding full forced run, not a second full run.

Survivor review (no exclusions or reduced thresholds):

- Search's removed object guard is equivalent for JSON primitives: the remaining
  array-value filter still yields no translations. Non-JSON callable objects
  with custom properties are outside the database payload contract.
- The image validator always pairs an error with a null value, or a valid value
  with no error. Replacing the caller's OR with AND is equivalent for these results.
- The two shared SRS survivors are the previously documented equivalent changes.
- The uncovered reanalysis fallback handles non-Error throws; the actual parser
  only throws Error for JSON input. No artificial parser mock was added to make
  that defensive branch appear covered.

Semantic duplicate matching, account response parsing and analysis persistence
mapping now have 100% mutation scores in the selected set.

These are API-boundary tests, not PostgreSQL integration tests. The next work is
isolated review RPC/RLS execution, followed by real-provider session/reconnection
checks and two-client native synchronization. The unrelated staged/deleted plugin
remains outside this change.

Commit message: `test(web): cover word writes and mutation gaps`

## Follow-up: PostgreSQL Review Integration

Added `npm run test:db`, using Node's built-in runner and a fresh local PostgreSQL
cluster per test file. All 36 application migrations execute unmodified. Only
the Supabase platform boundary (roles, auth identity adapter, core grants) is a
fixture. No hosted database, application account or provider is used.

The first complete run passed 35 of 37 tests and exposed two failing SRS groups:
PostgreSQL float rounding chose even numbers at ties (`2.5 -> 2`, `22.5 -> 22`),
and later Good/Easy assessments could return zero days instead of the shared
calculator's minimum one day. The forward-only migration
`20260905180000_align_review_rpc_srs_rounding.sql` fixes both. Fractional-part
rounding also preserves a binary float just below a half (`25 * 2.3 -> 57`).
The original deployed migration remains unchanged.

Coverage includes:

- Non-owner, non-superuser, non-BYPASSRLS execution; anonymous/missing identities,
  foreign/private/shared words, forged event ownership and product read-only access.
- Atomic event/progress persistence, identical retries, conflicting retry data,
  SQL constraint failure rollback and explicit transaction rollback.
- Immutable event upserts, DELETE denial both at table privilege and RLS layers,
  word tombstones and removal of related history.
- Four deterministic concurrency tests using independent psql sessions and an
  observed PostgreSQL lock wait, not timing-based race assumptions.
- 240 SQL/shared-SRS comparisons plus five independent numeric regression cases.

The CI Quality workflow has a separate credential-free PostgreSQL 16 job on
Ubuntu 24.04; local validation uses PostgreSQL 15. No CI run was dispatched.
See `docs/DATABASE_TESTING.md` for prerequisites and explicit scope boundaries.
Local teardown stops and removes only generated test clusters. The final run
also uses deliberately invalid ambient PGHOST/PGDATABASE/PGSERVICE values to
confirm they cannot redirect the harness away from its private socket.

Validation: all 43 PostgreSQL tests pass, including the 240-case SRS matrix.
Root lint, web typecheck, changed-file formatting, workflow YAML parsing and
`git diff --check` pass. Generated test clusters were stopped and removed.

The migration has NOT been applied to hosted Supabase and does not backfill old
intervals. A production database migration needs separate approval. Real
JWT/HTTP refresh and browser/native reconnection tests remain the next step.

Commit message: `fix(srs): align review RPC with shared calculator`

## Follow-up: Browser Session and Review Recovery

Added five extended Chromium scenarios against local Next.js and real hosted
Supabase, using the configured dedicated QA account. Each scenario starts with
empty browser storage, signs in through the UI and verifies the displayed user.
The forbidden application account is rejected before login. No service-role key
or mocked successful auth/database response is used.

- Force the cookie session's `expires_at` into the past and verify real refresh
  token rotation, user continuity and persisted cookies through a private page.
- Repeat through `/login`, exercising refreshed cookies on the proxy redirect.
- Supply an invalid refresh token with expired metadata: auth cookies disappear,
  the requested path/query survives login, and successful reauthentication
  returns to the original destination.
- Disconnect Chromium before an Easy assessment: show the recoverable error,
  keep the card uncompleted, verify unchanged server progress from another tab,
  reconnect and retry the identical request payload.
- Execute the real review action but discard its successful HTTP response:
  another tab sees the already-saved assessment; retrying the same payload must
  not apply it twice. Reload still shows EF 2.50, interval 4 days, one repetition
  and Learning status.

Review fixtures import one available starter-pack word into a UUID-named test
collection without AI calls. Cleanup targets only that exact collection through
the application's deletion flow, including on test failure. A first fixture
version exceeded the collection field's 50-character limit; names now fit and
the shared creation helper checks for browser truncation before submitting.
Both empty collections from that failed run were individually identified and
removed. The temporary cleanup spec is not retained.

Traces, videos and screenshots are disabled for these credential/cookie tests;
assertions compare token changes as booleans to avoid secret-valued diffs.
The local test process overrides Sentry DSNs with empty values. No deployment,
provider settings, remote schema or existing user collection was changed.

Scope limits: cookie expiry is accelerated; the signed JWT itself is neither
modified nor allowed to expire naturally. Concurrent refresh, revoked sessions,
durable offline retry after closing/reloading the review tab and native OS
network/foreground transitions are not covered by these scenarios. The pending
SRS SQL migration remains undeployed. Native two-client synchronization is still
the next device integration task.

Validation: the five scenarios pass, followed by a two-repeat run with all
10 executions passing without runner retries. Web Jest remains 308 passing
tests in 45 suites; web lint, typecheck, changed-file formatting and
`git diff --check` pass. Runtime application code and the mutation target set
are unchanged, so Stryker was not rerun for this browser-only coverage change.
The unrelated staged/deleted mobile plugin was preserved byte-for-byte.

Commit message: `test(web): verify session and review recovery`

## Follow-up: Native Lifecycle And Two-Client Conflict QA

Ran two isolated read-only Android QA instances with the retained 2.1.0 (80)
artifact. Mobile/domain runtime sources match this branch; this does not certify
the 2.2.0 store artifact or iOS. Only the explicitly allowed dedicated test
account and one newly created collection/word were used.

Confirmed a high-priority unresolved defect: A's older offline Easy assessment
overwrites B's already-synced newer Good assessment after reconnection. Both
review events survive exactly once, but repetitions stay at one and
`last_reviewed_at` moves backwards. B then converges to the same stale progress.
Whole-word snapshot upsert and later independent event upload explain the result;
existing pending-row/stale-acknowledgement protections do not merge assessments.

Offline assessment durability across native cold restart, reconnect-triggered
upload and foreground-triggered convergence were verified using real native
SQLite and authenticated server snapshots. Settings also showed a missing email
and Read Only fallback after offline cold start; an online restart restored the
email assertion. Its profile/access-state cause remains to be diagnosed.

Added nine hook lifecycle tests covering network/foreground triggers, background
timer behavior, cleanup, identity gating and retry recovery. These are boundary
tests, not an automated reproduction or fix of the hosted conflict.
See [the native QA report](../native-sync-qa-2026-09-05.md) for exact steps,
values, limitations and private evidence location.

Cleanup removed the fixture collection/history and propagated the word tombstone
to both clients. All baseline rows compared unchanged. Both temporary Android
instances were shut down; the existing iOS simulator was not used. No remote
schema, deployment, provider configuration or EAS operation was performed.

Validation: 92 mobile suites / 1140 tests / 16 snapshots and 45 web suites /
308 tests pass. Changed-file ESLint, mobile test typecheck, formatting and
`git diff --check` pass. Runtime code and mutation targets are unchanged;
Stryker was not rerun. The unrelated staged/deleted plugin remains excluded.

Next: define and implement server-authoritative, idempotent review-event
application, including out-of-order events, resets and installed-client
compatibility; then repeat this native conflict scenario. Do not silently select
timestamp-only or maximum-counter merging. Hosted migration/deployment still
requires separate authorization. Investigate offline Settings hydration as a
separate issue without weakening fail-closed authorization.

Commit message: `test(mobile): cover sync lifecycle and conflict QA`

## Follow-up: Server-Authoritative Learning Commands

Implemented protocol 2 on the same branch. The forward-only migration protects
SRS from client word snapshots and applies uniquely identified review events
atomically under a word row lock. The web review RPC and native event upsert
share this path. Repeated requests are idempotent; canonical before/after values
are calculated by the server, including multiple same-word events in one batch.

Ordering is explicitly server acceptance order, not retrospective chronological
replay. The reproduced Good → delayed Easy scenario now yields two repetitions,
10 days, EF 2.50 and a non-regressing last-review timestamp. Scheduling also
respects the last accepted reset's date. Reset is its own identified command;
retrying it after another review cannot erase that review.

SQLite v9 introduces a persistent sequence shared by reviews and resets. Local
SRS changes and queue inserts are transactional; upload acknowledgement and
tombstones clean up only corresponding commands. Native sync checks the backend
protocol, omits snapshot SRS fields, preserves command order and retrieves
canonical progress/history after upload. Pending commands protect provisional
progress during pulls. Web reset retries reuse the same request in the open form.
Direct mobile service helpers were moved off raw SRS updates as well.

Cutover cannot safely infer whether an unknown old event was already represented
in a previously uploaded snapshot. The transactional migration records existing
word cutovers; ambiguous pre-cutover events fail closed and remain queued, while
known retries remain accepted. Legacy reset snapshots also require a coordinated
client upgrade. No queue is silently cleared and no historical progress is
backfilled. See [protocol and rollout](../learning-sync-protocol.md) for the
complete contract, privilege boundaries and required reconciliation decisions.

Validation:

- 56 local PostgreSQL tests pass, including 240 SQL/shared-SRS comparisons,
  native batch/stale snapshot regression, reset rollback/idempotency/ownership,
  three additional concurrent reset/review cases and cutover protection.
- 93 mobile suites / 1149 tests / 16 snapshots pass; six new real-SQLite command
  tests and three additional sync orchestration tests cover the new boundaries.
- 46 web suites / 319 tests pass, including the real React reset form retry;
  configured web coverage thresholds pass.
- Root/mobile lint, web lint, both application test typechecks and diff checks pass.
- Full forced Stryker: 786 mutants, 98.04%. Four useful reset-validation survivors
  prompted additional tests. A forced rerun of all 52 mutants in that validation
  range updates the combined report to **98.91%**: 454 killed, four survivors,
  one uncovered and 327 TypeScript compile errors; no timeouts. Other results
  are from the preceding full forced run. The remaining findings are the
  previously documented equivalent/defensive cases; no thresholds were lowered.

Hosted migrations, deployment and a fresh native device run were NOT performed.
The deployed generated Supabase contract is unchanged; a temporary typed RPC
overlay covers the undeployed migration and must be removed after regeneration.
The unrelated staged/deleted plugin remains unchanged and excluded. No push,
PR, merge, EAS command or application-account operation was performed.

Next: staging rollout and two-device QA with upgraded clients, followed by an
explicitly approved coordinated production rollout. Preserve/reconcile legacy
queues before cutover; the separate offline Settings hydration issue remains open.

Commit message: `fix(sync): apply learning commands atomically on the server`

## Follow-up: Isolated Auth/REST And Native Protocol QA

Completed the reproduced two-client conflict against a fresh local Supabase
stack and newly rebuilt Android QA clients. Offline Easy survives cold restart;
online Good is acknowledged first; reconnect then converges both clients and
the server to two repetitions, interval 10, EF 2.50 and the newer timestamp.
Repeat sync creates no duplicates. The UI changes New to Learning and displays
two reviews, EF 2.5 and the expected due date. No hosted account was used.

This found and fixed two previously hidden prerequisites: unused development
credentials caused an import-time crash in a clean release bundle; and the
historical migration chain omitted `words.analysis_notes`, blocking native
metadata upload on a fresh backend. Added startup and schema-preservation
regressions. Explicit fixed-bundle QA now skips live Sentry initialization.

Added `test:sync:http` for real local Auth/REST testing with generated users:
delayed event upserts, canonical batch/reset retries, JWT/RLS isolation and
actual five-minute access-token expiry/refresh. The fixtures send the full
native metadata field set. Initial administrative cleanup failed under mixed
cached CLI/Auth versions; exact-user local database cleanup replaced it, then
the complete run passed. See [setup and evidence](../local-sync-qa.md).

Validation: 95 mobile suites / 1151 tests / 16 snapshots, 58 PostgreSQL tests,
four HTTP scenarios, mobile test typecheck, lint and diff checks pass. A fresh
ARM64 APK was built and exercised. Commit hooks also passed 46 web suites /
319 tests; Stryker was not rerun in this follow-up.
The unrelated staged/deleted plugin remains excluded and unchanged.

Next: diagnose offline Settings profile/access hydration and verify native
reset-command recovery after process death. A coordinated hosted rollout still
requires explicit approval, legacy queue reconciliation and client-version policy.
No push, PR, merge, hosted migration, EAS operation or store submission was made.

Commit message: `fix(mobile): support isolated sync QA builds`

## Follow-up: Settings Recovery And Persistent Native Reset

Settings now uses display-only auth session events instead of a network
`getUser()` race. Successful sync revalidates server access. Permission requests
are scoped to the current identity/generation; logout, account switches and
newer requests invalidate late successes/failures. Offline access remains
fail-closed; stored profile metadata never grants authorization.

Added 14 regressions for initial session display, auth events, logout/unmount,
identity changes, request races and offline-to-online access recovery; sync
tests also require access refresh only after successful synchronization.
Validation: 96 mobile suites / 1165 tests / 16 snapshots, mobile test typecheck,
lint and diff checks pass.

A rebuilt local-only Android client verified the email after offline cold
start and Full Access after reconnect. A UI-created reset survived process
death with the exact same persistent command; reconnect delivered it once,
emptied the queue and converged server/SQLite to zero repetitions. Repeat sync
was unchanged; UI showed New and Reviews 0. See the detailed
[evidence and limitations](../native-settings-reset-qa-2026-09-05.md).

One repeated offline cold-start UI flow exceeded its 30-second wait despite the
reset remaining safely stored. Next: isolate startup auth/network waits with
expired and valid tokens; ensure bounded loading without discarding sessions
or weakening authorization. Native iOS/physical-device checks and coordinated
hosted rollout remain separate, with the previous approval/cutover requirements.

Only a new synthetic local account was used and removed. The temporary backend
and read-only emulator were stopped; original APK/manifest were restored.
The unrelated staged/deleted plugin remains untouched and excluded. No push,
PR, merge, EAS operation or hosted write was performed.

Commit message: `fix(mobile): restore profile and access after reconnect`

## Follow-up: Bounded Session Startup

Entry/tab routing now shares a session gate with an eight-second UI deadline,
recoverable error state, manual retry and reconnect recovery. Pending SDK refresh
work is reused rather than cancelled or multiplied. Confirmed sign-out/absence
still routes to login; failed refresh checks do not discard local state.
Initialization no longer blocks entry on the network access lookup; tabs remain
read-only while access is unknown. Provider startup results are identity-event
scoped and ignored after unmount or newer auth events.

Validation: 99 mobile suites / 1187 tests / 18 snapshots, typecheck and lint pass.
22 new regressions cover routing, retry deadlines, stale results, auth-provider
state preservation and light/dark UI. Native QA used a rebuilt local-only APK
and one generated local account. A genuinely expired 180-second JWT showed the
retry screen; reconnect restored the same account and Full Access without
credentials, with unchanged SQLite progress. A separate 600-second-token
offline launch passed. See [evidence and limitations](../native-session-startup-qa-2026-09-05.md).

OPEN / next: after deliberately restarting the local Auth backend, automatic
recovery exceeded the 45-second UI wait despite a healthy backend and matching
API key. An app restart recovered without clearing data or logging in again.
Investigate pending transport/SDK work and retry behavior; do not mark all
native startup paths complete. The existing iOS/physical-device and coordinated
hosted rollout requirements remain in force.

The synthetic account/backend/read-only emulator were cleaned up; original
APK/manifest and unrelated staged plugin were preserved. No push, PR, merge,
hosted migration or EAS operation was performed.

Commit message: `fix(auth): bound native session checks`

## Follow-up: Stalled Native Auth Transport

The primary native client now aborts first-party Auth requests after ten seconds,
leaving retries, rotation and session invalidation to the Auth SDK. Generic
data-request retries are unchanged. Network failures preserve the session;
definitive refresh rejection still signs out. Caller cancellation and transport
resources are cleaned up. The eight-second UI deadline remains separate.

Validation: 101 mobile suites / 1207 tests / 18 snapshots, typecheck and lint
pass. Twenty new tests include five using the actual installed Auth SDK for
cold startup, concurrent readers, exhausted failures, recovery and invalidation.
A loopback fault proxy reproduced the failure on the original Android client:
manual retry could not release a request held for 148 seconds. The fixed client
cancelled held requests at approximately ten seconds and recovered automatically
once new requests were allowed. Identity, SRS fields, history and command queue
were unchanged. See [the evidence and limits](../native-auth-transport-qa-2026-09-06.md).

A normal Auth stop/start passed even on the original client. The prior full-stack
restart had no request trace, so that historical incident is not conclusively
explained. The controlled stalled-request defect is fixed. Next: isolated iOS
and physical-device recovery checks; long-duration offline and coordinated
hosted rollout remain separate. Stryker and PostgreSQL/HTTP suites were not rerun.

Only one new synthetic local account was used and removed; the disposable
backend/proxy/emulator were stopped, original native artifacts restored, and
the unrelated staged/deleted plugin preserved. No hosted writes, push or PR.

Commit message: `fix(auth): time out stalled native requests`
