---
date: 2026-08-29
topic: dutch-usage-nuance
---

# Dutch Usage And Nuance

## What We're Building

Add optional, structured AI-generated usage guidance to newly analyzed Dutch
words. The guidance contains one concise English summary and up to three
contrasts with a nearby Dutch word or expression. Each contrast explains the
difference and may include one Dutch example with English and optional Russian
translations.

The section appears only when valid guidance exists. It is shown after the
answer is revealed in review and in Word Detail, with an explicit
`AI-generated guidance` label. Existing cards without guidance continue to
work unchanged, and usage guidance never affects SRS correctness.

## Why This Approach

The selected approach stores one nullable `usage_notes` JSON object on both
`words` and `word_analysis_cache`, mirrored as serialized JSON in SQLite. It is
additive, needs no backfill, and keeps the complete display payload together.

Reusing free-form `analysis_notes` was rejected because correction notices and
learner guidance have different rendering and validation needs. Separate
relational tables were rejected because the bounded, non-queryable AI payload
does not justify extra sync and lifecycle complexity.

## Key Decisions

- Shape: `summary` plus zero to three validated `contrasts`.
- Contrast: Dutch `term`, short English `distinction`, and an optional example.
- Failure policy: malformed or incomplete guidance becomes `null`; the rest of
  the word analysis remains saveable and reviewable.
- Cache: new analyses write cache version 2; version 1 entries are ignored by
  the analysis endpoint so users can receive the new structured field.
- Compatibility: all app types treat `usage_notes` as nullable or optional.
- UI: one reusable section in `UniversalWordCard`, enabled for analysis,
  review-back, and Word Detail but hidden in compact cards.
- Trust: the UI labels the content as AI-generated and force re-analysis stays
  available through existing actions.

## Open Questions

None for the MVP. Editing or rating guidance, multiple examples per contrast,
and localization of the explanatory prose are deferred.

## Next Steps

Implement WP2.2 from the saved Memorila roadmap and validate the migration,
Edge Function parser, offline sync, light/dark rendering, and simulator flows.
