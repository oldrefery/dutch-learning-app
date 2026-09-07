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
review history and media. Download CSV was requested, but no local download
artifact has been located or validated. Do not assume the full snapshot is saved.

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
  inventory, ignored by Git; contains no full vocabulary.
- `reports/vocabulary-organization/sources/NT2Lex-CGN-v01.tsv`: downloaded source,
  ignored by Git; 15,227 rows plus header.
- Source SHA-256: `0acae87e65a6ceb4237dcf23c5576488338570f3431ac52e159b6fce9e1a0515`.
- [Read-only snapshot query](../scripts/vocabulary-analysis-snapshot.sql): reusable
  export query; replace its email placeholder only after checking task authority.

These ignored files exist only in this checkout. A fresh clone needs new exports
and source downloads. Never commit them to make a handoff portable.

## Immediate next steps

1. Save and validate the complete analysis export locally. The SQL editor currently
   contains the single-row JSON result; rerun the saved query if necessary. Reconcile
   unique IDs, account count and collection counts. Record the artifact path/hash.
2. Separate genuine expressions from lexical compounds and questionable labels.
   Keep the protected collection fully excluded regardless of its card labels.
3. Assess source matching coverage and finish SUBTLEX-NL source/license verification.
   Generate an exclusion report and a classification proposal, not production writes.
4. Update this handoff with actual artifact paths, completed checks and next action.

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

SUBTLEX-NL is a candidate for subtitle-based general frequency. Its actual dataset
download and reuse terms still need verification. No frequency matching or CEFR
classification has been completed, and no profile data has been changed.
