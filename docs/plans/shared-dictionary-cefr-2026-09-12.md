# Shared dictionary and CEFR: implementation plan

Date: 2026-09-12. Design status: proposed at creation.

**Resume entrypoint:** [session starter](../session-starter-prompt.txt) →
[active task](../tasks/_active_task.md) →
[current handoff](../tasks/shared-dictionary-cefr/handoff.md).
Read current progress there; this plan is the scope/design reference, not a live
status report. Every stage has its own resumable card under
`docs/tasks/shared-dictionary-cefr/steps/`.

Scope: backend/database, shared packages, mobile iOS/Android, web, existing content,
CEFR enrichment, compatibility, verification, and staged release.

## October 10 amendment — accepted automatic published updates

The owner selected shared dictionary content with automatic adoption of published
analysis, preservation of existing personal data and independent learning progress, and asked
for a revised plan including old-card migration and a model/effort for every next
checkpoint. This supersedes DEC-01's explicit-adoption default as a **target**;
production still runs the pinned-revision behavior until the new release is tested
and separately authorized. Completed D01-D12 evidence and AUTH-27/28/29 deliveries
are retained, not reopened or replayed. Final clarification: all analysis is shared,
with no personal linguistic overrides; full_access users and administrators may
request shared reanalysis through a validated server operation. See DEC-10 and the
[accepted design](../brainstorms/2026-10-10-shared-dictionary-auto-updates.md).

Known delivered baseline: 2053 published official entries / 21 packs; dictionary
backend/web enabled; native2.4.0(85) with two OTA repairs and processed Sentry maps.
Owner confirms iOS sync/status and prior offline preservation. Old cards were NOT
bulk-linked. The October4 snapshot classified2914 cards with **zero safe matches**;
2465 possible matches are candidates, not approved associations. Existing duplicate
fields and legacy support remain; CEFR remains OFF. Current evidence, source hashes
and uncommitted repairs are in the handoff, not inferred from historical plan rows.

Add **D13A** before D14. Local design/implementation/rehearsal can proceed while
existing D13 observation remains open; no waiting period blocks that preparation.
The current request approves design and planning, not a production migration,
personal-card linking, content publication, paid analysis, release or source push.
D13A has its own tested release gate. D14 requires both releases' relevant evidence,
new behavior observation and old-client reconciliation; October12 is not automatic
permission to remove compatibility. Initial time/cost estimates below are historical
and do not include this extension; re-estimate after D13A.1 rather than invent a cost.

## 1. Outcome and boundaries

One durable shared entry per resolved meaning supplies linguistic content and
CEFR. Personal records hold references, ownership, collection membership and
independent learning state. Analysis fields are shared, without per-user overrides.
Preserve historical differences until reviewed migration; mobile caches common
content for offline use. No new personal-notes feature is included in this extension.

Priority cohort clarified 2026-09-12: two users, P1 (primary owner/main learner)
and P2 (recent learner). See DEC-08 in the task decision ledger. Preserve both;
P1 requires full preservation. P2's willingness to consider a restart is a
last-resort fallback, not authorization to discard data. Coordinate device/build
verification with these two users instead of requiring a population-wide adoption
survey. This reduces rollout coordination, not schema/privacy/offline safeguards.

October 4 device-access exception: the owner directs continuation without P2's
unavailable primary Android. Its native build and device-only queues remain
unknown. Do not wait for that connection, waive preservation, or infer reset
permission. Retain legacy/offline compatibility and record this evidence limit
in the final release scope; operation and cutover approvals remain separate.

Cutover constraint confirmed 2026-09-12 (DEC-09): current production reads/writes
stay on the existing schema until all implementation and pre-release verification
are complete. No early switch of P1/P2 through deployment, canary or backfill.
The original D13 functional release changed the active path under AUTH-27. The
October10 extension needs its own final D13A release approval; D14 retires legacy
storage only after the expanded observation/adoption gate. Preparing new tables or
code does not authorize activating them. No completed release is replayed.

This is a substantial data-model migration, not a column addition. Plan roughly
12–16 reviewable PRs. Initial engineering estimate: 12–20 focused working days;
reserve 20–30 days including integration and rework. These are judgment estimates,
not measured throughput or guaranteed unattended-agent execution times. Store
review, user approvals, and waiting for old-client adoption are additional elapsed
time; final compatibility retirement may take longer than implementation.

The smaller alternative is shared CEFR only, leaving full card normalization for
later. This plan covers the full reference-based approach requested by the user.

Non-goals: replacing the SRS algorithm, replaying learning history, redesigning all
screens, rebuilding authentication, changing collection membership semantics,
supporting new languages, or editorially certifying every Dutch word.

Production migrations, paid bulk AI calls, public publication of new content, and
web/native releases require explicit approval at their gates. A request to write
this plan does not authorize them.

## 2. Repository evidence and startup state

- Planning began on clean `feature/web-review-navigation`, HEAD `e962870`.
  The locally known `origin/main` is `c5dfb14`; the performance branch was merged.
  Do not implement this project on the old branch. Before implementation, preserve
  these planning files, synchronize `main`, and create a new feature branch under
  the repository's `feature/` policy. No branch switch or commit was made for planning.
- Guidance: root `AGENTS.md`, read-only `.claude/CLAUDE.md`, and
  `apps/web/AGENTS.md`. Initial discovery used reconnaissance mode. The subsequent
  resume setup added `docs/session-starter-prompt.txt`, `docs/session-runbook.md`
  and `docs/tasks/_active_task.md`; future sessions use that orchestrated entrypoint.
- `supabase/migrations/001_initial_schema.sql`: `words` stores owner, content, and
  SRS. Later review/reset/correction functions still use this stable personal row.
- `supabase/functions/gemini-handler/cacheUtils.ts`: shared AI analysis cache,
  version filtering and a 180-day last-use eligibility window; refresh overwrites
  analysis fields. This is not a durable meaning registry.
- `packages/domain/src/semantic-word.ts`: current duplicate key is lemma/POS/article,
  not a complete meaning identity. The same assumption also exists in server and
  SQLite indexes, duplicate recovery, and imports.
- `apps/mobile/src/db/initDB.ts`: local schema version 12; content and queues live
  in SQLite. `apps/mobile/src/services/syncManager.ts` pulls and pushes word rows
  and maintains independent progress/event streams.
- `docs/learning-sync-protocol.md`: preserve protocol 2, command identity, server
  acceptance order, pending commands, tombstones, and correction behavior.
- `apps/web/src/features/analysis/word-persistence.ts`: analysis fields are copied
  into personal rows. Review setup uses `get_web_review_snapshot_v1` and must retain
  its compact, consistent read behavior.
- `packages/content/src/manifest.ts` and official catalog migrations: published
  manifests are immutable; pack-level CEFR is not a per-entry assessment.
- The ignored historical classification report contains 2,287 card records, not
  2,287 guaranteed usable shared assessments. No fresh production count or complete
  hosted-schema audit was performed for this plan.

## 3. Data contract and accepted October 10 target

Names below describe responsibilities, not final migration names.

| Component               | Authority and contents                                                                                                                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dictionary entry        | Stable identity for one meaning; language, lemma, POS, article, meaning discriminator, publication/retirement state                                                                                |
| Content revision        | Immutable reviewed or validated linguistic content; provenance, revision ID, content hash; no personal identifiers                                                                                 |
| CEFR assessment         | Entry/meaning identity, assessed input hash, A1–C2 or unknown, source, confidence, method/provider version, assessed time, review/lock state                                                       |
| Personal reference      | Existing `word_id`, owner, collection, shared meaning reference, applied revision/cursor and deletion state; current SRS authority retained. Legacy content exists only until reviewed transition. |
| Learning streams        | Existing events, resets, corrections, checkpoints, and auxiliary `user_progress`; never merged across users or rewritten by dictionary migration                                                   |
| Mobile local read model | Cached common revisions and resolved card content, existing learning queue and preserved legacy pending commands; usable without network                                                           |
| Enrichment work state   | Input revision/hash, attempt count, next retry, lease, status, bounded cost/usage metrics; server-only                                                                                             |

Essential invariants:

1. Never replace a personal `word_id` with a dictionary ID. Existing foreign keys,
   queued operations, URLs, and history retain their identities.
2. Clients cannot directly write shared content. A server-authorized full_access
   user or administrator can invoke shared reanalysis; the server validates and
   publishes the result for that meaning. Read_only users cannot invoke it. Personal
   state writes never mutate another user's progress or bypass publication controls.
3. Private text is not automatically a public dictionary contribution. Begin with
   approved official material and validated neutral analyses. Unclear/private
   content remains private and can have a private classification where necessary.
4. Do not merge meanings solely by spelling or hash all translations as a permanent
   identity. Exact-content fingerprints are conservative migration evidence;
   legitimate wording changes must not create accidental new identities.
5. All linguistic analysis fields are common; no personal override/reset UI is
   added. Preserve existing legacy content/overrides until reviewed transition, with
   protected originals and explicit content differences. Changing meaning requires
   separate resolution; shared reanalysis never silently relinks a personal record.
6. Following linked cards automatically adopt the current approved published head
   of the same meaning at a safe synchronization/session boundary. Immutable
   revision IDs record the applied content and historical context, not an indefinite
   manual-adoption requirement. Current clients remain pinned until D13A release.
   All users inherit the common analysis; active review questions remain frozen.
   CEFR remains OFF
   and any future refresh must match the meaning and assessed input.
7. Shared-content and CEFR changes have their own revision/cursor invalidation.
   They must reach mobile even when a personal card's `updated_at` does not change.
8. No per-card network request for dictionary content. Batch/hydrate at the data
   boundary and preserve the optimized web review snapshot.
9. Removing a personal card never deletes a shared entry. Retiring an entry does
   not break pinned historical references; privacy withdrawal needs a separate,
   explicitly defined cache/redaction path.

### 3.1 Shared-only analysis and reviewed old-card transition

Final owner decisions on October10: one common analysis per resolved meaning; no
individual translation/example/image overrides; reanalysis updates the common
entry; full_access users and administrators may invoke it. Optional separate
personal notes are outside this release. Existing learning and collection state
stay personal. Product policy is settled; D13A.1 specifies the technical contract.

| Location                     | Target contents                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Shared dictionary            | Meaning identity, analysis, immutable versions, published head and provenance                                 |
| Personal reference           | Stable personal word_id, owner, entry reference, collection and existing learning state/history relationships |
| Mobile cache                 | Downloaded shared versions and session snapshots for offline use; not user-owned analysis                     |
| Protected transition storage | Original legacy content, old overrides and mapping receipts until reviewed reconciliation/retention gates     |

The phrase linked card means the personal reference above, not a second analysis
copy. Do not introduce a new per-user analysis store or a new SRS authority. Keep
existing IDs and learning tables; D14 removes redundant authoritative analysis for
successfully migrated references only after returning-client compatibility passes.

- **Shared authority:** immutable revisions and one current published head per
  meaning. Reanalysis takes an explicit entry/meaning ID, not spelling alone.
  Two different meanings are separate entries even if their spelling is identical.
  The replaceable AI cache is an optimization, never a publication authority.
- **Allowed action:** a server-verified full_access user or administrator can request
  common reanalysis. Read_only/unauthenticated callers cannot; UI hiding alone is
  insufficient. Verify access from trusted server records at operation acceptance
  and before committing publication, including revoked access during a paid request.
  Identify the administrator authority in D13A.1; do not invent an AccessLevel enum
  value when current levels are read_only/full_access. Privileged manual moderation
  or rollback remains an administrator operation; full access grants the specified
  analysis action, not arbitrary direct dictionary writes.
- **Analysis/publication:** use neutral shared inputs, an idempotency key, per-entry
  concurrency control and existing quota/accounting. Deduplicate concurrent calls
  to avoid duplicated paid work. Produce a version, validate schema/completeness and
  same-meaning constraints, then atomically publish it as part of the successful
  action. No compulsory administrator confirmation for every valid full_access
  request. Failed/invalid/meaning-changing output leaves the current head intact
  and returns a clear result; unclear output is held for review. Machine validation
  is not human linguistic review. Record actor, input/version, validation and usage;
  retain a diff/history and administrator rollback. Never silently create a private
  analysis, detach the caller's reference or publish their personal examples.
- **New words:** reuse a resolved eligible common entry first. A new meaning needs
  canonical identity resolution, validated neutral analysis and the same server
  access/quota controls, not one full analysis copy per user. Ambiguity requires a
  meaning choice/review, not an automatic lemma/POS/article merge. Shared cache,
  official/shared imports and exports must use the same authority. No bulk paid
  analysis or new public-source publication is executed by this planning request.
- **Delivery:** automatic updates use an ordered publication cursor independently
  of personal updated_at. Web and mobile hydrate shared dependencies in bulk and
  resolve all analysis from the applied common version, with no personal overlay.
  Missing/invalid dependencies keep the last valid cache usable and do not advance
  a successful hydration checkpoint. No per-card network requests. Started review
  questions stay frozen; new sessions use the updated version after synchronization.
  Offline operation, interrupted downloads, retries and account switches must work.
- **Rollback:** atomically change the head using an expected prior head and emit a
  new monotonically increasing delivery event. A rollback to older content is a new
  event, so revision-number comparisons must not block it. Keep immutable history;
  rolling back dictionary content never rolls back user reviews or progress.
