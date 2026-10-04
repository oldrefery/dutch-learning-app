# D11 new-reference candidate pool — 2026-10-04

**State: local inventory, unreviewed.** This is neither a calibration fixture nor
independent CEFR gold. None of these proposals is approved for provider
transmission. The remaining two personal Gemini attempts apply only to the
previously frozen 24 meanings. No expected level is assigned here.

## Source and partition rules

- `P` means an exact entry in `packages/content/src/dutch-a1.json`, SHA-256
  `80e416942dc3718f6f5d169b2966d0fd7f7b8825c4527b3f13c8caab002339ca`.
  Its owner-controlled linguistic text may be used locally. The pack's A1
  title and editorial utility review are not a meaning-level CEFR label.
- `D` means a _proposed_ local derivation or adversarial input. Its exact text,
  linguistic sense, rights and source references still need review. It does not
  inherit approval or CEFR level from a related pack entry.
- Pilot lemmas are excluded from this pool. Different senses, forms and
  adversarial variants of one lemma must stay in the same split. The split
  assignments below are tentative family partitions, not frozen hashes.
- NT2Lex's publisher TSV can corroborate graded-text occurrence after exact
  sense matching; its automatically tagged frequencies cannot assign a CEFR
  level. The private downloaded file stays outside the repository. The CEFR
  Companion Volume provides repertoire descriptors, not word-by-word labels.

## Candidate families

| Split       | Candidate family               | Proposed slice(s)            | Local basis                              | Evidence still needed                                                  |
| ----------- | ------------------------------ | ---------------------------- | ---------------------------------------- | ---------------------------------------------------------------------- |
| calibration | `tafel`                        | ordinary; inflections        | P `a1-003-tafel`                         | Draft plural input review and independent level evidence               |
| held_out    | `stad`                         | ordinary; inflections        | P `a1-009-stad`                          | Draft plural input review and independent level evidence               |
| calibration | `werk`                         | ordinary                     | P `a1-013-werk`                          | Independent graded evidence for the exact pack sense                   |
| held_out    | `goed`                         | ordinary                     | P `a1-039-goed`                          | Independent graded evidence for the exact pack sense                   |
| calibration | `zich wassen`                  | reflexive-verbs              | D                                        | Licensed exact sense, grammar and example                              |
| held_out    | `zich schamen`                 | reflexive-verbs              | D                                        | Licensed exact sense, grammar and example                              |
| calibration | `aankomen`                     | sense-pairs; separable-verbs | D                                        | Separate arrival/weight-gain senses, inputs and graded contexts        |
| held_out    | `meebrengen`                   | separable-verbs              | D                                        | Licensed exact sense, separability and example                         |
| calibration | `treinstation`                 | compounds                    | D, related P `a1-007-trein`              | Compound sense, rights and independently graded context                |
| held_out    | `schoolplein`                  | compounds                    | D, related P `a1-012-school`             | Compound sense, rights and independently graded context                |
| calibration | `een oogje in het zeil houden` | idioms                       | D                                        | Lexicalized idiom sense, rights and example                            |
| held_out    | `de kat uit de boom kijken`    | idioms                       | D                                        | Lexicalized idiom sense, rights and example                            |
| calibration | `cel`                          | specialized                  | D                                        | Domain-specific sense and context; separate homographs stay together   |
| held_out    | `wortel`                       | sense-pairs; specialized     | D                                        | Separate plant/mathematical senses, inputs and graded contexts         |
| calibration | `quotiënt`                     | rare-missing                 | D                                        | Check source absence or scarcity; do not assume rarity from intuition  |
| held_out    | `zygomatisch`                  | rare-missing                 | D                                        | Check source absence or scarcity; do not assume rarity from intuition  |
| calibration | `slot`                         | ambiguous                    | D                                        | Two documented competing senses and intentionally insufficient context |
| held_out    | `blad`                         | ambiguous                    | D                                        | Two documented competing senses and intentionally insufficient context |
| calibration | `straat`                       | conflicting-examples         | P `a1-010-straat`; D conflicting variant | Exact authored conflict, expected abstention rationale                 |
| held_out    | `winkel`                       | conflicting-examples         | P `a1-011-winkel`; D conflicting variant | Exact authored conflict, expected abstention rationale                 |

Every required slice has at least one **proposed** family per split (ordinary
and inflections share a family in each split). The rows with `D` are research
leads, not ready fixture items. The current
[source screen](D11-sense-source-screen-20261004.md) binds 27 draft inputs
across all 20 families and covers every proposed slice/split cell.
The `P` rows have canonical hashes but still need meaning-level graded
evidence. No row has an adjudicated CEFR label.

An exact case-folded `word` check against the separately held NT2Lex TSV
(SHA-256 `37dc6b6e208d271e07283c082b3bf78ca07e28cc005ca445f52e6cd4ee0bc5b7`)
found rows for 14 of these 20 strings: `tafel` 1, `stad` 1, `werk` 5,
`goed` 5, `aankomen` 6, `meebrengen` 1, `treinstation` 1,
`schoolplein` 1, `cel` 4, `wortel` 3, `slot` 5, `blad` 3, `straat` 3 and
`winkel` 1. The other six strings had zero exact rows. Multirow counts do
not establish a particular sense; zero exact rows do not establish rarity
or absence in Dutch. No TSV rows are copied into this document.

## Dossier and gate before fixture construction

For each family, record exact Dutch lemma/form, part of speech, English gloss,
Dutch and English examples, source entry/revision or locally authored text,
lexical sense reference, graded learning evidence where available, license,
access date, canonical input SHA-256, reviewer identity and rationale. If
source evidence cannot support an exact level, leave the label unreviewed or
mark a justified abstention. Verify the family partitions and the full
slice-by-split matrix with the fixture validator. Freeze a reviewed policy
before any new provider results. This inventory alone does not satisfy D11.2.
