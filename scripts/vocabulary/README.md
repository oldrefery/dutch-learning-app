# Local vocabulary evidence analysis

Read-only tooling for the [organization plan](../../docs/plans/vocabulary-organization-2026-09-07.md).
It does not contact a database, change cards, assign final CEFR levels or move collections.

## Inputs and execution

1. Export the single-row result of [the snapshot query](../vocabulary-analysis-snapshot.sql).
   Use only the explicitly approved account. Verify its ID and card count independently.
2. Save the CSV under `reports/vocabulary-organization/`, which is ignored by Git.
   This analysis export deliberately excludes learning history and is not a recovery backup.
3. Download `NT2Lex-CGN-v01.tsv` from the [official source](https://cental.uclouvain.be/cefrlex/nt2lex/download/)
   into the same private directory. Retain attribution and source licensing information.
4. Run from the repository root using the Node version in `.nvmrc`:

```bash
node scripts/vocabulary/analyze.mjs \
  --snapshot reports/vocabulary-organization/snapshot.csv \
  --source reports/vocabulary-organization/sources/NT2Lex-CGN-v01.tsv \
  --output reports/vocabulary-organization/evidence.json \
  --owner APPROVED_ACCOUNT_UUID \
  --protected PROTECTED_COLLECTION_UUID \
  --expected-cards VERIFIED_ACTIVE_CARD_COUNT
```

The output must be a new file in the private directory. Existing reports are never
overwritten. Owner/count/membership checks run before report creation. The CLI
prints aggregate counts only; per-card content stays in the ignored output file.

## Interpretation

- `protected-collection`: excluded by the user's instruction, regardless of labels.
- `expression-candidate`: expression-like metadata; semantic review is still required.
- `lexical-compound-candidate`: single-word compound with a lexical POS. An expression
  flag alone must not exclude ordinary Dutch compounds.
- `vocabulary-candidate`: initial candidate, not a finalized eligibility decision.
- `needs-review`: remaining flags or multiword forms, including reflexive verbs and
  abbreviations. A multiword spelling does not automatically imply an idiom.

NT2Lex evidence matches normalized lemma and CGN POS without stripping accents,
removing `zich`, guessing stems or changing spelling. Lemma-only matches remain
explicitly unverified. Missing counts remain null; a genuine source zero stays zero.
`F@A1` through `F@C1` are corpus counts, not word difficulty labels, and the graded
reading corpus is not a general everyday-frequency ranking. There is no C2 column.
Every `estimatedCefr` is deliberately null until a separate meaning-aware review.

Repeated lemma/POS pairs are reported by ID, never merged. They may represent
different meanings. Input hashes detect content changes but exclude membership and
timestamps, which are stored separately. These hashes are analysis provenance, not
a complete production stale-plan check or rollback implementation.

## Tests

```bash
node --test scripts/vocabulary/*.test.mjs
```

Tests use synthetic in-memory data and disposable ignored fixture directories;
they do not access application accounts. Test cleanup deletes only directories
created by the test itself.
