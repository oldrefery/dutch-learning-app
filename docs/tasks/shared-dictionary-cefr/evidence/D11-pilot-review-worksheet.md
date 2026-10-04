# D11 autonomous meaning review worksheet

2026-10-03. Completed by the assistant after the user requested autonomous work
without a teacher. This is a model-origin diagnostic reference, not a gold fixture.

Exact meanings, examples and input digests are in the [worklist](D11-pilot-review-worklist.json).
The [provisional reference](D11-pilot-provisional-reference.json) binds those inputs
and records reasons, unknowns and lexical sources. No provider prediction was
collected before these judgments. Keep the reference out of provider prompts.

All 24 inputs and proposed family/split assignments were checked. The two opstaan
items and lopen now carry irregular-verb metadata. Existing 12/12 splits and all
11 pooled slices are retained; some slices are absent from one split. A split named
held_out does not make the assistant reference independently validated.

Nineteen tentative bands are assistant inferences; five cases remain unknown.
Unknown is absence of a justified reference band, not automatically an expected
provider abstention. Only licht and the conflicting lopen example are intentional
abstention probes. No numeric reference confidence is claimed. Rare/missing means
missing reviewed CEFR evidence, not a measured corpus-frequency assertion.

| ID       | Dutch input                | Provisional band | Reason                                                                                                     |
| -------- | -------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------- |
| pilot-01 | huis                       | A1               | Concrete home vocabulary in a short possession sentence; own beginner-level inference, not the pack title. |
| pilot-02 | boek                       | A1               | Concrete everyday object with a short reading example; own beginner-level inference.                       |
| pilot-03 | fiets                      | A1               | Everyday transport meaning; own beginner-level inference.                                                  |
| pilot-04 | water                      | A1               | Basic substance/drink meaning; own beginner-level inference.                                               |
| pilot-05 | bank                       | A1–A2            | Concrete outdoor seating sense, distinct from financial bank.                                              |
| pilot-06 | bank                       | A1–A2            | Routine financial institution sense; savings example may be harder than the headword.                      |
| pilot-07 | arm                        | A1               | Common body part; noun and article separate it from the poverty adjective.                                 |
| pilot-08 | arm                        | A1–A2            | Basic economic condition adjective in a short family sentence.                                             |
| pilot-09 | kind                       | A1               | Everyday child meaning; irregular plural belongs to the same family.                                       |
| pilot-10 | kinderen                   | A1               | Same meaning as pilot-09; observed plural alone does not raise lexical CEFR.                               |
| pilot-11 | zich vergissen             | A2–B1            | Reflexive construction describing a mistake; plausible range, not measured learner knowledge.              |
| pilot-12 | zich herinneren            | A2–B1            | Reflexive memory construction; plausible range, not independently validated.                               |
| pilot-13 | opstaan                    | A1–A2            | Daily waking routine; separability/irregular morphology are explicit.                                      |
| pilot-14 | opstaan                    | A1–A2            | Physical rising from a seat; separate meaning but same family/split.                                       |
| pilot-15 | ziekenhuis                 | A1–A2            | Common health institution; compound status alone does not make it advanced.                                |
| pilot-16 | tuinhek                    | A2–B1            | Concrete compound understandable through garden/fence constituents; exposure-dependent.                    |
| pilot-17 | met de deur in huis vallen | B1–B2            | Figurative conversational expression; a tentative teaching range.                                          |
| pilot-18 | de knoop doorhakken        | B1–B2            | Figurative decision expression; a tentative teaching range.                                                |
| pilot-19 | mitochondrium              | unknown          | Domain familiarity dominates this biology term; no reliable general CEFR band established.                 |
| pilot-20 | bewijslast                 | unknown          | Legal-domain term; meaning is supported but a general CEFR level is not.                                   |
| pilot-21 | kwispelen                  | A2–B1            | Concrete pet action; no claim that it is rare or that a school list equals CEFR.                           |
| pilot-22 | poldergemaal               | unknown          | Productive but domain-specific compound; domain knowledge and transparency prevent a justified level.      |
| pilot-23 | licht                      | unknown          | Bare adjective licht/light without examples leaves the intended sense underdetermined.                     |
| pilot-24 | lopen                      | unknown          | Walking gloss conflicts with the example about water flow; abstain on this input.                          |

[CEFR terminology](https://erk-nederlands.taalunie.org/terminologie/) supplies a
communicative-proficiency rubric. [NT2Lex](https://cental.uclouvain.be/cefrlex/nt2lex/)
supplies corpus distributions, not independent gold labels for these meanings.
Dictionary and idiom references linked in the JSON support meaning/morphology only.
No pack title, corpus presence or model confidence is treated as a gold label.

Review changes require new input/reference revisions and hashes. The diagnostic
report must call comparison with these bands agreement, not accuracy; it cannot
qualify the operational worker. A teacher is not a prerequisite for the next local
collector implementation. See [review and next actions](D11-autonomous-proposal-review-20261003.md).
