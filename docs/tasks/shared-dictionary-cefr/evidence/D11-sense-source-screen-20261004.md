# D11 sense/source screen — 2026-10-04

## Scope and result

This is a read-only, pre-provider screen of the
[20-family candidate pool](D11-new-reference-candidate-pool-20261004.md).
It does not assign CEFR levels, approve new provider transmission or create an
operational fixture. The existing v2/v3 Gemini outputs were not used as
references. Source access was checked on 2026-10-04; dictionary links may
change. No external dictionary text or corpus rows were copied into the app.

Six exact owner-controlled pack entries now have locally validated full
`DictionaryContent`, canonical assessment inputs and SHA-256 bindings in
[the unreviewed input dossier](D11-new-reference-pack-inputs-20261004.json).
They were produced from the pack entry with the same neutral defaults as the
prior diagnostic, parsed by `parseDictionaryContent`, canonicalized by
`canonicalizeCefrInput`, then independently re-parsed and hash-checked.
This binds the _base pack meanings only_. It does not create plural-form,
second-sense or deliberately conflicting variants.

| Split       | Pack meaning      | Exact entry     | Input SHA-256                                                      | Status     |
| ----------- | ----------------- | --------------- | ------------------------------------------------------------------ | ---------- |
| calibration | `tafel` / table   | `a1-003-tafel`  | `174e1a545fa8bb385fb3060e3d8f3cb6aa664bd254926b219e240f738ceab2a1` | Unreviewed |
| held_out    | `stad` / city     | `a1-009-stad`   | `1cff8978993c31157e6f70f38012ae2ee94b3ddf9f27635eef27416672d182be` | Unreviewed |
| calibration | `werk` / work     | `a1-013-werk`   | `2fc6c984f33a82c327bbcc77c88a581d4b685fb4bd375880023d664c81224a9b` | Unreviewed |
| held_out    | `goed` / good     | `a1-039-goed`   | `ce499e1218b29e40004f9562683768a7d8338ea3535a3a7ebcf11e80609e89d9` | Unreviewed |
| calibration | `straat` / street | `a1-010-straat` | `3c0e2ec275e350166806773697a1691cd19fec58d38f06833220faab3019555f` | Unreviewed |
| held_out    | `winkel` / shop   | `a1-011-winkel` | `01c348c66d1ad3075e8a797e852e97e8efcd868c84be0e49bbb6053b2c2c8199` | Unreviewed |

The pack file SHA-256 is
`80e416942dc3718f6f5d169b2966d0fd7f7b8825c4527b3f13c8caab002339ca`.
Its A1 packaging and editorial review establish ownership and utility, not a
meaning-level CEFR standard. The JSON dossier explicitly has no levels and
`provider_approved: false`.

## Independent lexical checks

The [ANW article for `tafel`](https://anw.ivdnt.org/article/tafel) confirms
the noun and plural `tafels`, and [the `stad` article](https://anw.ivdnt.org/article/stad)
confirms plural `steden`. Both articles currently expose grammar without a
meaning profile; they corroborate morphology, not CEFR or a new inflection
input. [The `werk` article](https://anw.ivdnt.org/article/werk) also lacks a
meaning profile, so the proposed second sense is unsupported there.
[The `goed` article](https://anw.ivdnt.org/article/goed) distinguishes
adjectival from nominal use, but has no meaning profile; the pool was
corrected from an adjectival/adverbial to an adjectival/nominal proposal.
[The `straat` article](https://anw.ivdnt.org/article/straat) confirms the
noun and plural but no meaning profile. The exact `winkel` ANW page was not
reliably retrievable in this screen; the pack entry remains the local source.

Four proposed authored families have an ANW sense anchor:

| Candidate                   | ANW evidence                                                                   | What it establishes                                         | Still missing                                                                |
| --------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `schoolplein`               | [sense 1.0](https://anw.ivdnt.org/article/schoolplein)                         | School-adjacent outdoor area, compound structure and plural | Owner-authored assessment input and independent graded context               |
| `de kat uit de boom kijken` | [sense 1.0](https://anw.ivdnt.org/article/de%20kat%20uit%20de%20boom%20kijken) | Idiomatic waiting/observing use                             | Owner-authored example, usage rights and graded context                      |
| `wortel`                    | [sense 6.0](https://anw.ivdnt.org/article/wortel)                              | Mathematical root distinct from plant/carrot senses         | Exact math input and independent graded context                              |
| `quotiënt`                  | [sense 1.0](https://anw.ivdnt.org/article/quoti%C3%ABnt)                       | Mathematical quotient; confirms the word is documented      | Exact input and graded context; zero NT2Lex exact rows does not prove rarity |

[ANW `schamen`](https://anw.ivdnt.org/article/schamen) marks the verb
reflexive, and [ANW `aankomen`](https://anw.ivdnt.org/article/aankomen)
shows separated forms such as `komt aan`. Neither page supplies a meaning
profile for the exact proposed sense. [ANW `wassen`](https://anw.ivdnt.org/article/wassen)
distinguishes the cleaning verb from other homographs but does not by itself
verify the proposed `zich wassen` construction. All three therefore remain
grammar-supported leads, not reviewed sense inputs.

The other authored leads (`meebrengen`, `treinstation`, the first idiom,
`cel`, `zygomatisch`, `slot` and `blad`) remain without a verified exact
sense dossier in this screen. A failed or redirected lookup is not evidence
that a Dutch meaning is absent. `quotiënt` now has a lexical sense reference
despite its zero exact NT2Lex rows: its `rare-missing` proposal can at most
test missing _corpus_ evidence, subject to a prespecified slice definition.

## Next exact action

Define owner-authored, sense-distinguishing inputs for viable `D` rows;
replace candidates whose senses cannot be verified. Keep related variants
in one family/split. Re-run canonical validation and bind each input to its
source. Obtain independently graded learning evidence where possible and
record unresolved cases honestly. Only after this source work can the
reviewed policy, minimum denominators and held-out fixture be frozen.
