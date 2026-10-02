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

## 1. Outcome and boundaries

One durable shared entry per resolved meaning supplies linguistic content and
CEFR. Personal cards reference it, preserving ownership, private overrides,
collection membership, and all learning state. Mobile remains usable offline.

Priority cohort clarified 2026-09-12: two users, P1 (primary owner/main learner)
and P2 (recent learner). See DEC-08 in the task decision ledger. Preserve both;
P1 requires full preservation. P2's willingness to consider a restart is a
last-resort fallback, not authorization to discard data. Coordinate device/build
verification with these two users instead of requiring a population-wide adoption
survey. This reduces rollout coordination, not schema/privacy/offline safeguards.

Cutover constraint confirmed 2026-09-12 (DEC-09): current production reads/writes
stay on the existing schema until all implementation and pre-release verification
are complete. No early switch of P1/P2 through deployment, canary or backfill.
Only the final approved D13 functional release changes the active path; later D14
retires legacy storage after observation, rather than removing the safety net
before cutover. Preparing new tables or code does not authorize activating them.

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

## 3. Proposed data contract

Names below describe responsibilities, not final migration names.

| Component               | Authority and contents                                                                                                                                    |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dictionary entry        | Stable identity for one meaning; language, lemma, POS, article, meaning discriminator, publication/retirement state                                       |
| Content revision        | Immutable reviewed or validated linguistic content; provenance, revision ID, content hash; no personal identifiers                                        |
| CEFR assessment         | Entry/meaning identity, assessed input hash, A1–C2 or unknown, source, confidence, method/provider version, assessed time, review/lock state              |
| Personal card           | Existing `word_id`, owner, collection, nullable dictionary/revision reference, private fallback/overrides, deletion state; current SRS authority retained |
| Learning streams        | Existing events, resets, corrections, checkpoints, and auxiliary `user_progress`; never merged across users or rewritten by dictionary migration          |
| Mobile local read model | Cached referenced revisions and effective card content, private pending changes, existing learning queue; usable without network                          |
| Enrichment work state   | Input revision/hash, attempt count, next retry, lease, status, bounded cost/usage metrics; server-only                                                    |

Essential invariants:

1. Never replace a personal `word_id` with a dictionary ID. Existing foreign keys,
   queued operations, URLs, and history retain their identities.
2. Shared content is not directly writable by ordinary clients. Owner-only card
   writes cannot mutate another user's card, public entries, or CEFR provenance.
3. Private text is not automatically a public dictionary contribution. Begin with
   approved official material and validated neutral analyses. Unclear/private
   content remains private and can have a private classification where necessary.
4. Do not merge meanings solely by spelling or hash all translations as a permanent
   identity. Exact-content fingerprints are conservative migration evidence;
   legitimate wording changes must not create accidental new identities.
5. Retain private overrides on update. An absent override means inherit; explicit
   null/removal must be represented separately. A meaning-changing edit requires
   relinking or detaching and invalidates any inapplicable inherited CEFR.
6. References initially pin content revisions. New content adoption is explicit;
   automatic CEFR refresh is allowed only for a still-matching meaning/input policy.
   A running review session freezes the content used to form its questions.
7. Shared-content and CEFR changes have their own revision/cursor invalidation.
   They must reach mobile even when a personal card's `updated_at` does not change.
8. No per-card network request for dictionary content. Batch/hydrate at the data
   boundary and preserve the optimized web review snapshot.
9. Removing a personal card never deletes a shared entry. Retiring an entry does
   not break pinned historical references; privacy withdrawal needs a separate,
   explicitly defined cache/redaction path.

## 4. Execution sequence and model settings

Assignments are engineering recommendations, not guaranteed model performance or
quota conversion rates. Use one active implementation task at a time. Standard
speed is the budgeting assumption. Do not enable extra agents or Ultra implicitly.