- **Learning:** preserve personal word_id, owner, collections, original input,
  tombstones, all review/reset/correction events, intervals/easiness/dates and pending
  learning commands. Do not reset/replay SRS when linking or publishing content.
  Add revision context compatibly where required to explain historical questions.
- **Old-card census:** reuse saved snapshots for local design/rehearsal, then take a
  fresh protected snapshot/delta for any live apply. Separate verified same-meaning
  exact matches; verified same-meaning differing content; ambiguous meanings;
  missing shared entries; and private-only/ineligible material. Existing zero-safe-
  match results remain valid; AI similarity or spelling alone is not a reviewed link.
- **Old differences:** retain original content and existing overrides in protected
  transition evidence. Exact matches can link through a reviewed mapping. Differing
  cards need a visible before/after diff and an explicit approved disposition:
  adopt the existing common analysis, improve the common analysis through permitted
  publication first, or hold the card unchanged pending resolution. Do not convert
  differences into permanent personal overrides, hide them all as personal notes,
  silently discard them or publish them as neutral dictionary data. Unresolved cards
  remain usable in the temporary legacy path; no claim that migration is complete.
  Review scope may be a concrete bounded mapping packet, not necessarily one popup
  per card. Reanalysis of an unlinked old card first resolves its common meaning.
- **Apply/rollback:** mapping records entry/revision, card/version/hash, source and
  explicit approved content delta. Use bounded idempotent batches, expected-version
  and tombstone guards and durable receipts. Skip/reclassify concurrent edits.
  Learning/identity/collection preservation is exact; linguistic changes must match
  the approved delta rather than a false promise of unchanged analyzed text. Never
  merge personal cards/history to satisfy an index. Rehearse rollback of only
  migration-owned changes, retaining later reviews and edits; never restore an old
  full backup over newer production learning.
- **Old clients:** negotiate the new capability; old build85 personal reanalysis or
  whole-row edits must not mutate the shared head or resurrect private copies on
  migrated references. Preserve pending commands and provide explicit reconciliation/
  upgrade for content writes while preserving learning. P2 Android unavailability
  does not permit queue deletion or premature removal. Missing mappings are explicit
  migration work, not a new permanent personal-analysis feature.
- **Privacy/CEFR:** preserve source licensing and separate private original input
  from public common analysis. CEFR remains OFF under its separate gate; do not
  convert pack levels into word assessments or activate provider jobs implicitly.

## 4. Execution sequence and model settings

Assignments are engineering recommendations, not guaranteed model performance or
quota conversion rates. Use one active implementation task at a time. Standard
speed is the budgeting assumption. Do not enable extra agents or Ultra implicitly.

| Step | Deliverable                                                  | Recommended model / reasoning           | Depends on                                                 |
| ---- | ------------------------------------------------------------ | --------------------------------------- | ---------------------------------------------------------- |
| D01  | Inventory, baseline, compatibility audit                     | GPT-6 Astra / High                      | None                                                       |
| D02  | Approved architecture and migration contract                 | GPT-6 Astra / High                      | D01                                                        |
| D03  | Additive database, RLS, revisions and references             | GPT-6.1 Sol / High; Astra / High review | D02                                                        |
| D04  | Shared types, validators and effective-content resolver      | GPT-5.6 Terra / High                    | D03                                                        |
| D05  | Server write/read path and legacy compatibility              | GPT-6.1 Sol / High                      | D03–D04                                                    |
| D06  | Resumable data mapping and backfill tooling                  | GPT-6.1 Sol / High; Astra / High review | D05                                                        |
| D07  | Mobile SQLite and local repositories                         | GPT-6.1 Sol / High                      | D04–D05                                                    |
| D08  | Mobile sync, offline edits and UI integration                | GPT-6.1 Sol / High; Astra / High review | D07                                                        |
| D09  | Web integration and performance preservation                 | GPT-6.1 Sol / High                      | D05                                                        |
| D10  | Official packs, shared imports and exports                   | GPT-6.1 Sol / High                      | D06, D08–D09                                               |
| D11  | CEFR ingestion and bounded scheduled enrichment              | GPT-6.1 Sol / High                      | D05–D06, D10                                               |
| D12  | Cross-client, privacy and regression verification            | GPT-6 Astra / High                      | D08–D11                                                    |
| D13  | Staged release, approved backfill and observation            | GPT-6 Astra / High                      | D12                                                        |
| D13A | Automatic published updates and reviewed old-card transition | Per-checkpoint models below             | Delivered D13 baseline; observation may overlap local work |
| D14  | Compatibility retirement and server deduplication            | Per-checkpoint models below             | D13 + D13A + adoption/retirement gate                      |

The D01–D12 sections below describe the implemented baseline and its original
verification scope. Their pinned-revision/private-overlay wording is historical;
section3.1 and D13A govern new work. Do not recreate those features or reset the
completed checkpoints when implementing the accepted shared-only target.

### D01 — Audit and baseline

- Inventory all word readers/writers: analyze, save, reanalyze, personal changes,
  review, reset/correction, delete/restore, official/shared import, export, search,
  collection counts, and background synchronization.
- Establish actual supported native builds and backend contracts. Do not infer
  public availability from old submission documents.
- Use read-only approved aggregate queries to measure cards, unique candidates,
  missing cache coverage, ambiguous meanings, private content, and CEFR coverage.
  Keep private inventories in ignored reports; committed artifacts contain only
  synthetic examples, aggregate counts, and hashes.
- Capture comparable web navigation/start-review and mobile cold/offline startup
  baselines on a small fixture and a large fixture around 2,100+ words. Add a larger
  synthetic scale fixture if user growth justifies it.
- Record quota before/after this stage with timestamps; unrelated account use
  contaminates the measurement and must be excluded or disclosed.

Exit: a change-surface map, baseline artifacts, risk register, and supported-client
matrix. No implementation or production data mutation needed.

### D02 — Freeze the architecture

- Confirm the responsibilities and invariants above; choose exact schema and
  privacy policy, content update policy, and dictionary publication workflow.
- Specify identity/meaning resolution, including two meanings with identical
  lemma/POS/article, expressions, custom examples, and unknown classifications.
- Define a minimal meaning-selection/relinking interaction for web and mobile;
  defer a full dictionary browsing/editor application.
- Specify old-client insert/update behavior and an additive protocol capability.
  Legacy content writes become private state, never edits to a shared entry.
  A stale legacy full-row update must not silently revert canonical content.
- Decide how local/staging schema-generated types enter PRs without hand editing
  generated contracts or misrepresenting them as already deployed.
- Define retirement criteria and the treatment of old devices returning after the
  support window. No deleting local queues to satisfy a migration.

Exit: accepted design, fixture examples, compatibility matrix, and rollback
strategy. Unresolved publication or compatibility policy blocks D03, not D01.

### D03 — Add the schema safely

- Add durable entries, revisions, assessment metadata and optional card references;
  retain all legacy columns and current learning constraints initially.
- Validate reference/revision consistency, ownership, publication visibility,
  provenance, and indexes for reference lookup and incremental delivery.
- Prevent cascading dictionary deletion from removing personal cards/history.
- Test direct table access as well as RPC/view access. Invoker views must preserve
  RLS; privileged functions need narrow grants and explicit ownership checks.
- Generate contracts from the approved local/staging schema workflow.

Exit: migration/constraint/RLS tests pass on fresh and upgraded databases; existing
clients/tests still work with all new feature flags disabled.

### D04 — Shared contracts

- Add separate dictionary-entry, revision, personal-reference, override and CEFR
  types/validators in shared packages. Keep external payload validation strict.
- Implement one effective-content resolver: valid private override, then pinned
  shared content, then legacy/private fallback; distinguish missing from null.
- Version new API envelopes without breaking old consumers. Unknown CEFR is not B1.
- Use the same semantic and assessment rules on server, mobile and web; generated
  schema types remain generated, not manually patched.

Exit: deterministic fixtures prove identical effective content and CEFR decisions
across platforms, including deleted/retired/missing revisions.

### D05 — Server paths and compatibility

- Add idempotent trusted entry resolution and personal-card linking. Handle
  simultaneous additions from multiple users without merging unresolved meanings.
- Persist analysis once in the canonical layer where eligible; the old analysis
  cache remains an optimization and gains an explicit mapping where appropriate.
- Route new writes through the contract; protect old inserts/updates with a
  documented compatibility path. Never allow an old whole-row payload to update
  shared content or existing SRS.
- Serve effective card content in bulk. Add a versioned optimized review snapshot
  if needed while retaining v1 compatibility and security.
- Keep a deterministic legacy projection during coexistence; specify its sole
  writer and conflict policy instead of uncontrolled client dual writes.

Exit: old/new contract tests, concurrency tests, retry tests, RLS tests and learning
regressions pass; flags permit a read-path rollback without data loss.

### D06 — Backfill tooling and rehearsal

- Produce a dry-run mapping: safe match, possible match, private-only, excluded,
  stale source, and missing source. Every input receives a disposition.
- Seed reviewed official entries first. Reuse historical per-card CEFR only when
  its input hash/meaning matches; missing provenance requires review, not guessing.
  Pack-level CEFR must not be silently promoted to an assessed word-level fact.
- Preserve IDs, counts, card content as seen by the user, SRS, events, resets,
  corrections, personal edits and tombstones. Do not collapse personal cards.
- Batch with durable checkpoints, compare-and-set on current source hashes,
  bounded locks, idempotency, and an append-only migration ledger. Reconcile edits
  arriving during backfill; do not run one long locking production transaction.
- Rehearse interruption/resume and read-path rollback on disposable data.

Exit: independently checkable before/after invariants and a reviewed dry-run report.
Actual production application belongs to D13 and requires separate approval.

### D07 — Mobile storage

- Extend the current SQLite schema through non-destructive versioned migrations;
  do not reset the database. Cache dictionary revisions and assessment revisions.
- Keep `word_id`, pending metadata, review/reset/correction command IDs, queue
  order, and deletion state intact. Preserve the existing progress authority.
- Adapt repositories and parsing to materialize effective content efficiently.
  No unrequested full dictionary download; cache only required content.
- Test interrupted upgrades, retries, missing cached entries and storage failures.

Exit: real SQLite upgrade tests preserve old/pending data and offline read behavior
on both native platforms' supported schema paths.

### D08 — Mobile synchronization and integration

- Sync dictionary dependencies and private cards with safe ordering/checkpoints.
  New offline words retain a local/private fallback until server resolution.
- Refresh shared content/CEFR by revision cursors, not only card timestamps. Handle
  missing dependencies without falsely acknowledging an incomplete sync.
- Update add/reanalyze/edit, lists/detail/review, and CEFR display; keep personal
  edits private and add clear unknown/estimated-level states using theme tokens.
- Test two devices plus web, offline edit/review/reset/correction, app termination,
  retry, logout/account switch, and a returning old supported mobile client.
- Reuse protocol-2 learning commands. Do not introduce a new SRS protocol as a
  side effect of dictionary adoption.

Exit: native online/offline/restart flows converge with unchanged learning intent,
no cross-account cache leakage, and no missing queue acknowledgements.

### D09 — Web integration

- Adapt analysis persistence, word repositories, search, collections, detail,
  imports and review to effective content and stable personal IDs.
- Add CEFR display and any minimal meaning/override controls with light/dark,
  loading, missing-level, stale-data, and retry states.
- Preserve the fast review-start path and consistent bulk snapshot. Do not fetch
  one dictionary row per card or add an extra authentication/navigation waterfall.
- Invalidate relevant server/client caches on revision adoption and personal edits;
  keep review session content stable until the session boundary.

Exit: web integration/E2E checks pass; same-environment repeated measurements show
no material review regression. Investigate a sustained >10% median/p95 regression
against a sufficiently sampled D01 baseline before shipping.

### D10 — Catalog, sharing and import/export

- Introduce backward-compatible references for official content. Do not edit
  already published immutable manifests or break old bundled Essentials.
- Map pack entry IDs to canonical entry/revision IDs using explicit provenance.
  New imports reuse shared content but create/retain personal learning identities.
- Update server import RPCs and both clients. Preserve duplicate/import/move and
  read-only-account rules; do not silently change one-collection semantics.
- Shared/private imports copy only content the recipient is authorized to receive.
  Ensure shared references cannot reveal unpublished private revisions.
- Keep exports self-contained or explicitly versioned with validated dependencies;
  reimport must not require access to another user's private rows.

Exit: official/shared/bundled/offline import, duplicate, export/reimport, and old
manifest tests pass without resets or unintended publication.

### D11 — CEFR and the server job

- Extend the existing analysis contract and persistence with validated CEFR,
  source, confidence and method/input version. Preserve old cache/payload handling.
- Calibrate estimates on a reviewed fixture; keep uncertain answers unknown or
  pending review. Source-backed and model-estimated assessments remain distinguishable.
- Create a bounded daily job for eligible unresolved meanings, including imported
  entries that bypassed AI analysis. A private fallback never enters a publicly
  readable assessment through an unsafe join.
- Use durable leases, limited batch/concurrency, timeouts, retry/backoff for 429/5xx,
  attempt limits, dead-letter/review state and idempotent compare-and-set writes.
