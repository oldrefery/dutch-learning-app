# D13A.7.3 — client acceptance review, 2026-10-11

D13A.7 remains in progress: fixed **3/6 complete, 3 remain**. This checkpoint
completes the local client review, not model or device qualification. Next is
**D13A.7.4 mapping/apply/compensation review, GPT-6 Astra / High**. Eight broad
milestones remain: D13.6,D13A.7,D13A.8,D13A.9,D14.1,D14.2,D14.3,D14.4.

## Finding and verified correction

Native review persistence and correction transport replaced the displayed Word
with the raw personal SQLite row after reading canonical learning progress. That
row intentionally retains original lexical fields and has no materialized following
revision/CEFR/conflict metadata. Consequently an accepted answer or correction
could revert visible translations and discard dictionary/import annotations until
a later reload. The immutable active questions themselves remained stable.

Both paths now use `mergeReviewLearningProgress`: copy the persisted five SRS
fields and `updated_at` into the current displayed word. Keep current lexical
content, revision, CEFR, private collection and conflict/recovery metadata. Keep
existing owner checks, durable learning queue, canonical progress reads, deletion
handling and idempotent event payloads. Raw repositories retain their existing
semantics; no schema, remote API, flag or dependency changed.

Three new unit regressions fail before the change and pass after it: normal answer,
confirmed correction and keeping server correction. A file-backed native SQLite
regression independently reproduced the lost shared translation/revision after an
answer. Both original failures and final passing logs are retained.

## Scope reviewed

- Native v2 materialization and delivery: owner joins, complete revision/head/card
  dependencies, decimal cursor ordering, atomic persistence, pending refresh debt,
  private command preservation and reviewed mode reconciliation.
- Native and web import/creation/adoption: durable original operation identity,
  metadata-only offline queues, fresh owner checks around remote delivery, actual
  content hydration before completion, explicit provider retry and publication.
- Owner lifetimes and web local journals: A→B→A/sign-out latches, abort boundaries,
  serialized mutation, no automatic provider replay from a restored journal.
- Native and web session preparation/controller: copied lexical snapshots, async
  preparation cancellation, stable history, canonical learning refresh, queued
  writes/corrections, owner checks and explicit session boundaries.
- Web batched dictionary reads validate exact card coverage and consistent heads;
  active/preparing/unsettled sessions do not silently replace their questions.

The JSON manifest records the reviewed source paths and final hashes. This is a
sequential review by the active agent, not an independent reviewer claim.

## A12/A13 local evidence added

`followingSession.sqlite.test.ts` runs real native question preparation, controller,
persistence, event/learning repositories, materialization and following sync against
an actual file-backed SQLite database. Expo's database interface and the remote
Supabase/auth edges are synthetic adapters. Each fixture seeds two same-owner
cards and a separate-owner card; no production data is used.

- A13: shared cache advances from revision1 to2 during an existing session without
  changing personal rows. Existing questions/history retain revision1; saving an
  answer preserves displayed shared metadata. A newly prepared session loaded from
  the current materialized cache sees revision2 without rewriting learning.
- A12: two offline answers have distinct durable event IDs; foreign-owner pending
  reads are empty. Closing/reopening the database retains events, queue and SRS.
  A failed pull retains refresh debt and the old cursor; recovery hydrates revision2
  without changing learning. Synthetic acknowledgements retire only acknowledged
  commands. Repeated acknowledgement preserves event payload/history/SRS; transport
  timestamps may advance. Another file reopen retains content and empty pending set.

These are composed local checks, not an installed Expo app, OS process-kill test,
real remote acknowledgement, full server-to-device scenario or model qualification.
The original 26-case fixture and previous traceability overlay remain unchanged;
this report supplements their A12/A13 local coverage.

## Fresh validation

- Final mobile: **46 suites, 712 tests passed**, including all five new cases.
- Web: **47 distinct suites, 609 tests passed** (34/415 plus disjoint13/194).
- Final mobile test TypeScript project, scoped zero-warning ESLint, Prettier and
  `git diff --check` pass. No web source changed.
- Earlier mobile45/707 and focused runs are retained, not added to the final count.
  Prior server/domain/full app/browser results are historical, not fresh checks.

Initial fixture failures are retained: duplicate private semantic keys, reading a
raw row instead of the production materialization projection, expecting acknowledged
commands to remain queued, and expecting repeated ACK transport timestamps to be
identical. These fixture assumptions were corrected; neither queue semantics nor
ACK timestamp behavior was changed. The separate content-replacement regressions
were confirmed against the old runtime and fixed in the runtime.

## Integrity and remaining gates

Entry verified all **3555 SHA references** and **603 dirty paths**, with no mismatch.
Branch `feature/shared-dictionary-schema`, HEAD
`f97a733407a4d2b37e8f9ca030ad9574de85a794` retained. Six mobile files changed (two new),
five task notes updated, two evidence files added. The manifest preserves historical
hashes except explicitly recorded current changes and records the final dirty set.
No unrelated user changes removed, no Git write, no pending runner or external action.
Reports: `reports/shared-dictionary-cefr/d13a7-client-review-20261011/`.

Remaining fixed steps:4 operator/mapping/compensation review;5 exact semantic model,
prompt and policy measurement;6 actual two-owner/device/old-client/offline/performance
qualification. Synthetic tests do not close steps5/6. No picker switch claimed.
Real2914 cards eligible/approved/applied0. Flags remain OFF outside QA,
shared_analysis FALSE and CEFR OFF. AUTH27–29 remain consumed. No paid/provider,
hosted mutation, migration, EAS, device, release or real-card linking authority added.
