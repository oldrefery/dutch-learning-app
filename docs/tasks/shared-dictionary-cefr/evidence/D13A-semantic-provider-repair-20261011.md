# D13A.7.5 — Provider P1/P2 repair and new packet

Date: 2026-10-11. Local fixes verified on user-confirmed Sol / High; prescribed Astra / High review pending.

**2026-10-11 local — D13A.7.5 provider P1/P2 repaired and locally verified.**

SEM-PROVIDER-01 now uses APPLICATION_JSON in the direct REST responseFormat enum;
HTTP Content-Type remains application/json. A saved Discovery20261010 fixture
independently checks all44 fixed and4 contingent requests. SEM-PROVIDER-02 retains
bounded operator diagnostics: HTTP status, allowlisted Google status, synthesized safe
message and up to8 known field paths. Raw provider prose/descriptions/headers/private
input are never retained. Original failure hash and4xx/408/5xx/network classification
remain unchanged; durable failure resume refuses redispatch. Ordinary client/store
receipts do not receive diagnostics. New diagnostics source is bound by the packet.

Both regression probes failed before fixes; fresh cached Deno170/170 with typecheck,
scoped lint/format and48 wire audits pass.17 source hashes and5 scope-tampering guards
verified. Old46-response replay agrees except the intentionally changed candidate
policy hash; all94 old provider files and3 AUTH-31 journal files remain immutable.
New provider calls0; credentials not accessed. Historical failure cause remains unknown.

New immutable packet SHA256: `e833fbc991f9e2ed066a09c3f79213362836a4c4f996024ac6b104c5832c76de`.
Policy SHA256: `ef5164c9c51781f44e19a2cc3424d4d5a01e8c10232d3c27d7139f59010d40b6`.42 cases,48 calls/USD15 ceilings,USD13.44
maximum reservation; corpus/labels/thresholds/limits/scope unchanged. Direct analysis
probes only; creation/publication/devices/activation excluded. New packet is unapproved
and unqualified. AUTH-30/31 consumed; no further paid run authorized.

Next **GPT-6 Astra / High**: re-review P1/P2 implementation, privacy/no-retry regressions,
independent contract fixture and exact new packet without paid calls. D13A.7 remains
fixed4/6 complete,2 remain: measured semantic qualification and actual-device/old-client/
offline/performance checks.8 broad milestones remain. Inside checkpoint5 two existing
packages remain: exact measurement with local re-review prerequisites, then final
failure/evidence review and scoped qualification decision. Repairs do not add numbered
milestones.651 local-only/uncommitted paths;646 entry paths preserved. No pending runner
or external operation. Flags OFF outside QA/shared_analysis FALSE/CEFR OFF;
real2914 eligible/approved/applied0.

## P1: direct REST enum and independent regression

responseSchemas.ts uses APPLICATION_JSON for responseFormat.text.mimeType. HTTP
Content-Type is still application/json. Full nested output schemas, candidate limits,
strict parsers, protected input and observed model-version gates remain unchanged.
The fixture projects TextResponseFormat from the previously saved public Discovery
revision20261010. An independent audit confirms exact equality with that saved schema.
The regression tests44 fixed requests and4 contingent generated-result judges against
its enum, rather than using only an implementation-owned literal. A full field/type/
enum walk of all48 request bodies has0 issues; schema's type:any remains opaque.
This does not establish live acceptance or provider-specific nested-schema support.
The official guide/machine-contract conflict and historical rejection cause remain as
recorded in the [previous review](D13A-semantic-provider-review-20261011.md).

Both new repair regressions first failed on the old implementation: invalid MIME enum
and missing durable HTTP diagnostics. An initial filter selected0 tests; the corrected
regex selected both and demonstrated2 expected failures. No claim is based on the0-test run.

## P2: bounded operator diagnostics without provider prose

providerDiagnostics.ts projects HTTP status, an allowlisted canonical Google error
status, body availability/structure state, a synthesized fixed message and at most8
unique recognized field paths. Snake-case wire paths normalize to known camel-case
paths; arbitrary schema/property/credential paths are discarded. Only recognized
BadRequest fieldViolations and known Invalid-value-at paths supply field hints.
Provider prose, descriptions, arbitrary status strings, headers and raw bodies never
enter the projection. Messages are safe summaries, not verbatim provider quotations.
This deliberate projection may omit unfamiliar detail and cannot recover raw prose.

Explicit4xx except408 retains provider-failed plus the exact original SHA256 of
JSON.stringify(status/body).408/5xx retain unknown and null evidence hash. Oversized,
invalid UTF-8 or unreadable non-success bodies remain unknown, with only known HTTP
status and synthesized diagnostics retained. Network/timeout paths remain unknown
without exception text. No retry/redirect or uncertainty/accounting change. The existing
pilot runner durably stores the projection in failure.json and refuses redispatch on
resume; failure bytes remain unchanged and the lock is released. Analysis worker tests
confirm only kind/hash reaches store RPC and no diagnostics enters ordinary receipts.
The creation worker still forwards only its existing kind/hash fields; public RPC/SQL
signatures and client contracts are unchanged. New helper source is included in the
packet's source hashes so diagnostic changes invalidate an approved frozen packet.

## Verification and scope

Fresh cached Deno170/170 with typecheck (22 additions:19 diagnostic cases,2 qualification
cases,1 client-boundary case). Coverage includes400/401/403/404/429,408/500/503, malformed
bodies, oversized/invalid UTF-8 responses, unknown-code/path redaction, bounded/deduplicated
fields, durable failure/resume and existing network/timeout tests. Initial test typecheck
found a fetch-overload annotation and redundant narrowed-type guards; corrected locally
without bypassing type checks. Server Deno lint, zero-warning script ESLint, scoped
Prettier and diff checks pass. No SQL/client/device/full-suite rerun is claimed.

New packet canonical hash and17 source hashes match current files;5 altered-scope probes
reject before the transport factory or credentials. Corpus42, labels, thresholds,
execution scope and limits match the previously reviewed packet. Only output MIME enum,
bound policy/request hashes and affected source bindings change. Policy remains
shared-meaning-independent-v3 with exact expected generation/judge model versions.

Old46 real responses replay through unchanged acceptance logic:41 valid judge verdicts,
3 rejected schema failures,14/16 positive acceptance,16/16 negative rejection,11/12
uncertain abstention,0 false acceptance. Old bank generation stays schema-invalid;
slot passes structural guards only. Replay equals the prior report except the intentionally
updated current-candidate policy. This is old-response evidence, not measurement of
new requests.94 old paid files and3 AUTH-31 files remain unchanged. The public Discovery
snapshot and every historical packet/report are preserved. New paid calls/key access0.

Reports: reports/shared-dictionary-cefr/d13a7-semantic-provider-repair-20261011.
New packet is unapproved/unqualified. Re-review next on GPT-6 Astra / High, without paid
calls. A passing direct-analysis pilot alone cannot qualify excluded creation/publication
or complete checkpoint5 for unmeasured workflows. No new approval requested or inferred.
AUTH-30/31 remain consumed. Work is local and uncommitted; no pending operation.
