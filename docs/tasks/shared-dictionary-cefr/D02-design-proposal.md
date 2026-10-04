# D02 foundation proposal — shared content with private learning state

Status: foundation policy accepted in part on 2026-09-21; technical details remain
proposed. Accepted: shared content/private learning, private personal edits and
explicit revision adoption. No implementation authority is implied.
This is design-only preparation while D01 device gaps remain
open. Source audit: `e962870`; [cohort evidence](evidence/D01-cohort-census.md),
[iOS evidence](evidence/D01-ios-owner-evidence.md),
[learning protocol](../../learning-sync-protocol.md).

## 1. Recommended approach and alternatives

Recommend incremental references to a durable shared dictionary. Keep the current
personal card as the owner of learning state and retain compatibility data until
both clients and rollback have been validated. iOS is the primary mobile acceptance
platform; Android remains a required supported platform, not disposable data.

A CEFR-only side table would be smaller but would not solve duplicated linguistic
content. Immediate replacement of personal rows would couple identity, offline
queues and releases unnecessarily. Neither alternative is selected by default.

Production continues to use the existing read/write path throughout preparation.
Creating draft schemas or flags does not authorize enabling them. Final cutover
remains DEC-09's separately approved operation after all functional work passes.

## 2. Proposed storage responsibilities (D02.1 draft)

| Proposed entity                 | Responsibility                                                                             | Ordinary client writes            |
| ------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------- |
| `dictionary_entries`            | Stable meaning ID, language, lemma, part of speech, sense discriminator, publication state | None                              |
| `dictionary_revisions`          | Immutable content, entry ID, content hash, source provenance                               | None                              |
| `dictionary_cefr_assessments`   | Meaning/input hash, A1–C2 or unknown, source/method, confidence, review lock               | None                              |
| Existing `words`                | Existing personal ID, owner, collection, SRS, tombstone; nullable entry/revision reference | Owner-scoped validated operations |
| Owner-only personal content     | Private fallback and field-level overrides; personal media/examples                        | Owning user only                  |
| Existing learning tables/queues | Review/reset/correction IDs, acceptance order, history and receipts                        | Existing protocol-2 commands      |

These names are proposed, not migrations. D02 must still settle the exact private
content layout, constraints, capability envelope and compatibility write rules.
An entry/revision pair must belong together; shared deletion must never cascade
into personal cards or history. Publication authority is separate from ownership
of a personal card. The replaceable analysis cache is not dictionary authority.

## 3. Content and privacy policy for approval

Two users may reference the same approved linguistic content, but never share SRS,
review history, deletion state or private changes. Effective card fields resolve
as explicit private override, otherwise pinned revision, otherwise private legacy
fallback. Missing override means inherit; explicit removal means hide that field.
Do not silently replace a missing pinned revision with the newest revision.

Linking a legacy card must preserve its current effective content. A link proposal
with differing content needs a private override or explicit user adoption, not an
unannounced change. Reanalysis and personal image changes stay private by default.

Initially admit only material with verified reuse rights and recorded provenance.
Neither personal rows, the 2,870 cache rows, nor collection-sharing consent is
automatic permission to publish globally. Preserve unresolved content privately;
do not treat the 231 cards without cache matches as disposable or failed records.

## 4. Revision and CEFR policy for approval

Pin a card to a reviewed content revision. Adoption of a newer revision is explicit
and preserves private overrides. A running review session keeps its chosen content
until completion. Meaning-changing relinks invalidate inherited assessments and
require an explicit choice about retaining existing learning history; never reset
progress automatically or silently reinterpret historical events.

CEFR may refresh without replacing displayed content only when its meaning and
assessed-input hash match the pinned revision's relevant input. Otherwise show
unknown/pending, not a guessed B1. Pack-level labels are not individual assessments.
Reviewed/locked assessments cannot be overwritten by an automatic worker.

Design the bounded enrichment worker disabled by default. Scheduling, provider,
batch size and spending caps remain separate decisions; no paid calls are approved.

## 5. Identity cases to carry into D02.2

Synthetic examples, not exported user vocabulary:

| Case                                              | Required result                                               |
| ------------------------------------------------- | ------------------------------------------------------------- |
| `bank`, noun, `de`: financial institution vs seat | Separate meaning IDs despite equal legacy key                 |
| Same approved meaning imported by two owners      | Shared revision, distinct unchanged personal IDs and progress |
| Personal example containing a person's name       | Private field; never bulk-publish it                          |
| Changed translation on an existing personal card  | Preserve private intent; do not edit shared revision          |
| Missing/ambiguous dictionary match                | Usable private fallback, unknown inherited CEFR               |
| New revision arrives during offline review        | Finish with cached content; no network per card               |

Current server/SQLite duplicate rules are not meaning-aware. Supporting two entries
in the dictionary is not evidence that old clients can safely store two personal
cards with the same legacy key. D02.2/D02.4 must resolve this before relaxing
uniqueness; do not allow a legacy duplicate repair to replace a personal ID.

## 6. Remaining architecture gates

- Choose legacy content-write conflict handling. Old full-row payloads lack a
  reliable base revision; silently interpreting all differences as intended edits
  can restore stale text. Never mutate shared content, silently discard intent or
  claim all old clients are compatible. Specify fixtures and explicit conflicts.
- Define minimal meaning/relink UI on iOS, Android and web; no general dictionary
  editor/export product is added by this proposal.
- Generate types from a reproducible local/staging schema, label provenance and
  avoid claiming undeployed migrations exist on production. Exact commands follow
  in D02.5 after the contract is selected.
- Define retirement policy and returning-device recovery; retain queues and their
  original command IDs. Missing Android evidence is not approval to block it.
- Rehearse rollback using current personal projections while retaining every
  post-cutover learning write. Restoring an old backup alone is not safe rollback.

The user accepted private-by-default content, unchanged personal learning/IDs and
explicit adoption of pinned revisions. Do not re-request those policy decisions.
Detailed identity/compatibility rules, rollback and acceptance fixtures are now
in the [technical contract](D02-compatibility-contract.md), still proposed.
D03 remains blocked until D02 is accepted and outstanding dependency gates are
closed or explicitly scoped; release gates cannot be waived by a resume command.
