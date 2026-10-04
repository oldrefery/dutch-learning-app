# D12 integrated verification — 2026-10-04

Starting HEAD `3c3d16c`, branch `feature/shared-dictionary-schema`.
Untracked `.playwright-cli/` predates this work and is not part of the change.

## Scope and intended next action

Run the local verification matrix from `package.json` and
`.github/workflows/quality.yml`, using Node 24.20.0 and no real provider
credentials. Save private raw logs under
`reports/shared-dictionary-cefr/d12-verification-20261004/`; record sanitized
results here. Disposable database tests create and remove only their own
temporary clusters. Any HTTP/native/browser runtime requires the previously
authorized task-only resources or a newly isolated synthetic local test.
Never use application accounts or hosted endpoints for these checks.

D11's diagnostic completion does not validate linguistic CEFR accuracy.
The [activation gate](D11-cefr-activation-gate.md) remains blocked, worker
and schedule OFF. D01 pre-release evidence and D13 release approval remain
independent requirements.

## Matrix

| Area                                    | Planned evidence                                       | Status                                                                                             |
| --------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| PostgreSQL/RLS/concurrency/backfill     | `npm run test:db`                                      | PASS in aggregate: full PG16 265/266 then repaired affected suite 29/29 (see below)                |
| Generated target contract               | `npm run supabase-contracts:target:check`              | PASS; disposable PostgreSQL 16 / PostgresMeta 0.99.0                                               |
| Local HTTP protocol                     | `npm run test:sync:http` on an isolated loopback stack | PASS: 10/10, actual JWT expiry/refresh/replay, cleanup exit 0                                      |
| Edge and dormant CEFR                   | Cached Edge suite with external network denied         | PASS: 158 tests, external network denied                                                           |
| Mobile SQLite/UI/coverage               | `npm run mobile:test:ci`                               | PASS after Expo patch update: 156 suites / 1796 tests / 22 snapshots; coverage gates pass          |
| Web/domain/coverage                     | `npm run web:test:coverage`                            | PASS: 86 suites / 780 tests; one preexisting skipped suite/test; coverage gates pass               |
| Types                                   | Mobile app/tests, domain, Supabase contracts, web      | PASS: all five targets; mobile app/test and web repeated after dependency update                   |
| Style/flows                             | Lint, web lint, format, Maestro flow validation        | Lint/web lint and Maestro validation PASS; final lint/web lint and full-repository formatting PASS |
| Official content and navigation backend | Local repository test scripts                          | PASS: 38 official-content and 4 navigation backend tests                                           |
| Browser fixture contracts               | `npm run web:e2e:fixtures`                             | PASS: 3 tests; fixture contracts only, not actual app E2E                                          |
| Mutation                                | `npm run web:mutation`, required threshold 90          | PASS after Jest environment correction: 96.59% / threshold 90%                                     |
| Web build                               | Placeholder public config, no Sentry upload credential | PASS: local production build, placeholder public config, no upload                                 |
| Expo health                             | Workflow-equivalent dependency/config checks           | PASS after compatible patch update: 21/21 checks                                                   |
| Native/cross-client/rollback            | D12.3–D12.5 reconciliation and missing runtime checks  | Open: fresh native artifacts required after Expo patches; D12.3–D12.5 not claimed                  |

D12 remains in progress. Check logs and running processes before restarting an
interrupted operation; do not replay uncertain writes.

## Repairs and unsuccessful setup attempts

- Twelve newer web test files used plain `@jest-environment node`. Stryker's
  per-test coverage dry run rejected them. They now use the existing repository
  convention `@stryker-mutator/jest-runner/jest-env/node`. The regular web suite
  passed afterward. Mutation run: 1393 mutants, 668 dry-run tests, 1265 reused
  incremental results and 128 newly evaluated mutants. This is not a full fresh
  mutation run. No assertions or product behavior changed.
- Host PostgreSQL 15 passed 265/266; the legacy-upgrade case could not create a
  second cluster because macOS shared-memory IDs were exhausted. No unrelated IPC
  segment or process was removed. A no-network, read-only-source Docker run with
  PostgreSQL 16 and Node 24.20.0 passed that case, but one real-psql CEFR integration
  test hit its 100ms budget. The focused retry then found the same issue in a
  200ms fake-response case. These integration deadlines are now 5000ms (the
  supported bound); the never-resolving fake still tests actual timeout behavior.
  Production deadlines and focused Edge timeout tests are unchanged.
- Sandbox denied local sockets required by navigation/Stryker; approved local
  reruns passed. Initial Expo Doctor could not reach npm in the sandbox; its
  approved public-metadata retry reported eight outdated compatible patches.
