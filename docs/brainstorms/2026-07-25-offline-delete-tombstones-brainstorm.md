# Offline Delete Tombstones

Date: 2026-07-25

## Context

Words and user progress are currently hard-deleted from SQLite. A device that
deletes while offline therefore has no durable change to push, and a stale
active copy can be pulled or upserted later.

## Decision

Use `deleted_at` tombstones on the domain rows:

- Add `deleted_at` to local `words` and `user_progress`.
- Add `deleted_at` to remote `words`.
- Keep the remote `user_progress` table creation, RLS, and pull contract in
  P0.4; P0.3 prepares its local and outgoing-delete shape.
- Exclude tombstones from all active reads.
- Include tombstones in incremental word pulls.
- Apply a remote tombstone by exact `(word_id, user_id)` only. Never use the
  semantic-key fallback for deletion.
- Preserve every local unsynced row during active remote apply.
- Let a remote tombstone override a local active or pending row with the same
  exact ID. Delete wins for the same identity.
- Push local word tombstones before active word upserts.
- Soft-delete remote collection words before hard-deleting a collection so
  other devices can observe those word deletions.
- Reconcile a remotely missing synced collection only when Supabase returns an
  exact count proving the collection snapshot is complete.
- Keep semantic uniqueness for active words only with a partial unique index
  whose predicate is `deleted_at IS NULL`.
- Preserve an existing remote tombstone in a `BEFORE UPDATE` trigger so stale
  upserts cannot clear `deleted_at`.

## Alternatives Considered

### Separate tombstone tables

This keeps active tables smaller, but requires a second cursor and extra
server-side guards to stop a stale domain-row upsert from recreating a deleted
identity. It adds coordination without improving the current sync model.

### Local deleted status with remote hard delete

This can push an offline deletion, but a second device cannot distinguish a
remote deletion from a row it has not fetched. It does not satisfy the
anti-resurrection requirement.

## Compatibility Notes

- Existing active word upsert payloads intentionally omit `deleted_at`; they
  must not clear a server tombstone.
- The current register-column fallback remains intact.
- P1.4 will separately stop sync bookkeeping from mutating domain
  `updated_at`.
- P1.5 will separately align case-normalized semantic uniqueness. P0.3 only
  changes the existing index predicate to exclude tombstones.

## Required Regression Coverage

- Offline word delete creates a durable local tombstone.
- Active local word reads exclude tombstones.
- Word tombstones push as remote `deleted_at` updates before active upserts.
- A remote tombstone removes an active or pending local row from active reads.
- A stale remote active row cannot overwrite a local tombstone.
- Collection deletion soft-deletes its remote words.
- Progress deletion creates a durable local tombstone and outgoing delete
  payload.
- Local and remote semantic unique indexes ignore tombstones.
