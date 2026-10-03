# D11 real calibration and bounded sample proposal

2026-10-03, starting `abc2ea0`, existing `feature/shared-dictionary-schema`,
AUTH-20/AUTH-18. Required preparation model GPT-6.1 Sol / High announced.
Current picker control is unavailable; no automatic model change is claimed.
This is a concrete local proposal, not a reviewed gold set or spending approval.

## Prepared review package

- [24 exact meaning candidates](D11-pilot-review-worklist.json), with full validated
  dictionary content, canonical meaning input and SHA-256, source locator, proposed
  family/split/slices and empty reviewer/expectation fields.
- [Human review worksheet](D11-pilot-review-worksheet.md), listing all 24 meanings
  and the review/adjudication procedure.
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
are original unreviewed diagnostic drafts, with no assigned CEFR level.

The pooled list covers all eleven required slices: sense pairs, inflections,
reflexive/separable verbs, compounds, idioms, ordinary/specialized uses, missing
reviewed evidence, ambiguity and conflicting examples. Proposed splits contain
12 calibration and 12 held-out items. Bank senses, arm homographs, kind inflections
and opstaan senses stay in the same respective split. Family relations and meaning
accuracy require editorial review. Some slices are absent from one pilot split;
this small probe is deliberately insufficient for operational qualification.

A Dutch-as-a-second-language reviewer is not yet identified. A clarification has
been sent to the user about an existing gold set or available teacher/editor;
its answer remains pending. Before provider execution, record reviewer/evidence,
acceptable level sets or abstention, ambiguity, adjudication and exact use
permissions. Freeze reviewed labels before predictions and keep them out of the
prompt. If new content/labels arrive, version and rehash the worklist and reviewed
fixture. Do not mark an expected abstention merely to fill an unreviewed label.

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
Collect validated responses into the existing offline report contract, using an
explicitly unqualified policy (`null`) for the pilot. No application flag, schedule
or deployed endpoint is enabled. Unknown answers and missing items remain visible.

Report observed cost, latency/timeout/retry counts, coverage, exact/within-one
agreement, severe mistakes, expected abstention and confidence bins, with every
denominator. Compare against frozen reviewed meanings. A positive small pilot
supports designing a larger reviewed fixture; it cannot qualify all slices or
all A1–C2 levels. Operational policy sizes/thresholds, a separate provider reuse
approval and exact fixture/report/profile/policy bindings still need review.
No bulk enrichment or D11 closure follows automatically from a passing pilot.

## Missing decisions and next checkpoint

Real reviewer or existing reviewed meaning evidence, permission for provider reuse,
and scoped sample spending approval remain absent. The concrete files above are
ready for review; approval of the budget alone does not create reviewed labels.
No request to approve immediate paid execution is made while the collector and
reviewed fixture are missing.

**Next required model: GPT-6 Astra / High** to review this proposal's family/sense
coverage, provider bounds/cost assumptions, circular qualification boundary and
human review plan. Then Sol / High can prepare the approved-input collector with
fake transport and durable reservations locally, before a final exact live
permission request. Resolve the pending reviewer clarification when it arrives.
D11 remains in_progress; D12 has not started.

## Verification and persistence

Prepared/validated locally with Node 24.20.0 and the existing domain parser and
canonicalizer. All 24 inputs parse, hashes recompute, inputs are unique, and no
family/exact-lemma crosses the proposed split. All reviewer and expectation
fields remain pending/null. Proposed profile passes the existing profile validator;
the worklist has a separate namespace and is rejected by the gold-fixture validator.
All eleven pooled slices are present; 12/12 split and budget arithmetic verified.
The validation does not establish linguistic correctness or quality.

Private logs/helper: `reports/shared-dictionary-cefr/d11-calibration-proposal-20261003/`.
An initial generation helper syntax error was corrected before artifacts were
created; its log is retained separately. No secret, account export or live call.
Previous 184 source hashes remain exact. New proposal artifact hashes are in
[D11 proposal inventory](D11-calibration-proposal-source-sha256.json).
Ordinary local commit hooks under AUTH-18; actual commit receipt follows.
