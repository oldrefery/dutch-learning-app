# D13A.7.4 — mapping/apply/compensation review, 2026-10-11

D13A.7 remains in progress: fixed **4/6 complete, 2 remain**. The local operator
review is complete. Next **D13A.7.5 — GPT-6 Astra / High**: exact semantic model/
prompt/policy qualification. Eight broad milestones remain: D13.6,D13A.7,D13A.8,
D13A.9,D14.1,D14.2,D14.3,D14.4.

## Reviewed invariants

The operator source and its existing actual-database tests agree with contract
section6. No new correctness defect requiring a code change was found in this scope.
The ten criteria and concrete source/test links are recorded in the report's
`review-matrix.json`; test execution results are recorded separately.

- Saved inventory requires exact hashes, complete counts and unique personal IDs.
  Historical D06 safe/possible matches stay ambiguous under the following policy.
  Reclassification of the same protected inputs still yields2914 cards and0 eligible
  links:2465 ambiguous,429 missing,18 private-review,2 excluded. These are historical
  snapshots, not a fresh live inventory or human-approved meaning decisions.
- Reviewed plans bind owner, raw/private content, existing reference/mode/version,
  target entry/revision/head sequence, complete content/media hashes and approved
  diff. Matching spelling alone never authorizes linking. Synthetic review UUIDs
  and hashes demonstrate packet binding, not semantic accuracy or owner approval.
- Planning originals, apply/compensation receipts and immutable batch intent remain
  administrator-only and survive personal deletion. Ordinary application and
  service roles cannot invoke these local operators or read protected originals.
- Apply locks and rechecks personal/state/placement/head/source/gates. Missing-state
  insertions are fenced through the word foreign key. Per-row and final receipts
  share the write transaction. SKIP LOCKED/NOWAIT contention produces no false
  success and no terminal busy-row receipt. Default50/max100 and exact retries hold.
- Compensation compares the full applied fingerprint and target head delivery
  sequence, then restores only owned reference/mode/content fields. Later content,
  placement, state/reference, head ABA or deletion is held for reconciliation.
  Versions advance exactly, including above JS safe integer; BIGINT exhaustion holds.
- Later accepted reviews, resets, corrections and their exact retries survive both
  transitions. Learning never comes from protected snapshots. SQLite retains raw
  words, private state, all learning/retry queues, refresh debt and cursors; pending
  private content blocks apply or causes a compensation hold.
- PostgreSQL barriers verify actual row/session lock overlap. Faulted row/final
  receipts and owned backend termination leave no partial transition. SQLite tests
  close/reopen the file and terminate only the owned child after provisional writes.
  Current operator source matches the preserved compiled child fixture.

## Live-operation prerequisites retained

These are existing contract/D13A.8 gates, not additional numbered plan steps:

| Required before any real apply/compensation                                                                       | Current evidence and unresolved scope                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exact environment, artifact/source SHA, operation, cohort, limits and explicit authority                          | Current request authorizes local review; AUTH27–29 are consumed. No live linking/rollback approval is inferred.                                                                                       |
| Fresh live inventory, changes since snapshot, exact owner/card set and current reference/content versions         | Historical2914 rechecked locally; fresh live state has not been obtained in this checkpoint.                                                                                                          |
| Reviewed same-meaning decisions and complete approved media/content diffs, provenance and protected originals     | Zero real approved decisions. Positive packets in tests are synthetic. Unresolved rows remain usable legacy cards.                                                                                    |
| Current client adoption and device queues, authoritative delivery versions/watermarks and old-build compatibility | Actual device/embedded build85/repair-OTA acceptance remains checkpoint6; the SQLite operator is an isolated rehearsal.                                                                               |
| Exact semantic model/prompt/policy qualification and reviewed failure rates                                       | Still checkpoint5. Mechanical hash/UUID checks are not model qualification.                                                                                                                           |
| Scoped backup/restore evidence and receipt/original retention                                                     | Local interruption/compensation tests pass within synthetic scope; refresh live backup and recovery scope before execution. Never restore a full learning snapshot over later reviews.                |
| Drain/reconcile in-flight apply work before compensation; immutable batch and per-row receipts                    | Compensation does not cancel unprocessed apply rows. Stop outstanding apply workers first; a committed busy result needs a new batch UUID. An uncommitted SQLite transaction may retry the same UUID. |
| Bounded per-batch outcome reconciliation and explicit handling of holds                                           | Only matching eligible rows may proceed; stale/missing/deleted/exhausted/changed-head rows remain held. No deletion of receipts to force a retry.                                                     |

## Validation and environment

Reports: `reports/shared-dictionary-cefr/d13a7-operator-review-20261011/`.
Node24.20.0. Fresh SQLite21/21 and inventory4/4 pass; exact historical inventory
reclassification agrees with saved aggregate counts. Final PostgreSQL **53/53**
passes: plan14, apply11, concurrency14, compensation14. Total **78 fresh tests**;
zero failures/cancelled/skipped. Scoped evidence formatting and diff check pass.

The first PostgreSQL launch could not reach the local Docker socket under the
sandbox and failed before database setup. The same reviewed harness was rerun with
approved local socket access: cached pinned image, no network/ports/image pull,
random owned tmpfs containers and owned cleanup. The failed setup log is retained
as infrastructure failure, not a SQL regression. No host PostgreSQL retry or change
to other clusters/settings was attempted.

## Integrity and scope

Entry3607 SHA references matched;611 dirty paths and feature/shared-dictionary-schema
HEAD f97a733407a4d2b37e8f9ca030ad9574de85a794 preserved. No implementation, tests,
migrations, dependencies, private inputs, old evidence or deployed state changed.
Only new review evidence/reports and five current task notes are written; final
613 dirty paths retain all611 entry paths. All owned tests/containers/SQLite children
exited with cleanup; no pending operation. Earlier client,
server/domain, browser and full-suite checks are historical, not rerun here.
No independent reviewer or model-picker switch is claimed.

D13A.7 stays in progress. Next checkpoint5: exact semantic model/prompt qualification,
GPT-6 Astra / High; checkpoint6: actual device/old-client/offline/performance evidence.
Real cards eligible/approved/applied0; flags OFF outside QA, shared_analysis FALSE,
CEFR OFF. No provider/paid/hosted/Git/EAS/device/release/automation operation.
