# D11 structural abstention review — 2026-10-04

## Scope and decision

I rechecked the four hash-bound inputs in the
[structural draft](D11-structural-abstention-draft-20261004.json) against the
latest [pack v3](D11-new-reference-pack-inputs-20261004-v3.json) and
[authored v6](D11-authored-sense-inputs-20261004-v6.json) dossiers. The
assistant's editorial decision is to **retain provisional abstention for
all four**. This is a diagnostic rule review, not independent meaning-level
gold, a frozen operational fixture, a CEFR label or permission to send the
inputs to a provider.

| Input                       | Exact-input review                                                                                                                                                                                                                                                                                   | Provisional rule                                                                                |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `candidate-straat-conflict` | Lemma/gloss denote a street, but the Dutch and English example pair concerns a wall clock. The two example languages agree with each other, so translation consistency does not resolve the cross-field contradiction.                                                                               | Abstain on the assessed record; do not silently discard the example and label the street sense. |
| `candidate-winkel-conflict` | Lemma/gloss denote a shop, but the example pair concerns cold weather. The same cross-field contradiction remains.                                                                                                                                                                                   | Abstain on the assessed record.                                                                 |
| `candidate-slot-ambiguous`  | One neutral noun record lists both lock and castle and has no example or usage note. A [modern Dutch dictionary entry](https://www.woorden.org/woord/slot) distinguishes these senses and an additional ending sense; its lexical distinction does not choose one for this input.                    | Abstain until one sense is selected or contextualized.                                          |
| `candidate-blad-ambiguous`  | One neutral noun record lists leaf and sheet of paper with no example or usage note. A [modern Dutch dictionary entry](https://www.woorden.org/woord/blad) distinguishes both and other senses. [ANW's entry](https://anw.ivdnt.org/article/blad) currently supplies grammar but no meaning profile. | Abstain until one sense is selected or contextualized.                                          |

The rule is about the **whole canonical assessment input**, not a claim
that `straat` or `winkel` themselves have unknown meanings. A later
editorially repaired input would have a different canonical hash and
would require its own review. For context-free polysemy, even two senses
that could ultimately share a CEFR band must not be merged into a
single sense-level reference without disambiguation.

The four hashes and proposed splits were checked against the dossiers;
`straat` and `slot` are in calibration, `winkel` and `blad` are held out.
Their other family members remain in the same split, preserving family
isolation. The reviewed rule adds no positive level and does not count
these four as graded observations. The draft JSON retains
`assistant_preliminary` and `operational_reference: false` until the
review policy and independent reference gate are satisfied.

## Exact-context follow-up: `meebrengen`

[KU Leuven's task suggestion 2.2](https://www.arts.kuleuven.be/cto/materialen/volwassenen/behoeftegericht-geintegreerd-nt2-onderwijs/school-en-ouders/materialenbank-school-en-ouders/watmoetjemeebrengen01.pdf)
contains a first-party bring-along use in its school-material activity,
which matches the drafted verb sense. The same one-page suggestion
explicitly lists both goals 1.1 and 1.2. The separately indexed learner
worksheet appears in search results with a 1.2 attribution, but the
worksheet itself was not retrievable for page-level inspection during
this review. Consequently, this is a **mixed-level contextual lead**, not
an admissible single-level observation in the graded ledger. The input
remains among the twelve lexical/form gaps. Inspect the learner worksheet
and its provenance before adding any graded row; do not infer a word-sense
CEFR level from either task level.

## Remaining gate

Define the exact handling of inflected forms, unsupported specialist
meanings and conflicting source-level labels; review source rights and
sense identity; set adequate per-slice denominators; and obtain a
meaning-level reference independent of the provider under test. Keep
all four expected outputs preliminary and D11.2 unqualified meanwhile.
