# D13A.6.3 — bounded apply with durable row and exact batch receipts

Date: October11,2026. Fixed progress3/5; checkpoints4–5 remain. D13A.6 in_progress.
Branch feature/shared-dictionary-schema, HEAD f97a733407a4d2b37e8f9ca030ad9574de85a794.
Local-only/uncommitted. No real personal card was linked or approved.

## Implemented local behavior

New `following-apply.sql` is administrator-only disposable operator tooling outside
`supabase/migrations`, installed after unchanged D06/planning helpers. Complete
reviewed plan SHA and per-row decision SHA/schema/owner/source/target/full diff are
checked. Personal rows/content state and owned collection placement are locked.
Published head/entry/revision/approved source are locked together; exact revision,
head delivery sequence and full content/media hash must still match. Recomputed
full diff must equal the approved packet. No spelling-based linking is permitted.

The default50 and hard maximum100 bound new rows per batch. Eligible items are only
exact-link/approved-diff-link; all ambiguous/missing/private-review/stale/excluded
rows remain held. Missing/deleted/changed personal data or changed/withdrawn targets
receive durable terminal reasons. Existing immutable provenance guards are preserved.
Counter exhaustion is a hold; BIGINT versions/head sequences remain exact strings.

The operator writes only personal reference/mode and content state: version +1,
fallback NULL and empty overrides required by following layout. Raw lexical/media
fields, ID, owner, placement and every learning field remain intact. Protected full
originals stay in the immutable plan. It does not publish private data or rewrite
shared revisions/heads, review events or learning queues. Capabilities are required
and locked, never enabled by the function; only synthetic fixtures enable them.

Each per-row receipt retains original source/decision/head binding, outcome and
successful result snapshot/hash/version. Each batch retains immutable request/result.
Exact batch retry returns the same result after flag changes or word deletion;
changed intent with the same UUID fails. A fresh batch UUID processes remaining rows.
Receipt tables have no live word/owner FK; deletion cannot erase receipts or resurrect
cards. Application/service roles cannot read/invoke this schema. Aggregate output
contains counts only. The original preparation report stays an immutable planning
view; `apply_report` provides application outcomes.

Selection uses FOR UPDATE SKIP LOCKED. Personal/state/target NOWAIT contention is
handled in a row subtransaction: no terminal receipt/write survives a busy row, and
applied/rejected counters increment only after receipt insertion. A second receipt
check after item locking protects against a worker committing after selector snapshot.
These contention paths still require checkpoint4's actual concurrent transactions.

## Fresh checks and retained failures

Final actual local PostgreSQL/current migrations/D06/planning/apply SQL:11/11,
zero failures/cancelled/skipped/todo. Existing cached pinned Docker image, local Unix
socket, network none/no ports, owned tmpfs container removed after the runner exited.
Scoped zero-warning lint, Prettier and git diff check pass. Full logs/hashes are in
[JSON evidence](D13A-following-apply-20261011.json).

Tests cover exact and approved media/private diffs; raw personal/learning preservation;
110-row default50/max100 bounds; exact batch retry, changed intent and row receipt
idempotence; disabled flags/wrong plan/unknown run; all five held dispositions;
sequential content/placement/tombstone/deletion and head/entry changes; mandatory
source immutability; later synthetic SRS updates; exact large versions/overflow holds;
receipt immutability/deletion survival/role denial/private aggregate output; transaction
ROLLBACK leaving no word transition or row/batch receipts, then same-intent retry.
The transaction ROLLBACK test proves failure atomicity, not selective reversal after
commit. Later SRS values are direct synthetic SQL fixture updates, not a new review
API/history/queue acceptance proof. Multi-worker races/restart are not qualified here.

Initial6/10 failed on four fixture issues: absent deleted-row JSON; forbidden source
mutation; missing mandatory private fallback; FK truncate guard. Second10/11 failed
because published entries must retain a head. Corrected fixtures preserve every
runtime constraint: provenance mutation must fail; head ABA now uses two valid
publications returning to the prior revision, with a new event sequence. Final11
pass on unchanged apply SQL. No trigger, domain validator or migration was weakened.
Native PG15 initdb was not retried; its prior host shared-memory failure remains
recorded. No kernel settings, other clusters or shared memory were modified.

## Preservation and scope

Entry3414 prior SHA references match;3409 stay exact after five task progress note
updates. Prior mapping evidence, original five operator sources, D06 sources, saved
private inputs and all app/domain/migration/performance bytes remain unchanged.
New source3 makes union379; web142/browser449 unchanged. Exact585 dirty paths contain
all580 entry paths plus three operator files and two evidence files. Protected data
stay in ignored storage. Prior planning14/inventory4 and web119/1253, native196/2670/
22 SQLite, Edge108, PG547/worker35, browser440/recovery10 are carried historical
results, not rerun. Fresh11 does not replace those full suites.

Saved real-card inventory remains2914, eligible0, semantic approvals0/applied0.
Positive decisions are explicitly synthetic attestations; neither a UUID nor hash
proves human semantic review. No owned operation remains pending. No provider/paid/
hosted/Git/EAS/device/release/automation or live linking occurred; flags OFF outside
QA, shared_analysis FALSE, CEFR OFF. AUTH27–29 remain consumed. No permission changed.

## Next fixed checkpoints

D13A.6.4 — GPT-6.1 Sol / High: actual transaction/process interruption and multiple
workers; contention on personal/content state/published head, deletion/tombstone,
later learning and failed receipt insertion. Verify busy paths/retries, no false
counts or partial writes, no skipped work/duplicates or resurrected cards. Preserve
immutable original plan and exact receipt history. Checkpoint5 then implements
selective receipt-owned rollback after new learning/edits in PostgreSQL and file-backed
SQLite. No rollback endpoint or D13A.6 SQLite transition exists yet. Device queue/
live delta reconciliation and live linking remain separate gates. Nine broader
milestones remain: D13.6,D13A.6–9,D14.1–4. The fixed five-checkpoint list is unchanged.
