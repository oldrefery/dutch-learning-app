# D11 draft editorial screen — 2026-10-04

## Scope

The assistant inspected all 27 exact inputs in
[pack v3](D11-new-reference-pack-inputs-20261004-v3.json) and
[authored v6](D11-authored-sense-inputs-20261004-v6.json) after canonical
validation. This is a preliminary editorial screen, not independent human
adjudication, a licensed CEFR reference or approval to send inputs to a
provider. Every item remains `unreviewed` with no expected level.

The screen checked lemma/form, article, part of speech, English gloss,
Dutch/English example alignment, proposed slice, family partition and the
scope of cited lexical evidence. It did not copy source text into the app.

## Findings

| Inputs                                                                      | Preliminary assessment                                                                                                                                                                                                                                                                         | Required follow-up                                                                                                                                                                                                                                                     |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Six base pack entries                                                       | Exact owner-controlled inputs; examples illustrate their glosses                                                                                                                                                                                                                               | Independent meaning-level graded evidence; A1 pack placement is not a label                                                                                                                                                                                            |
| `tafel` / `stad` plural variants                                            | `dutch_original` is plural, `dutch_lemma` is singular, and the English gloss/example are plural; this is a deliberate form probe                                                                                                                                                               | Confirm the fixture policy treats an inflection probe as a distinct input without splitting its family                                                                                                                                                                 |
| `straat` / `winkel` conflicts                                               | Dutch and English examples agree with each other but are unrelated to the lemma/gloss                                                                                                                                                                                                          | Preserve only as adversarial abstention cases, with a reviewed rule for what counts as conflict                                                                                                                                                                        |
| Idioms, separable verbs, reflexives, `schoolplein`, `wortel` and `quotiënt` | Draft examples are internally coherent and the linked sources support their intended lexical use                                                                                                                                                                                               | Independent graded context, language review and source-rights record; do not infer CEFR from source existence                                                                                                                                                          |
| `zich wassen`                                                               | `is_irregular: true` is plausible for the cleaning sense: [Taaladvies](https://taaladvies.net/werkwoorden-met-een-zwakke-en-een-sterke-vervoeging-algemeen/) lists `waste/wies` and `gewassen`                                                                                                 | Check the app's exact `is_irregular` convention during formal review                                                                                                                                                                                                   |
| `treinstation`                                                              | The [Rijksdienst term](https://kennis.cultureelerfgoed.nl/index.php/Begrip%3AD8200f5e-545b-4692-b2f8-13cbe5fa38d0) directly supports the compound sense                                                                                                                                        | Review original example and usage rights                                                                                                                                                                                                                               |
| `cel` biological/prison pair                                                | Distinct domain contexts are supported by [university biology](https://www.universiteitvannederland.nl/college/zo-maak-je-zaadcellen-in-een-lab) and [government prison](https://www.rijksoverheid.nl/vraag-en-antwoord/straffen-en-maatregelen/welke-rechten-heeft-een-gedetineerde) material | The ANW lemma has grammar only; seek stronger exact sense references and graded contexts                                                                                                                                                                               |
| `slot` / `blad` ambiguity probes                                            | Both inputs list two plausible English senses and intentionally have no example; no model answer has been seen for them                                                                                                                                                                        | Review whether this input shape should require abstention. `slot` currently relies on a historical [IVDNT-hosted dictionary](https://dagenta.ivdnt.org/wp-content/uploads/pdf/1897_koenen_verklarend-handwoordenboek-der-nederlandsche-taal.pdf); confirm modern usage |
| `quotiënt` / `zygomatisch` missing-corpus probes                            | Both have zero exact NT2Lex rows in the local screen                                                                                                                                                                                                                                           | Define `rare-missing` as missing **corpus evidence**, not lexical rarity; exact senses still need graded evidence                                                                                                                                                      |

No input was promoted to reviewed. This screen found no reason to alter the
canonical strings immediately; the open questions concern policy, evidence
and human-quality adjudication. The corpus/slice matrix has one to four
draft items per cell, so a minimum denominator and held-out quality cannot
be inferred from its coverage alone.

## Next action

Seek independent graded learning material that contains the exact meaning
in context, then write an evidence ledger with source/license, level,
meaning match, reviewer identity and uncertainty for each candidate.
Only after that can the team decide which items can receive reviewed labels
or abstention expectations and set defensible per-slice denominators and
policy. No new provider transmission is authorized; the two remaining
Gemini attempts are limited to the original 24 pilot meanings.
