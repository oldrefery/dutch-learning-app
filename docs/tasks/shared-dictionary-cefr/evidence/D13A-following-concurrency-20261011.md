# D13A.6.4 — actual concurrent and interrupted PostgreSQL transactions

Date: October11,2026. Fixed progress4/5, remaining checkpoint5. D13A.6 in_progress.
Branch feature/shared-dictionary-schema, HEAD f97a733407a4d2b37e8f9ca030ad9574de85a794.
Local-only/uncommitted. No real-card semantic approval or linking.

## Qualification

New synthetic fixture/session helpers and14 PostgreSQL tests execute current
migrations and unchanged D06/planning/apply SQL. Named owned sessions record exact
backend PIDs, use output/statement barriers and observe server lock wait state with
pg_stat_activity/pg_blocking_pids. Overlap is demonstrated, not inferred from a delay.
Statements and idle sessions are bounded; every connection closes in finally.
Only an exact owned PID/name can be terminated. Unique fault triggers are scoped to
one synthetic run, removed idempotently and installed only in the disposable cluster.
No guard/trigger/domain validator/migration is weakened.

| Scenario                                      | Executed assertion                                                                                                            |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Word, existing state, collection lock         | busy1/applied0/rejected0, no terminal receipt or personal change; fresh batch resumes once                                    |
| Content/placement edit in another transaction | Busy before commit, stale-source after commit, edited private data preserved                                                  |
| Content-state insertion/update                | Existing or absent state cannot cross the source fingerprint fence                                                            |
| Apply before private state insertion          | Writer observed blocked by owned apply; losing insert fails after commit, following state/version intact                      |
| Concurrent published head                     | Busy while locked, stale-target after commit                                                                                  |
| Apply holding head/capabilities               | Publication and disable are observed waiting for apply commit; accepted receipt retains original sequence                     |
| Tombstone/hard deletion                       | Busy then terminal hold, no resurrection; original protected plan intact                                                      |
| Actual accepted review event                  | Authenticated/RLS-authorized server calculation wins contention; apply preserves SRS/history; same-event retry adds no effect |
| Multiple bounded workers                      | Disjoint item selection, four unique receipts, one version increment per row and final remaining0                             |
| Same batch concurrent callers                 | Second caller waits for the first and returns one identical committed result                                                  |
| Row receipt lock fault                        | Row subtransaction reverts personal writes, no terminal receipt or false applied count; fresh retry works                     |
| Final batch receipt failure                   | No partial word/row/batch receipt can commit; same batch UUID resumes                                                         |
| Owned backend interrupted mid-batch           | Blocked after first in-transaction receipt/second row write; termination rolls everything back; same UUID resumes all three   |
| Connection lost after commit                  | Durable result and row receipts return unchanged without another transition                                                   |

The returned remaining count is a transaction-time observation. Another worker's
uncommitted receipts can make it nonzero; the suite settles in-flight workers and
proves final remaining0. An exact busy batch returns its saved busy result; use a
fresh batch UUID for progress. Original plan and durable receipt history stay intact.
The accepted learning test uses the real authenticated record_review_assessment
path and canonical review_events, not direct synthetic SRS column assignments.

## Fresh checks

Final actual local PostgreSQL concurrency14/14, zero failures/cancelled/skipped/todo.
Scoped ESLint max-warnings0, scoped Prettier and git diff check pass. Cached pinned
Docker image, local Unix socket, network none/no ports, owned tmpfs and cleanup.
Both owned runners and their temporary containers exited. No pending operation.
Logs/source/artifact hashes are in [JSON evidence](D13A-following-concurrency-20261011.json).

The first run passed13 tests; its final idle-client termination observer timed out
waiting for psql stdin after server termination. The owned helper now ends stdin to
let the client observe the terminated connection. Final14 pass on frozen corrected
source. Initial repeated-literal lint warning was fixed with a constant, no rule
suppression. Original apply/planning/D06 SQL is unchanged. Retain both attempt logs.
Native PG15 initdb was not retried; prior host shared-memory exhaustion remains
recorded. No system settings, other clusters or unrelated processes were changed.

## Preservation and limits

Entry3432 prior SHA references match;3427 stay exact after five task progress note
updates. Prior apply/planning evidence and original operator SQL/tests, D06, protected
private inputs and all app/domain/migration/performance files remain unchanged.
New source4 makes union383; web142/browser449 unchanged. Exact591 dirty paths preserve
all585 entry paths plus four fixture/test/readme files and two evidence files.
Old apply11/plan14/inventory4 and full web119/1253, native196/2670/22 SQLite, Edge108,
PG547/worker35, browser440/recovery10 are carried historical results, not rerun.
The new14 execute current operator behavior; they do not replace historical full
suites or qualify devices, browser performance or deployed environments.

Saved real2914 eligible/approved/applied0. Positive mapping attestations are synthetic,
not evidence of human semantic review. No live delta/device queue reconciliation,
provider/paid/hosted/Git/EAS/device/release/automation or live linking occurred. Flags
OFF outside QA, shared_analysis FALSE, CEFR OFF; AUTH27–29 remain consumed. No
permission broadened. Selective migration rollback and D13A.6 SQLite transition are
not implemented or proven yet; earlier transaction ROLLBACK is not that gate.

## Exact next checkpoint

D13A.6.5 — GPT-6.1 Sol / High recommended; no picker switch claimed. Implement
selective receipt-owned rollback in disposable operator PostgreSQL and file-backed
SQLite fixtures using existing native storage/repository machinery. Restore only
migration-owned mode/reference/content when exact result fingerprints still match.
Later content/reference changes are skipped for reconciliation; later accepted
learning/history/reset/correction/retry/pending values must survive untouched.
Prove committed apply + new accepted review + selective rollback, interrupted/retried
rollback, later edits and deletion races in both storage engines. Protect originals
and immutable receipts; never restore a full snapshot over learning or resurrect a
deleted card. Reuse current fixture helpers/accepted-event/barrier patterns. D13A.6
remains open until this last fixed checkpoint passes. Nine broad milestones remain:
D13.6,D13A.6–9,D14.1–4; fixed checklist unchanged.
