# D11 one-run estimated-cost mode — 2026-10-03

The user accepted an estimated, not guaranteed, $2 API-use figure for one run
of the frozen 24 meanings with at most one generation per meaning. The
authorization remains limited to the personal `oldrefery` key. No support
inquiry, production worker activation, publication or deployment is included.

The committed preparation proposal retains its original two-attempt maximum
for historical fake tests. The private execution registry and its bound
private draft must narrow this run to one generation per meaning. The parser,
runner and SQLite reservation path enforce that limit. The private registry
must name `estimated_unknown_controls`, acknowledge unknown control charges,
leave their maximum and verification references null, and reserve at most
194,304 tokens across 24 generations and 24 token-count controls. The published
Standard generation rates for Gemini 3.5 Flash are $1.50 per million input
tokens and $9 per million output/thinking tokens; 24 maximum generation
reservations total $0.956736. See the [official pricing page](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.5-flash).

The 24 `models.countTokens` calls and one `models.get` call retain zero ledger
placeholders solely because their direct REST cost maximum is unknown. The
report explicitly sets `hard_total_cost_bound: false`,
`cost_max_known: false` for controls and
`reported_cost_scope: generation_maximum_controls_unknown`. These placeholders
must not be described as actual zero charges or a hard $2 total. A failed or
uncertain control stops the run without replay. A failed generation consumes
that meaning's only attempt; the same run may continue through other meanings
when the response is otherwise safe. A second run requires a fresh decision.

The [official REST overview](https://ai.google.dev/gemini-api/docs/api-overview)
confirms the `generateContent` request and key header, and the
[token guide](https://ai.google.dev/gemini-api/docs/generate-content/tokens)
confirms `countTokens`. These sources do not provide a complete price maximum
for the two direct REST control methods.

Local verification before any provider dispatch:

- Node 24 diagnostic tests: 103 passed, 0 failed, including the one-attempt
  estimated-policy test and existing hard-bound/recovery tests.
- Scoped TypeScript, ESLint with zero warnings, Prettier and `git diff --check`:
  passed after the one-line policy type annotation and complexity refactor.
- Runtime implementation digest after those checks:
  `e419ca45a7f0f90cd4751ca4dd06aea92ab2cabb4a5c41070446948ac18393e4`.

No credential, private registry, provider request or report was created by
these tests. Private readiness and the actual one-run outcome remain pending.
