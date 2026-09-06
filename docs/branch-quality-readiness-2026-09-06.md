# Quality Branch Readiness — 2026-09-06

Branch: `codex/app-quality-session-sync-tests`.
Review baseline: `8056d5e8797587e0b41d358bc454e1d91d95a730`.
Previous commit: `51b3768` (interrupted local queue migration tests).
This report accompanies bounded sync diagnostics and rollout documentation.

## Local Evidence

Checks used Node 24.20.0 / npm 11.19.0 and the installed lockfile dependencies.
No fresh `npm ci` or remote GitHub Actions execution was performed. Local
PostgreSQL is 15; the CI job uses 16, so these are not identical environments.

| Check                                       | Result                                                                |
| ------------------------------------------- | --------------------------------------------------------------------- |
| Mobile Jest with coverage                   | 105 suites, 1,243 tests, 18 snapshots passed                          |
| Mobile application and test typechecks      | Passed                                                                |
| Domain and Supabase-contract typechecks     | Passed                                                                |
| Web Jest with coverage                      | 46 suites, 319 tests passed                                           |
| Web typecheck and lint                      | Passed                                                                |
| Repository `lint:ci`                        | Passed; five existing duplicate-string warnings remain in older tests |
| Formatting and Maestro YAML validation      | Passed; YAML validation is not device execution                       |
| Isolated PostgreSQL migrations/RLS/commands | 58 tests passed; disposable clusters only                             |
| Edge Function tests                         | 72 passed, external service dependencies replaced by test doubles     |
| Full forced web/domain Stryker run          | 98.91%, 16 source files, 786 mutants                                  |
| Production web build                        | Passed with dummy backend values and Sentry uploads disabled          |
| Expo Doctor                                 | 21/21 passed; dotenv loading disabled                                 |
| Release version alignment                   | Passed: 2.2.0, build 81                                               |
| Clean-release preflight                     | Blocked by dirty working tree; not bypassed                           |

Stryker produced 454 killed, four surviving, one uncovered and 327 compile-error
mutants, with no timeouts. Compile errors are excluded from the score. The
previously documented survivors/defensive parser gap remain; this score is not
coverage of the entire web app or of the new mobile diagnostics.

Reported total statement coverage is 62.13% mobile and 48.14% web, with differing
collection/exclusion rules. Passing configured thresholds does not mean complete
behavioral or screen coverage. New diagnostics add 14 regression cases plus
stronger existing sync assertions, covering timing, privacy and actual SQLite
aggregation rather than only successful SDK calls.

The dummy-config web build is a compilation check, not a deployment or a usable
production-backend smoke test. Expo Doctor initially could not reach the public
npm registry in the sandbox; the network-enabled retry passed without loading
application env files or accessing an EAS project.

## Scope And Release Decision

- No hosted schema, Sentry configuration, application account, store, OTA or remote
  Git branch was changed. No push, PR, merge or deployment was performed.
- The unrelated staged/deleted `apps/mobile/plugins/withRCTTurboModulePatch.js`
  remains excluded. Its index state must be resolved by its owner before a clean
  release; do not restore or include it as an incidental cleanup.
- New diagnostics still need deployment and live-ingestion confirmation. They
  observe native sync attempts, not all startup/session-gate failures.
- Protocol 2 needs a coordinated backend/web/native rollout and an explicit
  legacy-client decision. Follow [rollout and recovery](learning-sync-rollout.md);
  do not treat local green checks as permission to migrate production.
- Physical-device networking, real installed-old-build upgrade and real-provider
  web expiry remain unverified by user choice. A multi-day soak and hosted rollout
  have not been performed. Earlier local native/HTTP evidence remains separately
  documented, not newly rerun or relabeled as production evidence here.

Conclusion: local implementation and regression gates are ready for review, not
an unconditional production-release approval. The remaining consequential work
is the rollout/legacy-queue decision and clean release preparation, not another
claim of universal test coverage.
