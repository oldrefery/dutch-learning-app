---
date: 2026-07-25
topic: sync-metadata-timestamp-integrity
---

# Sync Metadata Timestamp Integrity

## What We're Building

Keep local domain `updated_at` values independent from sync-status bookkeeping.
After a real Supabase write succeeds, use the row returned by Supabase to
reconcile the local domain timestamp with the server-issued `updated_at`.
Record sync attempts and successful acknowledgements in dedicated local
timestamps.

The change covers words, progress, collections, and their tombstone
acknowledgements. It does not add remote columns or apply remote migrations.

## Approaches Considered

### Status-Only Updates Without Sync Timestamps

Stop updating `updated_at` in `mark*Synced` and `markWordsError`, but add no
replacement metadata. This is the smallest patch, but it discards the time of
the last sync attempt and does not satisfy the requirement to store
sync-specific timestamps independently.

### Local Sync Columns And Server Acknowledgements

Add nullable `last_sync_attempt_at` and `synced_at` columns to the three local
entity tables. Status-only transitions update those columns, while successful
remote writes return identifiers and `updated_at` through Supabase
`.select(...)`; repositories then persist the server timestamp together with
the sync acknowledgement.

This is the selected approach. It keeps reads simple, makes timestamp ownership
explicit, and fits the existing repository boundaries.

### Per-Entity Rows In `sync_metadata`

Store every entity acknowledgement in a normalized metadata table keyed by
table and row id. This avoids adding columns to entity tables, but introduces
extra joins, cleanup rules, and referential bookkeeping without a current
consumer that needs a historical sync ledger.

## Key Decisions

- Domain `updated_at` changes only for a domain mutation, delete/tombstone, a
  remote pull, or reconciliation with a server-returned value.
- `last_sync_attempt_at` records the latest completed push attempt that changed
  local sync state.
- `synced_at` records the latest successful local acknowledgement.
- Actual Supabase writes return only the row id plus server-managed timestamp
  fields needed by SQLite.
- Status-only duplicate reconciliation does not invent a domain timestamp.
- Failed pushes keep the row unsynced and must not write a successful
  acknowledgement.
- SQLite migration v6 is idempotent and local-only.
- No live Supabase migration is applied in this package.

## Open Questions

None. The execution tracker defines the required behavior and the existing
repository boundaries provide a direct implementation path.

## Next Steps

Implement SQLite schema v6, typed repository acknowledgements, Supabase
returning writes, and regression tests for success, failure, tombstones, and
status-only transitions.