- Preserve reviewed/manual assessments. Reject a response if the assessed input
  changed while the request was running. Do not call the provider if no work exists.
- Protect privileged invocation with server-only authorization; a public API key
  alone is not authorization for a paid enrichment worker. Keep secrets out of
  clients, logs and source control.
- Configure a daily request/token/cost ceiling, run ledger, failure/coverage
  metrics, and kill switch. Schedule stays disabled until approved. Weekly cadence
  remains configurable if daily volume does not justify daily runs.

Exit for the owner-selected reduced D11 scope: fake-provider tests cover
correctness, authorization, retries, races, limits and no-work behavior;
the offline pilot remains diagnostic and the worker/schedule stay disabled.
Automatic CEFR estimates are deferred behind the separately tracked
[activation gate](../tasks/shared-dictionary-cefr/evidence/D11-cefr-activation-gate.md):
independent exact-meaning quality, a prospective policy, approved small live
sample and cost review must pass before any bulk enrichment. D11 completion
does not satisfy or waive that gate.

### D12 — Integrated verification

- Run existing database, local HTTP sync, SQLite, shared/domain, mobile and web
  tests plus added contracts. Use repository script definitions as authority.
- Relevant commands include `npm run test:db`, `npm run test:sync:http`,
  `npm run test:edge`, `npm run mobile:test:ci`, `npm run mobile:typecheck`,
  `npm run mobile:typecheck:test`, `npm run web:test -- --runInBand`,
  `npm run web:typecheck`, `npm run web:build`, and `npm run official-content:test`.
  Run changed-scope lint/format and required CI/mutation gates; inspect current
  workflow requirements before choosing their exact scope.
- Run actual iOS and Android upgrade/offline/restart QA, and web browser E2E on
  isolated approved accounts. Synthetic tests alone do not prove native release safety.
- Verify two users sharing content have independent progress and private edits;
  verify anonymous, owner, other-user and server roles at every new boundary.
- Compare identifiers, event/command counts and learning snapshots before/after.
  Include interrupted backfill, old-client return, content updates during review,
  and cache invalidation without a personal word update.
- Verify the CEFR path fails closed with the worker and schedule disabled.
  Do not interpret the diagnostic pilot as measured exact-meaning accuracy.

Exit: no unresolved data-loss, privacy, authorization or learning-protocol defects;
all required CI checks pass and the release/rollback runbook is rehearsed.

### D13 — Controlled release

- Obtain approval for each actual environment write/release. Confirm backups and
  restore capability; a rollback must preserve reviews received since deployment.
- Apply separately approved additive backend preparation with new paths disabled.
  Prepare compatible web/mobile clients; validate on isolated QA accounts only.
  P1/P2 remain on the existing authoritative read/write path until the final gate.
- Before remote Expo/EAS operations, verify active identity and linked owner are
  exactly `oldrefery`. Never switch to or use `guardia`.
- Decide OTA versus store build from runtime compatibility and installed builds;
  do not promise that a SQLite change alone makes any release OTA-safe.
- Prepare reviewed mapping plans and delta reports without writing live personal
  references or redirecting reads/writes. Rehearse apply/rollback on an isolated
  copy, retaining subsequent learning writes. Actual mapping apply requires the
  final approved cutover; never enable guards early to bypass this boundary.
- Only after D01-D12 and all pre-cutover checks pass, present the exact release,
  P1/P2 preservation evidence, backups and rollback results for final user approval.
  Then switch the active path and apply reviewed bounded mapping batches as the
  final functional release sequence (DEC-09).
  Treat automatic CEFR enrichment as deferred under the separate
  [activation gate](../tasks/shared-dictionary-cefr/evidence/D11-cefr-activation-gate.md).
  Enable bounded scheduling only after that gate and separate approval.
  Observe at least 7 days including native offline return before any D14 removal;
  track sync failures, orphan references, CEFR failures, cost and review latency.

Exit for the reduced release scope: current mobile and web production work on
dictionary references, new analyses and imports reuse entries, the disabled
CEFR path is observable and makes no provider calls, and all unlinked
private/ambiguous entries have explicit dispositions. Automatic CEFR estimates
require separate activation and are not a D13 release claim.

### D13A — Automatic published updates and old-card transition

This is new work, not a reset of completed stages. Default execution is one checkpoint
at a time; each start/update/handoff states its model and reasoning effort. Model
assignments are recommendations, not a claim that the current chat was switched.
Only supported controls may perform a switch; otherwise state the required picker
setting without claiming it happened. No parallel agents are implicitly authorized.

| Checkpoint | Deliverable and exit evidence                                                                                                                                                                                                           | Model       | Effort | Dependency                                  |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------ | ------------------------------------------- |
| D13A.1     | Contract delta: published-head tracking, shared-only analysis, role checks, rollback ordering, old-card dispositions, old-client negotiation, acceptance matrix and bounded implementation estimate                                     | GPT-6 Astra | High   | Existing D13 evidence and accepted DEC-10   |
| D13A.2     | Reconcile deployed AUTH-28/29 repairs with actual source baselines; preserve sealed artifacts; prepare coherent local source/commit/PR package and validation, without replaying publication                                            | GPT-6.1 Sol | High   | D13A.1                                      |
| D13A.3     | Additive backend/domain support for head events, effective resolution, shared analysis commands, idempotency, RLS, cache/import adapters and legacy compatibility; contracts and database tests                                         | GPT-6.1 Sol | High   | D13A.2                                      |
| D13A.4     | Shared-entry analyze/validate/publish/diff/rollback workflow and caller permissions; authorization, provenance, expected-head conflict and read-only-account tests                                                                      | GPT-6.1 Sol | High   | D13A.3                                      |
| D13A.5     | Mobile iOS/Android and web hydration/invalidation, offline queues, safe review boundaries, shared reanalysis and removal of personal-analysis paths for migrated references, missing-dependency recovery; client and performance checks | GPT-6.1 Sol | High   | D13A.3–4                                    |
| D13A.6     | Reviewed old-card mapping tooling and snapshot rehearsal: exact learning preservation, approved analysis diffs and ambiguous/missing/private dispositions, bounded apply, concurrent delta and rollback retaining later reviews         | GPT-6.1 Sol | High   | D13A.3–5                                    |
| D13A.7     | Dedicated contract/migration/code review and end-to-end acceptance on both clients, two owners, offline return, old build85 compatibility, concurrent publication/legacy writes and rollback                                            | GPT-6 Astra | High   | D13A.4–6                                    |
| D13A.8     | Exact coordinated release/linking packet, fresh backup/delta and rehearsed rollback; after scoped approval deploy compatible clients/backend and apply only reviewed batches; verify production                                         | GPT-6 Astra | High   | D13A.7 and exact operation approval         |
| D13A.9     | Observe the newly activated behavior at least7 days before D14 removal; collect adoption, native offline return, preservation/sync/orphan/latency evidence and remaining-card dispositions                                              | GPT-6 Astra | High   | D13A.8; completed old D13 evidence retained |

D13A.1 completed October10: [technical contract](../tasks/shared-dictionary-cefr/D13A-technical-contract.md),
[26 declarative acceptance fixtures](../tasks/shared-dictionary-cefr/D13A-acceptance-fixtures.json)
and [source baseline](../tasks/shared-dictionary-cefr/evidence/D13A-contract-baseline-20261010.json).
Remaining implementation/verification estimate is13–24 active engineering days,
excluding manual corpus review and device/approval delays, with at least7 calendar
days of new-behavior observation. This estimate covers the new extension; completed
D01-D12/D13 work is not estimated again. D13A.2 completed October10: exact source
reconciliation,13-file patch, artifact integrity and local validation passed; see
[integration packet](../tasks/shared-dictionary-cefr/evidence/D13A-source-integration-20261010.md).
D13A.3 is complete locally: its storage/read block is recorded in
[following read checkpoint](../tasks/shared-dictionary-cefr/evidence/D13A-following-reads-20261010.md).
D13A.3 authority/operation journal support is also complete locally; see
[operation checkpoint](../tasks/shared-dictionary-cefr/evidence/D13A-analysis-operations-20261010.md).
Validation provenance, explicit late-result reconciliation and guarded atomic
publication/no-change support are also complete locally; see
[publication checkpoint](../tasks/shared-dictionary-cefr/evidence/D13A-analysis-publication-20261010.md).
128 unique PG checks, mobile160/1874/22, focused4/73, types/lint/format/target check
pass; no hosted publication/provider call or end-to-end/device acceptance inferred.
Import/cache/legacy transfer and placement recovery contracts plus final stage
verification are complete; see [completion evidence](../tasks/shared-dictionary-cefr/evidence/D13A-import-cache-20261010.md).
Final158 unique PG tests, mobile161/1891/22, focused5/90, final types/lint/format/target
check/diff PASS; web86/780 with one existing skipped. Next D13A.4, GPT-6.1 Sol / High:
semantic evaluator/provider workflow, diff/history and administrator rollback.
All new behavior stays dormant. D13A.4 is in_progress: history/diff and administrator
rollback are prepared and verified locally; see [checkpoint evidence](../tasks/shared-dictionary-cefr/evidence/D13A-history-rollback-20261010.md).
74 selected PG checks, mobile162/1906/22, focused6/105 and all types/lint/format/target
checks pass. Protected semantic evaluator/provider orchestration, policy/positive-
negative fixtures and durable unknown-result retry handling remain the next D13A.4
checkpoint, GPT-6.1 Sol / High. No hosted/provider operation follows from local tests.
October10 protected provider worker checkpoint is also complete locally; see
[worker evidence](../tasks/shared-dictionary-cefr/evidence/D13A-provider-worker-20261010.md).
Edge34/new PG6 plus unchanged compatibility58, focused6/105, types/lint/target/format
checks PASS; failed initial ACL fixture retained and corrected. Strict single-dispatch
transport, service-only context, verified actor factories and durable result retry
are prepared. Actual semantic evaluator/qualified policy/dormant endpoint assembly
and final D4 gates remain next; no extra paid judge call or live enablement inferred.

October10 independent semantic evaluator checkpoint is prepared locally under DEC-11:
separate durable judge attempt consumes a second existing quota slot, strict guards
precede dispatch and grounded six-dimension evidence controls acceptance/review.
Candidate policy and injected sense fixtures are not real-model qualification. Next
D13A.4 is dormant concrete endpoint/factory, readiness preflight and final workflow
gates, GPT-6.1 Sol / High. Measured exact model/prompt qualification remains D13A.7;
live policy/provider enablement remains D13A.8. See [semantic evidence](../tasks/shared-dictionary-cefr/evidence/D13A-semantic-evaluator-20261010.md)
and current handoff.

October10 D13A.4 endpoint/final local workflow gate complete; see
[completion evidence](../tasks/shared-dictionary-cefr/evidence/D13A-endpoint-workflow-20261010.md).
Atomic readiness before quota, immutable model/policy binding, repeated protected
dispatch and dormant concrete endpoint are prepared. Final Edge76/PG90/mobile162/
1906/22/web86/780 (one existing skipped), focused6/105 and all types/lint/target/format/
diff PASS. This supersedes historical incomplete D4 notes above. Next D13A.5 client
hydration/cache/shared-only analysis/offline/review integration, GPT-6.1 Sol / High;
not started. Candidate policy remains unqualified; measured model quality/full device
acceptance and live enablement stay D7/8 gates. No hosted/provider/source publication.

D13A.5 first client checkpoint complete locally October10: dormant web protocol2
batch hydration/review snapshot3, decimal metadata, stable session/revision snapshots,
following private-action preflight and read-only legacy projection compatibility.
Final web92/820 with explicit benchmark/zero skipped, mobile162/1907/22 with coverage,
affected types/root+web+domain lint/Edge76/check/format/diff PASS. Evidence:
[web reads checkpoint](../tasks/shared-dictionary-cefr/evidence/D13A-web-reads-20261010.md).
D13A.5 mobile SQLite storage checkpoint complete locally October10: additive schema17,
owner-scoped effective/head cache, exact decimal cursors, persistent refresh fences and
atomic dependency/reference/debt/page commit. File-backed interruption/restart/rollback/
owner/pending-queue and405-card batching regressions pass. Final mobile163/1933/22,
focused3/53, both mobile types/root lint zero warnings/source format/diff PASS. All102
prior source/37 mirror hashes preserved. Evidence:
[mobile storage checkpoint](../tasks/shared-dictionary-cefr/evidence/D13A-mobile-storage-20261010.md).
Storage is not yet wired to runtime sync/materialization/status/native review. Next
D13A.5 runtime capability v2, bounded owner/session-fenced sync, complete affected-entry
refreshes, typed projection/status and frozen sessions, GPT-6.1 Sol / High. Shared-only
Analyze again, web recovery and following performance remain later checkpoints; D7/8
real-model/device/acceptance/release gates remain. No provider/hosted/Git publication,
real card conversion or enablement occurred; pending legacy payloads stay preserved.

