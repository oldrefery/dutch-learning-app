# Following migration inventory and reviewed plan (D13A.6)

This is local operator preparation outside `supabase/migrations`. It adds no deployed
RPC, credential reader, network client, provider call, flags or personal-card write.
D06's pinned/media-override rehearsal stays historical and immutable. Its `safe-match`
classification does not qualify a following link: meaning and every content field,
including media, need explicit review under DEC-10.

## Saved inventory

Run with the repository's Node24 runtime and explicit local files:

```sh
node scripts/shared-dictionary/following-inventory.mjs config.json ignored-output-directory
node --test scripts/shared-dictionary/following-inventory.test.mjs
```

The config has `cohorts: [{label, expectedCount, path, sha256}]`. Each file is a saved
D06 item array. Exact input hashes, complete counts, unique personal IDs and known
dispositions are required. Outputs are written with mode0600 and exclusive creation;
an identical retry reuses the exact bytes, while changed intent cannot overwrite them.
`private-inventory-v2.json` retains protected identifiers/hash receipts; the summary
contains counts and hashes only. Keep both in ignored/private storage. A source file
is retained, not converted into shared public source material.

| Historical D06 result       | Following hold | Why                                                            |
| --------------------------- | -------------- | -------------------------------------------------------------- |
| safe-match / possible-match | ambiguous      | Requires reviewed same meaning and complete content/media diff |
| private-only                | private-review | Preserve private originals pending an explicit disposition     |
| missing-source              | missing        | No reviewed target                                             |
| stale-source                | stale          | Refresh source evidence                                        |
| excluded                    | excluded       | Preserve the excluded/tombstoned item                          |

Historical classification is snapshot-bound; it cannot prove current live inventory,
reconcile device queues, or approve a link. The October4 cohorts cover2914 cards and
still permit zero links. Zero is valid and unresolved cards remain usable as legacy.

## Isolated PostgreSQL planning

The actual test harness installs all current migrations, D06 `rehearsal.sql` helpers,
then `following-plan.sql` on a new disposable database. Only its administrator can
read the new schema or invoke planning; anon/authenticated/service_role are denied.
Run the focused test with Node24 and the repository's PostgreSQL fixture:

```sh
node --test --test-concurrency=1 scripts/postgres-tests/dictionary-following-plan.test.mjs
WOORDENAAR_PG_DOCKER=1 node --test --test-concurrency=1 scripts/postgres-tests/dictionary-following-plan.test.mjs
```

The optional existing Docker fallback requires a local Unix socket and the already
cached pinned image. It never pulls, exposes ports or joins a network; only its own
random tmpfs container is removed. Native initdb can fail on macOS if system shared
memory is exhausted. That failure is not a SQL result and does not permit changing
other clusters or system settings.

```sql
SELECT dictionary_following_rehearsal.plan(
  :run_id, :owner_ids, :verified_count, :inventory_sha256, :reviewed_decisions
);
SELECT dictionary_following_rehearsal.report(:run_id);
```

The inventory query captures every scoped row and its protected original in one
statement snapshot. Source fingerprints include mode/reference/content version,
full legacy row and private content state, owner, collection and deletion state;
learning/delivery timestamps are excluded by the existing D06 helper. Planning
never supplies learning fields as migration write data and never changes cards,
common revisions, head, events, collection or progress. There is no apply endpoint.

Without a reviewed decision, even one exact content/spelling candidate is held.
Malformed/private content is retained, missing targets are explicit, and tombstones
or existing following references are excluded. All rows appear in the immutable
plan, with seven dispositions: exact-link, approved-diff-link, ambiguous, missing,
private-review, stale and excluded. Originals are kept even after a word is deleted;
no word/owner foreign key can erase this evidence or prevent personal deletion.

## Exact review packet

The decisions object is keyed by personal word UUID. A link decision must contain:

- `owner_id`, `source_sha256`, `source_content_sha256`;
- `target_entry_id`, `target_revision_id`, `target_head_sequence`, `target_content_sha256`;
- `disposition`: exact-link or approved-diff-link;
- `meaning_review`: review_id, reviewer_id, reviewed_at and evidence_sha256;
- `approved_diff`: every changed content field, each with exact before/after values.

Full content hashes include media. Target head sequence is an exact decimal string,
not a revision number or JavaScript floating-point counter. The published target
head/revision/source is locked and checked together. Stale original/hash/head/source
becomes a hold; omitted, extra or changed approved fields fail atomically. exact-link
requires an empty diff; approved-diff-link requires a nonempty exact diff. The
operator-attested review record is mechanically bound and hashed; a UUID/hash alone
is not proof of human semantic review, licensing or owner approval. Positive tests
use explicitly synthetic attestations, not approvals of real personal content.

The run request and per-row decisions/originals form a deterministic plan hash.
They are immutable and append-only. Exact retries return the same hash; changed
intent requires a new run. Count mismatch or an interrupted transaction leaves no
partial run/items. Protected originals are not exposed through the aggregate report.

## Remaining D13A.6 gates

Checkpoints1–2 prepare inventory and the reviewed plan only. Checkpoints3–5 still
require bounded idempotent apply (default50/max100), per-row durable receipts,
head/personal-state locking, interruption/concurrent delta checks and selective
rollback. Revalidate the same reviewed fingerprints and full diff in the apply
transaction. Preserve later learning and skip later reference/content changes.
Prove apply + new review + rollback in real PostgreSQL and file-backed SQLite using
existing native repository/storage machinery; a read-disable switch is insufficient.
No hosted schema installation, live linking, provider call or release is authorized.
