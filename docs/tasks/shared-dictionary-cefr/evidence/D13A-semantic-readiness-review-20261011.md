# D13A.7.5 readiness review — 2026-10-11

Outcome: one actionable SQL regression; current source-bound packet is not approved
for measurement. Runtime,corpus,tests and frozen packets were not changed. New paid
provider calls0,API-key access0. Local-only/uncommitted review evidence.

## P1 SEM-READY-01 — retain in-flight creation responses

Location: `supabase/migrations/20261011220000_bind_dictionary_observed_model_versions.sql:78`.
The new observed-version branch runs before the existing returned/charged judge check.
After a valid generator response and a charged judge dispatch,call the service-only
`validate_dictionary_creation_v1` before the judge returns. Its null response fails the
version comparison and produces an immutable `review-required` validation/terminal run.
When the genuine response arrives,`record_dictionary_creation_judgement_v1` rejects it
with `terminal-creation-run`;the charged attempt remains dispatching with no raw result.

The normal TypeScript worker already waits for returned attempts;this is a regression
in the independently callable SQL authority boundary,not a claimed public-client exploit.
The historical profile rejects premature validation with
`independent-creation-evidence-required`,then retains the actual returned result.
A disposable local PostgreSQL reproducer confirms both behaviors with no network provider:

| Profile            | Premature validation         | Later journal           | Raw result retained |
| ------------------ | ---------------------------- | ----------------------- | ------------------- |
| Historical control | Rejected                     | Accepted;run validating | Yes                 |
| independent-v3     | review-required;run terminal | terminal-creation-run   | No                  |

Repair: check returned/charged/bound judge evidence before treating missing/wrong
observed model metadata as a terminal classification. An in-flight or quarantined
attempt must remain pending/non-validatable,with its existing charge and recovery path.
Add the v3 early-validation/late-response SQL regression and retain existing returned
wrong-version,generation-no-extra-charge and unknown/reconciled/terminal replay cases.
After source changes,freeze a new packet;never rewrite the reviewed candidate.

Reproducer and observed rows are in
`reports/shared-dictionary-cefr/d13a7-semantic-readiness-review-20261011/creation-pending-probe.mjs`
and `creation-pending-probe.json`. Both diagnostic assertions pass by reproducing the
regression;they are not evidence that the defect is fixed.

## Other fix review

Exact typed generator/judge version comparisons and explicit policy-v3 pins fix the
original acceptance gap. Missing/non-string/suffix variants cannot accept,unqualified
generation cannot buy a judge slot;terminal receipts remain recoverable in the examined
worker paths. Private SQL dispatch/accepted-validation guards cover direct update bypass.
Runtime enabled configuration requires both observed pins;disabled default remains OFF.
No new issue found in these paths. SEM-REVIEW-01's original unsafe-acceptance gap stays
closed locally;SEM-READY-01 is a separate lifecycle regression introduced by its SQL fix.

## All42 proposed labels reviewed

Reviewed every anchor,candidate,expected label and rationale against the exact prompt.
14 positive,14 negative,12 uncertain,2 guard cases;0 label corrections proposed.
Positive excluded contrasts do not assert the excluded sense;their nested translations
remain consistent. Nested negative castle translation is wrong despite a correct
exclusion elsewhere. Irregular lopen,separable opbellen,brightness and decision idiom
cases agree with supplied anchor grammar/meaning. English/Russian errors are isolated
as stated. Injection uncertainty is a policy expectation of this exact prompt.

The case-by-case notes are in `label-audit.json` beside the reproducer. This is a model
review of internal consistency,not independent human linguistic certification. The old
all-six-dimensions tags are coverage metadata,not six independent failures per example.
Read per-dimension raw verdicts and all four actual generation outputs during failure
review;aggregate decision rates alone cannot certify those properties.

## Exact packet and execution scope

Packet SHA `d30ec7fbbec479622d17060b3947f5b8ddb10f2fc2b713a8e21ca397aa9f1961`
reproduces byte-equivalent canonical data from all16 bound source paths. Every fixed
request hash matches its body. Labels/rationales are absent from provider payloads.
40 distinct fixed judge cases+4 generations+up to4 contingent judges=48 attempts;
USD0.28 each=USD13.44 reserve below USD15 ceiling. Largest fixed body4944 bytes vs32768
cap;output cap8192,zero automatic retries,expiry2026-10-18T00:00:00Z retained.
Existing tests verify durable intent,no unknown redispatch,expiry/budget/version stops.
Threshold counts are at least13/14 positives,13/14 negatives,10/12 uncertain,zero false
accepts/invalid verdicts;summary always remains `qualified:false` for manual review.
Pricing basis is the previously documented October11 proposal,not a new billing guarantee.

Scope limitation: direct update-style generator/judge requests use `gemini-3.8-flash`
for both roles. Current creation contracts explicitly reject identical requested models,
and their grant inputs differ. Local packet audit confirms `invalid-creation-profile`
for that pair. This is an existing contract boundary,not another introduced regression.
A successful pilot cannot qualify creation publication,unrestricted parts of speech or
production activation. Make this execution scope explicit in the replacement packet;
creation needs a compatible profile/transport qualification or reviewed contract change.
No second paid operation is authorized;AUTH-30 remains consumed.

## Verification, progress and next action

Fresh typed cached-only Deno147/147 passes. Two disposable PostgreSQL diagnostic cases
reproduce SEM-READY-01. Typed local packet audit passes.46 actual old responses replay
exactly as before;94 retained files verified unchanged. Prior82 SQL tests,target types
and client/device checks are historical,not represented as rerun in this review.
All408 source hashes,old candidate packets and provider receipts preserved. Temporary
cluster finalizer completed;no owned test container or pending provider operation.

Next **GPT-6.1 Sol / High** for the specific SQL repair/regression and replacement
immutable packet with explicit scope,then **GPT-6 Astra / High** re-review. No new
paid requests. D13A.7 fixed4/6 complete,2 remain;8 broad milestones. Inside checkpoint5
remain2 existing packages:repair/re-review plus separately authorized measurement;
then final failure/evidence review and qualification decision. No new numbered
milestone and no semantic qualification claimed. Flags OFF/shared_analysis FALSE/CEFR OFF.