D13A.5 mobile v2 sync adapter checkpoint complete locally October10; see
[adapter evidence](../tasks/shared-dictionary-cefr/evidence/D13A-mobile-sync-20261010.md).
Default-OFF capability2/effective2/change2 reads, durable pre-request debt, bounded
entry expansion, captured-owner guards and atomic page acknowledgement are prepared.
Final mobile164/1972/22 with coverage/zero skipped, focused3/70, types/root lint zero
warnings/format/diff PASS. Five source/test files local-only;110 of111 previous hashes
and37 mirrors preserved, with one declared repository owner-guard extension. Adapter
is not wired to application facade/materialization/status/private-action consumers.
Next coordinated runtime integration and immutable active/preparing native reviews,
GPT-6.1 Sol / High. Legacy push/receipts/private payloads and learning remain protected;
mode restoration requires explicit reconciliation. Shared actions/web recovery/following
performance and D7/8 real-model/device/release gates remain. No external operation.

D13A.5 coordinated mobile runtime checkpoint complete locally October10; see
[runtime evidence](../tasks/shared-dictionary-cefr/evidence/D13A-mobile-runtime-20261010.md).
Default-OFF v2 facade/materialization/status, atomic verified v1 receipt acknowledgement,
old-to-v2 generation debt handoff, private-action preflight/write fences and preparing
review snapshots integrated. Dictionary capability failure retains protections/debt and
allows independent acknowledged learning delivery. Final mobile166/2015/22 with coverage,
zero skipped/todo, focused10/271, both types/root lint zero warnings/scoped format/diff PASS.
Forty-one source/test files local-only;108 of115 prior sources preserved plus7 extensions,
149 union;37 mirrors/47 sealed artifacts unchanged. Shared-only Analyze again/receipts,
following new-word/import/transfer2/reconciliation, web offline/account-return recovery and
following review performance/parity remain. Next shared action/receipt recovery checkpoint,
GPT-6.1 Sol / High for Auth/permission/paid retry/receipt/cache invariants. D13A.5 remains
in_progress, D7/8 acceptance/release separate. No external/paid/hosted/Git/EAS/release/device/
automation or real card conversion; new flags OFF.

D13A.5 shared analysis client journal foundation complete locally October10; see
[journal evidence](../tasks/shared-dictionary-cefr/evidence/D13A-analysis-client-20261010.md).
Exact command/receipt state and dormant transport ports, mobile additive schema18 and
browser owner-scoped metadata/exclusive locks persist one-shot claims before dispatch.
Submitted operations recover through read-only actor receipt RPC without automatic paid
retry; receipt persists before synthetic refresh. No UI/production SDK/cache integration
or fresh-attempt/history/quarantine reconciliation API. Mobile167/2045/22 with coverage,
focused3/59; web93/835 with opt-in benchmark, focused1/15; zero skipped/todo, four types,
root/web/domain lint zero warnings/scoped format/diff PASS. Thirteen source/test files
local-only,144 of149 prior hashes preserved with5 extensions/8 newfiles,157 union;
37 mirrors/47 artifacts unchanged. Next trusted actor availability (OFF), platform SDK/
Auth, shared-only action/read-only status UI, explicit new attempts/history/reconciliation
and shared cache hydration, GPT-6.1 Sol / High for coupled Auth/authorization/paid retry/
receipt/cache invariants. D13A.5 in_progress; broader following transition/recovery/
performance and D7/8 acceptance/release remain. No external/provider/paid/hosted/Git/EAS/
release/device/automation or real conversion, flags OFF.

D13A.5 actor/SDK/publication adapter checkpoint complete locally October10; see
[adapter evidence](../tasks/shared-dictionary-cefr/evidence/D13A-analysis-sdk-20261010.md).
Self-only trusted actor read, captured SDK/Auth owner lifetime, mobile retry bypass,
complete validated mobile publication cache/debt and validated web snapshots are wired
behind default-OFF gates. No shared UI/new-attempt/history/quarantine resolution yet.
Mobile168/2070/22 with coverage, web94/851 including opt-in benchmark (testTimeout30000),
PG95/95 across seven selected modules through new migration; zero skipped/todo. Target
generate/check, types/lint/format/diff PASS; initial failures retained/repaired. Twenty
source/test files local-only,149 of157 preserved with8 extensions/12 additions,169 union;
37 mirrors/47 artifacts unchanged. Next shared-only action/read-only recovery/status UI,
web snapshot application/cache invalidation and explicit fresh-attempt/history/quarantine
reconciliation, recommended GPT-6.1 Sol / High for Auth/UI/nonce/paid uncertainty/cache
ordering. D13A.5 in_progress; broader following transition/recovery/performance and
D7/8 qualification/device/release remain. No provider/paid/hosted/real conversion/Git/EAS/
release/device/automation action, flags OFF. Benchmark long tasks are not acceptance.

D13A.5 shared action/status UI checkpoint complete locally October10; see
[UI evidence](../tasks/shared-dictionary-cefr/evidence/D13A-analysis-ui-20261010.md).
Mobile/web following details expose explicit shared analysis and saved read-only status;
validated visible content preserves current progress/mode/newer heads, current route
refresh and persistent Auth ABA latch across props changes. Submitted IDs never POST
again. Fresh-attempt/archive/history/quarantine reconciliation remains next. Mobile171/
2111/22 with coverage, web96/865 including opt-in benchmark; zero skipped/todo. Types/
lint/format/diff PASS, initial failures repaired/retained; backend unchanged, Edge76/PG95
carried only. Fifteen source/test paths local-only,165 of169 prior sources preserved,
4 extensions/11 additions,180 union;37 mirrors/47 artifacts unchanged. Next explicit
fresh-attempt/archive/history/quarantine reconciliation with atomic owner/word archive/
claim, preserved unresolved IDs and no automatic paid retries: recommended GPT-6.1 Sol /
High for coupled owner/storage/durable nonce/uncertain outcome invariants. D13A.5 remains
in_progress; following transition, broader web recovery, review performance/parity and
D7/8 model/device/review/release acceptance remain. Gates OFF, no external operation;
Node benchmark long tasks remain and do not constitute performance acceptance.

D13A.5 explicit attempts/archive/local history checkpoint complete locally October10;
see [attempt evidence](../tasks/shared-dictionary-cefr/evidence/D13A-analysis-attempts-20261010.md).
Fresh terminal server receipt, immutable request/fence/result, owner/permission/current
head and publication-boundary checks precede atomic archive/new intent and distinct
one-shot dispatch. Unknown/null/busy/quarantined IDs stay reserved; explicit read-only
checking can observe server reconciliation, no client privileged API or automatic paid
retry. Native schema19 preserves v18 slots; browser first archive writes a v3 envelope
under the existing lock and old readers fail closed. Local history only, bounded capacity
with no eviction/clear. Final mobile171/2132/22, web96/873 including benchmark; zero skipped/
todo, types/lint/format/diff PASS. Twenty source/test paths local-only,161 of180 preserved,
19 extensions/1 addition,181 union;37 mirrors/47 artifacts unchanged. Backend unchanged;
Edge76/PG95/target checks carried only. Next following new-word/import/transfer2 adoption/
recovery, recommended GPT-6.1 Sol / High for owner/intent/reference/cache and mixed-protocol
preservation. D13A.5 remains in_progress; broader recovery/server-history/private-mode/
review-performance and D7/8 qualification remain. Gates OFF; no external operation.

D13A.5 following import client journal checkpoint complete locally October10; see
[report](../tasks/shared-dictionary-cefr/evidence/D13A-following-import-client-20261010.md).
Native schema20/browser owner journals and explicit offline metadata queues retain exact
v2 roots/nonces, immutable receipts and CAS/cancellation fences without modifying v1,
personal words or SRS. SDK/Auth account-ABA checks and transfer2 exact published-content
planning/native preview pass; private-copy downgrade is rejected. Final mobile174/2161/22,
web98/887 including benchmark, zero skipped/todo; types/lint/format/diff PASS.23 paths,
173 prior sources preserved/8 extensions/15 additions,196 union;37 mirrors/47 artifacts
unchanged. Local-only, gates OFF, no external action. Client APIs are prepared; adoption
UI, trusted dependency retrieval, durable transfer documents/selection mapping and
personal/shared hydration remain next. Recommended GPT-6.1 Sol / High for document/nonces/
Auth/reference/cache recovery. Broader private/mode/recovery/review-performance and D7/8
acceptance remain; node loaded-host long tasks do not qualify release performance.

D13A.5 durable transfer2 storage/workflow checkpoint complete locally October10; see
[report](../tasks/shared-dictionary-cefr/evidence/D13A-transfer-storage-20261010.md).
Native schema21/separate browser sessions preserve whole originals, exact index-to-nonce
plans and public dependency snapshots before explicit v2 reservation/delivery. Private
or missing-reference differences remain for review; failed reads keep a draft. Owner
ABA/atomic native/cross-tab/restart/uncertain-reply cases pass without v1/SRS rewrites.
Final mobile176/2180/22 coverage, web100/899 benchmark, zero skipped/todo. Types/root-web/
changed-domain lint/scoped format/diff PASS; unchanged all-domain app-config.ts:171 any
remains outside the delta.19 paths,191 prior preserved/5 extensions/14 additions,210 union;
37 mirrors/47 artifacts unchanged.10 owner sessions/100 selections/1000000 UTF-16 units,
no eviction. Local-only, gates OFF, no external operation. Adoption UI/personal hydration
remain next: explicit transfer2 selection/review/status and owner-fenced personal pull/
shared hydration/web refresh after receipts, preserving placement/SRS/tombstones.
Recommended GPT-6.1 Sol / High for UI/Auth/nonces/personal-row/cache boundaries. Broader
source/private/mode/history/review-performance and D7/8 acceptance remain.

D13A.5 explicit transfer2 selection/retained UI checkpoint complete locally October10;
see [report](../tasks/shared-dictionary-cefr/evidence/D13A-transfer-ui-20261010.md).
Mobile/web schema2 uses explicit selection/full-original save before shared-reference
verification, v2 queue/import and same-ID state checks. Private/unresolved differences
stay for review; no legacy spelling/private-copy downgrade. Mount/restore read local
journals only. Mounted epoch/Auth ABA/flag withdrawal fence delivery after reservation,
retaining original nonces. Server confirmation still requires local dictionary loading.
Full mobile178/2198/22 coverage, web101/905 benchmark, zero skipped/todo; focused3/30+4/20;
types/root-web zero-warning lint/changed-domain lint/scoped format/diff PASS. Initial
fixture/type/ref/label checks repaired; token-equal trivia format recorded.14 paths,
209 prior preserved/1 extension/13 union additions,223 union;353 entry paths and37 mirrors/
47 artifacts unchanged. Local-only/gates OFF, no external operation; node long tasks
remain unqualified. Targeted personal pull/shared hydration/web refresh remain next,
recommended GPT-6.1 Sol / High for Auth/personal-row/SRS/tombstone/cache boundaries.
Preserve newer placement, local learning and tombstones; recover failed hydration with
original nonces, no fabricated rows/broad sync push. Broader source/recovery/private/mode/
history/review-performance and D7/8 acceptance remain; D13A.5 stays in_progress.

D13A.5 explicit import hydration checkpoint complete locally October10;
see [report](../tasks/shared-dictionary-cefr/evidence/D13A-import-hydration-20261010.md).
Receipt-bound current personal reads and complete shared dependencies now support explicit
mobile/web loading with original IDs, owner/epoch fences, atomic SQLite debt and current-
route refresh. Preserve newer placement, pending learning and tombstones; no semantic merge
or private fallback. Full mobile179/2227/22 and web102/917 pass; later syncManager helper
extractions have final2/110 affected tests/types/lint.16 paths/228 source union,419 entry
hashes and37 mirrors/47 artifacts preserved. Local-only/OFF; no external operation.
Next D13A.5 recovery/cancellation UI and fresh placement CAS, recommended GPT-6.1 Sol / High.
Identity-conflict resolution, missing local collection sync, broader source adoption,
private/mode/history and representative review performance/device parity remain.

D13A.5 recovery/cancellation UI checkpoint complete locally October10;
see [report](../tasks/shared-dictionary-cefr/evidence/D13A-recovery-ui-20261010.md).
Explicit fresh placement/version and selected destination, durable recovery/cancel requests,
same-ID pending retries and mounted/Auth guards now connect both clients. Conflicts require
new status/choice; cancellation preserves existing cards/learning/originals. Existing
recovery/cancel works with creation OFF; uncreated gated/deleted unavailable rows fail closed.
No original replay after related operations or automatic loading. Full
mobile179/2245/22 and web102/922, types/lint/format/diff pass;10 extensions/228 source union,
475 entry hashes,37 mirrors/47 artifacts preserved. Two UI tests formatted afterward;
token equality and final affected native1/12/web1/7 pass, no production change after full.
Local-only/OFF/no external operation.
Next D13A.5 explicit existing-card resolution for identity-conflict receipts, recommended
GPT-6.1 Sol / High for current identity/owner/learning/cache boundaries. Broader source
adoption/private/mode/server-history/review-performance and D7/8 acceptance remain open.

D13A.5 existing-card identity-conflict resolution complete locally October10;
see [report](../tasks/shared-dictionary-cefr/evidence/D13A-identity-resolution-20261010.md).
Explicit existing IDs from immutable original/recovery conflicts, current root version,
owner/deletion/shared follow meaning/mode now support native targeted personal/shared
hydration and web refresh. Learning/queues/newer rows/tombstones retained; no original
replay, semantic merge or private conversion. Full mobile179/2273/22 and web102/939 pass;
after web fixture-only unreachable comparison repair, final1/28 and web types pass. No
production/mobile-test change after full. Types/lint/format/diff PASS;13 extensions/228
source union,519 entry hashes,37 mirrors/47 artifacts unchanged. Local-only/OFF/no external
project operation. Next D13A.5 official starter-pack following adoption, recommended
GPT-6.1 Sol / High for provenance, durable IDs, owner/placement/learning boundaries. Broader
new-word/shared source/private/mode/server-history/review-performance and D7/8 remain open.

