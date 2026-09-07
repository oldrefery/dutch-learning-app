# Vocabulary organization: resume here

Updated: 2026-09-07.
Plan: [approved approach](plans/vocabulary-organization-2026-09-07.md).
Branch: `feature/vocabulary-organization` (from main `bf197d9`).

## Current authority

The user approved saving the plan and beginning read-only analysis of the personal
`oldrefery` profile. Production classification writes and collection moves still
need approval of their exact proposals. The user authorized commits in
`feature/vocabulary-organization` only. Pushes, PRs and deployments still require
separate permission.
Never use this personal account for tests. Preserve sayings/expressions everywhere.

## Verified inventory

Read-only SQL on 2026-09-07 confirmed exactly one matching account,
12 collections and 2,287 active cards with 2,287 distinct IDs. There are no
unassigned cards, missing lemmas or missing POS values. Seven collections are shared.
The protected collection `Spreekwoorden en uitdrukkingen` has 69 cards.
This leaves an upper bound of 2,218 cards before excluding expressions elsewhere.
The complete analysis JSON was inspected in the SQL editor at
2026-09-07T09:35:25.768039Z. This is NOT a recovery backup: it excludes SRS,
review history and media. The complete CSV is now saved locally and validated
against the previously verified owner ID and card count. No new snapshot timestamp
is inferred from the download time.

Of 614 cards flagged as expressions, 545 are outside the protected collection.
The other 1,673 cards outside that collection are unflagged. These are NOT final
exclusion/eligibility counts: many ordinary lexical compounds have expression
flags. Review actual meanings and types instead of excluding all flagged cards.
The `expression_type` field can also be present on unflagged cards.

Other collections: New words (813), Peter (443), Arjan (309), Wij slaven (186),
Een tompoes en bitterballen (74), Ik omhels je (78), De finale (194),
Ad Appel B1 (74), Waar is mijn fiets? 2 (35), Belgische woorden (4), Dieren (8).
Several collections have active shared links. `New words` also contains proverbs
and expressions. No levels have been saved and no collection has been changed.

## Durable local artifacts

- `reports/vocabulary-organization/inventory-2026-09-07.json`: verified aggregate
  inventory from the initial pass, ignored by Git; contains no full vocabulary.
- `reports/vocabulary-organization/snapshot-2026-09-07.csv`: full analysis snapshot,
  2,287 cards. SHA-256: `11296b11ec1c6b3b932d137f884c0315c072fb7fce409c6c086eeac717ba0583`.
- `reports/vocabulary-organization/evidence-2026-09-07.json`: complete per-card
  provisional dispositions and NT2Lex matches, not final classification decisions.
  SHA-256: `c8a73b87bfdd0716e0990438fe57af0b58199e1de571710e16505b51c250cce5`.
- `reports/vocabulary-organization/sources/NT2Lex-CGN-v01.tsv`: downloaded source,
  ignored by Git; 15,227 rows plus header.
- Source SHA-256: `0acae87e65a6ceb4237dcf23c5576488338570f3431ac52e159b6fce9e1a0515`.
- `reports/vocabulary-organization/sources/SUBTLEX-NL-with-pos-and-Zipf.xlsx`:
  complete source from OSF file `2dcvs`, downloaded and ZIP integrity checked.
  SHA-256: `6a43c784b30a9dc097f8d903b22c830dac631654efed430c86f2f9ec0a7cdd05`.
- `reports/vocabulary-organization/sources/SUBTLEX-NL-license.txt`: author's license,
  OSF file `w5mhg`; CC BY-NC-SA 4.0.
- `reports/vocabulary-organization/frequency-2026-09-07.json`: SUBTLEX surface/POS
  evidence for all 2,218 cards outside the protected collection, with input hashes.
- `reports/vocabulary-organization/semantic-review-uncertain-2026-09-07.json`:
  private editorial proposals for the 67 formerly uncertain cards, keyed by ID and
  content hash. Includes 53 estimated CEFR levels with rationales, NOT approved
  classifications. The private `review-uncertain-2026-09-07.mjs` records the explicit
  editorial input used to produce this report; neither file belongs in Git.
- `reports/vocabulary-organization/semantic-review-expressions-2026-09-07.json`:
  editorial proposals for all 158 expression candidates: 143 preserve, 13 include,
  2 hold. The private `review-expressions-2026-09-07.mjs` records the decisions.
- `reports/vocabulary-organization/semantic-review-lexical-001-2026-09-07.json`:
  first 100 ordinary/compound candidates in evidence order: 95 include with level
  estimates, 5 hold. Private decision source: `review-lexical-001-2026-09-07.mjs`.
- `reports/vocabulary-organization/review-coverage-2026-09-07.json`: reconciled
  coverage across all 2,287 IDs, source report hashes and explicit pending entries.
  Produced by private `reconcile-review-2026-09-07.mjs`; no overlapping decisions,
  unknown IDs, changed content hashes or protected-card reviews were found.
