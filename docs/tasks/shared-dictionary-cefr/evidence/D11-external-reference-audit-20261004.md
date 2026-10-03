# D11 external CEFR reference audit — 2026-10-04

## Question

Can a published source independently qualify the exact 24 Dutch meanings
used in the v2/v3 Gemini pilots, without reusing the assistant's provisional
bands or the provider's own answers?

## Primary sources checked

- The [Council of Europe CEFR Companion Volume](https://rm.coe.int/common-european-framework-of-reference-for-languages-learning-teaching/16809ea0d4)
  describes vocabulary range as a learner's breadth and variety of
  expressions across settings (pp. 130–132). Its descriptors do not assign
  bands to the particular Dutch senses in this pilot. It can guide review
  criteria but cannot be imported as 24 item labels.
- The [NT2Lex publisher's resource page](https://cental.uclouvain.be/cefrlex/nt2lex/)
  defines a receptive lexicon based on frequencies in graded readers and
  textbook reading activities. The [method paper](https://aclanthology.org/W18-0514.pdf)
  describes automatically tagged lemma/POS/sense entries and frequency
  distributions by source-text level. This is independent corpus evidence,
  not adjudicated minimum proficiency for each exact app meaning. The
  paper's C1 source corpus contains one reader and 6,199 tokens (Table 1);
  the published resource covers A1–C1, not C2.
- The [NT2Lex download page](https://cental.uclouvain.be/cefrlex/nt2lex/download/)
  distinguishes lemma/POS and sense-enriched versions. Both are marked
  CC BY-NC-SA 4.0. A research cross-check can cite the resource; bundling
  its data into the app would require a separate usage decision. No dataset
  was copied into this repository.

## Decision for D11

NT2Lex is useful for a separate evidence column such as observed graded-text
frequency, with exact sense matching and missing matches recorded. It cannot
turn the present provisional assistant labels into reviewed CEFR gold or
make the v3 diagnostic report `qualified`. The CEFR descriptors likewise
do not resolve the sample item by item. This audit did not establish an
independent 24-sense reference, so D11.2 and worker activation remain open.

Do not use either full pilot's Gemini predictions to create the reference
against which those same predictions are scored. The next validation design
needs a new source-backed meaning-level review protocol and a genuinely
held-out set before operational thresholds can be selected. The user's
remaining two paid attempts are reserved; another pass over the same 24
inputs would not answer this evidence gap.