D13 observation of the existing release remains **GPT-6 Astra / High** and may
continue at meaningful checkpoints, without blocking D13A.1–7 or starting a monitor.
The new observation window is about newly activated behavior; old release uptime
cannot prove it. Resolve actual regressions when found, do not merely wait7 days.

D13A.1 must map changes to actual packages/domain, word_content_state and revision/head
contracts, D06 tooling, mobile wordRepository/shared-reanalysis/sync, web persistence/review,
Edge/cache resolution and official/shared import/export paths. It must expose any
remaining product choice rather than silently broaden publication or linking.
D13A.2 must account for rootf97a733 plus ten local source/test files versus merged
main44141e0 and build85 source0a3bae1. Publishing OTA did not merge these repairs.
Source push/PR/merge (including automatic web deployment) requires its own scope.

D13A.7 mandatory acceptance scenarios:

- Two owners reference one meaning; a full_access user invokes common reanalysis,
  v2 publishes once, and both receive identical analysis after sync while exact
  personal IDs/SRS/history/collections remain unchanged. No private analysis copy.
- Administrator has the same analysis path; read_only/unauthenticated/revoked users
  cannot trigger it or bypass quotas through another endpoint. Test authorization
  at acceptance and publication; failed/duplicate/concurrent calls preserve the head
  and correct usage accounting. Administrator rollback is separately protected.
- Offline learning based onv1 whilev2 publishes; retry/cold start/two-device and
  account changes preserve all learning and converge onv2 without per-card fetches.
- A review started onv1 finishes consistently; the next session seesv2. Missing or
  corruptv2 dependencies keepv1 usable until recovery, with no false-success cursor.
- Concurrent publications cannot overwrite a newer head with a stale result;
  rollback tov1 emits a newer event and preserves post-publication learning.
- Old-card exact matches preserve content; approved differing matches change only
  listed analysis fields, with protected originals retained. Unreviewed/ambiguous
  rows are skipped. Interrupted apply, concurrent reviews and rollback preserve
  every personal identity, collection, history and pending learning operation.
- Build85/older pending private-edit commands are reconciled without silently
  publishing personal content, discarding pending work, or resurrecting a personal
  analysis store on migrated cards. No guessed link from spelling/AI score.
- Canonical imports and exports preserve meaning/privacy; ordinary personal state
  writes cannot alter shared content or another owner's progress. No new notes UI.
- CEFR stays OFF; no hidden provider work. Same-environment review measurements meet
  the existing performance gate, without per-card dictionary requests.

Exit: the common analysis is automatically delivered to references, permitted users
can reanalyze it through the validated shared operation, personal learning stays
intact, and no new per-user linguistic overrides are created. Planned old-card
cohorts are linked with approved deltas or explicitly recorded as unresolved/accepted
scope deferrals; unresolved rows retain their old data and must not be described as
fully migrated. Release/rollback/observation support the separate retirement gate.

### D14 — Complete normalization after the adoption gate

Depends on D13 plus D13A.7–9, current adoption/reconciliation evidence and separately
approved retirement. Keep this pending while any supported returning client needs
legacy storage. Publication of the new feature does not itself authorize removal.

| Checkpoint                                                               | Model       | Effort |
| ------------------------------------------------------------------------ | ----------- | ------ |
| D14.1 — Adoption and returning-client reconciliation gate                | GPT-6 Astra | High   |
| D14.2 — Remove redundant authoritative content for verified linked cards | GPT-6.1 Sol | High   |
| D14.3 — Retire verified-unused compatibility writers/cache paths         | GPT-6.1 Sol | High   |
| D14.4 — Preservation/performance regression and final review             | GPT-6 Astra | High   |

- Verify supported clients no longer depend on legacy full-content writes/reads;
  document the supported upgrade/reconciliation path for returning older devices.
- Remove redundant authoritative server content for linked cards; preserve private
  protected legacy exceptions until resolution and any measured, explicitly
  non-authoritative read projection. Do not retain per-user analysis as the target.
- Remove the temporary compatibility writer when safe, simplify repositories and
  retire obsolete cache paths only after checking all consumers.
- Re-run migration, private-edit, old-device, learning and performance tests. Do
  not rename personal IDs or move SRS merely for schema aesthetics.

Exit: shared content has one canonical authority, personal rows hold references and
private state, mobile retains an offline cache, and no active write path creates
unnecessary full-content server copies. If client adoption blocks this gate, label
the state explicitly as functional rollout complete / storage retirement pending.

## 5. Model switching and handoff discipline

