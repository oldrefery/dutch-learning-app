# Review correction local quality verification

Branch: `feature/isolated-fixture-ci`, based on `b0ebfaf`.

## Scope and safety

This milestone adds regression tests and mutation targets; application behavior,
dependencies, SQL migrations, and persisted data are unchanged. No application
account was used, no hosted migration was applied, and nothing was committed,
pushed, or deployed by this verification.

The new Stryker targets are `correction-validation.ts`, `correction-client.ts`,
`correction-actions.ts`, `correction-refresh.ts`, and `session-corrections.ts`.
All 16 existing targets remain enabled. The break threshold remains 90%; static
mutants and TypeScript checking remain enabled. JSON and HTML reports are written
under the ignored `reports/mutation/` directory.

## Regression coverage added

- Validate command identity, incrementable SQL revision limits, all ratings,
  safe integers, SRS ease bounds, real calendar dates and reset timestamps.
- Bind acknowledgements to the exact word, event, correction ID and revision;
  never accept an error response just because it also includes plausible data.
- Reject array-shaped UUIDs before database reads. Verify every owned-word/event
  query filter and preserve revision zero and missing effective events.
- Claim one write/refresh synchronously; ignore responses for detached hosts,
  replaced sessions, or replaced commands. Background sessions and unresolved
  ordinary reviews cannot start corrections.
- Retain immutable uncertain commands; preserve conflict state after failed
  refresh and reject mismatched refresh identities.
- Replace only the intended word/event, retain unrelated state and blocked edits,
  invalidate full details, and preserve readable history after deletion.
- Keep user-facing error guidance and privacy-safe telemetry useful; raw provider
  errors are not exposed or sent to Sentry.

The lifecycle tests construct real review-flow state, then use deferred mocked
transport promises to exercise ordering and stale-response behavior. SQL tests
separately exercise actual concurrent transactions and RLS in disposable databases.

## Local checks

Environment: Node 24.20.0; PostgreSQL 15 locally (CI uses PostgreSQL 16).

| Check                                                         | Result                                                             |
| ------------------------------------------------------------- | ------------------------------------------------------------------ |
| Web Jest                                                      | 53 suites, 520 tests passed                                        |
| Mobile Jest                                                   | 127 suites, 1,494 tests, 22 snapshots passed                       |
| Isolated PostgreSQL                                           | 102 tests passed                                                   |
| Edge Functions                                                | 72 tests passed                                                    |
| Offline browser fixture contracts                             | 3 tests passed                                                     |
| Mobile app/test, web, domain and database-contract typechecks | Passed                                                             |
| Repository and web lint                                       | Passed                                                             |
| Formatting and Maestro YAML validation                        | Passed                                                             |
| Web production build                                          | Passed with dummy backend configuration and Sentry upload disabled |

Web coverage uses the existing production scope, excluding test fixtures rather
than counting test helpers as application coverage. It is not whole-repository
coverage: existing route/repository exclusions remain. The measured total is
62.34% lines, 85.45% branches and 81.08% functions. All four newly targeted server
modules have 100% line/branch/function coverage; the session correction controller
has 99.06% lines, 97.5% branches and 100% functions. Mutation results are a separate
measure of whether assertions detect changed behavior.

## Mutation results

The first full forced run over the expanded scope scored 91.52% (669 killed,
59 surviving, 3 uncovered, 587 compile errors). After strengthening the tests, a
second full forced run scored 97.67%. A final incremental run incorporated the
two array-shaped UUID cases: 42 mutants were retested, with 1,276 unchanged
results reused from the completed forced run.

Final score: **97.95%** across **1,318 mutants in 21 files**:
716 killed, 14 surviving, 1 uncovered, 587 compile errors, zero timeouts and zero
runtime errors. Compile-error mutants do not count as test-detected errors and
are excluded from the score denominator. The new assertions detect 47 mutants
missed by the initial expanded-scope run; these are deliberate code mutations,
not 47 discovered application defects.

| New target                 | Initial score | Final score |
| -------------------------- | ------------- | ----------- |
| `correction-actions.ts`    | 67.44%        | 90.70%      |
| `correction-client.ts`     | 100%          | 100%        |
| `correction-refresh.ts`    | 84.62%        | 94.87%      |
| `correction-validation.ts` | 88.42%        | 95.79%      |
| `session-corrections.ts`   | 67.90%        | 100%        |

Remaining mutants stay visible, without suppressions or target exclusions:

- Four correction-action mutants change swallowed internal error strings or
  replace optional access with an exception handled by the same generic boundary.
- Two refresh mutants change swallowed internal error strings.
- Four validation mutants remove date-regex anchors (the ISO date round-trip still
  rejects extra characters) or defensive non-object checks (remaining fields still
  reject JSON primitives). This does not claim equivalence for arbitrary non-JSON
  JavaScript objects/functions with custom properties.
- Four pre-existing survivors concern search's primitive guard, the image
  validator's mutually exclusive error/value contract, Hard's identical zero-day
  result, and adding versus subtracting Good's zero ease adjustment.
- One pre-existing uncovered mutant remains in the fallback message for a
  non-Error analysis-parser exception in `features/words/actions.ts`.

These scores describe the configured scope, not all web or mobile code. Full
reproduction: `npm run web:mutation -- --force`; incremental verification:
`npm run web:mutation`. Do not run a Next.js build concurrently with either.

## Runner corrections

- Per-file Node environments now use Stryker's documented Jest environment, which
  also supports ordinary Jest runs. Previously these overrides bypassed mutation
  coverage collection.
- `watchman: false` now lives in Jest configuration, not only the npm CLI command,
  so programmatic Stryker runs use the same file crawler. The initial run reported
  repeated Watchman recrawls. A long-lived worker crashed in both full mutation
  runs, including after Watchman was disabled, so this is **not a crash fix**.
  Both local macOS crash reports point to V8 root visitation during garbage
  collection (`ClearStaleLeftTrimmedPointerVisitor`, `MarkCompactCollector`) in
  Node 24.20.0. This identifies the crash site, not the initiating cause. Stryker
  recreated the worker and retried its operation; neither completed report has
  `RuntimeError` or timeout results. Stabilizing/minimizing this local native
  test-runner crash remains a follow-up, not a resolved application bug.
- Generated browser and mutation reports are excluded from Prettier. Source/test
  files remain checked; no lint rule or test threshold was suppressed.
- Run production builds and Stryker sequentially: both consume `.next` route
  types, and a build can replace files during the checker's initial compilation.
- Local PostgreSQL, Chromium and Stryker needed sandbox permission for shared
  memory, native browser IPC and the runner's local socket respectively. The
  build additionally downloaded public Google Fonts. These permissions did not
  enable application-account testing.

## Not established by these results

The fixture browser tests do not run the review UI against a deployed backend.
Correction server actions and mobile transport still use mocks in these tests.
Real HTTP/Auth integration, browser interaction with the correction RPC, and
native runtime verification remain separate work before coordinated rollout.
Migration `20260906160000_add_review_corrections.sql` remains undeployed.
