# D11 Gemini REST and control-request preparation

Date: 2026-10-03. Starting HEAD `88c58b7`, branch
`feature/shared-dictionary-schema`, AUTH-20/AUTH-18. Recommended GPT-6.1 Sol / High
announced; current picker/model attribution unverified. No subagent.

This is an inert REST-contract and control-accounting checkpoint. It does not
complete the authorized live runner, CEFR calibration or D11 stage exit.

## Implementation

- `diagnostic-gemini.ts` constructs the full Standard-tier Gemini 3.5 Flash request
  from the authenticated frozen bundle. Explicit generation settings, system
  instruction, stable run/meaning identity and canonical input are included in the
  token-count request. No provisional labels, split or slice metadata are sent.
- Request body/digest is identical across retry attempts for a meaning. The future
  live generation runner must use this identity while preserving separate attempt
  reservations and distinct response IDs. The current fake collector is unchanged
  and cannot accept the test adapter as its transport.
- Injected test HTTP is mandatory; a fixed dummy key is used. No global fetch,
  environment/key loader, live factory or CLI exists. Endpoints are fixed and
  redirects disabled. Timeout/abort is bounded at 5 seconds. Responses are read
  with a streaming 16 KiB cap and strict JSON/UTF-8 validation.
- Receipt validation separates prompt, answer and thoughts, verifies the total
  and combined 2048 output-token cap, rejects cache/tool billing and requires
  Standard usage tier. A verified response version must match the requested model
  family and any prior exact version. Malformed/blocked/incomplete candidates
  retain valid identity/usage; unverified receipts remain a separate stop condition.
  HTTP status is returned without raw provider body; no hidden retry occurs.
- `models.get` name/capabilities/limits are checked, but its descriptive `version`
  is never used as the generation `response.modelVersion` pin.
- `diagnostic-store.ts` adds control reservations and immutable receipts to private
  fake-run SQLite. Whole body hash, known item, one metadata read /24 token counts,
  same UTC day and active lease are enforced. Reservation commits before dispatch.
  Missing receipt, failure or crash prevents replay. Verified results are reused;
  changed bodies and receipt overwrite are rejected.
- `diagnostic-controls.ts` probes only controls with the injected test adapter.
  It snapshots callables before awaiting, checks the prepared bundle before any
  request and retains a verified receipt across midnight before stopping.
  Billing remains unverified and live readiness false. Generation reports do not
  yet include control accounting; live integration must combine both ledgers.

## Documentation research

Context7 resolved the official Gemini API collection and queried the REST request,
usage and pricing concepts; direct official documentation filled remaining gaps.
Checked on October 3:

- [Generate content API](https://ai.google.dev/api/generate-content): request fields,
  Standard service tier, receipt identities and disjoint token totals.
- [Count tokens API](https://ai.google.dev/api/tokens): full `generateContentRequest`.
- [Models API](https://ai.google.dev/api/models): metadata is descriptive.
- [Thinking](https://ai.google.dev/gemini-api/docs/generate-content/thinking):
  output budget includes thoughts and answer.
- [Pricing](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.5-flash): Standard
  input $1.50/million, output including thinking $9/million.

No current authoritative control-endpoint billing statement was established from
the pricing/API documents. A 2024 forum answer is insufficient to pin this account's
complete 2026 charge bound. Do not treat controls as free or state a verified total
of $2. The frozen generation-only reservation remains $1.913472; control maximum
cost and total maximum remain null in the new proposal. Currency/tax/account
conditions have not been inspected. No account/key or provider API call occurred.

## Concrete draft and remaining work

[Live request proposal](D11-gemini-live-request.proposed.json) binds the five prior
artifacts, their aggregate binding and all 24 input hashes. It specifies 24 count
requests, one metadata read, at most 48 generations, two attempts/meaning,
concurrency one, time/body/token limits and generation pricing. It is explicitly
unapproved, has no live CLI, and leaves account/project/key, day/expiry, source-use,
spending, review and control-billing references unset. No reference enters a wire
request. This draft is reviewable but cannot execute or confer qualification.

Next **GPT-6 Astra / High**: review the prepared REST contract, usage handling,
durable controls and proposed authority/cost boundary. Then **GPT-6.1 Sol / High**:
implement the explicitly authorized live runner with stable identities, combined
ledger/report, bounded generation backoff, account/source/pricing binding and
final concrete authorization request. Do all reviewable local work before asking
for spending. A teacher is not a prerequisite; independent CEFR quality is still
unestablished. No paid execution is authorized.

## Verification and persistence

Node 24: **47/47 tests PASS** (23 new REST/control/draft cases plus 22 existing).
Coverage includes full token request equality, wrong model/tier/sum, combined cap,
candidate receipt retention, HTTP status, stream bound/cancel, UTF-8/redirect
rejection, abort, 25-control cache/resume, unknown/crash/failure no replay, midnight,
digest/capture immutability, overlap lease, bad metadata/input count and dormant
activation boundary. Scoped TypeScript, strict ESLint, Prettier and diff checks
PASS. Initial authoring syntax/native-strip and lint issues were repaired before
final verification; they are not review regression evidence.

Private logs: `reports/shared-dictionary-cefr/d11-gemini-adapter-20261003/`.
Baseline **202/202 exact** before edits. **200 prior hashes retained**; README and
diagnostic store changed intentionally. [207-path inventory](D11-gemini-adapter-source-sha256.json).
No worker/client/SQL/runtime/qualifier change. Retained reports and `.playwright-cli/`
preserved. D11 remains in_progress; D12 not started. Necessary local commit with
ordinary hooks under AUTH-18; hook results/receipt follow. No push/PR/merge,
device/backend, hosted migration, schedule, publication or deployment.
