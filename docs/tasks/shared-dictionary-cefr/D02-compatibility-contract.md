# D02 identity, compatibility and recovery contract

Status: D02 design baseline, 2026-09-21. The user accepted the foundation's
shared-content/private-learning split, private personal edits and explicit content
revision adoption and subsequently confirmed both transition restrictions:
single personal card per legacy key and preserved-queue recovery for conflicting
legacy writes. No implementation or production authority follows.
[Foundation](D02-design-proposal.md), [schema blueprint](D02-schema-blueprint.md).

## 1. Source constraints

- `supabase/migrations/20260725180000_align_word_semantic_case_normalization.sql`
  enforces one live personal row per owner/lowercase lemma/POS/article. Shared
  import conflict handling relies on that same key.
- `apps/mobile/src/db/wordRepository.ts` checks both ID and semantic key and can
  update `word_id` on a match. `syncManager.ts` also reconciles semantic duplicates.
  Simply dropping the server index would not make old clients sense-safe.
- Learning protocol 2 owns SRS and durable command IDs. Corrections and resets
  already have independent semantics; dictionary work must not replace them.
- P1 iOS reports 2.3.1 (84). P2 Android and all device-local learning queues are
  not fully evidenced. Do not infer retirement/adoption from a release listing.

## 2. Proposed identity and first-release boundary

Dictionary meanings receive independent opaque IDs. Language/lemma/POS/article
form a candidate-search index, never a unique meaning key. A sense discriminator
is stable within an entry; a translated gloss is editable content, not identity.
An expression receives its own meaning ID; do not split it into component words.
Unknown POS/article stays unknown rather than forcing an invented classification.

Automatic linking requires an explicit reviewed source-entry mapping and matching
content policy. Equal spelling or translation hashes alone only produce candidates.
Uncertain matches remain usable private cards. Normalization must be versioned and
identical in matching fixtures across clients/server; do not silently rewrite the
legacy personal key during the dictionary migration.

**Accepted first-release limit:** keep existing personal semantic uniqueness until
legacy readers are safely retired. The shared dictionary may hold both senses of
`bank`, but one owner cannot yet create two simultaneous same-key personal cards.
Show the existing card and require a deliberate meaning choice; never relabel a
conflict as a successful import of the second meaning. Multiple same-key personal
cards need a later separately tested uniqueness/client-access change.

## 3. Minimal owner UI and meaning changes

Use existing add/detail/reanalysis flows, not a new dictionary browser. When a
match is unambiguous and approved, show its meaning/source and shared status.
For ambiguous candidates show short meaning labels plus `Keep private`; no
automatic first-candidate choice. Offline or unavailable dictionary data must not
block saving a private card or reviewing cached cards.

`Adopt update` previews changed fields and retains private overrides. `Change
meaning` is distinct: explain that the existing card's progress/history will remain
and inherited CEFR may change/become unknown. Require explicit confirmation;
default cancellation leaves the card unchanged. It must not implicitly reset SRS.
Reset remains a separate existing user command, never part of a relink transaction.
Review events retain their identities; preserve content-revision context for new
sessions without backfilling invented historical meanings.

Personal media, custom examples and reanalysis edits stay owner-only. A meaning-
changing edit detaches the reference until the user resolves it. An inherited CEFR
must not survive a changed assessed input merely because the spelling is unchanged.

## 4. Logical storage and integrity proposal

| Record                        | Required fields / constraints                                                                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Dictionary entry              | Stable entry ID; language; candidate key; sense discriminator; draft/published/retired state; no owner content in public fields                              |
| Immutable revision            | Revision ID; entry ID; structured linguistic content; schema version; canonical content hash; source/provenance reference; reviewed state                    |
| Assessment                    | Assessment ID; entry ID; assessed-input hash; nullable validated level; source/method version; confidence; assessed time; review lock; supersession metadata |
| Personal reference on `words` | Nullable entry ID + pinned revision ID together; composite relationship proves membership; owner-controlled mutation only through validated operations       |
| Private content row           | One owner/word pair; complete private fallback for unlinked cards, sparse overrides for linked cards; explicit field removal; server content version         |
| Content operation receipt     | Owner, operation ID, request hash, result/version; retry identical intent returns same receipt; changed intent under same ID rejected                        |

Keep `words.word_id`, owner, collection, SRS and tombstones unchanged. Personal
content/reference changes and the legacy effective-content projection commit
atomically. No shared deletion cascades to cards/history. Published revisions are
not ordinary-client writable. Owner checks apply to direct tables and RPCs, not
only UI. Draft/source-review records are not readable by ordinary users.

