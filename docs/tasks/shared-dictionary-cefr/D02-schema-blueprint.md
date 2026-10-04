# D02 schema blueprint and implementation boundary

Design baseline: 2026-09-21. Complements the accepted product policies in
[decisions](decisions.md) and the [compatibility contract](D02-compatibility-contract.md).
This is a specification, not applied SQL or evidence of a deployed schema.
Names/types below are the D03 baseline; change material semantics through the
decision ledger, not an undocumented implementation shortcut.

## 1. Shared dictionary tables

`public.dictionary_entries`:

- `entry_id uuid` primary identity; `language_code text`; `lemma text`;
  nullable `part_of_speech text` and `article text`; `sense_key text`;
  `state text` restricted to draft/published/retired; creation/update timestamps.
- Non-unique language/normalized-lemma/POS/article candidate index. Meaning ID
  is never recomputed from text. Do not introduce global uniqueness on a gloss.
- No user IDs, personal media, source prompts or private text in readable fields.

`public.dictionary_revisions`:

- `revision_id uuid` primary identity; `entry_id uuid` required reference;
  `revision_no integer > 0`; `schema_version integer > 0`;
  `content jsonb` validated linguistic object; `content_sha256 text`;
  `cefr_input_sha256 text`; `source_id uuid`; `created_at timestamptz`.
- Unique `(entry_id, revision_no)` and `(entry_id, revision_id)`; immutable payload
  after insertion. Publication is a trusted operation, not an ordinary user update.
- `private.dictionary_sources`: `source_id uuid`, source kind, provenance locator,
  reuse-review state, reviewer/time and approved-content digest. Ordinary clients
  cannot read source locators or raw material. Only safe attribution is exposed.
- No hard deletion while referenced. Retired means unavailable for new links but
  readable for existing pinned cards; privacy withdrawal is a separately reviewed
  redaction/cache-removal operation, not ordinary retirement.
- `public.dictionary_entry_heads` holds the trusted current published revision
  pointer used for discovery. Moving it never moves an existing personal card pin.

No source is implicitly approved by this blueprint. D03 tests use synthetic
fixtures; D06/publication needs an explicit approved source inventory. Failure to
approve a source leaves its content private without blocking local schema tests.

## 2. Assessment data

`public.dictionary_cefr_assessments`: `assessment_id uuid` identity, `entry_id uuid`,
`input_sha256 text`, nullable `cefr_level text` constrained to A1/A2/B1/B2/C1/C2,
`status text` (unknown/estimated/reviewed), nullable `confidence numeric` in [0,1],
`method text`, `method_version text`, `source_id uuid`, `assessed_at timestamptz`,
`locked boolean`, nullable `supersedes_assessment_id uuid` within the same entry.
Preserve assessment history. `dictionary_cefr_heads` selects one accepted assessment
per `(entry_id, input_sha256)`; advancement is a trusted, serialized operation,
never based only on client timestamps. Locked/reviewed heads require reviewed
replacement, not background overwrite. The head must match its referenced input.

Hash a versioned canonical linguistic-input representation: identity/sense plus
the structured linguistic content used to assess the revision, excluding personal
ownership, learning data and media. Any private linguistic override conservatively
disables inheritance until an applicable assessment exists. Media-only changes
do not change the assessed linguistic input. Unknown has no invented level.
Raw provider requests/responses and private inputs never enter public rows.

Private-only words remain usable with unknown CEFR until a separately owner-scoped
assessment exists. Shared worker eligibility excludes private fallback content;
supporting private assessment later must not publish it or widen provider scope.

## 3. Personal card state

Keep existing `public.words` primary IDs, collection/owner relations, SRS, timestamps
and tombstones. Add nullable `dictionary_entry_id uuid` and
`dictionary_revision_id uuid` together; composite reference requires the revision
to belong to the entry. Shared deletion cannot cascade to `words`.
Keep legacy uniqueness and legacy columns through the compatibility period.

Add `public.word_content_state`, keyed by `word_id uuid`, with required `user_id uuid`
matching the card owner, `content_version bigint >= 0`, nullable
`fallback_content jsonb`, `overrides jsonb` and `updated_at timestamptz`.

- Unlinked migrated card: full validated private fallback; empty overrides.
- Linked card: no authoritative full fallback duplicate in this table; sparse
  overrides plus pinned revision. Existing `words` still holds its effective
  compatibility projection until D14. Devices retain their offline read model.
- Override values use explicit tagged operations: `set(value)` or `remove`.
  Missing means inherit. Reject unknown fields/tags and invalid field values;
  explicit removal cannot be filled again by legacy fallback resolution.
- Detach materializes effective content privately, clears references and overrides
  atomically, advances content version, preserves personal/learning IDs and SRS.
- Tombstones retain state under existing retention policy; no resurrection as an
  accidental side effect of adopting a revision or receiving a late command.

