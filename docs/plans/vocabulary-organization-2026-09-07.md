# Vocabulary classification and collection organization

Status: approved approach; read-only analysis complete and exact collection proposal ready.
No profile writes authorized yet.
Branch: `feature/vocabulary-organization`.
Resume with: [vocabulary organization handoff](../vocabulary-organization-handoff.md).

## Objective

Classify the owner's complete vocabulary by estimated CEFR difficulty and usage
frequency before reorganizing it into manageable, approximately equal collections.
The process must be repeatable outside the application UI.

## Scope and non-negotiable constraints

- The user explicitly authorized reading the `oldrefery` application profile for
  this task. This is not authorization to run tests against that personal account.
- Inspect all active cards regardless of current collection, including any cards
  without a collection. Reconcile counts instead of assuming the UI is exhaustive.
- Preserve the entire `Spreekwoorden en uitdrukkingen` collection unchanged.
- Also exclude proverbs, sayings and expressions found in other collections.
  Identify uncertain exclusions for review; do not rely exclusively on POS labels.
  Existing expression flags include ordinary lexical compounds. Such compounds
  remain classification candidates; the protected collection is always excluded.
- Never delete, deduplicate, merge, rewrite meanings or recreate cards automatically.
- Preserve IDs, content, translations, examples, media, usage notes, review history,
  knowledge ratings, SRS coefficients, intervals and scheduled review dates.
- No production writes until the corresponding concrete plan is approved.
- Commits are authorized in `feature/vocabulary-organization` only. Pushes, PRs
  and deployments require separate explicit authorization.
- Keep personal exports, per-card decisions and backups outside version control.
  Do not upload the private word list to third-party classification services.

## Phase 1: Read-only inventory

1. Verify account identity and retrieve the complete active vocabulary with stable IDs.
2. Record snapshot time, counts and original collection membership.
3. Separate protected collection, other expressions, eligible cards and uncertain cases.
4. Report duplicates, questionable spellings and ambiguous meanings without editing them.
5. Record sharing settings and active public links without changing access.

## Phase 2: Classification proposal

For each eligible card, record:

- Estimated CEFR level A1, A2, B1, B2, C1 or C2 for its actual meaning and POS.
- Confidence, short rationale, unresolved questions and method version.
- Corpus frequency, match type (lemma/form/POS), source/version and missing-data flag.
- Separately justified everyday usefulness; do not fabricate a corpus frequency.
- Input content hash so later edits invalidate stale decisions.

Use defensible Dutch lexical resources for corpus evidence and manually review
meaning-specific decisions. Corpus occurrence is evidence, not an official CEFR
assignment. Rare technical vocabulary is not automatically C2. A common lemma's
frequency does not establish the frequency of every sense. Do not convert personal
SRS difficulty or mastery into linguistic difficulty.

Deliver a complete proposal with counts, representative examples, confidence and
all unresolved cases. No card metadata is written during analysis.

## Phase 3: Persist approved classifications

After approval, create and validate a full recovery snapshot, then store level and
frequency metadata independently of collection membership. Determine the storage
contract and compatibility with existing clients before adding fields/tables.
Retain provenance and manual overrides. Do not move cards in this phase.

## Phase 4: Collection proposal

- Order cards within each level primarily by frequency and everyday usefulness.
- Split into approximately equal groups targeting 80–120 cards; distribute the
  remainder rather than creating a tiny final group. Small levels may be smaller.
- Never alter a level just to balance group sizes.
- Prefer stable labels such as `B1 · 01`, `B1 · 02`; topics are secondary.
- Produce an exact card-ID-to-target mapping, source/target counts and exclusions.
- Discuss existing shared links and old collections before moving their content;
  moving cards out of a shared collection changes what that link exposes.
- Do not automatically share new collections or delete old ones.

## Phase 5: Apply and verify

After approval of the exact mapping and sharing behavior:

1. Refresh and validate backups and preconditions immediately before writes.
2. Fail closed on changed card content, membership, owner, exclusions or stale plans.
3. Move existing card records; respect sync/version contracts and minimize partial state.
4. Verify card IDs/counts, protected content, every progress field and review history.
5. Verify web/mobile synchronization using safe read-only checks of the personal account;
   use isolated fixtures/test accounts for destructive or regression tests.
6. Retain an audit record of the applied operations.

## Phase 6: Repeatability and targeted rollback

Provide separate analyze, plan, validate, apply and verify operations, with dry-run
as the default and explicit authorization before production writes.

Future incremental runs classify new/changed words and fill suitable existing
groups without shuffling already organized cards. A full rebalance requires a
separate request. Preserve approved overrides across algorithm versions.

Rollback restores only this operation's collection assignments or classification
metadata, not subsequent learning progress. Check current state first and report
conflicts instead of overwriting later edits. Reapplying the same approved plan
must not duplicate cards or collections.

## Acceptance gates

- [x] Complete inventory, exclusions and unassigned cards reconciled.
- [x] Frequency sources and permitted local use verified.
- [x] Every eligible card classified or explicitly marked unresolved.
- [ ] Classification proposal approved before metadata writes.
- [ ] Collection mapping and sharing behavior approved before moves.
- [ ] Tested backup, stale-plan detection, idempotency and targeted rollback.
- [ ] Before/after invariants prove no lost cards or changed learning progress.
- [ ] Documentation allows a fresh session to resume safely.
