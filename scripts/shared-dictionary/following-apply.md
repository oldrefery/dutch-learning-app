# Following apply rehearsal (D13A.6.3)

Install `rehearsal.sql`, `following-plan.sql`, then `following-apply.sql` only on
an administrator-owned disposable local PostgreSQL fixture. These files are outside
`supabase/migrations`; installation, live linking, shared publication, provider calls
and device queue reconciliation are not performed by this checkpoint. Historical
October4 inventory still has2914 cards and0 approved real links. Positive tests are
synthetic attestations, not proof of human semantic approval.

```sql
SELECT dictionary_following_rehearsal.apply(:run_id, :reviewed_plan_sha256, :batch_id);
SELECT dictionary_following_rehearsal.apply(:run_id, :reviewed_plan_sha256, :batch_id, 100);
SELECT dictionary_following_rehearsal.apply_report(:run_id);
```

The default batch processes at most50 eligible rows; the hard maximum is100. Held
ambiguous/missing/private/stale/excluded plan items are never eligible. Each batch
has a fresh UUID and immutable request/result. Repeating the identical batch returns
that exact saved result even after flag changes or word deletion. Changed run/hash/
limit with the same batch UUID fails. A new UUID processes remaining unreceipted rows;
changing its limit does not reinterpret an earlier batch. A busy row has no terminal
receipt and remains retryable in a new batch. The aggregate result contains counts
only. The original preparation report retains its plan-time applied0; use
`apply_report` for durable application outcomes. Protected receipts and result snapshots remain administrator-only.

The complete plan SHA binds the immutable inventory and every reviewed decision.
Per-row schema/hash/owner/source/target/disposition/diff is revalidated. Personal rows
and content state are locked; the word lock fences absent-state insertion through
the owner foreign key. Owned placement is checked and locked. Published head, entry,
revision and approved source are locked together; exact head delivery sequence and
full content/media hash must still agree. Recomputed full diff must match the
reviewed packet. Missing/deleted/changed personal rows or withdrawn/changed shared
targets receive explicit terminal holds. Counter exhaustion also produces a hold.

Capabilities are required and locked, never enabled by the function. Only isolated
fixtures enable operations/reads/legacy_guard/following_reads. The operator changes
personal mode/reference and content-state version/fallback/overrides. Raw lexical
and media fields, ID, owner, collection, learning values, events and pending learning
are not migration write data. A successful transition increments content version
once and removes fallback/overrides as required for following layout. Protected
originals stay in the immutable plan. Result fingerprint/snapshot/version and target
sequence are retained per row; exact decimal strings avoid JavaScript rounding.

Batch and row receipts are in the same transaction as the writes. A failure cannot
commit a partial batch without its receipts. Selection uses FOR UPDATE SKIP LOCKED;
personal/target NOWAIT contention rolls back only that row subtransaction and
reports busy without a false applied count. An additional receipt check after
locking handles a previous worker committing after the selector snapshot. Neither
receipt table references a live personal word or owner, so deletion does not erase
receipts or cause resurrection. No application/service role can read or invoke it.

```sh
WOORDENAAR_PG_DOCKER=1 node --test --test-concurrency=1 --test-timeout=120000 scripts/postgres-tests/dictionary-following-apply.test.mjs
```

Use Node24 and the repository's existing local cached-image Docker fixture: local
Unix socket, no network/ports/image pull, random owned tmpfs container, owned cleanup.
Native PG15 previously failed before SQL due to host shared-memory exhaustion; do
not change system settings or other clusters to work around it.

Checkpoint3 covers bounded apply/idempotence/receipts and sequential stale checks.
Checkpoint4 still must prove interruption, multiple workers and concurrent content/
state/head/deletion/learning changes with actual transactions. Checkpoint5 still must
implement selective receipt-owned rollback after later learning/edits in PostgreSQL
and file-backed SQLite. No rollback endpoint exists yet. Runtime/linking permission
and current device queue/live delta reconciliation remain separate gates.