Legacy columns remain a compatibility projection during the transition, not a
second independent authority. Before final cutover they remain the existing
authority; any separately approved production preparation must be dormant.
Shared publication requires an approved source, neutral content review and a
privileged explicit operation. Importing someone else's shared collection grants
only its existing intended sharing scope, not dictionary publication consent.

## 5. New-client content operations

Propose a separate `dictionary_content_protocol = 1` capability; keep learning
protocol 2 and correction protocol 1 unchanged. A capability read is not permission
to cut over: preparation clients keep the old path until a server-controlled,
explicitly approved activation. Missing capability with old path active is normal.

After activation, content commands carry operation ID, owned word ID, expected
content version and explicit patch/reference intent. Server validation checks
ownership, live status, revision membership and visibility, then locks the card,
compares version and applies all content/projection changes atomically. A stale
base returns a conflict without mutation or acknowledgement. SRS cannot be patched.
Do not trust a caller's claimed app version or a writable `is_new_client` flag as
authority to bypass checks. Direct reference/private-state writes cannot bypass
the same guards.

Mobile persists command IDs and payloads before acknowledging local edits. Keep
content operations in a durable ordered queue separate from existing immutable
learning commands. Learning against an already owned card need not wait for a
dictionary refresh; a newly created card must exist before its learning commands.
An acknowledgement clears only its operation/version; concurrent newer edits stay
pending. Ambiguous timeouts retry the same ID. Web retries also retain operation
identity; do not claim durable web offline support without implementing it.

## 6. Legacy-write compatibility proposal

Old full-row content payloads have no trustworthy base version. Arrival time cannot
distinguish an intentional edit from a stale projection. Thus **do not silently
promote changed legacy text into current effective content on linked cards**.

| Legacy request after approved activation            | Proposed handling                                                                                                       |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| New personal insert                                 | Preserve supplied personal ID; store private fallback, no automatic publication/linking; retain current duplicate rules |
| Existing unlinked card update                       | Existing owner-scoped behavior, private state only; current learning guards remain                                      |
| Linked card, content equal to current projection    | Permit existing authorized non-content operations; no revision/override change                                          |
| Linked card, any differing linguistic/media payload | Reject atomically with upgrade/content-conflict error; no success acknowledgement, overwrite or lost queue              |
| Learning/reset/correction command                   | Existing protocol and ownership/idempotency rules; no dictionary-ID substitution                                        |
| Duplicate key with a different ID/meaning           | Explicit conflict; no reassignment or merging of personal IDs                                                           |

This deliberately differs from blindly adopting all legacy edits as private
overrides. New clients must import preserved legacy pending payloads into a private
conflict record, show original/local and current content, and submit the user's
resolved intent with an expected version. No automatic discard or forced overwrite.
Do not acknowledge the old pending write until preserved/resolved transactionally.

Important limitation: the old synchronizer pushes metadata before learning, so a
content rejection may stop that pass's learning upload too. Upgrade/reconciliation
is required, with queues intact. The user accepted this restriction; communication
and physical-device upgrade testing remain required before activation.
Do not describe this as transparent compatibility for all old offline clients.

## 7. Client/backend matrix and offline reads

| Combination                                         | Required behavior                                                                       |
| --------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Current clients + current production                | Unchanged throughout preparation                                                        |
| New clients + backend without dictionary capability | Existing path only; no invented dictionary writes                                       |
| New clients + dormant prepared backend              | Still existing path; no implicit switch after deploy                                    |
| New clients + activated backend                     | Versioned content operations, existing learning commands, owner-scoped bulk hydration   |
| Legacy clients + activated backend                  | Projection reads and above restrictions; returning-device recovery, no silent data loss |
| New clients offline                                 | Review materialized private/effective content; preserve original pending commands       |

Mobile keeps revision/assessment caches and an owner-scoped effective-content read
model. Shared updates use a cursor independent of personal `words.updated_at`;
checkpoint it only after a page is durably applied. Account switching isolates
private material. Missing pinned content uses last valid cached/fallback content,
not the latest revision chosen silently. Explicit removals override fallback.
Web resolves shared dependencies in batches and preserves compact review snapshots;
no per-word network request. New sessions see adopted content; active ones stay frozen.

## 8. Generated schema workflow (D02.5 proposal)

The repository's `packages/supabase-contracts/src/database.generated.ts` declares a
linked-project origin. Keep it as recorded deployed evidence until an authorized
generation changes that provenance. Do not hand-add undeployed dictionary tables
there or expand handwritten overlays as a substitute for generation.

D03 should generate a separate `database.target.generated.ts` from a disposable
local database containing the ordered migration chain. Pin the actual CLI/database
tool versions and record migration manifest/hash, schema list and output digest in
a sidecar manifest. Use the documented local target, e.g.
`supabase gen types --local --lang typescript --schema public`, after checking the
pinned CLI's supported syntax. This is a future command, not run this session.
Do not use `--linked` or a production project ID for an undeployed schema artifact.