| Step | Deliverable                                             | Recommended model / reasoning           | Depends on          |
| ---- | ------------------------------------------------------- | --------------------------------------- | ------------------- |
| D01  | Inventory, baseline, compatibility audit                | GPT-6 Astra / High                      | None                |
| D02  | Approved architecture and migration contract            | GPT-6 Astra / High                      | D01                 |
| D03  | Additive database, RLS, revisions and references        | GPT-6.1 Sol / High; Astra / High review | D02                 |
| D04  | Shared types, validators and effective-content resolver | GPT-5.6 Terra / High                    | D03                 |
| D05  | Server write/read path and legacy compatibility         | GPT-6.1 Sol / High                      | D03–D04             |
| D06  | Resumable data mapping and backfill tooling             | GPT-6.1 Sol / High; Astra / High review | D05                 |
| D07  | Mobile SQLite and local repositories                    | GPT-6.1 Sol / High                      | D04–D05             |
| D08  | Mobile sync, offline edits and UI integration           | GPT-6.1 Sol / High; Astra / High review | D07                 |
| D09  | Web integration and performance preservation            | GPT-6.1 Sol / High                      | D05                 |
| D10  | Official packs, shared imports and exports              | GPT-6.1 Sol / High                      | D06, D08–D09        |
| D11  | CEFR ingestion and bounded scheduled enrichment         | GPT-6.1 Sol / High                      | D05–D06, D10        |
| D12  | Cross-client, privacy and regression verification       | GPT-6 Astra / High                      | D08–D11             |
| D13  | Staged release, approved backfill and observation       | GPT-6 Astra / High                      | D12                 |
| D14  | Compatibility retirement and server deduplication       | GPT-6.1 Sol / High; Astra / High review | D13 + adoption gate |

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

Exit: fake-provider tests cover correctness, authorization, retries, races, limits
and no-work behavior. A separately approved small live sample validates quality
and cost before any bulk enrichment.

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
- Run approved dormant mapping batches and verify invariants without redirecting
  live reads/writes. Reconcile changes accumulated during preparation and pending
  operations; rehearse rollback that retains subsequent learning writes.
- Only after D01-D12 and all pre-cutover checks pass, present the exact release,
  P1/P2 preservation evidence, backups and rollback results for final user approval.
  Then switch the active path as the final functional release step (DEC-09).
  Separately enable bounded CEFR scheduling only after cost/quality approval.
  Observe at least 7 days including native offline return before any D14 removal;
  track sync failures, orphan references, CEFR failures, cost and review latency.

Exit: current mobile and web production work on dictionary references, new analyses
and imports reuse entries, CEFR enrichment is observable and bounded, and all
unlinked private/ambiguous entries have explicit dispositions.

### D14 — Complete normalization after the adoption gate

- Verify supported clients no longer depend on legacy full-content writes/reads;
  document the supported upgrade/reconciliation path for returning older devices.
- Remove redundant authoritative server content for linked cards; preserve private
  overrides/fallbacks and any measured, explicitly non-authoritative read projection.
- Remove the temporary compatibility writer when safe, simplify repositories and
  retire obsolete cache paths only after checking all consumers.
- Re-run migration, private-edit, old-device, learning and performance tests. Do
  not rename personal IDs or move SRS merely for schema aesthetics.

Exit: shared content has one canonical authority, personal rows hold references and
private state, mobile retains an offline cache, and no active write path creates
unnecessary full-content server copies. If client adoption blocks this gate, label
the state explicitly as functional rollout complete / storage retirement pending.

## 5. Model switching and handoff discipline

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

| Stage | Fresh-session card                                                           |
| ----- | ---------------------------------------------------------------------------- |
| D01   | [Audit and baseline](../tasks/shared-dictionary-cefr/steps/D01.md)           |
| D02   | [Architecture decisions](../tasks/shared-dictionary-cefr/steps/D02.md)       |
| D03   | [Additive schema](../tasks/shared-dictionary-cefr/steps/D03.md)              |
| D04   | [Shared contracts](../tasks/shared-dictionary-cefr/steps/D04.md)             |
| D05   | [Server compatibility](../tasks/shared-dictionary-cefr/steps/D05.md)         |
| D06   | [Backfill rehearsal](../tasks/shared-dictionary-cefr/steps/D06.md)           |
| D07   | [Mobile storage](../tasks/shared-dictionary-cefr/steps/D07.md)               |
| D08   | [Mobile sync and UI](../tasks/shared-dictionary-cefr/steps/D08.md)           |
| D09   | [Web integration](../tasks/shared-dictionary-cefr/steps/D09.md)              |
| D10   | [Catalog and imports](../tasks/shared-dictionary-cefr/steps/D10.md)          |
| D11   | [CEFR enrichment](../tasks/shared-dictionary-cefr/steps/D11.md)              |
| D12   | [Integrated verification](../tasks/shared-dictionary-cefr/steps/D12.md)      |
| D13   | [Controlled release](../tasks/shared-dictionary-cefr/steps/D13.md)           |
| D14   | [Retirement and normalization](../tasks/shared-dictionary-cefr/steps/D14.md) |

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
