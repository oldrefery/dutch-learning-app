# Dutch A1 Starter Pack Content Review

## Scope

Review every entry in `src/assets/starter-packs/dutch-a1.json` before enabling
the pack in production. This is a linguistic and pedagogical review, not a
technical QA pass.

## Reviewer requirements

- Fluent or native-level Dutch.
- Comfortable evaluating CEFR A1 vocabulary and everyday usage.
- Independent from the original draft where practical.

Project-owner exception: when an external reviewer is unavailable, the owner
may authorize a documented internal editorial review. Such a review must cover
the same checklist and must not be represented as independent native-speaker
certification.

## Entry checklist

For every entry, confirm all applicable items:

- The Dutch lemma or expression is correctly spelled and normalized.
- The part of speech is correct.
- Nouns have the correct `de` or `het` article and plural.
- Verbs have correct principal forms, separable parts, and fixed prepositions.
- Register and expression metadata match normal contemporary usage.
- English translations cover the intended meaning without misleading senses.
- When a database card has broader senses, the retained first two translations
  and examples are the most useful ones for an A1 learner.
- Dutch examples are natural, grammatical, and appropriate for A1 learners.
- English example translations accurately match the Dutch examples.
- The entry is useful at A1 level and does not duplicate another semantic card.
- No text appears copied from a proprietary dictionary or competitor deck.

Record any required corrections directly in the manifest and repeat the
technical validation after editing.

## Approval procedure

When all 60 entries pass review:

1. Set `content_review.status` to `approved`.
2. Set `content_review.reviewed_by` to the reviewer's name or stable project
   identifier.
3. Set `content_review.reviewed_at` to the ISO 8601 approval timestamp.
4. Replace the draft review note with a concise description of the completed
   review and material corrections.
5. Remove the `-draft` suffix from the manifest version.
6. Run the manifest tests, project quality gates, and the starter-pack Maestro
   flow before release.

Russian translations are optional for the first release. Add them only when
they receive the same documented review.

## Completed review

- Date: `2026-08-29T11:36:37Z`
- Reviewer identifier: `internal-dutch-content-review`
- Review type: project-owner-authorized internal editorial review; not an
  independent native-speaker certification
- Scope: all 60 entries and every item in the entry checklist
- References: official spelling guidance from Woordenlijst.org, grammatical
  forms from the Instituut voor de Nederlandse Taal ANW, and CEFR A1 usage
  criteria from the NT2 Taalprofielen
- Result: approved for the `0.2.0` release

Material corrections:

- Simplified the database-derived `adres`, `blijven`, `brengen`, `denken`,
  `koken`, `slapen`, and `zien` cards to concrete A1 senses and examples.
- Completed and normalized the principal forms and irregular flags for the
  reviewed verbs.
- Corrected `goed` so its adjective classification, translation, and example
  describe the same sense.
- Removed misleading or unnecessarily advanced secondary senses and related
  words from the affected cards.
- Removed the seven isolated Russian translations; Russian content remains
  deferred until it can receive a complete, consistent review.
- Protected the reviewed entry set with a SHA-256 generator integrity check so
  later database changes cannot silently alter an approved release.