CI recreates the isolated schema, generates twice deterministically and verifies
the committed target artifact. Both clients typecheck against the same target
contract while runtime capability/activation guards preserve old-path behavior.
Audit existing RPC nullability and official-content overlays for parity; remove
only redundant overlays, not unrelated metadata corrections. Post-deploy comparison
is a separate release verification, not proof provided by local generation.

Documentation checked through Context7: [Supabase CLI generation](https://github.com/supabase/cli/blob/develop/README.md),
[target/language/schema flags](https://github.com/supabase/cli/blob/develop/apps/cli/src/commands/gen/types/types.command.ts).
Development-branch documentation is not the pinned local tool version.

## 9. Rollback and retirement gates

Before any release: finish missing Android and full-queue evidence, test native
upgrades without reinstalling, validate schema/RLS/contract/performance tests,
snapshot P1/P2 counts plus row-level content/SRS/history/queue invariants privately,
and verify recoverable backups. Reconcile writes arriving after the initial census.
Neither the screenshots nor equal counts establish these preservation invariants.

For rollback, stop new dictionary content actions/worker, retain all operation
receipts and queues, and route reads to the transactionally maintained current
personal projection. Keep the learning protocol and all post-cutover accepted
commands active. Do not deploy an old incompatible binary or restore a pre-cutover
backup over new learning writes. Rehearse rollback after edits, reviews, resets,
corrections and offline returns; prove exact acknowledgement preservation.

Legacy storage remains until every in-scope active device has upgraded/reconciled,
restore/recovery works, an agreed observation period has passed and separate D14
approval is recorded. The duration is not guessed or implied by a week passing.
Account for other accounts affected by shared schema changes before any global
retirement. Unknown/returning devices retain private data and get recovery guidance;
never solve compatibility by logout, reinstallation, queue deletion or changing IDs.

## 10. Acceptance fixtures to implement and execute later

| ID  | Scenario                                            | Required assertion                                                                       |
| --- | --------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| F01 | Two owners, same reviewed meaning                   | Same shared revision; distinct original card IDs, independent SRS/history                |
| F02 | Two `bank` senses                                   | Distinct dictionary IDs; same-key second personal card explicitly deferred/conflicted    |
| F03 | Equal strings, unknown provenance                   | No automatic shared publication or merge                                                 |
| F04 | Personal example and explicit removal               | Owner-only overlay; removed field does not reappear from fallback                        |
| F05 | New revision during active offline review           | Frozen question content; adoption only after explicit action                             |
| F06 | Changed assessed input                              | No inherited stale CEFR; unknown is not B1                                               |
| F07 | New command retry with same/changed intent          | Same receipt without duplicate effects / reject changed intent                           |
| F08 | Concurrent content edit or tombstone                | Expected-version/liveness conflict; no resurrection or SRS update                        |
| F09 | Stale legacy content on linked card                 | Explicit error; projection, reference and pending local data preserved                   |
| F10 | Upgrade after F09                                   | Private conflict retained; reviewed resolution once; queued learning IDs/order unchanged |
| F11 | Legacy duplicate repair on new client               | ID remains stable; no semantic-key replacement of linked cards                           |
| F12 | Missing revision, dictionary outage, account switch | Cached private fallback, usable offline review, no private cross-account exposure        |
| F13 | Rollback after new learning writes                  | Every accepted event/reset/correction and retry receipt survives                         |
| F14 | Partial cursor page or ack with concurrent edit     | No skipped shared change or erased newer local operation                                 |
| F15 | Old backend / dormant capability / spoofed flag     | No premature switch and no authority gained by caller flags                              |
| F16 | Fresh and upgraded schema generation                | Reproducible target types; old-path typechecks and migration provenance agree            |

Additional cases from final design review:

| ID  | Scenario                                     | Required assertion                                                   |
| --- | -------------------------------------------- | -------------------------------------------------------------------- |
| F17 | Accepted command retry after later tombstone | Original receipt returned without resurrection or second application |
| F18 | Direct table update or forged adapter flag   | No reference/content guard bypass or forged acknowledgement          |
| F19 | Foreign owner in private content relation    | Rejected by database ownership/integrity enforcement, not just UI    |
| F20 | Earlier token commits after later token      | Consumer does not permanently skip the late-committing shared change |

These are acceptance specifications, not executed tests. The two product boundaries
are accepted; do not request them again. The [blueprint](D02-schema-blueprint.md)
closes logical schema/error/recovery details. SQL implementation, permission tests
and runtime verification require D03 onward. D01 gaps and local implementation
authority remain separate gates; no D03 or production operation has occurred.
