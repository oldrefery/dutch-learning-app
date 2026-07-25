---
date: 2026-07-25
topic: user-progress-remote-contract
---

# User Progress Remote Contract

## What We're Building

Add the missing Supabase `user_progress` table and make progress a complete
offline-first sync stream. The app will pull active rows and tombstones through
a per-user `(updated_at, progress_id)` cursor before pushing local progress.

## Why This Approach

The design follows the existing word delta-sync contract. Deterministic cursor
pagination avoids full snapshots and response-limit truncation, while durable
tombstones prevent a stale client from reviving deleted progress. Remote active
rows must not overwrite local unsynced changes.

A full remote snapshot was rejected because it scales with total history.
Hard deletes were rejected because disconnected clients cannot observe them.
A separate revision service was deferred because server-managed
`updated_at` plus a stable id tiebreaker is sufficient for the current scope.

## Key Decisions

- Create a user-owned table with foreign keys, RLS, cursor/delete indexes, and
  server-managed `updated_at`.
- Preserve remote tombstones with a `BEFORE UPDATE` anti-resurrection trigger.
- Pull progress after words so local foreign keys can resolve.
- Apply remote tombstones before active rows and advance the cursor only after
  both SQLite operations succeed.
- Preserve local `pending`, `error`, `conflict`, and `deleted` rows when an
  active remote row is applied.
- Keep sync-specific timestamp cleanup in P1.4.

## Open Questions

- None for this work package.

## Next Steps

- Add the migration and schema contract tests.
- Add repository remote-apply behavior.
- Add Stage 3 progress pull and deterministic pagination tests.
- Validate the complete migration chain with a local Supabase reset when the
  Docker runtime is available.