- Installed eight direct SDK57 patch updates and 10 transitive Expo patches.
  Exact versions are in `apps/mobile/package.json` and `package-lock.json`.
  No major SDK/RN/React change, opt-in scene support, native regeneration, cache
  clearing, account/EAS operation or dependency-wide update was performed.
  Reviewed official SDK57 changelogs: Expo/build-properties add opt-in scene
  support; updates fixes embedded bundle diff and asset-hash handling. New native
  artifacts are required; D10 binaries do not validate these dependency changes.
- HTTP setup retries stopped and removed only freshly created QA resources.
  Default Docker bindings were rejected before tests; the local create-request
  adapter now binds explicitly to 127.0.0.1. A generated underscore in a temporary
  name was correctly rejected by the fixture path guard. A later adapter stdin
  half-close issue broke fixture SQL; the adapter is now used only for container
  creation, with native Docker transport used for tests/cleanup. Fixture safety
  guards and application source were not relaxed.

## Reproduction and persistence

Private raw logs and per-command JSON receipts reside in
`reports/shared-dictionary-cefr/d12-verification-20261004/`. Initial source is
`3c3d16c`; final worktree includes only the documented test/dependency fixes plus
checkpoint documentation. No secret dotenv was loaded; public build values are
loopback placeholders, Sentry uploads disabled. Node 24.20.0, clean allowlisted
environment, CI mode. The Edge command adds `--cached-only --allow-env --deny-net`
to the repository's Deno config and function directory. Ordinary npm commands in
the matrix use root workspace wrappers. Preserve safe runner copies and hashes
with the private results before session end.

No paid/provider call, support message, hosted mutation, publication, push, PR,
deployment or CEFR activation. Native devices have only been inspected read-only;
assigned Android is absent and iOS availability will be rechecked before use.

### Mid-run checkpoint

PostgreSQL focused final run: **29/29 PASS**, including completed fake response,
all conservative failure outcomes and the genuine never-resolving provider.
Together with the full run, every one of the 266 database cases has a passing
result for its final relevant source. This is an aggregate result, not a second
full 266-case run. Logs: `database-pg16.log`,
`database-pg16-budget-{recheck,final}.log`. All PG16 containers auto-removed.

HTTP v6: nine immediate cases passed; waiting for actual 300-second JWT expiration
and refresh/replay. New task project and cleanup state are persisted in
`http-runtime-v6.json`; inspect before repeating. Earlier v1–v5 are stopped.
Assigned iOS is Shutdown and Android absent on read-only inspection. Native
build/upgrade/restart and actual browser acceptance remain first runtime work.

### D12.1/D12.2 local matrix accepted

HTTP v6 completed 10/10 (343 seconds); test exit 0, stop exit 0, network removal
exit 0 at 17:14:37 UTC. Formatting and final mobile/web lint/type/test checks pass.
D12.1/D12.2 are complete for the local matrix; hosted CI was not triggered.
No test runner remains active. Native/build/runtime acceptance is still open.

For D12.3, the retained source copy was refreshed from the current repository using
`D08-qa-setup.mjs native-only`; no installed app was changed. Read-only inspection
found the old DB/Kong bindings exposed all interfaces. The exact stopped containers
were snapshotted/renamed to `-d12-port-backup`, then recreated with their filesystem
configuration and the identical named database volume, explicit 127.0.0.1 bindings,
and restart policy `no`. Neither backup was started or deleted. Auth/REST are
unchanged and have no published ports. Private `retained-loopback.json` records
IDs and phases; never repeat this replacement blindly. The two container image
snapshots contain local QA configuration and must remain private. No database
migration, content reset or data copy was performed. Next: start exact four task
services, capture baseline, rebuild both native apps, then verify retained state
through update/offline restart before runtime acceptance.

### Retained QA database upgrade

Local commit `e09f5ca` preserves the matrix fixes; normal hooks passed mobile
1796 tests/22 snapshots and web 780 tests/one existing skip. Four retained QA
services are now running on verified loopback bindings. Full private backup
`retained-before.sql` captured before applying the three previously missing D11
migrations in one transaction, including migration ledger entries. Receipt
`local-migration-receipt.json` records exact original SQL hashes and commit.
All eight captured table projections compare identically afterward (28 words,
22 content states, nine collections, four access rows and empty review tables).
CEFR control is disabled with null policy and zero methods/jobs/usage; no schedule
or worker was started. This is local synthetic upgrade evidence only.

Both platform prebuilds and CocoaPods completed in the private QA copy. Android
and iOS Release builds are running; installed apps remain unchanged. Browser
first navigation/snapshot timed out during concurrent native compilation, then
the login page rendered with zero console errors. No successful runtime acceptance
is claimed from those setup attempts. Private `web-runtime.json` records exact
runner/proxy/web PIDs and source copy; new named browser session `d12-local-qa`.
