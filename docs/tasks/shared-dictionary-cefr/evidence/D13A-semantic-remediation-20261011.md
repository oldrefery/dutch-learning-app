# D13A.7.5 — Local semantic transport/schema remediation

Date: 2026-10-11. Requested local fixes and saved-response verification complete.
D13A.7 remains4/6 complete,2 remain; eight broad milestones remain. No new paid
provider requests were authorized or made. AUTH-30 remains consumed.

## Changes and failure disposition

SEM-PILOT-01 is fixed locally: the transport accepts string-valued thoughtSignature
metadata on output text parts and preserves the entire provider envelope. Malformed
signature/thought types and unknown executable metadata remain rejected. The
[official Part contract](https://ai.google.dev/api/generate-content) describes this
opaque optional signature separately from generated text. No signature or model
content is stripped from stored responses; existing pilot files are unchanged.

SEM-PILOT-02 is remediated in request construction: the semantic request now sends
an exact JSON schema for content, hashes, decision and the six required checks.
All objects require all fields and forbid additional properties. The prompt explicitly
uses content_sha256. Runtime hash binding, quote grounding, dimension uniqueness
and decision aggregation checks remain strict. Old malformed responses stay rejected.

SEM-PILOT-03 is remediated in request construction: generation now sends a schema
for every dictionary field, including nullable conjugation and usage notes, contrast
examples shaped as nl/en/ru objects or null, enum values and bounded arrays. The
prompt specifies the nested example shape. Schema field names are checked against
DictionaryContent at compile time. The unchanged domain parser enforces string
bounds, identity and semantic/media guards after provider output.

Both requests use the current documented REST generationConfig.responseFormat.text
with mimeType application/json and schema; [official structured-output guide](https://ai.google.dev/gemini-api/docs/generate-content/structured-output?hl=en).
No SDK/API endpoint switch, retry, quota increase, publication or activation occurs.
Provider attempts still use candidateCount1/maxOutputTokens8192 and the existing
transport byte/timeout/rate boundaries. Live support and adherence of this new
response format were not measured; they remain qualification work.

The validator profile is now shared-meaning-independent-v2. Its policy SHA binds
both model names, judge prompt, generation prompt/template, both complete schema
configurations, text-part contract and evaluator version. Preparing a semantic
request rejects stale or altered policies before transmission. Qualification packet
source hashes also include the new responseSchemas.ts. Existing SQL registries are
unchanged and no new qualified policy has been installed.

- New semantic prompt SHA: `8c585646c85a3a9cf5bef4808c7a1e5ec7856b5665deb32008b86bff493167d2`.
- New policy SHA: `2e72d472cf295773035ace9d13de24b0f14943028f51364992c391ccd5dc5eb9`.
- Unapproved candidate packet SHA: `29151401f5083946b1ad5c262c245ef428e25a20884f40448ab74a2e05e7cdaf`.
- Candidate packet: `reports/shared-dictionary-cefr/d13a7-semantic-remediation-20261011/candidate-packet.json`.
- Old approved packet SHA remains d397dcd23022e9fb4eaeef4469b2e7f0915ff7b57d225805cc0844600b256cf6;
  its AUTH-30 allowance is consumed and cannot be used for this new packet.

The request/schema changes address prevention of future malformed outputs; local
validation cannot demonstrate how the provider will answer a changed request.

## Verification against retained actual responses

The new semantic-qualification-replay.ts has no provider invocation path. It verifies
all94 sealed pilot files before and after replay, verifies the old canonical packet
hash, reparses actual provider envelopes through the corrected production transport
and calls the existing candidate/verdict validators. It verifies that the full
provider envelope stays equal, including signature metadata. Output is a new
write-once offline report; original result/dispatch/report files are never rewritten.

Actual replay: **46 responses**, new provider calls **0**. Forty-one of44 judge
outputs pass strict parsing. Fourteen of16 positive results are same-meaning,
16/16 negative results are different-meaning,11/12 uncertain results are uncertain;
false accepts0. The same three malformed responses remain invalid:
positive-notes-1-1,positive-notes-1-2 and uncertain-injection-3-1.

The bank generation remains schema-invalid because its contrast example is a string.
The slot generation passes structural/identity/media checks. Neither generated
output has a live semantic judge response. No changed response is fabricated to
turn these four old malformed payloads into passes.

Report: `reports/shared-dictionary-cefr/d13a7-semantic-remediation-20261011/replay-final.json`. It explicitly records qualified:false and
new_request_schemas_exercised_by_provider:false. This is offline parser verification
of earlier measurements, not qualification of the new model/prompt/schema/policy.
Proposed corpus labels, limited negative coverage and actual model-version activation
control are still qualification gates.

Reproduce with read-only receipt access and write access only to a new local report:

```bash
/Users/devrush/.deno/bin/deno run --cached-only \
  --config supabase/functions/deno.json --allow-read \
  --allow-write=reports/shared-dictionary-cefr/d13a7-semantic-remediation-20261011 \
  scripts/shared-dictionary/semantic-qualification-replay.ts \
  docs/tasks/shared-dictionary-cefr/evidence/D13A-semantic-pilot-result-20261011.json \
  reports/shared-dictionary-cefr/d13a7-semantic-remediation-20261011/replay-review.json
```

Neither this command nor prepare has network/environment permissions. No API key
was read during remediation, tests or replay.

## Fresh checks and limitations

Deno103/103 with typechecking passed across worker, independent semantic evaluator,
endpoint, qualification harness, new schema regressions and replay regressions.
No network/environment permission was granted to tests. The schema tests use the
already-installed Ajv6 JSON validator; the test-only --unstable-detect-cjs flag is
needed by Deno for this existing CommonJS package. Nothing was installed.

Regressions cover the actual signature-bearing shape, immutable full envelopes,
malformed/executable metadata, the observed extra/substituted verdict hash field,
bare/nested contrast examples, complete structured requests, stale policies, altered
retained results and independent original-packet verification. Signature-only diagnostic
normalization from the previous turn is now replaced by actual corrected production
parsing for this new replay report. Previous pilot scores remain immutable.

ESLint passes for the three changed/new operator scripts; Deno lint passes for the
five server/schema files (repo ESLint intentionally excludes supabase/functions).
Targeted Prettier and git diff --check pass. The initial schema-test CommonJS loader
failure was resolved by the test flag; no test was skipped. Initial lint invocation
included excluded server paths and replay complexity23; final scoped lint and helper
extraction resolve the warnings. All logs are retained.

Original branch/HEAD feature/shared-dictionary-schema/f97a733 unchanged. Entry3781
SHA references/622 dirty paths verified. Four existing source files plus five task
notes deliberately updated; four new source/test files and this evidence pair added.
Final628 dirty paths; source union404, task web142/browser449 unchanged. All94 provider
journal files and old evidence manifests are unchanged. All owned runners exited;
no external operation is pending. Prior SQL/domain/client/full app/browser suites
remain historical; this change has focused fresh server/operator checks. Flags OFF
outside QA/shared_analysis FALSE/CEFR OFF. No commit, PR, deployment or publication.

Next: GPT-6 Astra / High for prescribed review of the local fixes, schema/policy
binding, corpus labels and coverage. D13A.7.5 stays open until the new exact configuration
has measured reviewed qualification. Prepare any additional operation completely
before asking for approval, and honor the owner's current no-new-paid-call scope.
D13A.7.6 still requires actual devices/old builds/offline return/performance evidence.
