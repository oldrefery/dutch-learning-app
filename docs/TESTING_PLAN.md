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
```

Mobile coverage is available with `npm run mobile:test:coverage`. Browser and
device E2E setup is documented in `docs/E2E_TESTING.md`; these are separate
checks, not implied by a passing Jest run.

## Critical Regression Matrix

| Risk                                | Executable evidence                                                                                                                                     | Boundary still requiring live validation                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Expired web session                 | SDK cookie adapter, route redirects preserve refreshed/deleted cookies, configured route matchers                                                       | Real Supabase token rotation and concurrent browser requests                      |
| Authentication/authorization        | Verified-user lookup, fail-closed access defaults, OAuth code exchange, safe next destination                                                           | Provider login, revoked sessions, real RLS enforcement                            |
| Expired mobile session/reconnection | Sync preflight expiry boundaries, refresh failure, offline → online retry; existing JWT/RLS retry tests                                                 | OS connectivity events, background/foreground and native SDK storage              |
| In-flight sync conflicts            | Real in-memory SQLite executes repository SQL; stale word/progress acknowledgements cannot clear newer pending edits; tombstones survive                | Concurrent devices and remote last-writer policy                                  |
| Review persistence                  | Web action validates/authenticates and calls atomic RPC; failure does not revalidate; retries preserve event identity                                   | Execute PostgreSQL RPC/RLS and competing submissions against an isolated database |
| Mobile review atomicity             | Real SQLite constraints/transactions: event failure or duplicate event rolls back word progress; wrong owner/deleted word denied                        | Expo SQLite native bridge behavior on both platforms                              |
| SRS/knowledge                       | Explicit coefficient/rounding/boundary examples, new → learning → established → forgotten, reset and durable event history                              | End-to-end rendering after cross-device synchronization                           |
| Production OTA safety               | Fake executable CLI in isolated temp project tests identity, token identity format, project mismatch, option rejection, publication/map-upload failures | Actual EAS/Sentry permissions and production channel mapping                      |

SQLite tests replace only the Expo bridge with Node's in-memory SQLite engine.
They use the real schema, repository statements, constraints and triggers, and
never open application database files. API mocks test our orchestration, not
Supabase's refresh internals or PostgreSQL transaction semantics.

Existing SQL text assertions are useful schema-contract smoke checks, but must
not be described as database integration tests. Likewise, a successful mocked
RPC is not evidence that live RLS or server idempotency works.

## Mutation Testing

`stryker.web.config.mjs` selects risk-bearing modules rather than every UI file:
auth/session/proxy/callback, review persistence, shared SRS, and the existing
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

## Account And Side-Effect Safety

Only approved QA accounts or disposable accounts may be used for live tests.
Never use the application's `oldrefery` account. Offline unit/SQLite/CLI tests
need no account, network mutation, build quota or store access. Mock CLI fixtures
do not inherit EAS credentials.

Real environment changes, releases and Git operations require their own explicit
authorization. See `docs/EAS_BUILD_GUIDE.md` for the current cloud-first release
workflow and the limitations of legacy native source-map re-export.
