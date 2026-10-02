# D05 server paths and compatibility evidence

Date: 2026-09-21. Model: GPT-5.6 Sol / High. Branch:
`feature/shared-dictionary-schema`; base/current HEAD: `c5dfb14d49b9`.

## Scope and authority

The user explicitly authorized local D05. AUTH-11 was exercised only for local
server migrations, cache metadata, generated target contracts, synthetic tests
and documentation. No hosted migration or data mutation, deployment, source
publication, paid provider call, schedule, runtime activation, cutover, commit,
push or pull request occurred.

The implementation is additive and dormant. `operations_enabled`, `reads_enabled`
and `legacy_guard_enabled` all default to `false`. Existing `words` reads/writes
and `get_web_review_snapshot_v1()` remain authoritative. The production generated
contract is unchanged; only the local pre-deployment target contract was regenerated.

## Implemented checkpoints

- D05.1: `persist_canonical_dictionary_analysis_v1` serializes a trusted
  `resolution_id`, requires approved provenance, and is executable only by the
  service role. Identical concurrent intent applies once. Distinct resolution IDs
  with the same lemma/POS/article create distinct meaning entries. Personal link
  commands derive the owner from `auth.uid()` and lock the owned live word.
- D05.2: eligible reviewed analysis is stored once as an immutable revision. The
  cache has an explicit entry/revision mapping, exposes it as response metadata,
  retains it for media-only refreshes, and clears it for linguistic refreshes.
  Cached ordinary Gemini output is not automatically published.
- D05.3: strict version-1 content commands reject unknown fields and SRS payloads,
  use expected content versions and immutable operation receipts, and atomically
  update reference/private state plus projection. Old unlinked cards remain on
  the legacy path. The release-controlled guard rejects linked-card content writes
  while metadata updates continue; the existing learning trigger preserves SRS.
- D05.4: owner-only bulk effective-content hydration is bounded to 1,000 IDs.
  Media-only overrides keep matching inherited CEFR; linguistic overrides return
  unknown. Review snapshot v2 adds bulk effective content while v1 is unchanged.
- D05.5: the command is the sole linked-card projection writer. `edit`, explicit
  `adopt-revision`, `detach`, and `resolve-conflict` preserve personal word IDs and
  learning state. A private change log uses a transactional singleton cursor row,
  preventing an earlier allocated/later committed change from being skipped.

The compatibility and rollback behavior is documented in
`docs/dictionary-content-protocol.md`.

## Verification

All checks ran locally on the final uncommitted worktree with Node 24.9.0.

- Focused D05 PostgreSQL suite: **12/12 passed**. It covers default-off flags,
  canonical idempotency/distinct meanings, cache mapping invalidation, strict
  envelopes, retry after tombstone, stale/cross-owner denial, concurrent duplicate
  commands, commit-order cursor serialization, all command transitions, inherited
  CEFR, legacy guard/SRS behavior, v1/v2 compatibility, and lossless read rollback.
- Full PostgreSQL suite: **157/157 passed** on PostgreSQL 15, including existing
  review/reset/correction, RLS, account deletion, catalog/import and SRS regressions.
- Full Edge/Deno suite: **74/74 passed**.
- Mobile shared contract: **4/4 passed**. Web analysis/shared contracts: **7/7 passed**.
- Web, mobile build, mobile test, domain and Supabase-contract typechecks passed.
- `npm run lint:ci`, full `format:check`, and `git diff --check` passed.
- Local target type generation passed; deterministic target check replayed every
  migration on isolated Docker PostgreSQL/Postgres Meta and passed. Exact-name
  disposable container/network inventory was empty afterward.

One invalid full-suite attempt used ambient Node 20 and produced two TypeScript
extension-loader failures after 143 database tests passed. It was not a product or
SQL failure. Re-running with the repository-required Node 24 produced 157/157.
One target-check attempt used a PATH without Docker and failed before generation;
the corrected PATH passed. Do not treat either preflight failure as test evidence.

## Artifact fingerprints (SHA-256)

- D05 migration: `95d66774bf4596f872dc669e8763b54176c3082dc1df3edbf161d66bb1d84bf9`
- D05 PostgreSQL tests: `458a2fd9e22160db3afe10dbc59a986b651e8f95b43e6bd3c61e3ef6132dd3c9`
- Generated target contract: `6e7dbe743c676f6f432cbbec2f7c5c9a3c5155b9f9da0a61140b110bd6878fd7`
- Cache mapping adapter: `d4078531108e349dfd49689fa137b764799394405104878a1340903710fd4420`
- Gemini cache response adapter: `db0e1092932f1e4140408ab01191e202af318e5b337a2150d457b8ddf8f7a07b`
- Protocol document: `3531636e84e747cec0d7bf7efa7312f0349d469650a053405ee28773f35db64b`

## Remaining gates

D05 is code-complete locally, not released. D01 Android/full learning-queue
evidence remains mandatory before release. D06 must produce only a disposable
dry-run/backfill rehearsal under separate local authorization; actual production
mapping remains a D13 operation with explicit approval. No operation is running
or uncertain. All D03-D05/task changes remain local and uncommitted.
