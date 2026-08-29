# Dutch A1 Starter Pack Content Review

## Scope

Review every entry in `src/assets/starter-packs/dutch-a1.json` before enabling
the pack in production. This is a linguistic and pedagogical review, not a
technical QA pass.

## Reviewer requirements

- Fluent or native-level Dutch.
- Comfortable evaluating CEFR A1 vocabulary and everyday usage.
- Independent from the original draft where practical.

## Entry checklist

For every entry, confirm all applicable items:

- The Dutch lemma or expression is correctly spelled and normalized.
- The part of speech is correct.
- Nouns have the correct `de` or `het` article and plural.
- Verbs have correct principal forms, separable parts, and fixed prepositions.
- Register and expression metadata match normal contemporary usage.
- English translations cover the intended meaning without misleading senses.
- Dutch examples are natural, grammatical, and appropriate for A1 learners.
- English example translations accurately match the Dutch examples.
- The entry is useful at A1 level and does not duplicate another semantic card.
- No text appears copied from a proprietary dictionary or competitor deck.

Record any required corrections directly in the manifest and repeat the
technical validation after editing.

## Approval procedure

When all 53 entries pass review:

1. Set `content_review.status` to `approved`.
2. Set `content_review.reviewed_by` to the reviewer's name or stable project
   identifier.
3. Set `content_review.reviewed_at` to the ISO 8601 approval timestamp.
4. Replace the draft review note with a concise description of the completed
   review and material corrections.
5. Change the manifest version from `0.1.0-draft` to the approved release
   version.
6. Run the manifest tests, project quality gates, and the starter-pack Maestro
   flow before release.

Russian translations are optional for the first release. Add them only when
they receive the same documented review.
