# Application Quality And Testing

Updated: 2026-09-05. This replaces the pre-monorepo, pre-test-suite proposal.

## Workspace Layout

- `apps/mobile/src`: Expo screens, stores, repositories and native UI.
- `apps/mobile/jest.config.js`: mobile Jest/Expo configuration.
- `apps/web/src`: Next.js routes, auth, feature actions and web UI.
- `apps/web/jest.config.mjs`: web Jest configuration.
- `packages/domain/src/srs.ts`: shared SRS and knowledge-level definitions.
- `apps/web/e2e` and `apps/mobile/.maestro`: browser/device workflows.

Use the root lockfile and pinned Node 24 / npm 11. Do not install the obsolete
test dependencies or root Jest snippets from the original 2025 testing plan.

The root staged-lint command uses ESLint 9's `v10_config_lookup_from_file`
flag so each file selects its nearest workspace config, not the root Expo
config. Remove the flag when upgrading to ESLint 10, where this is the default.
`lintStagedConfig.test.ts` executes configuration resolution from the root for
both mobile and web files to guard against regressions.

## Deterministic Local Checks

Run from the repository root:

```bash
npm run mobile:test -- --runInBand --watch=false --watchman=false
npm run web:test
npm run mobile:typecheck:test
npm run web:typecheck
npm run lint
npm run web:lint
npm run web:test:coverage
npm run web:mutation
npm run test:db
```

Mobile coverage is available with `npm run mobile:test:coverage`. Browser and
device E2E setup is documented in `docs/E2E_TESTING.md`; these are separate
checks, not implied by a passing Jest run.

PostgreSQL prerequisites, isolation and test scope are in
[DATABASE_TESTING.md](DATABASE_TESTING.md). The database suite requires local
server binaries, but no account, connection string or Docker service.

## Critical Regression Matrix

| Risk                                  | Executable evidence                                                                                                                                                                                               | Boundary still requiring live validation                                                     |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Expired web session                   | SDK adapter/redirect unit tests plus Chromium and real Supabase refresh-token rotation through private pages and redirects; invalid-token cleanup and return-path reauthentication                                | Actual signed JWT expiry, concurrent refresh and remotely revoked sessions                   |
| Authentication/authorization          | Verified-user lookup, fail-closed access defaults, OAuth code exchange, safe next destination                                                                                                                     | Provider login, revoked sessions, real RLS enforcement                                       |
| Expired mobile session/reconnection   | Preflight expiry/refresh-failure tests; Android airplane-mode assessment survives cold restart and syncs on reconnect; foreground sync and hook lifecycle tests                                                   | Actual expired/revoked native sessions, offline Settings fallback and iOS                    |
| In-flight sync conflicts              | SQLite stale-acknowledgement/tombstone tests; two real Android clients reproduce an older offline snapshot overwriting newer remote progress                                                                      | Confirmed unresolved progress conflict; event ordering and old-client policy                 |
| Review persistence                    | Action tests, isolated PostgreSQL RPC/RLS/concurrency and browser offline/lost-response retries against real Supabase; unchanged retry payload and durable single-assessment progress                             | Broader hosted schema drift, other assessments under network failures and device transitions |
| Word writes and progress preservation | Execute all five word actions with a recording API double: owner/collection/live-word filters, exact reset/delete/move/image payloads, failed or missing writes, reanalysis conflict fallback without SRS changes | Real PostgreSQL/RLS ownership checks, competing writes and cache refresh in a browser        |
| Mobile review atomicity               | Real SQLite constraints/transactions: event failure or duplicate event rolls back word progress; wrong owner/deleted word denied                                                                                  | Expo SQLite native bridge behavior on both platforms                                         |
| SRS/knowledge                         | Explicit coefficient/rounding/boundary examples, new → learning → established → forgotten, reset and durable event history                                                                                        | End-to-end rendering after cross-device synchronization                                      |
| Production OTA safety                 | Fake executable CLI in isolated temp project tests identity, token identity format, project mismatch, option rejection, publication/map-upload failures                                                           | Actual EAS/Sentry permissions and production channel mapping                                 |

