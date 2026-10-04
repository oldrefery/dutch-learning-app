# D11 pilot v3 abstention revision — 2026-10-04

The first complete personal Gemini pilot returned a known level on all 24
meanings, including both intentional ambiguity/conflict probes. Its 19/19
agreement with assistant-inferred bands is useful diagnostic data, but not
independent accuracy. The unchanged report remains unqualified. A local
parser repair now rejects a contradiction between `ambiguous` and the
candidate; the raw response was not retained, so that repair cannot revise
the previous captures.

The [v3 prompt](D11-pilot-prompt-v3.txt) directs the model to compare gloss,
form and examples before estimating; abstain if a gloss still covers multiple
senses, an example illustrates another sense, or available evidence does not
support a reliable CEFR estimate. It states the exact relationship between
the `ambiguous` flag and a null candidate. It does not name probe IDs, reveal
reference levels or ask for automatic abstention on every unknown reference.
The [v3 profile](D11-pilot-profile-v3.proposed.json) changes only method and
prompt revision. The [v3 proposal summary](D11-pilot-proposal-summary-v3.json)
updates their hashes. All 24 canonical inputs and input hashes, 12/12 splits,
provisional reference, Gemini model/configuration and proposed budget remain
unchanged. No independent gold or operational qualification is claimed.

| Binding                     | SHA-256                                                            |
| --------------------------- | ------------------------------------------------------------------ |
| v3 prompt                   | `492dea06c525d01d843e7429319b2fee43e25a0eecdadf2b01d3a25a73b9d5b5` |
| v3 profile (canonical JSON) | `ea609110700eba3a2a6709b7937beba9eea60270df58d8521658b000507fe447` |
| v3 diagnostic bundle        | `1248911a0b948e2c84ac1344731f2c7fd898a5ceaad9fd78be3f074199d5ae35` |

The bundle loader accepts only the bound v2 or v3 method/prompt pairs.
Local validation loaded all 24 unchanged hashes and built the full generation
bodies (2,766–2,980 UTF-8 bytes each). Node 24 diagnostic tests passed
109/109. Scoped strict TypeScript, zero-warning ESLint, Prettier and
`git diff --check` passed. No v3 provider request has been made. If the user
grant is used for one further pilot, it must get a distinct private registry,
no-network `--check`, and a separate journal; it would consume attempt 3 of
the five even if partial. Three remain before that dispatch. The combined
$10 estimate is not a hard bound.
