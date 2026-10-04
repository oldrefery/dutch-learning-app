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

## Read-only coverage check

For research only, the publisher's sense-enriched
[`NT2Lex-CGN+ODWN-v01.tsv`](https://cental.uclouvain.be/cefrlex/nt2lex/download/)
was downloaded to `/private/tmp/d11-nt2lex-research.tsv` (4,350,941 bytes;
SHA-256 `37dc6b6e208d271e07283c082b3bf78ca07e28cc005ca445f52e6cd4ee0bc5b5`).
The file was not copied into the repository or application. An exact,
case-folded lemma lookup, without morphology or phrase normalization,
matched 11 of the pilot's 20 distinct lemmas. Several matched lemmas have
multiple automatically assigned sense rows; a row cannot be chosen from
the lemma alone. Nine lemmas had no exact match, including multiword and
specialized items. This is an exact-string coverage observation, not a
claim of absent senses after normalization or a CEFR evaluation.

The bundled 60-entry A1 project pack has 55 exact lemma matches in this
resource; 38 of those matches have multiple rows. This could seed a new
research inventory, but pack membership and the corpus frequency columns
still cannot supply reviewed meaning-level labels. Matching a candidate
requires a separate sense check against its gloss/examples and source
provenance before any CEFR judgment.
