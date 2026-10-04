# D11 remaining reference gaps — 2026-10-04

## Scope and decision

The [graded-context ledger](D11-graded-context-ledger-20261004.json) has
twenty-four non-operational observations for twenty of the 27 exact inputs.
Seven inputs have no admitted graded observation. Four of those are
deliberate conflict or context-free ambiguity probes: their primary
expectation is a reviewed **abstention rule**, not a positive CEFR level.
The other three need a sense-matched learning context or an explicit
unsupported disposition. The assistant has not assigned a word-sense
CEFR label or qualified the provider.
The [specialist gap disposition](D11-specialist-gap-disposition-20261004.md)
now records the bounded search and leaves all three unsupported for
positive levels without converting source absence into an expected CEFR
abstention label.
The [four-input structural draft](D11-structural-abstention-draft-20261004.json)
binds these preliminary abstention expectations to exact input hashes.
It is assistant-screened, not independent quality gold or an operational
fixture.

| Exact input                 | Probe type             | Current finding                                                                 | Next evidence action                                                          |
| --------------------------- | ---------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `candidate-straat-conflict` | Example/gloss conflict | Dutch example concerns a wall clock, not a street                               | Retain reviewed preliminary abstention; preserve family isolation             |
| `candidate-winkel-conflict` | Example/gloss conflict | Dutch example concerns cold weather, not a shop                                 | Retain reviewed preliminary abstention; preserve family isolation             |
| `candidate-slot-ambiguous`  | Context-free polysemy  | `lock` and `castle` remain plausible without an example                         | Retain reviewed preliminary abstention; do not choose a sense                 |
| `candidate-blad-ambiguous`  | Context-free polysemy  | `leaf` and `sheet of paper` remain plausible without an example                 | Retain reviewed preliminary abstention; do not choose a sense                 |
| `candidate-wortel-math`     | Specialized sense pair | No graded mathematical-root use verified; carrot string matches are wrong-sense | Seek a sense-exact mathematics context with an explicit language level        |
| `candidate-quotient`        | Missing-corpus probe   | Mathematical term has no exact NT2Lex row in the local screen                   | Seek language-level evidence; do not infer CEFR from school mathematics grade |
| `candidate-zygomatisch`     | Missing-corpus probe   | Medical sense has no exact NT2Lex row in the local screen                       | Seek graded language evidence; otherwise expect abstention                    |

## Gate before calibration

The [source admission rules](D11-source-admission-rules-20261004.md) record
why the mixed-level KU Leuven `meebrengen` and Boom `aankomen` leads and the conflicting
Lingua.com `treinstation` labels remain outside the graded ledger. A
separate, weak [A2 language-lesson use](D11-train-station-source-screen-20261004.md)
now covers the exact `treinstation` input without resolving Lingua.com's
source-level conflict.

The [October 4 structural review](D11-structural-abstention-review-20261004.md)
confirms provisional abstention for the four conflict/polysemy probes
without promoting them to independent gold. It also checks a KU Leuven
`meebrengen` task suggestion: the exact use is visible, but that page
lists both 1.1 and 1.2 goals, while the separate learner worksheet was
not inspectable. That KU Leuven lead remains excluded; the separately
inspected KleurRijker row is only a weak glossary observation. The plural
`tafels` form has a glossary-use
observation. The [plant-root screen](D11-plant-root-source-screen-20261004.md)
and [biological-cell screen](D11-biological-cell-source-screen-20261004.md)
add one source-level use each. The train-station lesson and a
[KleurRijker A2 glossary entry](D11-bring-along-source-screen-20261004.md)
add one each for `treinstation` and `meebrengen` respectively. The official A1
`meebrengen` can-do example corroborates sense but is not a graded
learner-material observation. The first-party
[B2 prison-cell exercise](D11-prison-cell-source-screen-20261004.md)
adds one exact-sense contextual observation for `cel`. A directly
inspected [B2 reading exercise](D11-oogje-zeil-source-screen-20261004.md)
adds one weak contextual observation for the watchful-supervision idiom;
five lexical/form gaps remained at that checkpoint. A directly opened
[coLanguage A1 lesson](D11-weight-gain-source-screen-20261004.md)
now adds one weak weight-gain `aankomen` use; four lexical/form gaps
remained at that checkpoint. A directly inspected
[B1 idiom lesson and B2 glossary article](D11-kat-boom-source-screen-20261004.md)
add two weak observations for `de kat uit de boom kijken`; three
lexical/form gaps remain. The weight-gain example in a third-party
Lest Best guide copy remains unadmitted pending first-party verification.

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
   is met, D11.2 remains blocked and the worker stays disabled.
   The [quality-gate decision](D11-quality-gate-decision-20261004.md)
   records the owner choice now needed for any narrower offline outcome.
