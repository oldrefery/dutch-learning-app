# D13A.7.5 — Remediation and qualification-gate review

Date: 2026-10-11. Local prescribed review complete; qualification is not approved.
Scope: code, retained responses, synthetic reproduction and qualification conditions.
New provider calls: **0**. Credentials were not accessed. AUTH-30 remains consumed.

## Review decision

The thoughtSignature parsing fix, structured request schemas, v2 prompt/config policy
binding and immutable offline replay are accepted as local engineering remediation.
No regression was found in those changes. The current candidate packet is not ready
for a qualification/activation decision: two pre-existing qualification gaps are now
specified below. They are not newly introduced parser regressions. Production flags
remain OFF, and this review neither modifies runtime code nor grants activation.

### SEM-REVIEW-01 — P1: enforce observed versions before acceptance

Location: `supabase/functions/dictionary-analysis/independentEvaluator.ts:182`,
with configuration in `semanticModel.ts:62` and generation through `endpoint.ts`.
The evaluator checks the requested model recorded in the semantic journal, but does
not compare either retained provider_response.modelVersion with a qualified expected
version. A valid, correctly hash-bound same-meaning verdict can therefore produce
accepted under missing or different generator/judge versions. Pinning a requested
model string and recording a pilot modelVersion does not implement this runtime gate.
No SQL modelVersion check exists on this independent-analysis path either.

A local synthetic stored-result probe reproduced four cases: missing/wrong generator
version and missing/wrong judge version. All four returned accepted; the matching
control also returned accepted. The probe uses the actual evaluator, correctly rebuilt
result/content/request hashes and a returned journal record. Any dispatch or write
throws. These are synthetic gate probes, not measured semantic false accepts.
Evidence: `reports/shared-dictionary-cefr/d13a7-semantic-review-20261011/version-probe.ts`
and `version-probe.json` (five assertions, zero network/env permissions).

Required local closure: explicitly bind expected observed generator and judge versions
into the exact qualified policy/configuration; reject or require review on missing or
mismatched versions for both fresh results and resumed/reconciled stored results.
Preserve receipts and unknown-outcome accounting; never retry to obtain a preferred
version. Cover independent updates and first-creation paths sharing this evaluator,
and retain old terminal-receipt replay semantics. Verify SQL policy/readiness and
publication binding still use the resulting exact profile. A version mismatch must
not yield accepted content or dispatch an unnecessary judge. Re-seal a new candidate
only after regression tests and review; the existing candidate remains historical.

### SEM-REVIEW-02 — P2: broaden and review the qualification corpus

Location: `scripts/shared-dictionary/semantic-qualification-corpus.ts:176` onward,
with proposal and thresholds in `semantic-qualification.ts:125`.
The24 cases contain8 positives,8 negatives,6 uncertain and2 local guards. All8 negative
cases mutate one financial-bank anchor. All lexical entries are nouns; positives use
four senses across three lemmas. There is no positive non-null usage_notes fixture,
no negative non-null contrast-example fixture, and no successful measured generated
content followed by its independent judge. Twice evaluating each negative gives16
results, not16 independent senses. This is an adequate small diagnostic corpus but
insufficient for the intended broader shared-dictionary qualification.

The existing labels/rationales were inspected for consistency with the protected
anchors and exact prompt: explicit sense substitutions are contradictions; injection
cases expect uncertainty by prompt policy; weak anchors intentionally abstain. This
inspection does not upgrade proposed labels to independent human linguistic review.
The seat gloss permits both bench and sofa; retain that documented sense scope or
split it explicitly before freezing new expectations. Do not adjust labels after
seeing results merely to improve measured rates.

Required local closure: prepare a coverage matrix crossing all six judged dimensions
with positive, contradictory and insufficient-evidence cases across multiple senses
and the intended parts of speech. Include valid contrast notes discussing another
sense without changing the selected meaning, non-null translated contrast examples,
incorrect nested translations/examples, related-word and grammar traps, and uncertain
or injected evidence. Bind reviewed expected labels, rationales and any exclusions to
an exact corpus hash. Use owner/human review where required by the qualification
record; do not claim that an independent person or reviewer was available here.
Record counts by unique case/sense and repeated attempt separately. Extend generation
and independent-judge coverage beyond the two current noun inputs, or explicitly
limit the eventual qualified scope with a runtime-enforced restriction.

