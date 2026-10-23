# D13A.5 — Explicit retained-import recovery and cancellation

Date: 2026-10-10. Local checkpoint complete; D13A.5 remains in progress.
Recommended model/effort: GPT-6.1 Sol / High. No picker switch claimed.
Branch: feature/shared-dictionary-schema. HEAD: f97a733407a4d2b37e8f9ca030ad9574de85a794.
Persistence: local-only/uncommitted. No external operation was started.

## Behavior

Mobile and web retained-import panels now offer explicit placement recovery and
cancellation after a current-server-state check. Recovery requires an explicitly selected
owned collection and captures the original intent, current placement and recovery version.
The client checks fresh server placement again before reserving; the existing server CAS
returns immutable state/placement conflicts if it changes after reservation. Conflicts
require another status check and explicit destination selection. A failed status check,
reload, original delivery or recovery/cancellation attempt clears the prior placement
snapshot. Deleted/unavailable or cancelled cards never offer recovery.

Recovery/cancellation requests are journaled before dispatch. Unknown results expose a
same-ID retry; restart only reads durable metadata and never dispatches automatically.
A pending recovery/cancellation cannot reserve another operation, and any related
recovery/cancellation fences original-import delivery. Finished conflict results allow a
new explicitly requested recovery after fresh status; cancellation permanently fences
further import/recovery. Creation flags gate uncreated recovery, while existing-card
recovery, cancellation and status/retry remain available with creation off. Backend
permission, ownership, target validity and deletion checks remain authoritative.

Cancellation only closes future import/recovery. It does not delete an existing card,
unlink it, reset learning or remove the saved original. Both panels explain this before
the explicit cancellation button. Applied recovery is shown separately from identity,
state and placement conflicts. Only a latest confirmed inserted/applied receipt enables
Load saved import; the existing owner-fenced hydrator still verifies current personal
and shared dependencies before SQLite hydration or a web refresh request. Recovery never
fabricates personal rows/SRS or invokes broad sync/provider/private-copy paths.

Native and web service adapters compose the mounted request epoch with their existing
Auth lifetime and latch account A-to-B-to-A. They check both boundaries around RPCs and
journal transactions; a view closed during an uncertain response retains the original
pending request. The common controller also fences delivery after reservation/unmount.
Current placement is displayed using known collection names without exposing protocol
versions or nonces in the product flow.

## Verification

Runtime: Node 24.20.0 via `/Users/devrush/.nvm/versions/node/v24.20.0/bin`.
Exact source/log hashes: [machine evidence](D13A-recovery-ui-20261010.json).

| Check                                                            | Result                                                                                |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Full mobile suite, configured coverage                           | 179 suites, 2245 tests, 22 snapshots; zero skipped/todo                               |
| Full web suite, benchmark enabled                                | 102 suites, 922 tests; zero skipped/todo                                              |
| Focused native controller, light/dark UI and real SQLite adapter | 3 suites, 42 tests before final stale-status regression; final full suite includes it |
| Focused web UI/browser adapter                                   | 2 suites, 17 tests, included in full web                                              |
| Mobile production/test, web and domain types                     | Pass                                                                                  |
| Root/web/changed-domain lint                                     | Pass, zero warnings                                                                   |
| Scoped format and git diff check                                 | Pass                                                                                  |

Both full runs cover the production source hashes in full-suite-source.json. Two UI test
files were subsequently formatted; TypeScript token equality and final affected native1/12
plus web1/7 runs verify the final tests. No production source changed after full runs. New native18/web5 regression cases cover explicit destination/CAS,
state/placement conflicts, gate-off existing recovery, uncreated/deleted/cancelled fences,
rapid clicks, same-ID unknown replies across restart, offline state checks, mounted/Auth
invalidation and no personal data writes. Existing Auth ABA/two-owner and learning/cache
preservation regressions are also included unchanged. Test fixture field ordering, new
guard expectations, stale-error text and duplicate-string lint failures were repaired;
failed logs retained. Final scoped format corrected two test files with token equality.
No test skip or rule suppression was added.

475 entry hashes were verified. All10 source/test paths extend the preceding228-source
bundle; no additions, migrations/backend/generated-target changes or historical mirror
edits. The37 historical test mirrors and47 sealed artifacts remain unchanged. Exact dirty
paths are in the report directory's git-status.txt. Prior backend/Edge/PostgreSQL checks
are carried unchanged only; no new remote or backend run is claimed.

Node review benchmark still records long tasks and does not qualify browser/native/device
performance. The pre-existing broad-domain app-config.ts:171 any remains outside this
change; scoped changed-domain lint passed, no all-domain lint result is claimed.
All runners exited. No pending resource or uncertain external operation remains.

## Next checkpoint and permissions

D13A.5 remains in_progress; D13 observation stays open and D14 pending. Next:
**explicit existing-card resolution for identity-conflict receipts**, GPT-6.1 Sol / High.
Validate the receipt's existing personal ID against current owner, deletion, shared meaning
and mode; offer explicit current-card loading without merging learning or replaying the
original import. Preserve conflict receipts/nonces and reject deleted/foreign/wrong-meaning
cards. Verify restart/offline/Auth ABA/two owners and pending recovery/cancel fences.
A missing local owned collection still requires ordinary collection sync before hydration.
Broader official/shared/new-word adoption, private/mode/server-history reconciliation,
representative review performance and D13A.7/8 qualification remain open.

All new client/server gates OFF, shared_analysis FALSE, roles/policies unseeded, CEFR OFF.
AUTH27–29 consumed. No commit/push/PR, hosted migration, conversion, provider/paid call,
publication, Expo/EAS/release, device operation or automation was authorized or performed.
