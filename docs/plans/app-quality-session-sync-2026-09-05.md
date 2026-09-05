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
