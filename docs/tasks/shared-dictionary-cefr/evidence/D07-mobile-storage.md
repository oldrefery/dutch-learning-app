# D07 mobile storage evidence

Date: 2026-09-21\
Stage: D07 complete locally under AUTH-13\
Model / reasoning: GPT-5.6 Sol / High\
Branch / base: `feature/shared-dictionary-schema` / `c5dfb14d49b9a53521b53e13bdd19991999ede5d`

## Outcome

The mobile database now has an additive SQLite v13 read model for shared
dictionary content. The current `words` table and every existing learning table,
queue and trigger remain authoritative and are not rebuilt by v13.

The migration adds:

- immutable revision and CEFR-assessment caches plus a CEFR-head cache;
- owner-scoped personal-card content state with either a pinned reference or a
  complete private fallback;
- a durable ordered dictionary-content command queue;
- a monotonic per-owner change cursor;
- owner validation triggers and lookup indexes.

`DictionaryContentRepository` validates all stored protocol objects through the
shared D04 domain parsers. It caches only dependency bundles supplied by the
caller, accepts card state before a missing revision arrives, materializes
effective content and inherited CEFR in chunked bulk SQL, and reports the missing
dependency explicitly. It also preserves exact command retries after a later
soft tombstone, while rejecting changed intent and new commands for a deleted or
foreign card.

No current screen or sync path uses v13 yet. Runtime flags and the production
read/write path remain off; D08 owns synchronization and UI activation.

## Preservation and failure evidence

Real file-backed SQLite tests start from v8 and run the production initializer
through v13. They verify:

- interrupted v13 transactions roll back and retry cleanly;
- failure after SQL commit but before the AsyncStorage version marker is safe;
- `word_id`, word/SRS fields, sync metadata, soft tombstones, review events,
  reset/correction command IDs, queue sequence and correction recovery rows are
  byte-for-byte unchanged by the v12-to-v13 upgrade;
- foreign-key checks stay clean and a second initialization is idempotent;
- cache/card batches are atomic on identity, owner or storage failure;
- missing revisions remain offline-readable as `missing-revision` and become
  ready after the exact dependency is cached;
- card content versions and change cursors never move backwards;
- command ordering, exact retry, conflict state, acknowledgement and disk-failure
  recovery are durable.

The iOS and Android applications share this single Expo SQLite schema and
repository path; there is no platform-conditional migration branch. Native
online/offline/restart flows and device coverage remain the D08 exit gate.

## Verification

All commands used Node 24 (`PATH=/opt/homebrew/opt/node@24/bin:$PATH`).

- Focused D07 SQLite tests: 3 suites, 27 tests passed while developing; final
  repository suite: 1 suite, 8 tests passed.
- Full mobile Jest: 136 suites, 1,571 tests and 22 snapshots passed in 46.177 s
  on the final D07 code.
- `npm run mobile:typecheck`: passed.
- `npm run mobile:typecheck:test`: passed after the final command-retry change.
- `npm run lint -- --max-warnings=0`: passed.
- `npm run format:check`: passed.
- `git diff --check`: passed.

Expected negative-path console output from injected migration interruptions,
network failures and existing React test warnings did not fail the suite.

The implementation followed the current Expo SQLite transaction contract:
v13 executes in one `withExclusiveTransactionAsync` transaction and repository
queries inside exclusive transactions use the transaction object.

## Artifact fingerprints

```text
f8dfb28c4241493ce05235fe61b9381e5ad8c2ad993ddbd5bb0755b40fdcf9f0  apps/mobile/src/db/dictionaryContentSchema.ts
5dd697fccc660072b41d4f1f3f7c68cb6297b7fd8c1d840ab005e0048d7ae5d4  apps/mobile/src/db/dictionaryContentRepository.ts
3ab2b3725a7c527da221811613f3082e6108dad8184b13991bbe28a2656e8fce  apps/mobile/src/db/initDB.ts
da27a9e4b367712aea0648e5a831986dc6594b41623b03294093676fb82a8434  apps/mobile/src/db/__tests__/dictionaryContentRepository.sqlite.test.ts
b7657ee7ef91e9e394f81f1ae436f11affa3d17de9432ff1c03ba90f2cb59321  apps/mobile/src/db/__tests__/initDB.migration.sqlite.test.ts
```

These hashes describe the local uncommitted checkpoint. No commit, push, PR,
hosted operation, deployment, application replacement or production activation
was performed.

## Next gate

D08 mobile synchronization and integration, implemented with GPT-5.6 Sol / High
and reviewed with GPT-6 Astra / High. It requires a new explicit local-stage
authorization. D01 Android and complete learning-queue evidence remain mandatory
before release.