October10 owner requirement: name **model + reasoning effort for every next
checkpoint**, including review, migration, release and observation, before starting
and in its handoff. The D13A/D14 tables are the current forward schedule. High is
the default for this cross-client/data-preservation work; no xhigh/Max/Ultra by
habit. Reassess only when a concrete unresolved problem warrants it.
Assignments use the existing project routing and the
[official model guide](https://developers.openai.com/api/docs/guides/latest-model?model=gpt-6.1-sol)
checked October10: Astra for demanding reasoning/review, Sol for implementation;
the task-by-task choices are engineering judgment, not measured benchmarks.

- D01-D02 use **GPT-6 Astra / High**. From 2026-10-02 (AUTH-16), the user
  authorizes autonomous model/effort selection and switching for this task.
  Announce changes and use supported controls without asking again; record only
  confirmed switches and report any unavailable control. Future Sol work uses
  **GPT-6.1 Sol**, including D09 / High. Historical actual-use records are retained.
- Use **GPT-6.1 Sol / High** for cross-layer business logic and synchronization.
  Use **GPT-5.6 Terra / High** for bounded client/contract integration after the
  architecture is fixed, and **Terra / Medium** for mechanical fixtures/docs/types.
- **GPT-5.6 Luna / Medium** is optional for isolated repetitive edits with explicit
  tests, not identity resolution, RLS, migration policy, or sync protocol design.
- Escalate to **Astra / High** after two unsuccessful attempts on the same
  cross-layer defect, or immediately if an invariant/data-loss risk is unclear.
  **Astra / Extra High (`xhigh`)** is reserved for an unresolved concurrency or
  migration proof after a focused High investigation, not a default for every task.
- No default Max/Ultra. Higher effort and repeated full-context runs can spend
  allowance without improving a mechanically constrained task.
- Each completed stage records commit/PR, touched contracts, tests/results,
  remaining risks, rollback implications, next step, and recommended model.
  Use a compact handoff rather than rereading the entire historical conversation.
- Run targeted tests during iteration and full required gates at review boundaries;
  do not rerun unchanged broad suites without a reason.

These assignments apply the documented model roles and reasoning guidance to this
repository; they are recommendations, not benchmark results for this project.
See [official model guidance](https://learn.chatgpt.com/docs/models).

## 6. Weekly allowance and cost estimate

One weekly-budget equivalent (W) means 100% of this account's currently configured
main weekly allowance. It is not a token amount, a message count, or a calendar
week of engineering work. Other tasks on the same account consume that allowance.

Planning snapshot: main allowance used 62%, remaining 38%, window 10,080 minutes;
next reset reported for 2026-09-19 13:26 Europe/Amsterdam. The account API reports
`prolite`; this is an internal label, not proof of a particular advertised quota
multiplier. The user reports a Pro subscription costing EUR 114/month. We have not
verified an invoice or an exact mapping from that price to weekly capacity.

The official documentation says model, task complexity, context, reasoning,
tool use and caching affect consumption. Its message ranges are five-hour
estimates, not a fixed weekly token allowance. Do not derive this project's weekly
cost from subscription price or API token prices.
See [official usage/pricing guidance](https://learn.chatgpt.com/docs/pricing).

**Low-confidence planning envelope, not a measured forecast:** reserve **4–6 W**
for D01–D14 using the model mix above. Think of **2–4 W** as an initial working
hypothesis plus approximately **2 W** for migration/sync surprises and rework.
This estimate has no calibrated project-specific consumption baseline yet and
must not be treated as a guarantee that 6 W will be enough. If the user wants a
firm ceiling, use a stop-and-replan budget rather than promise completion within it.

Do not promise the same envelope if every task runs on Astra High/Extra High,
multiple agents, accelerated speed, or very long sessions. Conversely, safely
isolating routine work and retaining existing SRS can reduce consumption. No
reliable numeric multiplier for those alternatives was measured here.

Calibration procedure:

1. Record used percentage, reset boundary, model/effort and scope before/after
   D01 and one representative implementation slice after design approval.
2. Treat a reset as a window boundary, not negative consumption. Separate unrelated
   account use and do not assume credits equal remaining included allowance.
3. Compare observed usage for completed slices with remaining work of similar
   risk. Reforecast after D03 and again after D08, when migration/sync uncertainty
   has materially decreased.
4. If the first meaningful vertical slice costs much more than budgeted, stop and
   present scope/model options instead of silently exhausting the reserve.

The CEFR worker's runtime provider charges, hosting/database costs, and any mobile
build costs are **separate** from the development assistant's weekly allowance.
Estimate runtime enrichment only after counting eligible unique inputs and a small
approved provider sample; cap it independently. This plan does not authorize extra
credit purchases or unlimited paid enrichment.

## 7. Implementation references

- [Design summary](../brainstorms/2026-09-12-shared-dictionary-brainstorm.md)
- [Existing learning protocol](../learning-sync-protocol.md)
- [Existing learning rollout boundaries](../learning-sync-rollout.md)
- [Official content design](../brainstorms/2026-09-11-official-content-catalog-brainstorm.md)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase views and table security](https://supabase.com/docs/guides/database/tables)
- [Scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions)

Current Supabase documentation was checked through Context7 for RLS/view behavior
and Cron/Vault scheduling. Expo documentation was queried for SQLite migrations;
the retrieved migration examples mixed application SQLite and framework internals,
so they are not an implementation recipe. D07 must verify the installed
`expo-sqlite` transaction API and relevant SDK documentation before coding. Likewise,
read the installed Next.js documentation and query Context7 for any changed API
when implementing D09. No external framework API is being implemented by this plan.

## 8. Resume in a new session

Open the same local project checkout and send `/repo` or `/repo continue` as a
message. `AGENTS.md` routes it to the saved task. This is not a registered built-in
slash menu command. If the client does not send it as text, use the portable prompt:

> Resume the active task using docs/session-starter-prompt.txt. Read its handoff
> and current stage card, verify the actual checkout and permissions, announce
> the recommended model/effort, and continue the first incomplete checkpoint.
> Do not restart completed stages. Save a new checkpoint before ending.

For status only use `/repo status`; to save progress and stop use `/repo pause`.
No automatic weekly wake-up is configured or required: resume manually after the
quota resets. Read fresh quota values; historical percentages in this plan expire.

### Stage launch cards

Each card repeats its stage scope as numbered checkboxes and lists required input
files, dependencies, model/effort, exit gate, evidence fields and pause instructions.
If scope changes, update both the corresponding plan section and stage card;
statuses and completion evidence live in the handoff/cards, not in this plan.

| Stage | Fresh-session card                                                                         |
| ----- | ------------------------------------------------------------------------------------------ |
| D01   | [Audit and baseline](../tasks/shared-dictionary-cefr/steps/D01.md)                         |
| D02   | [Architecture decisions](../tasks/shared-dictionary-cefr/steps/D02.md)                     |
| D03   | [Additive schema](../tasks/shared-dictionary-cefr/steps/D03.md)                            |
| D04   | [Shared contracts](../tasks/shared-dictionary-cefr/steps/D04.md)                           |
| D05   | [Server compatibility](../tasks/shared-dictionary-cefr/steps/D05.md)                       |
| D06   | [Backfill rehearsal](../tasks/shared-dictionary-cefr/steps/D06.md)                         |
| D07   | [Mobile storage](../tasks/shared-dictionary-cefr/steps/D07.md)                             |
| D08   | [Mobile sync and UI](../tasks/shared-dictionary-cefr/steps/D08.md)                         |
| D09   | [Web integration](../tasks/shared-dictionary-cefr/steps/D09.md)                            |
| D10   | [Catalog and imports](../tasks/shared-dictionary-cefr/steps/D10.md)                        |
| D11   | [CEFR enrichment](../tasks/shared-dictionary-cefr/steps/D11.md)                            |
| D12   | [Integrated verification](../tasks/shared-dictionary-cefr/steps/D12.md)                    |
| D13   | [Controlled release](../tasks/shared-dictionary-cefr/steps/D13.md)                         |
| D13A  | [Automatic updates and old-card transition](../tasks/shared-dictionary-cefr/steps/D13A.md) |
| D14   | [Retirement and normalization](../tasks/shared-dictionary-cefr/steps/D14.md)               |

### What survives a pause

After every meaningful checkpoint, save completed work, actual test results,
branch/revision and uncommitted files, approved decisions, unresolved operations,
and the exact next checkpoint/action. A pause halfway through D08 resumes halfway
through D08, not at D01. A completed stage points to the next stage and its model.

Default execution is one stage at a time. A model switch, weekly allowance reset,
or new conversation does not change progress or grant additional permissions.
The [runbook](../session-runbook.md) covers hard interruptions and stale evidence.

### Persistence boundary

At setup these files are saved locally, not committed or pushed. They survive a
new session in the same checkout. A fresh worktree, clone or another computer
requires an authorized commit containing the task bundle (and a base that includes
it), or explicit transfer. Do not claim branch-portable recovery until that has
been verified. Record the actual persistence level in the handoff each session.

D13A.5 official starter-pack following adoption complete locally October10; see
D13A-official-import-20261010.md/json. Raw approved originals and stable entry IDs bind
exact pack/version/manifest/content to optional immutable journal provenance and separately
verified published references. Official-pack v2 intents reuse existing explicit queue,
receipts/conflicts/recovery/hydration; no spelling merge, private fallback, SRS copying or
collection creation. Native/web legacy paths guarded in new mode; initial preparation uses
fresh Auth, saved drafts/roots resume offline. Full native181/2304/22 and web104/967,
types/lint/format/diff PASS; 562 entry hashes, 246 source union, 37 mirrors/47 artifacts kept.
Local-only/OFF, no external action. Next explicit shared-collection following source adoption,
recommended GPT-6.1 Sol / High for token provenance, durable identity, owner/learning guards.
Broader new-word/private/mode/history/performance and D7/8 acceptance remain; D13A.5 stays
in_progress. Always announce the next model and reasoning effort, reaffirmed by the owner.

D13A.5 explicit shared-collection following source adoption complete locally October10;
see D13A-shared-import-20261010.md/json. Full v2 originals bind explicit share token/source
collection/all source IDs to immutable journals and separately verified published meanings.
Fresh source/Auth/ABA/mounted/gate checks, native explicit preview, owner remount/owned
targets and native/web source routes reuse existing receipt/conflict/hydration/recovery.
Legacy writes fenced in following mode; no spelling merge, private/v1 fallback, learning
copy or automatic publication. Native183/2330/22 coverage, web107/994 benchmark, final
focused6/103 and6/46/types/zero-warning root-web-changed-domain lint/scoped format/diff PASS.
Final relevant full-run sources exact;635 entry hashes,264 source union,37 mirrors/47
artifacts preserved. Backend/SQL/contracts unchanged; earlier checks carried only. Initial
fresh online Auth and unchanged source preparation needed; saved sessions resume offline.
Node long tasks unqualified. Local-only/OFF, all runners exited, no external operation.
Next new-word following source adoption, recommended GPT-6.1 Sol / High; always state
model/effort. Broader private/mode/server-history/review-performance/D7/8 acceptance remain;
D13A.5 in_progress, D13 open/D14 pending. Use local fixtures only for shared lookup/analysis/
validated creation and durable adoption; provider/paid/publication/hosted actions require
separate authorization.

Final format follow-up: one native test required a second whitespace-only Prettier pass.
Full native183/2330/22, test-inclusive types and affected zero-warning lint repeated on
final bytes; source manifest mobile-full-source-verified.json and logs retained.
No production/web source change after their passing full checks. All runners exited.

2026-10-10 — D13A.5 new-word published-meaning lookup/adoption complete locally.
See D13A-new-word-20261010.md/json and reports/d13a5-new-word-20261010. Native add and both
web add routes retain every exact-lemma published candidate, explicit selection/full refs
and content, then reuse durable v2 import/receipt/conflict/recovery/hydration. Fresh owner/
Auth ABA/input/mount/gate/capability guards; read-only adoption/owned preferences retained,
legacy provider/private saves blocked. No automatic analysis, personal fallback, collection
creation or batch completion. Native186/2380/22 coverage, web111/1045 benchmark; zero skipped/
todo, focused8/131 and6/64, final types/lint/format/diff pass and exact full-source manifests.
703 entry hashes,35 current paths (6 extensions/29 additions;14 new/15 first audited),293
source union;37 mirrors/47 sealed artifacts preserved. Generated schema/SQL/Edge unchanged;
prior backend checks carried only. Node long tasks192–457ms unqualified; local-only/OFF.
All runners exited; no external/provider/paid/hosted/Git/publication/release/device/automation.
Next D13A.5 explicit unresolved-new-meaning resolution/validated creation contract and local
backend fixtures, GPT-6.1 Sol / High. Existing analysis2 requires an owned word/entry/head;
service-only persist_canonical_dictionary_analysis_v1 cannot replace new validated creation.
Define durable owner/query/meaning/anchor/provenance/permission/quota/nonces/unknown outcomes
before connecting no-match submission and post-receipt batch completion. Unresolved input,
aliases/inflections still have no durable creation operation. Provider/paid/publication/hosted/
flag actions require separate authorization. Broader private/mode/history/review-performance/
D7/8 remain; D13A.5/D13 open, D14 pending. Always announce next model and reasoning effort.

### October10 D13A.5 new-meaning contract checkpoint

The [new-meaning resolution/creation contract](../tasks/shared-dictionary-cefr/D13A-new-meaning-contract.md)
separates immutable private owner intent from reviewed server meaning identity and
new-entry publication. Domain parsers and journal reducers preserve original input,
nonce/owner/fence/result identity and unknown-outcome quarantine. This is contract
preparation, not a backend creation endpoint or no-match UI completion. Next implement
dormant additive SQL operations and local authority/quota/concurrency/publication
fixtures before client storage/transport/UI. GPT-6.1 Sol / High; D13A.5 remains
in_progress, D13 open, D14 pending. No live/paid/source/release authorization added.

## October10 creation acceptance checkpoint and remaining plan

See [report](../tasks/shared-dictionary-cefr/evidence/D13A-creation-acceptance-20261010.md) and [hashes/results](../tasks/shared-dictionary-cefr/evidence/D13A-creation-acceptance-20261010.json).

Dormant reviewed-identity/resolution and creation acceptance/status backend checkpoint
complete locally; D13A.5 remains in_progress. Migration1800 retains private original
intent, binds service-reviewed source/identity evidence and authorizes owner acceptance
with current permission, profile and shared quota. Replay is immutable; concurrent owners
accept one reviewed sense once, with durable zero-charge busy receipts. Accepted draft/
anchor is invisible to ordinary clients and produces no head/event or personal/SRS write.
First revision_no1 is separate from the global positive BIGINT head cursor. Busy retry
requires a new command nonce. Dispatch/validation/publication/storage/forms remain pending.

Final PostgreSQL full39 files/443 tests and focused35 creation +10 existing RLS PASS;
native187/2426/22 snapshots with configured coverage and web112/1091 benchmark PASS,
zero failed/skipped/todo. Final production/test/web/domain/contracts types, root/web/
package zero-warning lint, target generation/check and scoped format/diff PASS. Final
relevant full source manifests match. Native initdb SYSV ENOSPC required an explicit cached
Docker fallback with network none, tmpfs and no ports/hosted env; final process readiness
and listen_addresses='' corrected initialization races/socket-only RLS. Initial fixture/
lint errors and unchanged native transfer test timeout were repaired/retested with
SQL constraints and test timeouts preserved. Attempts retained. A partial DB run was stopped
for harness repair; only its orphan task-owned container was removed. All runners exited.

862 entry hashes verified;12 current sources (8 extensions/4 additions),301 source union;
37 historical mirrors/47 sealed artifacts unchanged. No external/provider/paid/hosted/
publication/Git/release/EAS/device/automation action; all new gates OFF, shared_analysis
FALSE, creation profile and roles/policies unseeded, CEFR OFF. AUTH27–29 consumed.
Node benchmark remains unqualified; no browser/native/device/performance acceptance.

Next **D13A.5 — GPT-6.1 Sol / High recommended**: creation dispatch/result/independent
validation and atomic first publication backend with local fake-provider fixtures.
Extend accepted-only status/lease with immutable attempt/result accounting, unknown-outcome
quarantine and late reconciliation; no unsafe redispatch/takeover. Before dispatch is
possible, retain/redact unknown/paid accounting across Auth deletion instead of cascading
it. Bind validation to reviewed identity/anchor/source/profile/fence/result and fresh
permission/availability. Commit revision_no1 plus one global head/event atomically, return
exact publication receipt, write no personal/SRS state. Generate/check target contract.
Test first publication after other entries advanced the global cursor, including cursors
above JavaScript safe integer range; never equate head_sequence with revision_no1.
Then add SQLite/browser durable creation storage and fresh-owner transport before connecting
no-match forms; native batch completion still requires explicit authoritative adoption.
Broader private/mode/history/account-return/review parity/performance remain. Use local
fixtures only; live provider/paid/hosted/publication/flag/role/Git/release needs its own scope.
Always announce next model/effort; no picker switch is claimed.

Remaining numbered checkpoints: **10**, including current D13A.5; this is not a
work-session count. D13 remains in_progress and D14 pending.

| Checkpoint | Remaining deliverable                                                                           | Recommended model | Effort |
| ---------- | ----------------------------------------------------------------------------------------------- | ----------------- | ------ |
| D13.6      | Complete current release observation/adoption and native offline-return evidence                | GPT-6 Astra       | High   |
| D13A.5     | Finish creation backend, storage/forms, recovery/private-mode/history/review parity/performance | GPT-6.1 Sol       | High   |
| D13A.6     | Reviewed old-card mapping and migration rehearsal preserving IDs, SRS, history and originals    | GPT-6.1 Sol       | High   |
| D13A.7     | Dedicated contract/code/migration/end-to-end/model/device acceptance review                     | GPT-6 Astra       | High   |
| D13A.8     | Exact approved coordinated release/linking with backup, delta and rollback                      | GPT-6 Astra       | High   |
| D13A.9     | Observe newly activated behavior for at least7 days                                             | GPT-6 Astra       | High   |
| D14.1      | Gate old-client retirement and supported returning-client reconciliation                        | GPT-6 Astra       | High   |
| D14.2      | Remove redundant authoritative per-user content while preserving unresolved originals           | GPT-6.1 Sol       | High   |
| D14.3      | Remove verified-unused compatibility writers and caches                                         | GPT-6.1 Sol       | High   |
| D14.4      | Final migration, learning, older-device and performance regression/review                       | GPT-6 Astra       | High   |

## October10 creation generation journal checkpoint

D13A.5 remains in_progress. Local migration1900 provides a durable generation intent,
immutable result/hash and explicit late/unknown quarantine/reconciliation. Actor deletion
redacts durable owner identity while preserving paid accounting and unresolved leases.
Owner get/accept projects live status while original command receipts stay immutable.
Dispatch/result/reconciliation cannot write a public head/event or personal/SRS state.
All gates default OFF; no policy/profile or role seeded, and no provider HTTP adapter.

Final77 focused PostgreSQL tests and contract/native production+test/web types and target
generation/check PASS; final full40 DB files/475 tests PASS with zero skipped/todo,
source boundary exact; own temporary runners/containers closed. Prior full native187/2426/22 coverage
and web112/1091 benchmark are carried for unchanged runtime sources; five additive
service RPC declarations are the only public type changes. Existing dirty work and
all historical evidence preserved. No external/paid/hosted/Git/publication/EAS action.
See [current evidence](../tasks/shared-dictionary-cefr/evidence/D13A-creation-dispatch-20261010.md).

Next **GPT-6.1 Sol / High**: separately charged independent creation judgement plus
strict schema/media/identity/six-dimension semantic validation, immutable machine
provenance and atomic first revision_no1/global head event. Keep durable run FKs and
exact receipts; preserve registered source hash bytes if source columns are added.
The global cursor may exceed1 and JS safe integer range. Then explicit recovery,
durable SQLite/browser storage, fresh-owner transport and no-match forms/adoption.
The numbered remaining list above stays **10**, including current D13A.5; not a
session count. D13 observation remains open; D14 pending.

## October11 local creation judgement/first publication checkpoint

D13A.5 remains in_progress. Dormant migration2000 adds separately charged independent
judge, strict grounded derived validation and atomic first revision_no1/head/global
event with immutable receipt. Old UTC source evidence bytes and human/analysis guards
are retained; actor redaction preserves published proof and unresolved judge quarantine.
Seven service-only RPCs, private RLS/no direct table grants, default OFF and unseeded.
Final41 DB files/512 tests, focused114, isolated legacy ACL1, target/types/new-fixture
lint/format/diff PASS. Prior mobile/web runtime suites carried for unchanged bytes;
public generated contract reconstruction removes only seven additive RPC signatures.
Initial state-order/user setup and legacy trigger invoker ACL failures repaired and
retained; final full/focused repeated on exact source. No external/paid/hosted/Git action.
See tasks/shared-dictionary-cefr/evidence/D13A-creation-publication-20261010.md/json.

Next explicit reviewed/audited known-failure/review draft recovery with new run/fence/
nonce and per-attempt quota accounting; no unknown takeover/reassignment. Then local
fake HTTP creation worker, SQLite/browser durable owner storage, fresh async Auth/gate
transport, no-match forms and explicit authoritative published-reference adoption.
Broader mode/private/history/account-return/review/performance remain. GPT-6.1 Sol / High
recommended; no picker switch claimed. The numbered list remains10 including D13A.5;
D13 observation open/D14 pending, AUTH27–29 consumed. Gates/policies/roles stay OFF/unseeded.

### October11 local audited creation recovery checkpoint

D13A.5 remains in_progress. [Recovery evidence](../tasks/shared-dictionary-cefr/evidence/D13A-creation-recovery-20261011.md)
qualifies migration2100's same-surviving-owner terminal draft recovery. Immutable15-minute
administrator review binds fresh reviewed resolution, nonce, prior fence/accounting,
neutral source/anchor and current qualified policy. Explicit owner reservation atomically
charges one generation slot, creates a new run/fence and transfers the known lease.
Original attempts/validation/command receipts remain exact; unknown/actorless/active/
published/cross-owner cases are denied. Later generation/judge/publication use existing
strict independent proof, separately charged judge and revision1. No personal/SRS write
or automatic publication in recovery. New gate OFF, no real role/policy/profile seeded.

Final full42 PostgreSQL files/547 and focused149 (35 new+114 existing), isolated schema
repair1, target generation/check, types, changed-fixture lint/format/diff PASS. Exact179
DB source paths,995 baseline references,310 source union,37 mirrors/47 artifacts retained.
Previous native187/2426/22 and web112/1091 runtime suites/edge carried only; two additive
RPCs reconstruct prior generated bytes exactly. Initial SQL quote/lint/RPC fixture and
schema-rejection assumption repaired; diagnostic logs retained, no guard relaxed.
All runners exited/temporary resources zero; six QA containers untouched. Local-only,
no external/provider/paid/hosted/Git/release/EAS/device/automation. D13 open/D14 pending,
shared_analysis FALSE/CEFR OFF, AUTH27–29 consumed. Next D13A.5 fake HTTP creation worker,
SQLite/browser durable journals, fresh-owner transport/forms/adoption; broader mode/
history/account-return/review/performance remain. GPT-6.1 Sol / High;10 numbered
checkpoints remain including current D13A.5. Orphan reassignment/active-run abandonment
remain outside this recovery checkpoint; no implicit administrative takeover is added.

### 2026-10-11 — D13A.5 creation HTTP worker/local fake transport checkpoint

Completed strict normal/recovery HTTP orchestration through retained run IDs, isolated
caller/service clients, fresh Auth, committed one-shot generation/judge grants, derived
validation and first publication. No serve entrypoint/default paid transport or live action.
35 new PostgreSQL integrations and108 Deno tests PASS; prior full547 DB checks carried on
179 exact unchanged sources.8 source paths/317 union, historical mirrors/artifacts preserved;
all runners exited, own temporary Docker resources zero, six QA containers untouched.
See docs/tasks/shared-dictionary-cefr/evidence/D13A-creation-worker-20261011.md/.json.
D13A.5 in_progress;10 numbered checkpoints remain. Next durable SQLite/browser creation
journals, then fresh-owner forms/adoption. GPT-6.1 Sol / High recommended; no picker switch.
Concrete provider request/transport/profile qualification, mode/history/account-return/
review/performance and D13A.7/8 still open. New gates OFF/CEFR OFF/shared_analysis FALSE,
AUTH27–29 consumed; no additional provider/paid/hosted/role/flag/Git/release authority.

D13A.5 durable creation journal checkpoint complete locally October11; see
[D13A creation journal evidence](../tasks/shared-dictionary-cefr/evidence/D13A-creation-journals-20261011.md).
Shared strict envelope plus SQLite migration22/exclusive transactions and browser
one-owner key/Web Locks retain private original intent, owner/session tags, exact
ordinary/recovery command, submitted/uncertain status and separate publication/adoption
receipts. Fresh guards, atomic claims, immutable receipts/nonces, bounded storage and
no eviction/redispatch; no personal/SRS/cache hydration write. Native188/2451/22 with
configured coverage, web113/1117 with Node benchmark, focused107/72 and Edge108 PASS;
scoped types/lint/format/diff PASS. File-backed SQLite/synthetic locks do not qualify
real native/browser performance or Auth SDK lifecycle. Prior full PG547/worker35
carried only; client/barrel changes are outside static imported runtime, SQL exact.
1074 baseline references,14 source paths (8 additions/6 extensions),325 union;
37 mirrors/47 artifacts unchanged. Local/uncommitted, gates OFF, no provider/paid/
hosted/Git/EAS/release action; AUTH27–29 consumed. Next fresh owner/session/gate creation
client transport, then no-match forms and authoritative separate adoption/cache hydration,
GPT-6.1 Sol / High. D13A.5 remains in_progress;10 numbered checkpoints remain.

D13A.5 fresh-owner creation client checkpoint complete locally October11; see
[creation client evidence](../tasks/shared-dictionary-cefr/evidence/D13A-creation-client-20261011.md).
Persist original resolution before requests; resolved new meaning prepares exact ordinary/
reviewed-recovery command; atomic submitted claim precedes Edge invoke. Restore/status
never calls endpoint again. Auth getUser/latch, explicit bearer verification, mounted
context/SDK AbortSignal and capability/actor preflight; creation-specific SQL gates stay
authoritative. Native generic fetch excludes creation from503/504/520/546 retry. SDK
factories add no construction request or personal adoption/hydration. Native190/2490/22
configured coverage, web114/1150 Node benchmark, focused130/105 and Edge108 PASS;
scoped types/lint/format/diff PASS. No actual device/browser/Auth/provider qualification.
1138 baseline references;12 sources (9 additions/3 extensions),334 union;37 mirrors/47
artifacts unchanged. Prior PG547/worker35 carried only, imported runtime/SQL exact.
Local/uncommitted, gates OFF, no provider/paid/hosted/Git/EAS/release action, AUTH27–29
consumed. Next no-match/meaning-hint/read-only recovery forms with mounted lifecycle,
then separate authoritative adoption/cache hydration, GPT-6.1 Sol / High. D13A.5 remains
in_progress;10 numbered checkpoints remain.

October11 D13A.5 explicit no-match/status recovery forms complete locally:
[forms evidence](../tasks/shared-dictionary-cefr/evidence/D13A-creation-forms-20261011.md)
and [hashes](../tasks/shared-dictionary-cefr/evidence/D13A-creation-forms-20261011.json).
Mounted native/web creation UI restores journals before fresh intent, retains original
query/hint/nonces, fences Auth/context/AbortSignal and exposes submitted status only.
Full native2536/web1195/Edge108 and scoped types/lint/coverage pass final bytes.
Publication remains distinct from personal adoption/cache hydration, the next D13A.5
checkpoint (GPT-6.1 Sol / High). D13A.5 stays in_progress;10 numbered checkpoints remain.
New live gates OFF; no provider/paid/hosted/Git/release action.

D13A.5 October11 creation adoption checkpoint complete locally; see
[D13A creation adoption evidence](../tasks/shared-dictionary-cefr/evidence/D13A-creation-adoption-20261011.md).
Original client checklist stays 5/8 complete, 3 open. Item7 inventory now3/4 local
areas complete: new-word lookup, import/transfer2, and creation-to-personal adoption/
hydration. Its preserved private-payload/mode reconciliation remains. Item6 shared
Analyze again/publication-refresh parity and item8 web recovery/review-start performance
also remain open. Ten broader numbered roadmap milestones are not a session estimate.
Next local scope is item7 preserved private/mode reconciliation, GPT-6.1 Sol / High.

### October11 — D13A.5 item7 private/mode comparison checkpoint

Original client progress remains5/8; item7 remains3/4 named areas. Within area4,
read-only comparison/mode guards are checkpoint1 of a fixed2, complete locally.
Checkpoint2 is explicit reviewed disposition with protected pending/original state
and atomic current-mode hydration, owner/head/content/placement/stale guards and
learning preservation. It remains open; D13A.6 corpus mapping/apply is separate.
See [evidence](../tasks/shared-dictionary-cefr/evidence/D13A-private-mode-preview-20261011.md).
Next GPT-6.1 Sol / High; no picker change, permission expansion or live conversion.

### October11 — D13A.5 item7 complete locally

Reviewed private/mode disposition completes area4 checkpoint2/2 and item7 area4/4.
Original D13A.5 progress is now6/8, with original items6 and8 open. Exact originals,
queue strings and dependency content are protected before atomic chosen-mode cache
loading; owner/stale/head/placement fences retain learning. Mode return stays
explicit; no server mode change, provider call or old-card corpus conversion occurs.
See [evidence](../tasks/shared-dictionary-cefr/evidence/D13A-private-mode-apply-20261011.md).
Next item6 shared Analyze again/publication-refresh parity, GPT-6.1 Sol / High;
then item8 web recovery/review-start performance. Ten larger roadmap milestones
remain while D13A.5 is in_progress; these counts are not session estimates.

### October11 — D13A.5 item6 complete locally

Shared Analyze again/publication refresh parity is complete locally: exact saved
publication content reload, native complete atomic sibling cache refresh and web
owner-validated /app layout invalidation. Offline/gate/dependency/operation/owner/view
failure paths retain receipts/debt without analysis redispatch or learning mutation.
Fresh native196/2670/22 with coverage, web118/1241, Edge108; focused/types/lint/format/
diff pass. PG547/worker35 are historical with unchanged AST runtime closures.
See [evidence](../tasks/shared-dictionary-cefr/evidence/D13A-analysis-refresh-20261011.md).
Original progress is7/8, only item8 open; item7 stays4/4 and area4 stays2/2. Next item8
web offline/account-return and representative review-start performance/parity,
GPT-6.1 Sol / High. Ten broader milestones remain while D13A.5 is open; not turn
estimates. Flags OFF/shared_analysis FALSE/CEFR OFF; local-only/no external action.

## October11 — D13A.5 item8 web recovery complete; performance open

Following review uses an exact indexed dictionary-descriptor table and independently
restored per-word metadata; lexical/placement/learning/revision/private/CEFR identity
and active question boundaries remain. Snapshot1/2 stays raw. Initial setup controls
wait for one-time owner preference application, preventing a late restoration from
overwriting the first deliberate choice. The probe uses real enabled controls and
one click per transition with no artificial readiness wait.

Final synthetic browser recovery passes five groups in light/dark (10 checks),
including Retry/offline loaded-question behavior, shared-head collection/detail and
next-session adoption, owner A-B-A return/isolation and read-only request boundaries.
Cold offline navigation still needs connectivity/retry; production Auth/SQL/device
behavior is not established. Desktop160 plus CPU4x160 functional samples pass, but
material navigation-to-card timing regression keeps original item8 performance open.
Desktop5000 all-due cold704.4/899.6ms (+27.7%); CPU4x1497.3/1654.7ms (+10.5%).
CPU4x5000/20-due client576.3/733.0ms (+27.2%). Observed p95 is max of10, not production
p95; reduced page bytes about28.8% do not establish acceptable latency or attribution.

Fresh web119/1249, focused4/40, types/lint/backend-probe7; native196/2670/22, Edge108
and PG547/worker35 carried, not rerun. Source13/browser449 frozen, union370/web142;
prior evidence/source/mirrors/artifacts preserved. Original progress7/8, item8 areas
1/2 complete; ten broader milestones remain, not session estimates. Next **GPT-6 Astra /
High**: actual server/browser performance profiling and a demonstrated fix, preserve
paired fixtures/readiness/owner/session/learning fences, then requalify. D13A.5 remains
in_progress; no pending operation. Flags OFF/shared_analysis FALSE/CEFR OFF, AUTH27-29
consumed; no provider/paid/hosted/Git/EAS/device/release/automation action.

See [evidence](../tasks/shared-dictionary-cefr/evidence/D13A-web-acceptance-20261011.md).

## October11 — D13A.5 complete locally; next D13A.6

Original client checklist8/8 and item8 existing areas2/2 complete; nine broader
milestones remain (D13.6,D13A.6-9,D14.1-4). Profiles identified repeated revision
projection/full-row copying and RSC field traversal. Compact same-build JSON/typed-word
transport preserves every personal/lexical/SRS/event/metadata field and session/owner
boundary; snapshot1/2 and public contracts stay unchanged. Web119/1253, focused1/9,
types/lint/backend-probe7 pass. Desktop160 + CPU4x160 + unchanged-source large-case
CPU4 repeat120 pass; recovery10 passes in light/dark. All full/repeat navigation
medians stay within the existing10% local investigation threshold; pooled large CPU4
median differences-5.3% to+7%. Rare cold tails remain documented, with variation in
both paths; no production p95/SLA claim. D13A.7 retains dedicated broader review,
device and production-like performance qualification. No gate was waived.

Source9/browser449 frozen, union371/web142; prior evidence preserved. Native196/2670/22,
Edge108, PG547/worker35 carried with exact declared boundaries, not rerun. All owned
processes exited. Next D13A.6 **GPT-6.1 Sol / High**: reviewed semantic mapping and
local snapshot/apply/rollback rehearsal; zero safe matches remains valid, preserve
originals/later learning and classify unresolved meanings. No live linking/provider/
paid/hosted/Git/EAS/device/release/automation permission; flags OFF/shared_analysis
FALSE/CEFR OFF and AUTH27-29 consumed. See [evidence](../tasks/shared-dictionary-cefr/evidence/D13A-web-performance-20261011.md).

## October11 — D13A.6 inventory and planning checkpoint,2/5 complete

Saved snapshot all2914 cards classified: ambiguous2465,missing429,private-review18,
excluded2,eligible0; no real semantic approval or live refresh inferred. Immutable
local administrator planning binds protected full originals and exact source/owner/
version/target head decimal sequence/content/meaning attestations/full-media diff.
Synthetic positive fixtures only; no shared publication from private data. Source/
head mismatches held, incomplete diff fails atomic, exact retry survives deletion,
new intent revalidates source, originals retained without preventing deletion.
Final PostgreSQL14 and inventory4 pass, scoped zero-warning lint/format/diff pass;
all owned runners/container exited. Native host shared-memory failure and fixed
synthetic fixture/lint failures retained. No system/other cluster cleanup.
Five new operator sources outside migrations;3378 entry refs verified,3373 preserved
after five task-note updates; union376/web142/browser449 unchanged prior boundaries.
Exact580 dirty paths; local-only/uncommitted. Full prior suites carried, not rerun.
No apply/rollback endpoint or SQLite migration rehearsal implemented in this checkpoint.
Next D13A.6.3 **GPT-6.1 Sol / High**: bounded apply default50/max100, immutable
plan/decision/source/head/diff checks under locks, durable per-row receipts and no
learning writes. Fixed3/5 remain: apply, concurrent/interrupted delta, selective
rollback after new learning/edits in PostgreSQL+SQLite. Nine broad milestones remain.
No external action/permission change; flags OFF/shared_analysis FALSE/CEFR OFF;
AUTH27-29 consumed. See [evidence](../tasks/shared-dictionary-cefr/evidence/D13A-following-mapping-plan-20261011.md).

## October11 — D13A.6 bounded apply checkpoint,3/5 complete

Administrator-only disposable apply outside migrations; complete plan/decision hash
and personal owner/source/state/target head exact decimal sequence/content/full-media
diff checked under locks. Default50/max100, immutable per-row outcomes/result snapshots/
hashes/versions and exact batch request/results. Reference/mode and content state only;
private raw fields/IDs/owners/placement/SRS remain intact. Same batch retry returns
original result after gate changes/deletion; changed intent fails; fresh UUID processes
remaining work. Unknown/stale/unreviewed rows held. No publication from private data.
Final actual PostgreSQL11 and zero-warning lint/format/diff pass; owned runners and
container exited. Sequential stale checks and transaction ROLLBACK proven; multi-worker
races/interruptions and selective reversal after commit remain separate fixed gates.
Earlier fixture6/10 and10/11 failures corrected without weakening source immutability,
mandatory published head/fallback or FK constraints. Entry3414 refs verified;3409
preserved after five task-note updates; new source3, union379/web142/browser449. Prior
planning/D06/app/domain/migrations/evidence unchanged; plan14/inventory4 and full suites
carried only. Exact585 dirty paths, local-only/uncommitted. Real2914 eligible/approved/
applied0. No external action/permission change; flags OFF/shared_analysis FALSE/CEFR
OFF, AUTH27-29 consumed. Next D13A.6.4 **GPT-6.1 Sol / High**: actual interrupted/
concurrent batches/workers/content/state/head/deletion/learning; then5 selective
PostgreSQL+SQLite rollback retaining later reviews/edits. Fixed2/5 remain and nine
broader milestones remain. See [evidence](../tasks/shared-dictionary-cefr/evidence/D13A-following-apply-20261011.md).

## October11 — D13A.6 actual concurrency/interruption checkpoint,4/5 complete

New14 PostgreSQL tests execute unchanged D06/planning/apply SQL with independent
owned sessions and observed server lock barriers. Busy retries/no false counts;
content/placement/state/head/capability/deletion fences; actual authenticated accepted
review event and canonical SRS/history/same-event retry preserved; bounded disjoint
workers, same-batch callers; row/final receipt failure; owned backend interruption
mid-batch and lost connection after commit. No partial writes/duplicates/resurrection.
First13 pass plus final idle-client observer timeout retained; ending stdin after
owned backend termination fixes observer, no SQL/guard change. Final14 and scoped
zero-warning lint/format/diff pass, both owned runners/container exited. Entry3432
refs verified,3427 preserved after five task-note updates; source4, union383/web142/
browser449, exact591 dirty paths. Old apply11/plan14/inventory4/full suites carried,
not rerun. Real2914 eligible/approved/applied0; local-only/uncommitted, no external
operation/global flag/permission change; AUTH27-29 consumed. Next D13A.6.5 **GPT-6.1
Sol / High**: selective receipt-owned rollback after committed apply/new accepted
learning in PostgreSQL and file-backed SQLite, skip later edits/deletion, preserve
learning/history/pending values and originals/receipts. Transaction ROLLBACK is not
this gate. Fixed1/5 remains and nine broader milestones remain. See [evidence](../tasks/shared-dictionary-cefr/evidence/D13A-following-concurrency-20261011.md).

**2026-10-11 local — D13A.6.5 complete; D13A.6 done locally, fixed5/5.**

Selective receipt-owned compensation passes actual PostgreSQL14/14 and file-backed
native SQLite21/21. Committed apply/new accepted learning/reset/correction survives
rollback; exact version+1, protected originals/receipts, original linked legacy refs,
private media/diffs, head/content/placement/version/owner/deletion holds. Owned
backend/SQLite process interruption, restart, receipt failures, parallel workers,
50/100 bounds and exact retries verified. No snapshot learning restore/resurrection.
SQLite operator isolated from runtime; actual device delivery/queues remain D7/8.
First failed PG/SQLite attempts retained; corrected final sources pass types and
zero-warning lint/format/diff. Every owned runner/container/child exited; no pending
operation. Entry3449 refs verified,3444 retained after five task-note updates;
new source7/union390/web142/browser449, exact600 dirty paths preserving all591.
Prior D06/plan/apply/concurrency/domain/app/migrations/evidence unchanged; old full
suites carried only. Real2914 eligible/approved/applied0, flags OFF/shared_analysis
FALSE/CEFR OFF, AUTH27-29 consumed, no external operation. Local-only/uncommitted.

Next **D13A.7 — GPT-6 Astra / High**, not started: dedicated contract/code/migration
and acceptance matrix review; semantic negatives/exact model/prompt qualification
and actual devices/old-client/offline return. No picker switch/independent agent
claimed. Current stage5/5,0 remaining. **Eight broad milestones remain:**
D13.6,D13A.7,D13A.8,D13A.9,D14.1,D14.2,D14.3,D14.4. No new stage started.
See [evidence](../tasks/shared-dictionary-cefr/evidence/D13A-following-rollback-20261011.md).

## October11 — D13A.7 traceability and server review checkpoint

**2026-10-11 local — D13A.7 checkpoints1–2 complete; fixed2/6,4 remain.**

Mapped all26 declarative cases to implementation and89 suite references/27 suites;
current overlay resolves six DEC-11 expectations while preserving the original
fixture. Reviewed server/domain analysis, semantic/profile/authority fencing,
publication/provenance and head rollback. Fixed four focused Edge type errors with
two explicit RequestInit annotations; added concrete A26 two-attempt no-change
coverage and strengthened A08 generation-only journal recovery. Runtime/domain/SQL
unchanged. Fresh PG96/96 plus final updated endpoint17/17 (97 distinct current
cases), Edge76/76 with typecheck, domain4 suites82/82 and scoped lint/format/diff.
Initial failed typecheck retained. Historical full suites are carried, not fresh.

Next **D13A.7.3 — GPT-6 Astra / High**: native/web delivery, pending private queues,
imports/creation/account lifetimes and stable sessions. Then fixed steps4 mapping/
compensation review,5 exact model qualification,6 devices/old clients/performance.
Eight broad milestones remain: D13.6,D13A.7,D13A.8,D13A.9,D14.1,D14.2,D14.3,D14.4.
D13A.7 is in_progress; no independent reviewer or picker switch claimed. Local-only,
all600 entry dirty paths preserved, owned runners exited/no pending operation.
Real2914 eligible/approved/applied0, flags OFF/shared_analysis FALSE/CEFR OFF,
AUTH27-29 consumed; no provider/hosted/Git/EAS/device/release authority added.
See [review evidence](../tasks/shared-dictionary-cefr/evidence/D13A-acceptance-review-20261011.md) and
[current26-case overlay](../tasks/shared-dictionary-cefr/D13A-acceptance-traceability-20261011.json).

## 2026-10-11 — D13A.7.3 client review

**2026-10-11 local — D13A.7.3 client review complete; fixed3/6 complete,3 remain.**

Reviewed native/web following delivery, private queues, import/creation/adoption,
account fencing and stable sessions. Confirmed and fixed raw SQLite row replacement
of materialized shared content after a review or correction: merge persisted learning
fields only, retaining content/revision, private placement and conflict metadata.
Regression tests failed before the fix and pass afterwards. Added actual native
controller/persistence/file-SQLite A12/A13 checks; these use synthetic RPC/ACKs,
not installed clients or a real provider. Final native46 suites712/712 and web47
suites609/609 pass; native test typecheck, scoped zero-warning lint/format pass.

Next **D13A.7.4 — GPT-6 Astra / High**: mapping/apply/compensation review and live
operation prerequisites. Then5 exact semantic model/prompt qualification and6 actual
devices/old builds/offline/performance. Eight broad milestones remain:
D13.6,D13A.7,D13A.8,D13A.9,D14.1,D14.2,D14.3,D14.4. No independent reviewer or
picker switch claimed. Local-only/uncommitted; entry603 dirty paths preserved.
No pending runner/external operation. Real2914 eligible/approved/applied0,
flags OFF/shared_analysis FALSE/CEFR OFF, AUTH27-29 consumed; no remote/provider/
Git/EAS/device/release authority added. Historical full suites are carried only.
See [client review evidence](../tasks/shared-dictionary-cefr/evidence/D13A-client-review-20261011.md).

## 2026-10-11 — D13A.7.4 operator review

**2026-10-11 local — D13A.7.4 operator review complete; fixed4/6 complete,2 remain.**

Reviewed ten mapping/apply/compensation invariants and live-operation prerequisites.
No new defect found; implementation/tests/migrations unchanged. Fresh PostgreSQL53/53,
file-backed native SQLite21/21 and inventory4/4 pass. Reclassification of exact saved
2914-card inputs still permits0 links. Later learning, private originals/queues,
selective rollback, concurrency/interruption and immutable receipts verified locally.
Initial sandbox Docker-socket denial retained; approved isolated rerun passes.
Entry3607 SHA refs verified;611 dirty paths preserved, final613. All owned runners
exited; no pending external operation. Local-only/uncommitted; no live authority added.

Next **D13A.7.5 — GPT-6 Astra / High**: exact semantic model/prompt/policy qualification.
Prepare concrete non-private fixtures, expected outcomes, call/cost bounds and exact
operation packet before asking for missing provider authority; no paid call is authorized.
Then6 actual device/old-build/offline/performance qualification. Eight broad milestones
remain: D13.6,D13A.7,D13A.8,D13A.9,D14.1,D14.2,D14.3,D14.4. Real2914 eligible/
approved/applied0, flags OFF/shared_analysis FALSE/CEFR OFF, AUTH27-29 consumed.
No independent reviewer or picker switch claimed. See
[operator review evidence](../tasks/shared-dictionary-cefr/evidence/D13A-operator-review-20261011.md).

## 2026-10-11 — D13A.7.5 pilot preparation, not model qualification

**2026-10-11 local — D13A.7.5 pilot preparation complete; qualification pending.**

Prepared24 synthetic cases and an immutable48-attempt/USD15 maximum Gemini3.8-flash
proposal; no paid/provider call dispatched. Fresh offline Deno13/13 with typecheck,
ESLint and Prettier pass. Proposed labels need independent review; no linguistic
accuracy or qualified model claimed. Local credential unavailable and paid authority
not granted (DEC-11). Four standalone scripts added; production runtime unchanged.
Entry3629 SHA references/613 dirty paths preserved; final619; source union400.
D13A.7 remains **4/6 complete,2 remain**; eight broad milestones remain.
Next **D13A.7.5 — GPT-6 Astra / High**: review the saved operation proposal, obtain
explicit pilot authority and intended-project credential, then measure/review results.
See `docs/tasks/shared-dictionary-cefr/evidence/D13A-semantic-qualification-preparation-20261011.md`.
No model-picker switch, independent reviewer, activation or external operation claimed.

## October23 — D13A.7 final native acceptance complete

D13A.7 is complete, fixed6/6,0 remaining. The full48-pair physical iPhone matrix,
physical Android list/owner/offline regression, archived parser/native SQLite compatibility,
strict preservation and final plain QA restore are accepted within the explicit limits in
[final native acceptance](../tasks/shared-dictionary-cefr/evidence/D13A-final-native-acceptance-20261023.md).
Warm full5000 load+review improves2439→1876ms versus the previous matrix. Remaining
following-cache load cost and one short-review tail are disclosed, not described as a
universal10% performance pass. Original production signatures/native OTA activation and
production latency remain outside this local qualification.

The owner-required stop is honored. D13A.8 has not started. Seven broad milestones remain:
D13.6,D13A.8,D13A.9,D14.1,D14.2,D14.3,D14.4. No paid/hosted/publication/migration/Git action;
main account untouched; isolated QA apps/proxy/containers stopped with data retained.