- [Read-only snapshot query](../scripts/vocabulary-analysis-snapshot.sql): reusable
  export query; replace its email placeholder only after checking task authority.

These ignored files exist only in this checkout. A fresh clone needs new exports
and source downloads. Never commit them to make a handoff portable.

## Immediate next steps

1. Continue ordinary/compound semantic review from offset 100 in the original
   evidence's combined `vocabulary-candidate` / `lexical-compound-candidate` list.
   The first 100, all 158 expression candidates and all 67 uncertain candidates
   have editorial proposals. There are 1,893 ordinary/compound cards still pending.
   Use stable IDs and content hashes, not offsets alone, when saving decisions.
   Check meanings for expressions even among ordinary candidates.
2. Resolve the 11 held cards individually, keeping their originals untouched.
   Some cards mix unrelated senses or have questionable headword forms. Quality
   notes also exist on preserved expressions; preservation does not certify spelling.
   Do not fix, split or merge cards automatically.
3. Improve frequency evidence for reflexive/inflected entries using explicitly
   justified lemma relationships; never silently substitute a base verb's sense
   or sum duplicated lemma totals. Current matching is exact surface/POS only.
4. Continue meaning-aware CEFR proposals with confidence and rationale. Do not
   assign levels from first appearance in NT2Lex or from missing frequency alone.
   Everyday usefulness still needs its separately justified per-card proposal;
   none of the current reports is a finalized frequency/usefulness ordering.
5. Update this handoff with actual artifact paths, completed checks and next action.

## Completed analysis pass

[Local analyzer instructions](../scripts/vocabulary/README.md) describe the reusable
CLI and its synthetic tests. It has no network/database writes or apply command.
All 26 analyzer/CLI tests and 8 synthetic SUBTLEX extraction tests pass.

Provisional dispositions: 69 protected, 1,623 vocabulary candidates, 370 lexical
compound candidates, 158 expression candidates and 67 needing review. These counts
sum to 2,287 but are NOT an approved collection mapping.

Outside the protected collection: 1,216 lemma+POS matches, 39 lemma-only matches
and 963 missing from NT2Lex. Two repeated lemma/POS groups were reported without
merging any records. The original NT2Lex evidence keeps CEFR null; the separate
semantic reports now contain 161 editorial level proposals. The source evidence
and private snapshot have not been overwritten.

Semantic coverage reconciles to the full inventory: 69 protected, 161 proposed for
classification, 153 proposed for expression preservation, 11 held and 1,893 pending.
The 325 reviewed cards outside the protected collection have unique IDs and matching
input hashes across the three batches. Proposed levels: A1 9, A2 38, B1 68, B2 42,
C1 4, C2 0. This partial distribution is NOT representative of the complete profile.
Levels are editorial estimates, generally medium confidence, with explicitly low
confidence for specialized/cultural items. They are not verified CEFR certifications.
No level was generated from the frequency score or personal learning progress.

SUBTLEX extraction scanned 437,503 source rows. Outside the protected collection:
1,811 surface+POS matches, 52 surface-only matches and 355 missing. All selected
numeric rows passed POS-count reconciliation and cached Zipf formula checks.
These matches remain sense-unverified; ranking scores are null. No lemma totals
were summed and no reflexive pronouns or accents were removed to force matches.

## Source research

- NT2Lex: <https://cental.uclouvain.be/cefrlex/nt2lex/>
- NT2Lex downloads: <https://cental.uclouvain.be/cefrlex/nt2lex/download/>
- SUBTLEX-NL paper: <https://doi.org/10.3758/BRM.42.3.643>

NT2Lex provides frequencies in graded receptive texts at A1, A2, B1, B2 and C1;
there is no C2 column. Its download page specifies CC BY-NC-SA 4.0 and research/
teaching use. Keep the source local, retain attribution and do not bundle it in
the app or redistribute it. Cite Tack, Francois, Desmet and Fairon (2018), NT2Lex.
The extended CGN+ODWN version may assist sense matching; it is not yet downloaded.
Corpus occurrence is evidence, not an official per-sense CEFR assignment.

SUBTLEX-NL origin and license were verified in the author's public OSF project:
<https://osf.io/3d8cx/overview> and <https://osf.io/3d8cx/files/w5mhg>.
The project lists Marc Brysbaert as contributor and specifies CC BY-NC-SA 4.0.
Use locally with attribution; do not redistribute the corpus in the app/repository.
The downloaded full file is <https://osf.io/3d8cx/files/2dcvs> (not the filtered
minimum-two-films subset). Its wiki describes smoothed Zipf values; keep absent
entries distinguishable rather than silently imputing them as observed counts.
NT2Lex and exact-surface SUBTLEX matching are complete. Meaning-aware classification
is still in progress; full eligibility, frequency ordering and collection mapping
are not finalized.
No profile data has been changed.
