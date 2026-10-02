# D10.3 — accepted unavailable-target recovery design

Status: **architecture review complete; implementation and integrated acceptance
pending**. Reviewed on 2026-10-02 after `795334c` / source `42c9bfd`, following the
user's model-switch confirmation for GPT-6 Astra / High. AUTH-17/AUTH-18 cover this
local technical checkpoint. This is not production, cutover or deployment approval.
It supersedes the candidate in [review input](D10-target-recovery-review-input.md).

## Decision and scope

Keep the original personal UUID, exact original intent and all learning/content
queues. Add an atomic recovery RPC with an immutable request, durable personal-ID
origin, monotonically increasing recovery version and expected current placement.
Add a terminal cancellation barrier for explicit deletion of an unsettled import.
Separate collection-delivery debt from learning/content debt on the client.

Do not rotate the original nonce to retarget. Do not adopt a semantic duplicate,
recreate an acknowledged missing card, infer provenance from spelling, or treat a
server absence read as proof that an old request can no longer arrive. Recovery
copies no SRS snapshot and changes no private/shared content on an existing card.

The first implementation covers retained v14 original intents and new imports.
Pre-upgrade rows without an exact intent/receipt remain an explicit recovery gate;
do not fabricate that evidence from SQLite v15's acknowledgement bit. A fresh-ID
content copy is a separate user action, never automatic same-ID recovery.

## Source findings and reproduced counterexamples

Historical SQL tests are pinned through
`20261002110000_add_dictionary_import_intents.sql`, intentionally before the future
recovery migration. They characterize gaps, not desired new behavior:

1. Original success plus a lost reply: a new nonce targeting another collection
   fails while the personal row exists. After hard deletion, that new nonce
   **recreates the same ID with reset SRS**. Exact original receipt replay remains
   a safe no-op. An operation-only receipt ledger is insufficient for recovery.
2. Deletion before an original import arrives affects zero rows. The delayed
   import then creates the personal card. A durable cancellation barrier must
   precede acknowledgement of explicit local deletion.
3. Collection deletion uses `ON DELETE SET NULL`, not a personal-card cascade.
   The original receipt replays without fixing placement. The read-only owner
   may update their existing word's collection while collection INSERT is denied;
   an authorized metadata-only move preserves all other card values except the
   normal update timestamp. Expected placement must therefore support NULL.

Source review additionally found that `acceptReceipt` currently keeps generic
word metadata pending. `executeDictionaryWordMetadataUpsert` then unconditionally
updates `collection_id` for those words. Merely making recovery receipt replay a
server no-op would still allow a stale client to undo a newer server move through
this follow-up UPDATE. Recovery acceptance must remove only its delivered
placement debt without discarding content or learning debt.

## Server persistence and transaction boundary

Add a private origin registry keyed by global personal `word_id`, with owner FK
to `auth.users` (account cascade), immutable original operation/hash, sticky
`inserted_once`, monotonic `recovery_version` and sticky `cancelled`. There is **no
FK to `public.words`**: hard deletion must retain the fence. Version zero is the
original-delivery generation. Use bounded nonnegative integers with explicit
overflow rejection. The registry retains hashes/IDs, not private card text.

Backfill from unambiguous successful original receipts. If multiple successful
roots/owners claim one personal ID, fail the migration preflight with aggregate
diagnostics; do not select an arbitrary winner. Test receipt-only deleted rows,
live rows, conflicts, ambiguity and account cascade. An original semantic-conflict
receipt alone does not claim the ID: its existing explicit vacant-key retry can
still rotate the original nonce until recovery or cancellation claims the root.

Add immutable recovery/cancellation receipts keyed by owner and operation ID,
binding the canonical hash of the entire request. Reusing a committed nonce with
different input fails. Preserve existing original receipts. Registry identity
fields cannot change; `inserted_once`/`cancelled` cannot revert. Revoke direct access
and expose only guarded authenticated RPCs with an empty search path. No source
payload is added to server receipts; account deletion removes the private records.

All original, recovery and cancellation RPCs acquire the same **personal UUID
advisory lock first**, then the existing owner/original-operation lock. Recovery
and cancellation also serialize their owner/operation receipt key consistently.
The personal lock prevents cross-nonce races; the original-operation lock prevents
one root nonce from binding conflicting IDs/payloads. Check immutable original
receipt hashes even for an original conflict. Implementation must test actual
lock ordering, uniqueness conflicts, rollbacks and concurrent transactions; the
abstract model below does not prove PostgreSQL concurrency behavior.

After locking, exact cached receipts return historical results without moving,
inserting or deleting anything. For an unseen original request, a claimed root
with version above zero or `cancelled` cannot insert. A different root cannot
reuse any claimed personal ID, including after hard deletion. Successful original
insertion and its registry/receipt must commit together.

