# Shared dictionary backfill rehearsal

D06 administrator tooling for a **disposable local database** with the D03/D05
schema. `rehearsal.sql` is intentionally outside `supabase/migrations`; deploys
do not install it. The script has no connection string, credential reader,
network client, production CLI or automatic runtime-flag changes.

Run the synthetic rehearsal with the repository's Node 24 and PostgreSQL 15:

```bash
node --test --test-concurrency=1 scripts/postgres-tests/dictionary-backfill.test.mjs
```

The existing test harness creates a new Unix-socket-only cluster, installs the
normal migrations and this script, inserts synthetic accounts, exercises the
protocol, stops that cluster and removes only its own temporary directory.
No installed mobile app, existing local database, hosted project or account is used.

## Reviewed source preparation

`dictionary_rehearsal.seed_official` takes an explicit stable resolution UUID,
reviewed manifest SHA-256, sense identity, complete D04 content, content/input
hashes, approved source UUID and an optional per-meaning assessment. It reuses
the D05 trusted persistence path. The source must be approved `first_party` or
`licensed` material with its content hash bound to the actual payload. It never
copies a personal card or approves provenance automatically.

The content hash is SHA-256 of recursively sorted, compact JSON; CEFR input uses
the D04 `canonicalizeCefrInput` format (schema version 1, without media). SQL byte
compatibility with the shared domain implementation is tested. These hashes are
distinct from the legacy vocabulary analyzer's snapshot hashes and the backfill
source fingerprint. Never substitute one for another.

Each seed records the reviewed manifest hash and resolution receipt. An identical
retry returns the same reference; changed intent fails. Separate resolution IDs
remain separate meanings even for identical spellings. A manifest hash records
the administrator's reviewed input binding; it does not itself prove a license or
authorize publication. Production source approval must still inspect that exact
manifest and the original source.

The optional assessment requires `scope: meaning`, exact sense/input hash, level,
status, confidence, method/version, approved source and original assessment time.
Pack-level CEFR, stale hashes and another meaning are rejected atomically. An
editorial estimate retains `estimated` status. Without acceptable evidence no
assessment is inserted. Historical private reports must first be reviewed and
translated into this explicit source-bound shape; they are never ingested or
promoted automatically. No historical private artifacts were read for D06.

## Dry run

Install `rehearsal.sql` once on the disposable database as its administrator.
Normal application roles, including `service_role`, have no access to this schema.
Prepare official seeds first, then call:

```sql
SELECT dictionary_rehearsal.plan(
  :run_id, :owner_ids, :independently_verified_total,
  :excluded_word_ids, :private_only_word_ids, :expected_source_hashes
);
SELECT dictionary_rehearsal.report(:run_id);
SELECT * FROM dictionary_rehearsal.items
WHERE run_id = :run_id ORDER BY word_id;
```

The plan covers every scoped row, including tombstones, in one statement snapshot.
It validates the exact total and rejects supplied exclusions/evidence outside the
scope. Private reports contain word/owner identifiers and must stay in ignored
storage; the aggregate report contains no content or personal identifiers.
The plan and ledger are audit records, **not a recovery backup**.

| Disposition      | Meaning and action                                                                                  |
| ---------------- | --------------------------------------------------------------------------------------------------- |
| `safe-match`     | Exactly one reviewed official revision matches all linguistic content; link candidate.              |
| `possible-match` | Same spelling/POS/article, changed content or ambiguous exact matches; human meaning review.        |
| `private-only`   | Explicit private designation, existing private state or malformed legacy content; retain unchanged. |
| `excluded`       | Explicit exclusion, tombstone or existing reference; retain unchanged.                              |
| `stale-source`   | Supplied current-format source fingerprint disagrees; refresh evidence and create a new plan.       |
| `missing-source` | No approved official candidate; retain unchanged pending source review.                             |

No case merges personal cards. Only media differences can become automatic private
overrides. Text/example differences require review. Existing private state is
preserved without attempting to reinterpret it. Legacy nulls/empty arrays remain
stored exactly as before.

## Batches, retries and concurrent writes

Review the per-card mapping and retain the returned plan SHA-256. Application
requires that exact digest and all three D05 capabilities, including the legacy
guard. A default-off database rejects apply. This makes early/dormant preparation
ineligible for reference changes; the tests enable capabilities only in their
disposable cluster.

```sql
SELECT dictionary_rehearsal.apply_batch(:run_id, :reviewed_plan_sha256, 50);
SELECT dictionary_rehearsal.report(:run_id);
```

Use **one committed transaction per batch**, at most 100 items. Do not wrap the
entire run in a long transaction. Each item uses a row lock, a compare-and-set
source fingerprint and an atomic append-only receipt. The fingerprint includes
personal content, ownership, collection, deletion and content state; excludes
SRS and delivery timestamps. Learning writes therefore survive without making
unchanged content stale. Only the two dictionary references and the new private
content-state row are written. Legacy projection columns are not rewritten.

Concurrent workers skip items already locked by another worker. Busy personal
cards use `NOWAIT`, return `busy`, retain no terminal receipt and can be retried.
Other lock waits are limited to one second. An unexpected error aborts the batch,
leaving no partial receipts; a lost connection rolls back its open transaction.
Always inspect the ledger after uncertain completion. Reusing the run resumes
from committed receipts, without depending on an in-memory offset or cursor.

Changed/deleted/moved cards and retired sources get terminal rejection receipts;
they are never overwritten. Reconcile them using a **new** reviewed plan with
fresh source evidence. Do not edit the old run or turn its rejection into success.
The report flags new/unplanned and changed/missing cards even after the old run's
`remaining` reaches zero. New cards are not silently added to a reviewed plan.

## Verification and rollback

Tests independently compare exact personal rows (except new references and
`updated_at`) plus collections, SRS, immutable events, resets, corrections,
learning checkpoints/heads/cutovers and auxiliary progress. They also check
effective-content equality, inherited CEFR for media-only overrides, separate
owner IDs, retry/concurrency behavior and role denial.

Read-path rollback disables D05 reads and returns to snapshot v1. Keep references,
receipts, the legacy guard and learning authority intact. No old snapshot is
restored over reviews or personal edits that arrived after apply. The rehearsal
verifies a new post-link review still exists after this rollback.

For a real release, D13 still needs reviewed production inputs, full recovery
backups, current source/delta reconciliation, D01 device/queue evidence and D07–D12
client verification. Promotion of this local administrator tooling into a hosted
operation needs its own review and explicit release authority. It is not exposed
as a public RPC and has not been executed against real accounts.
