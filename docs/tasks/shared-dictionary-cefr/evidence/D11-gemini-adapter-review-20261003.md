# D11 Gemini REST/control technical review

Date: 2026-10-03. Starting HEAD `177eb96`, implementation `cf27475`, branch
`feature/shared-dictionary-schema`, AUTH-20/AUTH-18. GPT-6 Astra / High recommendation
announced after a model-switch event; exact picker/model attribution unverified.
No subagent. Baseline inventory **207/207 exact** before edits.

Verdict: **PASS after five P2 repairs for the local preparation scope**. No remaining
finding in that scope. This does not approve the live runner, provider spending,
source transmission, account binding or CEFR qualification.

## Findings, reproducers and repairs

| Finding                                                | Reproduced behavior                                                                                                                                                   | Repair                                                                                                                                                         |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P2 — response body ownership                           | Timeout returned while the received stream remained locked; late responses started reading after timeout; header/redirect rejection left bodies uncancelled.          | Dedicated HTTP module cancels the active reader on abort, checks abort before consuming a late response, and releases unread bodies on all rejection paths.    |
| P2 — invalid envelopes classified as transport retries | Invalid JSON, oversized envelopes and invalid UTF-8 returned `transport_error`. MIME prefix matching also accepted a valid JSON envelope labeled `application/jsonp`. | Typed envelope failure becomes `receipt_error`; exact JSON media type and HTTP 200 required. Actual network/read errors remain transport failures.             |
| P2 — compatibility checked after metadata dispatch     | A structurally valid, rebound bundle selecting an unsupported model still reserved and sent one fixed-model metadata request before failing.                          | Prepare/validate every wire request before any control reservation or HTTP call.                                                                               |
| P2 — expired lease before dispatch                     | Expiring the lease after reservation still allowed one HTTP call; only capture noticed lease loss.                                                                    | Renew/assert lease immediately before dispatch; retain the conservative unknown reservation when that check fails.                                             |
| P2 — sibling model accepted by prefix                  | Synthetic responses named `gemini-3.5-flash-lite` or `gemini-3.5-flash-image` passed the requested-model gate with no prior pin.                                      | Accept only the exact Flash alias or a three-digit numeric revision, then require the subsequent exact pin. Unsupported naming changes fail closed for review. |

The sibling names are synthetic negative cases, not claims about available products.
Numeric revision acceptance is a conservative local validation rule, not proof of
model availability, immutable weights or current account pricing.

`pre-fix.log` records **10 failed regressions /1 passing network-error control**.
`pre-fix-model.log` records **2 failed model regressions /1 passing numeric-version
control**. Reproducers used only injected HTTP and temporary private SQLite.

## Verification

- Node 24: **61/61 PASS** — fourteen review cases plus all forty-seven prior cases.
  Existing receipt/usage, full-body count equality, immutable cache, unknown replay,
  duplicate run, midnight, reserve/capture, frozen draft and qualification tests pass.
- Scoped TypeScript, strict ESLint (zero warnings), Prettier and `git diff --check`
  PASS. An unused test import was removed before the final lint run.
- Request body/template digest, five frozen pilot artifacts, model settings,
  budget maxima, existing fake collector and operational qualifier are unchanged.
  No SQL migration, client, worker, native/device/backend or hosted operation.
- [210-path source inventory](D11-gemini-review-source-sha256.json): **203 previous
  hashes retained**. Adapter, controls, README and the unapproved live draft changed;
  HTTP module, review test and this review were added. No source hash is inferred
  from a different checkout.

Private evidence: `reports/shared-dictionary-cefr/d11-gemini-review-20261003/`,
including both pre-fix logs, final Node/type/lint/format and ordinary commit-hook logs.
The usual package-less Node module warning remains unrelated to the repairs.

## API and authority review

Context7 refreshed the official API schemas for
[generation receipts](https://ai.google.dev/api/generate-content),
[full-request token counting](https://ai.google.dev/api/tokens) and
[model metadata](https://ai.google.dev/api/models). Wire mapping, disjoint usage
sum and distinction between metadata version and response model version match
those contracts. No provider request, credential or account access occurred.

The adapter still requires injected test HTTP and a fixed dummy key. The existing
collector rejects it as a generation transport. The proposal's new `review_ref`
points here; `approved` and `live_ready` remain false. No reference bands enter the
request. The model reference cannot become independent CEFR gold or operational
qualification. Account/project/key, one-day source/spending approval, control
endpoint billing and complete total cost remain unresolved. The generation-only
$1.913472 reservation is not a verified all-in $2 ceiling.

## Next checkpoint and persistence

Next **GPT-6.1 Sol / High**: implement the local live-runner integration with fake
HTTP verification, stable meaning identities plus separate attempt reservations,
combined control/generation accounting and reporting, bounded retry/backoff,
exact account/source/pricing/approval binding and a dormant execution entrypoint.
Preserve receipt stops versus retryable failures and the repaired dispatch guards.
Prepare the complete reviewable artifact before any final spending request.
A teacher is not required. Paid execution remains unapproved.

D11 stays in_progress; D12 not started. Scoped local repair/review commit and
ordinary hooks under AUTH-18; receipt follows. Preserve `.playwright-cli/` and
ignored reports. No pending external write, activation, restoration or release.