These guarantees cover the original/recovery RPCs and participating client sync.
The registry alone cannot fence arbitrary legacy direct INSERTs into `words`.
Audit legacy bootstrap/INSERT reachability and prove supported-client compatibility
before D10 closure/release. Do not claim a database-wide no-resurrection guarantee
without a separately reviewed write guard or a satisfied adoption gate. Existing
D01/D13/D14 gates and the v15 client bootstrap protection are not waived.

## Recovery request, read and result

Strict version-one request (reject extra/missing fields):

```text
protocol_version: 1
operation_id: fresh recovery UUID
original_intent: exact persisted DictionaryImportIntent
expected_recovery_version: nonnegative integer
expected_collection_id: UUID | null
target_collection_id: owned UUID
```

An authenticated read RPC takes the exact original intent and returns the owned
root's version, inserted/cancelled state and current active placement (nullable).
Return generic unavailable for foreign or unproven existing IDs. This is a snapshot
for an explicit retry, never a guarantee about future delivery. Do not reveal
another owner's IDs/content. Source syntax/hash validation applies throughout;
current publication/mapping validation is needed only when creating a new card,
not to move/replay a proven existing import after source retirement.

For a new recovery transaction, after root/hash/cancellation checks:

1. Compare expected and current recovery version. A mismatch returns typed
   `state-conflict` with owned current state, without mutation or acceptance.
2. Lock and validate the active owned target; never INSERT/UPSERT the collection.
3. If `inserted_once`, lock the active owned personal row. Missing/tombstoned means
   unavailable; never insert. Compare its current placement with the expected
   placement using NULL-safe equality. A mismatch returns `placement-conflict`.
   On a match, change only collection metadata, preserving SRS/content/history.
4. Otherwise, reject any existing proposed UUID without proven provenance.
   Validate the original source/pin and attempt the same-ID import in the new
   target with server SRS defaults and content version zero. Preserve current
   semantic-key uniqueness. A duplicate yields `identity-conflict`, no adoption.
5. On applied or semantic conflict, claim the exact original root, advance the
   version once and store the immutable recovery receipt in the same transaction.
   A semantic conflict also settles any unseen original at the old target.

An accepted receipt binds protocol, recovery operation, original operation,
personal UUID, target, committed recovery version, outcome `applied` or
`identity-conflict`, optional owned duplicate ID and `idempotent`. The client
validates all binding fields. Never mark a typed nonmutating state/placement
conflict or unavailable response as success. Nonmutating failures need no receipt;
the client still never rewrites an in-flight request under the same nonce.

Two proposals based on version N race: the first commit advances N to N+1; the
other receives state-conflict. **No automatic rebase.** Show the current placement
and require an explicit retry, which reads current state and persists a new request
and nonce. An old cached receipt never moves again; an old uncommitted proposal
cannot move at the new version. Repeated target failure follows the same rule,
without recursive lineage chains or an unbounded list of predecessor operations.
Ordinary moves are guarded by expected placement; the contract compares current
placement, not a total historical ordering of every ordinary move.

## Explicit deletion and cancellation

Use a separate strict cancellation request containing protocol version, operation
UUID and exact original intent. Under the same locks, validate root/receipt binding
and refuse an unrelated existing UUID. Claim an absent root if necessary, set
`cancelled` permanently, advance the version only on first cancellation and save
the cancellation receipt atomically. Cancellation needs no expected version:
explicit deletion terminates that personal import across all older proposals.

Cancellation does not itself delete or modify an existing personal row. Ordinary
authorized word deletion follows its acknowledgement. If insertion won the lock
first, deletion removes that row; if cancellation won first, later fresh original
or recovery requests cannot insert. Historical successful receipts remain no-ops.
Replaying cancellation is safe. There is no existing undo-delete feature to
preserve; any future restore needs a separate explicit contract, not ID reuse.

Persist cancellation and the local tombstone atomically, retaining import data
until cancellation acknowledgement. Enumerate cancellation from deleted rows too.
Bulk explicit collection deletion must queue the same barriers for its unsettled
imports. Remote cleanup keeps pending imports and never fabricates cancellation.
Send barriers **before ordinary collection/word deletion**, including before the
current collection-first sync phase. A stale original/recovery reply cannot erase
the cancellation or tombstone. Do not hard-purge its SQLite FK parent prematurely.

## Mobile durable state and acknowledgements

Use an additive SQLite migration (next version v16), preserving v14 intents, v15
acknowledgements and every existing queue. Add owner/word-bound recovery and
cancellation outboxes. Persist the complete immutable request, ordering/status,
and the local placement revision it delivers. Keep the original intent unchanged.

Preparing/replacing recovery is one exclusive transaction: compare the exact
original payload and previous outbox operation (or absence), assert active owner
and active owned card/target, persist a fresh proposal and move only local placement
to the chosen target. Increment local placement revision. Expected _remote_
placement/version are separate from the local chosen target. Never update an
in-flight request payload in place. A stale acknowledgement/error cannot replace
a newer proposal. Generic movement of a pending import must use this path.

