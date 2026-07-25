---
date: 2026-07-25
topic: semantic-uniqueness-reachability
---

# Semantic Uniqueness And Reachability

## What We're Building

Align active-word semantic uniqueness between SQLite and PostgreSQL by making
the remote index case-insensitive for `dutch_lemma`. Make every client-side
remote duplicate lookup use the same case-insensitive lemma semantics. Replace
the synchronization transport-only preflight with the existing
reachability-aware network check.

## Why This Approach

Use a new forward-only Supabase migration rather than editing committed
migrations. The migration replaces the active-word partial unique index,
updates the import RPC conflict target, and fails with an actionable error if
existing active rows would collide after case normalization.

Automatic duplicate deletion or merging was rejected because choosing a winner
could silently change collection membership or orphan user progress. Editing
historical migrations was rejected because it would make migration history
environment-dependent. Adding a generated normalized column or a new lookup
RPC was rejected as unnecessary schema and API surface for this package.

## Key Decisions

- Remote uniqueness uses `LOWER(dutch_lemma)` while preserving the existing
  `deleted_at IS NULL` predicate and the current part-of-speech/article
  semantics.
- Existing mixed-case collisions block the migration instead of being mutated
  automatically.
- The shared import function uses a matching expression and predicate in
  `ON CONFLICT`, as required for PostgreSQL partial-index inference.
- Supabase duplicate lookups use exact `ILIKE` patterns with `\`, `%`, and `_`
  escaped so arbitrary lemma text cannot broaden the query.
- Synchronization calls `isNetworkAvailable()`. A connected transport with a
  confirmed unreachable internet state does not start auth or sync stages;
  unknown reachability remains usable, matching NetInfo's asynchronous state
  model.
- No migration is applied to the linked Supabase project in this package.

## Open Questions

- Before deployment, operators must inspect and manually resolve any active
  mixed-case collisions reported by the migration guard.

## Next Steps

- Add the Supabase migration and schema contract tests.
- Update both remote duplicate lookup paths and their mixed-case/wildcard tests.
- Switch `SyncManager` preflight and add reachability regression coverage.
- Run targeted and full repository quality gates.
