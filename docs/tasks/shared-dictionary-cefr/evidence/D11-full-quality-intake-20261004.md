# D11 full-quality reference intake — 2026-10-04

Starting revision `a15e721` on `feature/shared-dictionary-schema`.
The owner selected the original full D11 quality gate and reported that
their prior level judgments agree with a teacher's judgments. Teacher
scope and timing are still unconfirmed. No new provider request or
external reviewer contact occurred in this checkpoint.

## Two separate review packets

1. [Historical 24-input teacher-scope packet](D11-teacher-scope-packet-20261004.json),
   SHA-256 `984a3051dd3aba5d3ba937efd356449e90ab28faa1aa74eefc3400556c06d971`.
   It contains the exact content and canonical input hash for every
   previously scored pilot item, but no assistant/Gemini levels, scores,
   source-pack cues or split/slice assignments. It exists to determine
   precisely which historical teacher judgments, if any, refer to these
   exact meanings. It cannot turn the viewed v3 run into a new held-out
   test.
2. [New 27-input blind review packet](D11-blind-review-packet-20261004.json),
   SHA-256 `a7c72025b7ca7e1c59d4f12c6bb384d404c6c5ecf5ef732c67c642b08236b9e7`.
   It contains exact content and input hashes from the ten bundled-pack
   and seventeen authored candidates, without proposed levels, model
   outputs, source-pack cues or split/slice assignments. The pool has
   20 families and 27 unreviewed inputs. It is a **review packet**, not
   a reviewed fixture and not approved for provider transmission.

Both packets were generated only from existing local dossiers. For all
51 items, the SHA-256 of the stored canonical input was recomputed and
matched its input hash; each packet has unique IDs and hashes. The
historical packet has 24 items and the new one 27. No model predictions
or teacher labels are present. Packet generation did not change a
canonical input or the frozen v3 report.

## Provenance intake for a historical teacher judgment

For each claimed teacher match, capture the exact packet ID/hash,
whether the teacher saw the **sense and example** or only the word,
the original level or acceptable range, the date or relative timing,
whether assistant/Gemini suggestions were visible, and the original
record or an explicit owner recollection. Identify the teacher by a
private stable reviewer reference, not by personal details in portable
task documents. Distinguish `exact_sense`, `lemma_only` and
`scope_unknown`; distinguish `original_record` from `owner_recollection`.

An exact-sense original judgment made independently of the evaluated
method can become an independent human reference **for that item**.
A lemma-only or recalled judgment is corroboration, not an exact-input
gold label. All previously viewed pilot items remain development/error
analysis even if a teacher's original label is later recovered. Neither
the frozen assistant reference nor the v3 report is edited or rescored.
The context-free `licht` and internally conflicting `lopen` inputs
require an input-level abstention review regardless of a teacher's
level for the familiar word.

## Prospective new reference

The new 27-input packet gives a reviewer the exact linguistic input
without candidate answers. Store returned reviews in a **separate**
versioned file with these fields per item: packet ID/hash, reviewer
reference, review date, `exact_sense`/`lemma_only` scope, whether model
answers were visible, acceptable level set or expected abstention,
rationale, source references and disagreement status. Never fill a
missing level by copying a bundled pack title or a graded text level.
Second review/adjudication is required for disagreements. If no
independent reviewer exists for a proposed positive label, keep it
unreviewed and `qualified: false`.

The current proposed distribution is:

| Slice                | Calibration | Held out |
| -------------------- | ----------: | -------: |
| ambiguous            |           1 |        1 |
| compounds            |           1 |        1 |
| conflicting-examples |           1 |        1 |
| idioms               |           1 |        1 |
| inflections          |           1 |        1 |
| ordinary             |           3 |        4 |
| rare-missing         |           1 |        1 |
| reflexive-verbs      |           1 |        1 |
| sense-pairs          |           4 |        2 |
| separable-verbs      |           2 |        1 |
| specialized          |           1 |        1 |

These 22 cells contain 32 slice memberships because some inputs belong
to multiple slices. Reaching even five reviewed memberships per cell
requires 78 additional memberships before rejected/disputed inputs;
that is a screening floor, not a statistically strong policy. The
prospective policy must state its denominator and accuracy thresholds
before any new provider results. Keep families together and exclude
all historical pilot items from the fresh held-out score. An exact
new-input manifest, destination and spending bound must be approved
separately before a live sample. Worker and schedule remain OFF.