Track local placement revision and its acknowledged revision independently of
generic `sync_status` and content/learning queues. The layout may extend the
existing import-provenance table plus outbox; do not add a second general sync
framework. Every explicit local move increments the placement revision. Recovery
acceptance acknowledges only the exact delivered revision; subsequent explicit
moves remain pending. Generic metadata sync must not echo an already delivered
target merely because content or learning is pending. Read current owned placement
after historical receipt acceptance and hydrate that field only when there is no
newer explicit local placement debt, preserving all learning/content values.
An absent remote row remains unavailable/provenance-protected, never bootstrapped.

Within the acknowledgement transaction recheck active owner, original payload,
exact current outbox request, active/deleted state, chosen target and placement
revision. Applied recovery records provenance and retires only that original and
recovery record. Content/learning/refresh queues remain. Conflict retains both
identities and all debt. Cancelling state supersedes original/recovery acceptance.
An ignored stale response aborts/restarts the sync phase; it must not allow dependent
content/learning delivery under a false success result. Check owner before/after
network operations too, and suppress foreign store publication.

Deliver cancellation first, recovery before original import, then dependent word
metadata/content/learning. Do not send original while recovery is active. Route
semantic-conflict retry through recovery once a root is claimed; never rotate that
root nonce again. Only a pre-recovery original conflict can use the existing retry.
Background delivery uses the same coordinator and transaction checks as foreground.

Upgrade rules must be conservative: retain exact v14 payloads and pending queues;
do not infer prior placement acknowledgement for ambiguous v15 pending metadata.
Backfill only provable provenance/placement, otherwise retain a visible recovery
state requiring a current-state read and explicit decision. Tests must prove this
instead of marking old pending moves delivered from a boolean acknowledgement.

## Implementation sequence and required evidence

Continue on **GPT-6.1 Sol / High** in the existing branch, one checkpoint at a time:

1. Strict domain request/read/result parsers and additive SQL registry/receipts,
   backfill preflight, shared locks and original RPC fence. No UI before server
   contract tests. Preserve flag-off behavior and regenerate target contracts.
2. Recovery/read/cancel RPCs with real concurrent PostgreSQL tests, including
   all three historical counterexamples as new-protocol rejection/safe outcomes.
   Include same/different nonce races, source retirement, read-only, foreign IDs,
   hash mismatch, target SET NULL, deleted rows, rollback and account cascade.
3. SQLite v16 outboxes and placement debt; file-backed tests for restart,
   replacement, owner switch, atomic rollback, upgrade, deletion/bulk deletion,
   stale responses, and learning/private edits during recovery.
4. Sync integration and typed errors. Reproduce lost original/recovery/cancel
   replies; test server move B followed by stale receipt A and generic pending
   learning: **no metadata UPDATE back to A**. Exercise both background and
   foreground, pending counts/status and cancellation before collection deletion.
5. Existing-target recovery UI, explicit retry from current server state, visible
   retained debt and semantic conflicts. Test both themes and account changes.
   Finish safely evidenced pre-upgrade behavior and applicable web integration.
6. Astra / High review of implemented protocol, then assigned-device/both-client
   acceptance. Keep D10.3–D10.5 unchecked until their actual exit coverage passes.

No new production migration is executed by this review. No native/D08 QA resource
was started. D11 remains outside this checkpoint.

## Executable evidence and limits

- `scripts/postgres-tests/dictionary-import-recovery-baseline.test.mjs`: **3/3**
  real migrated PostgreSQL baseline counterexamples passed on 2026-10-02.
  A fresh task-owned Unix-socket cluster was created and cleaned up; no ambient
  credentials, hosted database, Docker or device used.
- `scripts/shared-dictionary/import-recovery-model.test.mjs`: **10/10** passed,
  including all **40,320** permutations of eight abstract events. At most one
  birth, no insertion after cancellation, no repeated move on receipt replay,
  CAS conflicts, NULL placement, conflict retry, unavailable/unproven identity,
  content/SRS preservation and local stale-response selection are exercised.
- Model methods are atomic serial transactions by assumption. The model omits SQL
  authentication/RLS, canonical hashing, schema validation, lock mechanics, source
  publication, SQLite durability, actual network scheduling and placement-debt
  implementation. Cancellation plus subsequent deletion is one event in the
  permutation test; separate implementation tests must interleave that gap.
  These results validate the design's selected state transitions, not a complete
  correctness proof or acceptance of code that has not been written.
- Scoped strict ESLint (zero warnings), Prettier and diff checks pass. The first
  lint attempt found a repeated diagnostic literal and test-runner complexity;
  extracted a constant and transition assertion helper, then reran lint and the
  complete model suite successfully. No rule suppression or gate bypass.

Commands (Node 24.20.0 on PATH):

```sh
WOORDENAAR_PG_BIN=/opt/homebrew/opt/postgresql@15/bin node --test --test-concurrency=1 --test-timeout=120000 scripts/postgres-tests/dictionary-import-recovery-baseline.test.mjs
node --test scripts/shared-dictionary/import-recovery-model.test.mjs
```
