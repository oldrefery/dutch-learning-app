# D11 meaning-level validation protocol — 2026-10-04

## Why the completed pilot cannot qualify a method

The v3 diagnostic used the same 24 inputs and assistant-inferred reference
as v2. Its 19/19 agreement and 2/2 ambiguity-probe abstentions show a
prompt improvement on this sample, not measured CEFR accuracy. The
reference was prepared before Gemini's responses but lacks independent
meaning-level adjudication. The diagnostic report is explicitly
`qualified: false`.

The current sample is structurally too small for the operational gate in
`cefr-calibration/policy.ts`. That gate checks every required slice in both
calibration and held-out splits. The v3 report has no `separable-verbs` or
`conflicting-examples` item in calibration, and no `inflections` or
`ambiguous` item held out. Many other slice/split cells have one item. No
positive per-slice minimum could be satisfied by the empty cells, even if
the provisional labels were later reviewed. Repeating these 24 inputs
cannot fix either missing coverage or reference independence.

## Next fixture construction

1. Select a new pool of distinct, licensed project meanings, without
   personal account exports. Include exact senses of homographs, verb
   forms, phrases, ordinary and specialized uses, missing-source cases,
   deliberately ambiguous context and gloss/example conflicts. Review
   linguistic metadata before assigning any expected level.
2. Keep source provenance per meaning: exact repository entry/revision,
   canonical input and SHA-256, sense-level lexical references, any
   independently graded learning material, date accessed and permitted
   use. A corpus occurrence at a given text level is supporting evidence,
   not by itself a label. Do not infer a level from pack names, lemma-only
   lists, frequency counts, or model confidence.
3. Review each meaning without seeing a candidate from the model under
   test. Assign an acceptable level set only when source-backed evidence
   supports that exact sense. Otherwise record expected abstention or a
   disputed/unreviewed state. Record the actual reviewer identity and
   adjudication rationale; autonomous assistant review must be identified
   as such, never represented as external human review or independent gold.
4. Partition by meaning family before provider scoring. Keep all senses
   of a homograph and exact/near duplicates in one split. Cover every
   required slice in both calibration and held-out splits. Set sample-size
   requirements and acceptance thresholds in an explicit reviewed policy
   before viewing provider results; do not choose thresholds from the
   24-item pilot's apparent success.
5. Freeze a versioned fixture and source dossier with hashes. Run local
   parser/partition/report tests first. Only a separately authorized
   provider sample for this new fixture may measure the method on its
   held-out portion. The remaining two-attempt approval is scoped to the
   original 24 meanings and does not authorize transmission of new items.

## Qualification boundary

Until the meaning-level reference, held-out coverage, reviewed policy,
provider results and server-only qualification approval all exist, retain
`qualified: false`, the worker and schedule disabled, and public CEFR
assessments unchanged. The current diagnostic results can guide prompt
design and error analysis only. NT2Lex can be cited as an independent
graded-frequency signal, subject to its usage terms, but its automatic
sense tags and frequency columns are not a reviewed fixture.

On October 4 the owner accepted a narrower
[offline D11.2 diagnostic closure](D11-offline-diagnostic-closure-20261004.md)
without independent gold. This does not waive any qualification or
worker-activation condition in this protocol.
