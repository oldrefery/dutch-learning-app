# D11 personal Gemini metadata probe — preflight, 2026-10-03

The user authorized at most five further personal `oldrefery@gmail.com`
Gemini attempts with an approximate $10 combined estimate, not a hard spend
cap. This is attempt 1 of 5 when dispatched. Neither earlier one-run registry
is eligible for replay.

The planned request is exactly one `GET` to
`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash`
using the previously verified personal key. There is no request body, frozen
meaning input, token count or generation. The response is bounded to 16 KiB,
parsed in memory, and reduced to allowlisted model identifiers, metadata field
presence/types, supported-method membership and numeric token limits. The
raw response and key are not written or printed. Redirects and retry are
disabled. A durable `consumed.json` is written before the fetch. Any uncertain
outcome consumes this attempt; inspect that record and `result.json` before
further provider actions.

The one-shot script is outside the repository at owner-only
`/private/tmp/d11-gemini-metadata-ODNLhN/probe.mjs`; SHA-256
`33f2c65bd600cf4bbe572f812070ecd45177ca982653d44a2417d109e334bdff`.
Its synthetic self-test passed. The private key file has owner-only mode and
its SHA-256 matched the second-run personal-key authorization; `--check`
reported `ready: true, external_calls: 0`. Neither consumed nor result file
existed before dispatch. Remove the temporary key after execution; retain the
private consumed/result evidence.

The [official REST Models API](https://ai.google.dev/api/models) documents the
model resource and its fields. The
[Gemini 3.5 Flash model page](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash)
documents the target model. These sources do not establish the actual JSON
returned to this key. Read-only AI Studio Logs and Google Cloud Logs Explorer
showed no attributable request log for the earlier two failures. AI Studio
displayed approximately EUR 0.14 month-to-date for the selected project and
warned that costs may lag; that total cannot be attributed to these attempts.

At this preflight: D11 in_progress; D12 pending; qualification false; worker
disabled. No support message, push, PR or deployment.