D03 adds structures only; D05 owns adapter behavior, D06 owns mapping/backfill.
Do not activate projection triggers or link live cards as a side effect of schema
creation. Validate cross-table owner/reference invariants transactionally, including
direct-write attempts, not only in TypeScript.
New columns/tables are protected from unauthorized writes from creation; only
behavior-changing legacy adapters stay dormant. Dormant must not mean unprotected.

## 4. Authority and read access

| Surface                           | Ordinary authenticated reads                                 | Ordinary direct writes                                      |
| --------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------- |
| Published dictionary/revisions    | Safe published material; retained pinned revisions by policy | Denied                                                      |
| Draft dictionary/source records   | Denied                                                       | Denied                                                      |
| Assessments/heads                 | Only for readable entries, no raw provider data              | Denied                                                      |
| Personal content state            | Owned card only, including tombstone recovery as allowed     | Denied; validated owner operations only                     |
| Content receipts                  | Own acknowledgement metadata only                            | Denied                                                      |
| Existing words/learning endpoints | Existing owner/sharing boundaries preserved                  | Existing permissions with enforced reference/content guards |

Do not enable anonymous dictionary access merely for convenience. Existing
collection sharing needs its authorized effective-content projection, not direct
access to the owner's private table or unpublished dictionary revisions.
Use narrow, explicitly owner-checking operations for privileged mutations; fixed
name resolution and least privileges. A client header, request setting or claimed
version cannot authorize bypassing the legacy-write guard. D03/D05 must prove
direct updates and forged flags fail while the validated RPC succeeds.

## 5. Content command and retry semantics

Envelope: protocol version, operation ID, word ID, operation kind, expected content
version, schema version and validated payload. Kinds: create-private, edit-private,
link, adopt-revision, detach, resolve-conflict. Owner derives from the authenticated
context, never from an authoritative caller-supplied owner parameter. No SRS fields.
Canonical request hashing includes all intent fields, not access tokens/timestamps
created anew on retry. Create-private reserves the original client word ID.

`private.word_content_receipts` key `(user_id, operation_id)`: request hash, word ID,
resulting content version and minimal acknowledgement. Keep receipts through the
retry/support window; no automatic expiry before a proven returning-device policy.

Authenticate, serialize operation identity, then check an existing receipt. Same
intent returns that receipt even if the card was subsequently tombstoned; this
must not resurrect content or grant access to another account. Changed intent
rejects. For a new operation, check ownership/liveness and expected version under
the card lock, validate references, then commit state/projection/receipt together.
Concurrent duplicate commands apply once. Failed commands leave no success receipt.
Account deletion follows its separately authorized privacy deletion policy.

Domain errors: unsupported-protocol, not-found-or-not-owned, stale-content-version,
invalid-revision, semantic-key-conflict, legacy-content-upgrade-required and
operation-intent-mismatch. No foreign record details in errors. New clients keep
payloads for conflicts; they never infer success from a timeout or empty response.

## 6. Cursor, recovery and publication details

Use an independent ordered change token for shared revision availability and CEFR
head changes. Its implementation must be commit-order safe: a bare allocated
sequence/timestamp can skip a transaction that commits later. Choose a serialized
publisher/change-log transaction or another tested consistent protocol in D05;
test reversed commit order. Cursor pages and cached dependencies apply atomically.
Announcing a newer revision offers adoption; it never moves a personal pin.

The upgrade path snapshots old pending metadata into owner-only local conflict
storage before replacing the local read model. Capture payload, original personal
ID and local sequence/version; preserve separate learning queues unchanged. An
unmatched/new private card remains recoverable. Conflict resolution with a fresh
base creates one new content intent; it never rewrites original review/reset IDs.

Rollback disables new content operations and enrichment, retains receipts, and
serves the current effective projection. Existing accepted learning writes survive.
New unacknowledged content queues stay paused/recoverable; do not route them into
legacy full-row writes. Publication withdrawal and source licensing are separate
gates; default is no publication of unreviewed material.

## 7. Closure and implementation handoff

The D02 design package comprises this blueprint, the compatibility matrix,
foundation policies and fixture specifications. Table/RPC implementation must
prove these semantics; documents and formatting tests are not database verification.
Add acceptance cases for receipt retry after tombstone, forged bypass flags,
cross-owner content-state references and out-of-order commit visibility.

Retirement remains off by default. D13 must record a concrete observation duration
and support/recovery window before release; D14 additionally requires fresh adoption,
preservation/rollback evidence and separate removal approval. No default deadline
automatically disables old clients or erases queues. Numeric spending/provider
choices belong to D11's separate paid-operation gate, not D03 schema preparation.

Before D03: obtain explicit local implementation authority and a scoped decision
allowing synthetic local work while D01 Android/queue evidence remains open.
Preserve the task bundle before preparing a new implementation branch. No commit,
push, hosted migration, content backfill, deployment, paid call or production
activation is authorized by completing this design document.
