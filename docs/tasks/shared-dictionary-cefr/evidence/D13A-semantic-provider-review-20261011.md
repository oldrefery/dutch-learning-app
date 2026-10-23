# D13A.7.5 — AUTH-31 provider/request/transport review

Date: 2026-10-11. Review completed with P1/P2 findings; no implementation edits or paid calls.

**2026-10-11 local — D13A.7.5 provider failure review complete; two findings.**

SEM-PROVIDER-01 (P1): responseFormat.text.mimeType is application/json in all44 fixed
requests, but live public v1beta Discovery revision20261010 declares the wire enum
APPLICATION_JSON/TEXT_PLAIN/MIME_TYPE_UNSPECIFIED. The official GenerateContent guide
shows application/json, so this is a documented guide/machine-contract discrepancy.
Offline validation flags all40 judges/4 generators; substituting APPLICATION_JSON in
memory clears that wire mismatch. Actual AUTH-31 rejection cause is still unproven:
no status/body was retained and no provider request was repeated.
SEM-PROVIDER-02 (P2): transport retains only kind/hash for client failures; runner
persists that reduced object. Seven mocked HTTP cases and known-failure resume confirm
lost diagnostics and exactly-once/no-retry behavior.148 focused Deno tests/typecheck pass.

No runtime/test/corpus/packet edit; all3969 entry references verified,644 paths preserved.
Only public documentation GETs and local mocked checks; no key access/paid call. AUTH-31
and AUTH-30 consumed, old journals immutable. Current exact candidate is unqualified.
Next **GPT-6.1 Sol / High**: repair wire enum and bounded sanitized error diagnostics,
add contract/redaction/no-retry regressions, prepare a new immutable source-bound packet;
then **GPT-6 Astra / High** re-review before any separately authorized measurement.
Fixed4/6 complete,2 remain;8 broad;2 existing packages inside5. Findings are prerequisites
inside the existing measurement package, not new numbered milestones.646 local-only/
uncommitted paths; no pending runner/operation. Flags OFF/shared_analysis FALSE/CEFR OFF.

## SEM-PROVIDER-01 — P1: use the direct REST wire enum

Location: supabase/functions/dictionary-analysis/responseSchemas.ts:123.
jsonGenerationConfig sends responseFormat.text.mimeType application/json in both
judge and generation requests. The [public v1beta Discovery contract](https://generativelanguage.googleapis.com/$discovery/rest?version=v1beta),
revision20261010, links GenerationConfig.responseFormat -> ResponseFormatConfig.text ->
TextResponseFormat.mimeType. That string enum allows MIME_TYPE_UNSPECIFIED,
APPLICATION_JSON and TEXT_PLAIN. The actual first dispatched request carries a value
outside that enum; all40 fixed judge and4 generation requests share the mismatch.
The saved dispatch hash matches the frozen positive-1-1 request exactly.

The [official GenerateContent structured-output guide](https://ai.google.dev/gemini-api/docs/generate-content/structured-output?hl=en)
shows application/json in the same location, explaining the prior implementation.
This is a real documentation conflict. It does not justify claiming an observed400:
the actual response status/body are unavailable. The wire mismatch is the strongest
local request finding and a plausible failure cause; historical cause remains unproven.

Offline audit walks the exact request against published Discovery field/type/enum
contracts, treating schema's type:any as opaque. It finds one mismatch per request.
Changing only mimeType to APPLICATION_JSON in memory clears all44 wire mismatches.
This check does not validate provider-specific nested-schema support or live acceptance.
Fix the direct REST enum, keep HTTP Content-Type and schema/meaning guards, and add a
regression derived from the saved public contract for both request paths. Existing
schema tests validate content JSON and own-builder consistency, so148 green tests do
not detect this provider wire-enum gap. Changing config changes policy/packet binding;
freeze a new packet after repairs and prescribed review.

## SEM-PROVIDER-02 — P2: retain diagnostic evidence before discarding failures

Location: supabase/functions/dictionary-analysis/geminiTransport.ts:140-145;
scripts/shared-dictionary/semantic-qualification-cli.ts:162-165 persists the reduced result.
Explicit client errors yield only provider-failed plus SHA256(status/body), losing status,
Google status/code, message and field diagnostics. The hash cannot recover the evidence.
AUTH-31 therefore cannot distinguish invalid schema, unauthorized key, permissions,
missing model or quota rejection without another external observation.

Seven fake HTTP responses (400,401,403,404,429,408,503) exercise the real transport with
synthetic credentials and injected fetch. Client errors all drop status/message;408/503
remain unknown. Each performs exactly one fetch. A real pilot runner using fake400 stores
only kind/hash, releases its lock, and refuses redispatch on resume; fetch count stays1.
The no-retry and durable accounting behavior is correct and must remain intact.

Add bounded sanitized operator-only diagnostics (at least HTTP status, validated Google
error status and redacted message/field violations) alongside the unchanged evidence hash.
Do not expose raw error bodies, headers/API keys or echoed private content to ordinary
client responses/logs. Keep408/5xx/network uncertainty and no-retry classification. Tests
should cover structured/malformed/oversized bodies, redaction, durable failure storage,
and restart without redispatch. This is a local repair prerequisite before another pilot.

## Evidence, limits and next action

Reports: reports/shared-dictionary-cefr/d13a7-semantic-provider-review-20261011.
Saved public Discovery schema, request-audit.py/json/log, failure-probe.ts/json/log,
Deno148 log and companion manifest bind the review to current files. No production
source/tests/corpus/prompt/packet changed. Prior408 source paths,94 old paid response
artifacts and3 AUTH-31 journal files preserved. Fresh focused Deno148/typecheck passes;
8 mocked review scenarios and44 request audits are separate from that test count.
No SQL/client/device/target suites rerun. No credentials read or generation API called.
Context7 gave general fields and mixed Interactions examples; public Discovery and the
specific GenerateContent guide supplied the decisive wire evidence. Generic structured
output docs describe a different API surface; do not use its snake_case format here.

Initial read-only audit helper had an argument mismatch and was corrected. A sandboxed
public-document download failed DNS; a scoped public GET with network approval succeeded.
No automatic approval rejection or paid retry occurred. No pending external operation.
AUTH-30/31 consumed; actual prior attempt cost/status/cause remain unknown as documented.

Next GPT-6.1 Sol / High: close both findings locally with regressions and a new immutable
scope-bound packet, then GPT-6 Astra / High re-review without paid calls. Measured service
qualification requires separate later authority. Existing D13A.7 progress remains4/6,
2 remaining checkpoints,8 broad milestones and2 packages inside5; repairs belong within
measurement prerequisites, not new milestones. Creation/publication/devices/activation
remain outside the direct-analysis pilot scope.
