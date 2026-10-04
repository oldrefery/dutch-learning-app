# D11 sense/source screen — 2026-10-04

## Scope and current result

This is a local, pre-provider screen of the
[20-family candidate pool](D11-new-reference-candidate-pool-20261004.md).
It neither assigns CEFR levels nor creates an operational fixture. The prior
Gemini pilot was not used as a reference. Lexical pages were checked on
2026-10-04; links and page content may change. No external dictionary text or
corpus rows were copied into the app.

The latest [pack dossier](D11-new-reference-pack-inputs-20261004-v3.json)
contains ten inputs across six families. The latest
[authored dossier](D11-authored-sense-inputs-20261004-v6.json) contains seventeen
inputs across fourteen families. Earlier dossier versions remain historical
snapshots; use these two latest files together. All 27 `DictionaryContent`
objects parse, match their canonical assessment inputs and SHA-256 hashes,
have unique IDs/hashes, and keep each family in one split. Every item is
`unreviewed`, has `expected_levels: null` and `provider_approved: false`.
These bindings establish exact input identity, not linguistic or CEFR quality.

## Source-backed draft families

| Family / split                               | Local input(s)                            | Lexical or grammatical support                                                                                                                                                                                                                           | Limit                                                                               |
| -------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `tafel` / calibration                        | Pack table; authored plural example       | [ANW `tafel`](https://anw.ivdnt.org/article/tafel) confirms `tafels`                                                                                                                                                                                     | Pack A1 placement and morphology do not label the exact meaning                     |
| `stad` / held-out                            | Pack city; authored plural example        | [ANW `stad`](https://anw.ivdnt.org/article/stad) confirms `steden`                                                                                                                                                                                       | Same limit                                                                          |
| `straat` / calibration                       | Pack street; authored conflicting example | Pack `a1-010-straat`; [ANW `straat`](https://anw.ivdnt.org/article/straat) corroborates noun grammar                                                                                                                                                     | Conflict is an adversarial, locally authored draft, not a naturally occurring sense |
| `winkel` / held-out                          | Pack shop; authored conflicting example   | Pack `a1-011-winkel`                                                                                                                                                                                                                                     | Direct ANW page was not reliably retrieved; conflict needs editorial review         |
| `werk` / calibration                         | Pack work only                            | Pack `a1-013-werk`                                                                                                                                                                                                                                       | Proposed second sense withdrawn because no exact source was verified                |
| `goed` / held-out                            | Pack good only                            | Pack `a1-039-goed`; [ANW `goed`](https://anw.ivdnt.org/article/goed) distinguishes grammatical uses                                                                                                                                                      | Proposed second sense withdrawn because a precise contrast was not supported        |
| `schoolplein` / held-out                     | Schoolyard                                | [ANW sense 1.0](https://anw.ivdnt.org/article/schoolplein)                                                                                                                                                                                               | No independently graded context                                                     |
| `de kat uit de boom kijken` / held-out       | Idiomatic waiting                         | [ANW sense 1.0](https://anw.ivdnt.org/article/de%20kat%20uit%20de%20boom%20kijken)                                                                                                                                                                       | Locally authored wording needs review                                               |
| `een oogje in het zeil houden` / calibration | Watchful idiom                            | [Onze Taal](https://onzetaal.nl/taalloket/werkwoordelijke-uitdrukking) lists the idiom and meaning                                                                                                                                                       | Locally authored wording needs review                                               |
| `aankomen` / calibration                     | Arrival; weight gain                      | [ANW grammar](https://anw.ivdnt.org/article/aankomen), [arrival usage](https://taaladvies.net/toekomen-of-aankomen/) and [weight-gain usage](https://taaladvies.net/bijkomen-of-verdikken-of-aankomen/)                                                  | Two contrasted drafts, not independent graded labels                                |
| `meebrengen` / held-out                      | Bring along                               | [Van Dale usage](https://www.vandale.nl/blogs/taaladvies/meenemen-of-meebrengen) and [Onze Taal usage](https://onzetaal.nl/taalloket/koekjes-meegenomen-meegebracht)                                                                                     | Example and separable construction need editorial review                            |
| `wortel` / held-out                          | Plant root; mathematical root             | [ANW senses 1.0 and 6.0](https://anw.ivdnt.org/article/wortel)                                                                                                                                                                                           | Two contrasted drafts, not independent graded labels                                |
| `quotiënt` / calibration                     | Mathematical quotient                     | [ANW sense 1.0](https://anw.ivdnt.org/article/quoti%C3%ABnt)                                                                                                                                                                                             | Zero exact NT2Lex rows is only a missing-corpus probe, not proof of rarity          |
| `zich wassen` / calibration                  | Wash oneself                              | [Onze Taal reflexive grammar](https://onzetaal.nl/taalloket/wederkerend-werkwoord) and [ANW `wassen`](https://anw.ivdnt.org/article/wassen)                                                                                                              | Reflexive use is optional; wording needs review                                     |
| `zich schamen` / held-out                    | Feel ashamed                              | [Onze Taal reflexive grammar](https://onzetaal.nl/taalloket/wederkerend-werkwoord), [ANW `schamen`](https://anw.ivdnt.org/article/schamen) and [WNT entry](https://gtb.ivdnt.org/iWDB/search?actie=article_content&id=M062241&lemmodern=schamen&wdb=WNT) | Obligatory reflexive use is supported; wording needs review                         |

Five further source-backed families are in authored v6:

- `treinstation` (calibration compound): the
  [Rijksdienst heritage term](https://kennis.cultureelerfgoed.nl/index.php/Begrip%3AD8200f5e-545b-4692-b2f8-13cbe5fa38d0)
  defines a train station; [ANW `station`](https://anw.ivdnt.org/article/station)
  confirms the component and lists the compound. Its example is locally authored.
- `cel` (calibration specialized/sense pair):
  [university biology use](https://www.universiteitvannederland.nl/college/zo-maak-je-zaadcellen-in-een-lab),
  [Dutch government prison use](https://www.rijksoverheid.nl/vraag-en-antwoord/straffen-en-maatregelen/welke-rechten-heeft-een-gedetineerde)
  and [ANW grammar](https://anw.ivdnt.org/article/cel) corroborate two contexts;
  both examples are locally authored.
- `slot` (calibration ambiguous): an
  [IVDNT-hosted historical dictionary](https://dagenta.ivdnt.org/wp-content/uploads/pdf/1897_koenen_verklarend-handwoordenboek-der-nederlandsche-taal.pdf)
  lists lock and castle separately. Modern usage needs review. The draft lists
  both glosses and omits an example.
- `blad` (held-out ambiguous):
  [Onze Taal](https://onzetaal.nl/taalloket/de-het-algemene-regels) names
  leaf and paper senses; [ANW grammar](https://anw.ivdnt.org/article/blad)
  confirms the noun. The draft lists both glosses and omits an example.
- `zygomatisch` (held-out rare-missing):
  [dental clinical use](https://www.parohaarlem.nl/nl/wat-is-een-zygomatisch-implantaat/)
  and [professional association use](https://www.nvcg.nl/wp-content/uploads/2019/01/Cg-magazine-december-2018.pdf)
  support the cheekbone-related adjective. Zero exact NT2Lex rows is a
  missing-corpus probe, not proof of lexical rarity.

The six base pack entries derive from `packages/content/src/dutch-a1.json`,
SHA-256 `80e416942dc3718f6f5d169b2966d0fd7f7b8825c4527b3f13c8caab002339ca`.
Its A1 packaging establishes local provenance, not a meaning-level CEFR
standard. Pack-linked plural and conflict examples, and the authored
sense examples, are original local drafts; lexical sources corroborate the
target meaning or grammar without licensing the source's text for reuse.

The conflict examples pair Dutch and English sentences that agree with each
other but do not illustrate their linked lemma/gloss. `abstain` is a
provisional expectation for policy design, not an adjudicated output.

## Actual slice coverage and remaining work

The 27 draft inputs cover all eleven required slices in both splits, with
one to four inputs per cell. The two ambiguous drafts deliberately omit
examples; each lists competing senses and has a provisional `abstain`
expectation. `quotiënt` and `zygomatisch` probe missing exact NT2Lex rows,
not established lexical rarity. Full **draft** coverage is not adequate
calibration: most cells have only one item, no minimum denominator has been
fixed, and no input has a reviewed level or independent meaning-level graded
evidence. Source rights, editorial wording, provider scope and policy remain
unreviewed. D11.2 remains unqualified.

## Next exact action

Review all 27 exact inputs and their sources, paying special attention to
the historical `slot` reference, adversarial conflicts and deliberately
context-free ambiguous cases. Then collect independently graded meaning-level
evidence, record honest unresolved cases, establish adequate per-slice
denominators and freeze the review policy before any new provider scoring.
The two remaining personal Gemini attempts apply only to the original 24
pilot meanings; these 27 drafts are not approved for transmission.