## Conditions for closing checkpoint5

The remaining route inside D13A.7.5 is fixed at **three work packages**. These refine
the existing checkpoint; they do not add numbered milestones or represent three
promises of successful runs.

1. **Local readiness:** close SEM-REVIEW-01 and SEM-REVIEW-02; review the resulting
   version-bound profile, source, prompts, schemas and corpus. Freeze a concrete
   operation packet with expected outcomes, per-category and end-to-end acceptance
   conditions, permitted scope, call/cost ceilings, expiry and immutable journaling.
   Existing candidate29151401... and AUTH-30 are not authority for changed work.
2. **Measured qualification:** only after separate explicit authority, measure the
   exact frozen configuration against the reviewed corpus and generation+judge
   cases. Verify actual provider versions, structured-response support/adherence,
   full receipt counts and outcome accounting. No such calls are authorized now.
   Offline replay cannot replace this measurement. Unknown outcomes stop for
   reconciliation and still consume the attempt allowance.
3. **Final evidence review:** inspect every malformed/unsafe/uncertain failure and
   generated result, evaluate the preregistered thresholds and coverage, and record
   a scope-bound qualified or not-qualified decision. Activation is still D13A.8.
   Failed measurement returns to the relevant work package; do not reset completed
   review or disguise a repeated run as a new milestone.

The old pilot thresholds remain historical diagnostic thresholds: zero false accepts,
zero invalid verdicts, zero missing/mixed versions, positive acceptance at least0.875,
negative rejection at least0.875 and uncertain abstention at least0.833. The replay
fails the invalid-verdict condition (3). Even a pass on that narrow corpus would not
close the broader gate. Review expanded-corpus thresholds before measurement; never
infer population accuracy from zero errors on repeated synthetic cases. Generated
outputs must pass both guards and independently reviewed same-meaning judgments;
structural validity alone is insufficient. Keep all denominators and exclusions visible.

## Checks and evidence

- Entry integrity:3817 SHA references verified, no mismatch;628 dirty paths retained.
- Fresh focused Deno tests:47/47 with typecheck (schema10, semantic33, replay4).
  No network/environment permissions. Command and logs are in the paired manifest.
- Fresh replay:46 original provider responses,94 sealed files verified before/after;
  byte-equivalent JSON result to the previous replay.41/44 verdicts parse,3 correctly
  remain invalid;14/16 positive accepts,16/16 negative rejects,11/12 uncertain,
  zero false accepts on this corpus. Bank generation is malformed; slot passes guards
  only. Neither original generated output has a live independent-judge result.
- Fresh gate diagnostic:five synthetic assertions, including four unsafe accepted
  outcomes proving SEM-REVIEW-01. These are not included in the47 regression tests.
- The previous103-test run remains verified historical evidence; it was not rerun
  wholesale. Runtime/source hashes, all94 provider files and candidate packet unchanged.
- Current documentation checked through Context7, then the primary REST guide because
  retrieved snippets mixed Interactions and legacy generateContent. The code's
  responseFormat.text shape matches the [REST structured-output example](https://ai.google.dev/gemini-api/docs/generate-content/structured-output?hl=en).
  The [Part reference](https://ai.google.dev/api/generate-content) documents the
  optional opaque thoughtSignature. This supports request/parser syntax; it does not
  establish the provider's adherence to our particular nested schema.

Reports: `reports/shared-dictionary-cefr/d13a7-semantic-review-20261011/`.
Persistence: local-only, uncommitted; feature/shared-dictionary-schema/f97a733.
No source/test/migration changes, hosted operations, key reads, paid requests,
commits, releases, device operations or activation. All runners exited.

## Progress and exact continuation

D13A.7 remains **4/6 complete,2 remain**:5 semantic qualification;6 actual devices,
old-build/repair-OTA compatibility, offline return and performance. Today's requested
review is complete inside checkpoint5; it is not evidence of model qualification.
Eight broad milestones remain: D13.6,D13A.7,D13A.8,D13A.9,D14.1,D14.2,D14.3,D14.4.

Next: **GPT-6.1 Sol / High**, local readiness work package1: implement observed-version
fencing with regressions and expand the corpus/qualification packet for review, with
zero new paid calls. Subsequent prescribed review: GPT-6 Astra / High. No model-picker
change or independent agent is claimed. User authorization remains local only.
