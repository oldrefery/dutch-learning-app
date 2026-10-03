# D11 autonomous diagnostic sample proposal

2026-10-03, starting `abc2ea0`, existing `feature/shared-dictionary-schema`,
AUTH-20/AUTH-18. Required preparation model GPT-6.1 Sol / High announced.
Current picker control is unavailable; no automatic model change is claimed.
Revised after the autonomous proposal review from `d51aac0`. The user has no
teacher and explicitly requested that the assistant perform the review. This is
a diagnostic proposal, not independent gold evidence or spending approval.

## Prepared review package

- [24 exact meaning candidates](D11-pilot-review-worklist.json), with full validated
  dictionary content, canonical meaning input and SHA-256, source locator, proposed
  family/split/slices and explicit assistant review provenance. Gold expectation
  fields remain null; three irregular-verb metadata values are corrected.
- [Autonomous review worksheet](D11-pilot-review-worksheet.md) and
  [frozen provisional reference](D11-pilot-provisional-reference.json): 19 model
  level bands and five unknown cases, with reasons and lexical source links.
- [Proposed prompt](D11-pilot-prompt.txt) and
  [immutable-profile draft](D11-pilot-profile.proposed.json); prompt digest binds
  the revision, and resolved model version is explicitly unknown until observed.
- [Calculated bounds and digests](D11-pilot-proposal-summary.json), marked
  `approved: false`. None of these files can authorize the operational worker.

Four candidates (`huis`, `boek`, `fiets`, `water`) are drawn from the existing
bundled project snapshot. Its license limits distribution to the app/repository;
permission to send those four exact inputs to the provider is still required.
Its content review is not an independent CEFR gold label. No private card export,
account identifier, learning history or media is read/copied. The other 20 inputs
are original diagnostic drafts, now checked by the assistant. Their separate
provisional bands are model estimates, not source-backed CEFR labels.

The pooled list covers all eleven required slices: sense pairs, inflections,
reflexive/separable verbs, compounds, idioms, ordinary/specialized uses, missing
reviewed evidence, ambiguity and conflicting examples. Proposed splits contain
12 calibration and 12 held-out items. Bank senses, arm homographs, kind inflections
and opstaan senses stay in the same respective split. Family/sense separation has been checked by the assistant; this does not supply
independent lexical or CEFR validation. Some slices are absent from one pilot split;
this small probe is deliberately insufficient for operational qualification.

The user resolved the reviewer question: no teacher is available; perform the
review autonomously. A teacher is no longer a prerequisite for this diagnostic
pilot. The assistant checked all inputs and family assignments, corrected
`opstaan` and `lopen` irregular-verb metadata, and prepared 19 tentative CEFR
bands. Five cases remain unknown, including three specialized meanings and the
two intentional ambiguity/conflict probes. No external reviewer is invented.

Freeze the worklist and provisional reference by digest before predictions; do
not include reference bands/rationales in provider prompts. Later changes require
a new revision and hashes. Dictionary sources support meaning/morphology only;
the bands are assistant inferences. Agreement with them measures consistency,
not accuracy or calibrated confidence. The earlier human-review prerequisite is
superseded for this diagnostic path; operational qualification remains separate.
See the [review findings](D11-autonomous-proposal-review-20261003.md).

## Proposed provider and generation bounds