SQLite tests replace only the Expo bridge with Node's in-memory SQLite engine.
They use the real schema, repository statements, constraints and triggers, and
never open application database files. API mocks test our orchestration, not
Supabase's refresh internals or PostgreSQL transaction semantics.

Existing SQL text assertions are useful schema-contract smoke checks, but must
not be described as database integration tests. Likewise, a successful mocked
RPC is not evidence that live RLS or server idempotency works.

## Mutation Testing

`stryker.web.config.mjs` selects risk-bearing modules rather than every UI file:
auth/session/proxy/callback, review persistence, word actions/analysis mapping, shared SRS, and the existing
analysis, collection validation, search, deletion and word mutation helpers.
The break threshold stays at 90%; do not lower it merely to accommodate new
modules.

- Review survivors before adding tests. Assert externally meaningful outcomes.
- Preserve type checking. `apps/web/tsconfig.stryker.json` explicitly includes
  the workspace SRS sources so the checker observes mutations outside the web app.
- Node-environment tests use Stryker's documented environment wrapper, which
  also works with ordinary Jest and reports per-test mutation coverage.
- Web Jest ignores its own nested `.stryker-tmp` directories to avoid duplicate
  workspace package names after an interrupted mutation run.
- The incremental report is a cache, not a substitute for final validation.
  Run `npm run web:mutation -- --force` to retest every mutant.
- Reports are local artifacts under `reports/mutation` and
  `reports/stryker-web-incremental.json`. Do not commit generated reports.

Coverage percentages apply to the configured file set, not the whole product.
Keep uncovered real-provider, real-database and device scenarios visible rather
than claiming that a high score proves all production behavior.

Word action tests mock only the auth context, server client and Next.js cache/
redirect boundaries. The real validation, parsing, mapping and action code runs.
Each queued query records its filters and payload independently; missing-row
responses and errors must not trigger successful navigation/revalidation.
The query double does not execute SQL or simulate RLS enforcement.

## Next Integration Work

Isolated PostgreSQL review RPC/RLS, duplicate events, rollback and concurrent
assessment tests are implemented. The SRS comparison exposed rounding/minimum
interval differences, corrected by a new migration (not deployed by tests).

Browser recovery tests now exercise real Supabase refresh and review writes:
see `apps/web/e2e/README.md`. Cookie expiry is accelerated without modifying or
waiting for the signed JWT's real expiry. Offline retry stays in the open tab;
no persistent offline queue across reloads is claimed.

1. Extend auth validation to actual JWT expiry, concurrent refresh requests and
   remotely revoked disposable sessions; these are not proved by metadata expiry.
2. Fix the confirmed native two-client conflict: an older offline assessment
   overwrites newer remote progress after reconnect. Both events survive, but
   the repetition count loses an assessment and the last-review date regresses.
   Define event ordering, resets and old-client compatibility before changing
   the protocol. See [native QA findings](native-sync-qa-2026-09-05.md).
3. Diagnose the offline cold-start Settings fallback (missing email / Read Only).
   Native Android pending-event durability, reconnect and foreground sync were
   exercised; iOS and actual expired/revoked native sessions remain unverified.

Nine `useSyncManager.lifecycle` hook tests cover reconnect/foreground triggers,
background timers, cleanup, missing identity and failed-attempt recovery. Their
mocked event boundaries do not cover the live progress-conflict defect.

## Account And Side-Effect Safety

Only approved QA accounts or disposable accounts may be used for live tests.
Never use the application's `oldrefery` account. Offline unit/SQLite/CLI tests
need no account, network mutation, build quota or store access. Mock CLI fixtures
do not inherit EAS credentials.

Real environment changes, releases and Git operations require their own explicit
authorization. See `docs/EAS_BUILD_GUIDE.md` for the current cloud-first release
workflow and the limitations of legacy native source-map re-export.
