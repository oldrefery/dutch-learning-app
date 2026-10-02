# D08.4 sync-status repair — 2026-10-01

Status: local repair and synthetic verification complete; native acceptance open.
Branch `feature/shared-dictionary-schema`, HEAD
`c5dfb14d49b9a53521b53e13bdd19991999ede5d`. All task work remains local,
uncommitted and unpushed. Model/effort picker was not observable; Astra / High
was recommended. No independent agent review is claimed.

## Change and review

- `syncStatusService.getSnapshot` reads the requested owner's missing-card IDs
  alongside pending content commands. A single set counts metadata, commands and
  hydration debt without counting the same word twice. Both dictionary queries
  remain behind the existing default-off runtime flag. Last-success timestamps
  are preserved; known incomplete hydration now produces pending status.
- `dictionaryContentSync.refreshChanges` persists `requireCardRefresh` for the
  affected owner's cards before pulling their dependencies. A failed/rejected or
  partial pull retains debt and does not advance the page cursor. A retry starts
  from the same cursor. Existing transactional `saveCardStates` clears completed
  refresh obligations; pending private edits remain separately counted.
- Existing repository queries exclude foreign-owner and deleted words; queue
  insertion is idempotent. No schema, server protocol, learning protocol, runtime
  activation flag or UI design changed. The fix concerns known hydration work;
  it does not claim knowledge of server changes that have never been fetched.

## Verification

Commands use Node 24 via `PATH=/opt/homebrew/opt/node@24/bin:$PATH`; Jest runs
from `apps/mobile`, other commands from the repository root. Logs are durable
but ignored under `reports/shared-dictionary-cefr/`.

- Before runtime edits: focused status/change-page Jest **5 failed, 17 passed**.
  Failures reproduced missing hydration counts and absent refresh persistence.
  Log: `D08-status-before.log`.
- After runtime edits: full `npx jest --watchman=false --runInBand --silent`:
  **142 suites, 1,632 tests, 22 snapshots passed**. Log:
  `D08-status-full-mobile.log`. Subsequent edits only refined test helpers and
  added the two Settings theme tests below; runtime remained unchanged.
- Final focused `npx jest --watchman=false --runInBand --coverage=false
--runTestsByPath` with status service, dictionary sync, dictionary repository,
  file-backed restart and Settings status suites: **5 suites, 53 tests passed**.
  Log: `D08-status-after.log`.
- Coverage includes owner isolation, deduplication across all three sources,
  default-off behavior, incomplete/rejected pull retry at the old cursor,
  hydration-only debt surviving a real SQLite close/reopen, debt clearance and
  unchanged SRS. Light/dark Settings tests show `1 pending` after failure and
  `Up to date` only after recovery, retaining the prior successful timestamp.
- Build/test typechecks, full strict lint and final focused strict lint passed.
  Logs: `D08-status-typecheck-build.log`, `D08-status-typecheck-test.log`,
  `D08-status-lint.log`, `D08-status-focused-lint.log`.
- Final `npm run format:check` and `git diff --check` passed. Formatting log:
  `D08-status-format.log`.

Intermediate harness corrections: the first edit command ran from the mobile
folder instead of the repository root and changed no files. The initial restart
assertion used a nonexistent repository helper; it now uses the owner-scoped
reader. Test fixture types and two lint warnings were corrected without rule
suppression. Formatting was rerun after the helper cleanup. These are not
unresolved runtime defects.

Runtime fingerprints:

| File                                                | SHA-256                                                            |
| --------------------------------------------------- | ------------------------------------------------------------------ |
| `apps/mobile/src/services/syncStatusService.ts`     | `232d23ec02ac7d8a7c58b01406e6e41c7eb5cb193567d3b91b29522635c15f1c` |
| `apps/mobile/src/services/dictionaryContentSync.ts` | `8178f92944c1f2afd5eb35d33fa2755f3a379e5fff5af5d2da54036788feab2a` |

## Next checkpoint and environment

Switch to **GPT-5.6 Sol / High** for routine isolated native QA. Rebuild both QA
clients with these runtime files before asserting the defect is fixed on native.
Inspect retained task resources first; no device/service operation was performed
or its liveness reverified during this repair session. Prior process IDs and
installed builds are historical, not fresh observations.

Only iOS `DDEDCE4E-153B-48A4-A47C-B4ED0F499F1F`, Android AVD
`woordenaar_d08_qa_20260921` / emulator-5584 and Docker project
`woordenaar-d08-qa.ZFsE50` are authorized. Preserve existing synthetic state.
The ignored native source copy is not yet refreshed with this fix. Roots and
helpers are in [the native checkpoint](D08-native-content-qa-20261001.md).

Rerun missing-dependency status for both cursor-only CEFR refresh and card-refresh
hydration, include cold restart and recovery, and verify old cursor/pending debt
until success, then empty queues, new assessment and unchanged learning state.
Continue the remaining private-add/native-image/stale-local-choice/repeated-modal/
deletion/account-switch matrix in [closure review](D08-closure-review.md).
D08.4 stays open; D09 has not started. Production, schema switching, deployment,
paid providers, commits and other sessions' devices remain outside this scope.
