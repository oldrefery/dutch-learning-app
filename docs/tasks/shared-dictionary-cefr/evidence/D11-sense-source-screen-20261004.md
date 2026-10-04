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
[authored dossier](D11-authored-sense-inputs-20261004-v4.json) contains eleven
inputs across nine families. Earlier dossier versions remain historical
snapshots; use these two latest files together. All 21 `DictionaryContent`
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

The six base pack entries derive from `packages/content/src/dutch-a1.json`,
SHA-256 `80e416942dc3718f6f5d169b2966d0fd7f7b8825c4527b3f13c8caab002339ca`.
Its A1 packaging establishes local provenance, not a meaning-level CEFR
standard. Pack-linked plural and conflict examples, and all eleven authored
sense examples, are original local drafts; lexical sources corroborate the
target meaning or grammar without licensing the source's text for reuse.

The conflict examples pair Dutch and English sentences that agree with each
other but do not illustrate their linked lemma/gloss. `abstain` is a
provisional expectation for policy design, not an adjudicated output.

## Actual slice coverage and remaining work

The 21 draft inputs cover both splits for ordinary, inflections,
reflexive-verbs, sense-pairs, separable-verbs, idioms and
conflicting-examples. Five proposed slice/split cells still have **no exact
input**:

| Split       | Missing slice | Proposed family still requiring an exact source/input |
| ----------- | ------------- | ----------------------------------------------------- |
| calibration | compounds     | `treinstation`                                        |
| calibration | specialized   | `cel`                                                 |
| calibration | ambiguous     | `slot`                                                |
| held-out    | rare-missing  | `zygomatisch`                                         |
| held-out    | ambiguous     | `blad`                                                |

The five proposed families above have no verified exact sense dossier in
this screen. [ANW `station`](https://anw.ivdnt.org/article/station) lists
`treinstation` as a compound, but this indirect reference is not an exact
entry. A failed lookup is not evidence that a Dutch meaning is absent.
Replace unsupported candidates if reliable references cannot be found.
Actual slice counts do not satisfy minimum denominators, and the 21 drafts
have no reviewed levels, independent meaning-level graded evidence,
approved provider scope or frozen policy. D11.2 remains unqualified.

## Next exact action

Find precise references and author inputs for the five missing cells, or
replace their families with defensible candidates while preserving split
isolation. Revalidate canonical hashes and source rights. Then collect
independently graded meaning-level evidence, record honest unresolved cases,
review labels and freeze the policy/minimum denominators before any new
provider scoring. The two remaining personal Gemini attempts apply only to
the original 24 pilot meanings; these 21 drafts are not approved for
transmission.
