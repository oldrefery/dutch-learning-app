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
