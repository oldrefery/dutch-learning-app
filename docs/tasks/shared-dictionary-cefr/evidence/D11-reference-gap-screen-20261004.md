# D11 remaining reference gaps — 2026-10-04

## Scope and decision

The [graded-context ledger](D11-graded-context-ledger-20261004.json) has
seventeen non-operational observations for fourteen of the 27 exact inputs.
Thirteen inputs have no admitted graded observation. Four of those are
deliberate conflict or context-free ambiguity probes: their primary
expectation is a reviewed **abstention rule**, not a positive CEFR level.
The other nine need a sense-matched learning context or an explicit
unsupported disposition. The assistant has not assigned a word-sense
CEFR label or qualified the provider.
The [four-input structural draft](D11-structural-abstention-draft-20261004.json)
binds these preliminary abstention expectations to exact input hashes.
It is assistant-screened, not independent quality gold or an operational
fixture.

| Exact input                  | Probe type             | Current finding                                                                                                                                                                                                                                                                                     | Next evidence action                                                          |
| ---------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `candidate-straat-conflict`  | Example/gloss conflict | Dutch example concerns a wall clock, not a street                                                                                                                                                                                                                                                   | Retain reviewed preliminary abstention; preserve family isolation             |
| `candidate-winkel-conflict`  | Example/gloss conflict | Dutch example concerns cold weather, not a shop                                                                                                                                                                                                                                                     | Retain reviewed preliminary abstention; preserve family isolation             |
| `candidate-slot-ambiguous`   | Context-free polysemy  | `lock` and `castle` remain plausible without an example                                                                                                                                                                                                                                             | Retain reviewed preliminary abstention; do not choose a sense                 |
| `candidate-blad-ambiguous`   | Context-free polysemy  | `leaf` and `sheet of paper` remain plausible without an example                                                                                                                                                                                                                                     | Retain reviewed preliminary abstention; do not choose a sense                 |
| `candidate-kat-boom`         | Idiom                  | [B1 plain-language advice](https://doorlotje.nl/blog/teksten-die-een-vertaaltool-begrijpt) recommends avoiding this idiom; this is not a graded learner use                                                                                                                                         | Find an exact use in graded learning material or leave unsupported            |
| `candidate-wortel-math`      | Specialized sense pair | No graded mathematical-root use verified; carrot string matches are wrong-sense                                                                                                                                                                                                                     | Seek a sense-exact mathematics context with an explicit language level        |
| `candidate-quotient`         | Missing-corpus probe   | Mathematical term has no exact NT2Lex row in the local screen                                                                                                                                                                                                                                       | Seek language-level evidence; do not infer CEFR from school mathematics grade |
| `candidate-oogje-zeil`       | Idiom                  | A [BVNT2 conference abstract](https://bvnt2.org/app/uploads/2026/06/Programma-conferentie-2026.pdf) cites the idiom and B1–C1 learners, but does not grade the idiom                                                                                                                                | Find an exact graded teaching context or leave unsupported                    |
| `candidate-meebrengen-bring` | Separable verb         | [KU Leuven task suggestion](https://www.arts.kuleuven.be/cto/materialen/volwassenen/behoeftegericht-geintegreerd-nt2-onderwijs/school-en-ouders/materialenbank-school-en-ouders/watmoetjemeebrengen01.pdf) uses the exact sense but mixes 1.1/1.2 goals; the separate worksheet was not inspectable | Resolve the worksheet and its task-level provenance before a ledger row       |
| `candidate-aankomen-weight`  | Contrasting sense      | [Boom preview](https://www.nt2.nl/media/48/inkijkexemplaar_klare_taal_plus.pdf) uses the weight-gain sense on PDF pages 6–7, but the [publisher level](https://www.boom.nl/nt2/100-17379_Klare-taal-plus) spans A2–B2 without a page-specific label                                                 | Seek a single-level sense-exact context; arrival evidence cannot transfer     |
| `candidate-treinstation`     | Compound               | [Lingua.com index](https://lingua.com/nl/nederlands/lezen/) lists the exact story under A2, while the [PDF](https://lingua.com/pdf/nederlands-tekst-weg-vragen.pdf) labels it B1                                                                                                                    | Resolve the source-level discrepancy or keep it ungraded                      |
| `candidate-cel-prison`       | Contrasting sense      | Government prison context supports meaning, not a learner level                                                                                                                                                                                                                                     | Seek graded prison-cell context or leave unsupported                          |
| `candidate-zygomatisch`      | Missing-corpus probe   | Medical sense has no exact NT2Lex row in the local screen                                                                                                                                                                                                                                           | Seek graded language evidence; otherwise expect abstention                    |

## Gate before calibration

The [source admission rules](D11-source-admission-rules-20261004.md) record
why the mixed-level `meebrengen` and `aankomen` leads and the conflicting
`treinstation` labels remain outside the graded ledger.

The [October 4 structural review](D11-structural-abstention-review-20261004.md)
confirms provisional abstention for the four conflict/polysemy probes
without promoting them to independent gold. It also checks a KU Leuven
`meebrengen` task suggestion: the exact use is visible, but that page
lists both 1.1 and 1.2 goals, while the separate learner worksheet was
not inspectable. The `meebrengen` row therefore remains a mixed-level
lead, not a graded observation. The plural `tafels` form has a glossary-use
observation. The [plant-root screen](D11-plant-root-source-screen-20261004.md)
and [biological-cell screen](D11-biological-cell-source-screen-20261004.md)
add one source-level use each; nine lexical/form gaps remain.

1. Review and freeze the four structural abstention rules, plus rules
   for inflected forms, unsupported specialist meanings and source-level
   disagreements. Keep unknown/pending distinct from a CEFR band.
2. Resolve source identity, reuse rights, exact sense, page or stable
   locator, and assistant uncertainty for each admitted observation.
3. Set minimum per-slice denominators before evaluating the model.
   One to four draft inputs per slice/split cell and the current
   source-level observations cannot establish a reliable threshold.
4. Obtain meaning-level review independent of the model under test.
   The user's no-teacher instruction permits assistant screening, but
   assistant screening is not independent quality gold. Until that gate
   is met, D11.2 remains in progress and the worker stays disabled.