Use the project's existing `gemini-3.5-flash` model through Gemini Developer API
`generateContent`, paid Standard tier, text-only single turn and one candidate.
This isolates the pilot to the existing provider choice; it does not change the
application model. Proposed settings: temperature 0, thinking level low,
`maxOutputTokens: 2048`, JSON response and thought summaries disabled. No tools,
search grounding, explicit cache, Batch/Flex/Priority or conversation history.
Google documents the model as generally available and supports GenerateContent.
[Official model guide](https://ai.google.dev/gemini-api/docs/generate-content/whats-new-gemini-3.5).

The current Standard tariff is $1.50 per million input tokens and $9 per million
output tokens, including thinking. Recheck prices immediately before execution;
any increase invalidates this spending proposal.
[Official pricing](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.5-flash).

The documented generated-token limit includes both thinking and answer tokens.
Nevertheless reserve separate maxima of 2048 output and 2048 reasoning tokens
with the existing disjoint-counter ledger. This deliberately over-reserves the
combined limit and does not treat thinking level low as a numeric token cap.
Truncation is an unknown answer; already generated thinking can still be billed.
[Official token-limit and billing semantics](https://ai.google.dev/gemini-api/docs/generate-content/thinking).

Require total input of at most 2000 tokens, including the complete instructions,
identity and canonical content. An approved collector must verify the complete
request via provider token counting and reject an over-bound input before
GenerateContent. Token counting is a provider interaction too and requires the
same transmission approval. Never estimate this token count from character length.
[Official counting guide](https://ai.google.dev/gemini-api/docs/generate-content/tokens).

Transport receipts must preserve provider `responseId`, `modelVersion`, finish
reason and usage counters. Map prompt/candidate/thought counts to the three
separate ledger counters; verify totals and requested service tier. Missing or
inconsistent billing metadata retains the full reservation. A changed observed
model version splits evidence and prevents treating responses as one stable
qualified profile. A bounded adapter must read only one final answer, limit its
JSON to 4096 bytes, and bound the entire transport envelope as well.
[Official GenerateContent response metadata](https://ai.google.dev/api/generate-content).

## Exact proposed allowance

| Dimension                                       |                         Maximum |
| ----------------------------------------------- | ------------------------------: |
| Distinct meanings                               |                              24 |
| Attempts per meaning, including initial attempt |                               2 |
| Total generation requests                       |                              48 |
| Complete input per attempt                      |                     2000 tokens |
| Output reservation per attempt                  |                     2048 tokens |
| Reasoning reservation per attempt               |                     2048 tokens |
| Conservative tokens per attempt                 |                            6096 |
| Conservative cost per attempt                   |    39,864 micro-USD ($0.039864) |
| Conservative tokens for the whole probe         |                         292,608 |
| Conservative cost for the whole probe           | 1,913,472 micro-USD ($1.913472) |
| Proposed authorization ceiling                  |                       $2.00 USD |
| Parallel requests                               |                               1 |

Calculation uses exact decimal rates: `2000*1.5 + 2048*9 + 2048*9 = 39864`
micro-USD per attempt; multiply by 48. This is an inference from the cited tariff
and proposed bounds, not observed spend. The $2 limit covers generation charges
at that tariff; taxes/currency/bank charges are outside this API-usage estimate.
If $2 must include such charges, reduce the approved allowance before execution.
Request capacity remains capped at 48; unused money never authorizes extra items.

At most 24 token-counting preflights and one model-metadata read are proposed in
addition to generation, with no automatic retries on those control requests.
Their billing/availability must be verified before approval of the collector;
any extra charge must fit the same $2 ceiling or the proposal is revised. No
account, billing project or key has been accessed during preparation.

A retry is reserved anew before dispatch. Retry only 429/5xx or transport failure,
at most once per meaning with bounded backoff. Timeout or interrupted delivery
retains its maximum; no refund from cancellation alone. Stop on price/model/tier
mismatch, invalid counters, missing approved input, auth failure or exceeded bound.
All generated requests must use one UTC-day budget; stop rather than roll an
unspent approval into a new day. Proposed call timeout is 5 seconds to match the
worker's current bound; this pilot must measure whether that bound is usable.

## Pilot execution and acceptance boundary

The operational worker requires a qualified method, which the pilot is intended
to evaluate. Therefore the pilot must use a separate explicitly approved offline
calibration collector. It must not fake a qualification or seed a synthetic
registry approval to bypass this ordering. That collector/adapter is not yet
implemented or executable. It needs its own durable spending reservation and
fenced capture checks before approval/execution; the reviewed worker semantics
supply its constraints, not a permission to call it unqualified.

Keep results in a new ignored private run directory, with restrictive access,
new-file/no-overwrite writes, request/input/profile/prompt/response digests and
per-attempt billing. No SQL assessment publication is part of this allowance.
Use a separate diagnostic report contract that accepts model-origin references.
The existing calibration report requires reviewed expectations; passing `null`
policy does not turn assistant estimates into valid gold evidence. Never fabricate
review metadata or weaken qualification to reuse that report. No application flag, schedule
or deployed endpoint is enabled. Unknown answers and missing items remain visible.

Report observed cost, latency/timeout/retry counts, output validity, coverage,
agreement with provisional bands and distance from those bands, with every
denominator. Show unknown-reference cases separately; they must not count as
incorrect predictions or automatically expected abstentions. For the two
intentional ambiguity/conflict probes, show observed abstention separately.
Confidence bins may summarize outputs, but must not be called calibrated accuracy.
No operational quality pass/fail may be derived from this report.

## Review outcome and next checkpoint

Local autonomous preparation is complete. **Next required model: GPT-6.1 Sol /
High** for the diagnostic collector and report implementation with fake transport.
A teacher is not required to proceed. Implement immutable input/reference/profile
binding, no-overwrite private capture, durable reservations before dispatch and
conservative accounting for uncertain outcomes. Verify rejection of reference
leakage, changed inputs, resume/retry overspend and accidental qualification.

Only then prepare the concrete live request: exact inputs and account, request
limits, current pricing, control-request billing, source transmission permission
and $2 proposed allowance. The existing four bundled inputs have an app/repository
license; do not infer external transmission permission. No immediate paid request
is made while the collector is not yet executable. The user need not supply a
teacher, labels or a gold set to continue local implementation.

D11 remains in_progress; D12 has not started. This small model-reference diagnostic
cannot satisfy the independent-quality gate or activate bulk enrichment. Future
qualification needs a separately reviewed evidence/policy route; no such approval
is implied by the autonomous-review instruction.

## Verification and persistence

Prepared/validated locally with Node 24.20.0 and the existing domain parser and
canonicalizer. All 24 inputs parse, hashes recompute, inputs are unique, and no
family/exact-lemma crosses the proposed split. Assistant review provenance is explicit; gold expectation fields remain null. Proposed profile passes the existing profile validator;
the worklist has a separate namespace and is rejected by the gold-fixture validator.
All eleven pooled slices are present; 12/12 split and budget arithmetic verified.
The validation establishes structural integrity, not independent linguistic
correctness or CEFR accuracy. Current review validation and persistence are
recorded in the linked autonomous review; the following preparation receipt is
historical.

Private logs/helper: `reports/shared-dictionary-cefr/d11-calibration-proposal-20261003/`.
An initial generation helper syntax error was corrected before artifacts were
created; its log is retained separately. No secret, account export or live call.
Previous 184 source hashes remain exact. New proposal artifact hashes are in
[D11 proposal inventory](D11-calibration-proposal-source-sha256.json).
Ordinary local commit hooks under AUTH-18; actual commit receipt follows.
