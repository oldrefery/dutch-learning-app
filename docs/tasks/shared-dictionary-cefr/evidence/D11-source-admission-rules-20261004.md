# D11 source admission rules — 2026-10-04

## Decision boundary

This is an assistant-preliminary source-screening rule for D11.2. It
governs which external observations can enter the local graded-context
ledger; it does **not** assign a word-sense CEFR level, freeze a reviewed
quality fixture, qualify a provider or grant rights to transmit source
text. The [meaning-level validation protocol](D11-independent-validation-protocol-20261004.md)
and [worker contract](D11-calibration-worker-contract-20261002.md) retain
their independent-review and operational gates.

An observation may enter the preliminary ledger only when the source is
directly inspectable, the publisher and stable document/page locator are
known, the material or exercise has one unambiguous stated level, and
the exact canonical input's sense and relevant form occur in that
source. Record whether the occurrence is a contextual use, glossary
use, distractor or other weak exposure; these types have different
strength. Record source rights as reference-only unless reviewed reuse
permission exists. Store only links, locators and original paraphrases.

Do not choose one level from a range, a mixed-goal activity, conflicting
HTML/PDF labels or an unverified search excerpt. Mark those cases as
leads outside the graded ledger until the exact material and its level
are reconciled. A publisher's grade for a lesson, course or book is an
**exposure signal**, never a minimum CEFR level for each word used
there. A single occurrence, even from a strong source, cannot by itself
produce an acceptable level set.

## Sense and form rules

- Bind each observation to the exact canonical SHA-256 and meaning
  family. A homograph's other sense cannot inherit the observation.
  For example, an arrival use of `aankomen` does not support weight
  gain, and carrot `wortel` does not support tree or mathematical roots.
- An inflected-form probe needs direct evidence of that form. A
  singular example does not prove plural exposure. The
  [DISK / Boom A2 wordlist](https://www.nt2.nl/downloads/disk/woordenlijsten/disk_wl_t6_a2.pdf)
  uses `tafels` for physical tables in a restaurant definition, so it
  is a weak glossary-use observation for the plural input. It is not
  an A2 label for that form. An isolated morphology pair without
  contextual sense is grammar evidence only.
- An absent corpus row or rare-looking specialist term cannot become
  an inferred high CEFR level. Without a graded, sense-exact language
  context, leave the positive level unsupported. A later expected
  abstention needs its own reviewed rationale; absence alone does not
  establish lexical rarity.
- A distractor may be recorded as weak exposure but cannot establish
  that learners were meant to produce or understand the target sense.
  A conflict between example and gloss requires abstention on that
  exact input, per the [structural review](D11-structural-abstention-review-20261004.md).

## Applied exclusions

| Input                        | Verified lead                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Reason no single-level ledger row was added                                                                                                                                           |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `candidate-meebrengen-bring` | [KU Leuven's task suggestion](https://www.arts.kuleuven.be/cto/materialen/volwassenen/behoeftegericht-geintegreerd-nt2-onderwijs/school-en-ouders/materialenbank-school-en-ouders/watmoetjemeebrengen01.pdf) uses the bring-along sense but lists goals 1.1 and 1.2; its [A1 task index](https://www.arts.kuleuven.be/cto/materialen/volwassenen/behoeftegericht-geintegreerd-nt2-onderwijs/school-en-ouders/materialenbank-school-en-ouders/2-niveau-a1-breakthrough-1.1) also lists the numbered tasks. | The separate worksheet could not be inspected directly. Search excerpts mentioning source level 1.2 do not resolve the mixed task metadata.                                           |
| `candidate-aankomen-weight`  | [Boom's `Klare taal plus` preview](https://www.nt2.nl/media/48/inkijkexemplaar_klare_taal_plus.pdf), PDF pages 6–7, contrasts arriving with gaining weight and has a weight-change exercise.                                                                                                                                                                                                                                                                                                              | The [publisher's product page](https://www.boom.nl/nt2/100-17379_Klare-taal-plus) spans A2–B1 and B1 onward, with a B2 exit level; the inspected pages have no individual CEFR label. |
| `candidate-treinstation`     | Lingua.com's [reading index](https://lingua.com/nl/nederlands/lezen/) and [story PDF](https://lingua.com/pdf/nederlands-tekst-weg-vragen.pdf) refer to the same exact-use story.                                                                                                                                                                                                                                                                                                                          | The index categorizes it as A2, while the PDF labels it B1. Neither label is chosen by precedence without publisher reconciliation.                                                   |

The three inputs remain in the lexical/form gap set. The independent
meaning-level review, adequate slice denominators, prespecified
thresholds, rights check and separately approved provider sample are
still missing. D11.2 remains unqualified and the worker/schedule stay
disabled.
