# D11 personal Gemini metadata probe — result, 2026-10-03

Exactly one authorized metadata-only `GET` to
`models/gemini-3.5-flash` returned HTTP 200. This consumed attempt 1 of the
user's at-most-five further personal-key attempts; four remain. The request
contained no frozen meaning input and invoked neither token counting nor
generation. The temporary owner-only key file and loopback transfer script
were removed immediately afterward. No key or raw provider body was retained.

The bounded allowlisted result contained:

| Field               | Observed                                                              |
| ------------------- | --------------------------------------------------------------------- |
| `name`              | `models/gemini-3.5-flash`                                             |
| `baseModelId`       | absent                                                                |
| `version`           | `3.5-flash-05-2026`                                                   |
| `thinking`          | boolean `true`                                                        |
| Methods             | four valid identifiers, including `generateContent` and `countTokens` |
| Input/output limits | 1,048,576 / 65,536                                                    |

The prior parser required `baseModelId === gemini-3.5-flash`, so this actual
response shape identifies the concrete cause of the second run's local
`validation` stop. The parser now permits omission but still rejects any
present incorrect value. Its normalized receipt preserves omission instead
of fabricating a value. The test fixture for an absent ID completes metadata
and 24 token controls with fake HTTP, while the existing wrong-ID rejection
still passes. No assumption is made about future generation receipts.

Owner-only private evidence:

- Root: `/private/tmp/d11-gemini-metadata-ODNLhN`
- `consumed.json` SHA-256:
  `73eb8885984dbc2e7aecc0ea474062b594e9a85e7acf210b5fa8cca50947cc79`
- `result.json` SHA-256:
  `76c349e6921c96e3772981f68761ee206b7ddbad3cd7efed7c052bab92e859ea`

The subsequent static audit used the official
[GenerateContent response reference](https://ai.google.dev/api/generate-content)
and [countTokens request reference](https://ai.google.dev/api/tokens). The
count request encloses the exact generation body as documented. Response
`usageMetadata` defines prompt, candidate, thinking and total token fields;
the service-tier enum includes `standard`. The model resource reported a
dated `version` (`3.5-flash-05-2026`). That field is not the generation
`modelVersion`, but a dated generation version is plausible; the local
validator now accepts the exact Flash family with either a three-digit or
`MM-YYYY` suffix and still pins the first actual generation version. Fake
tests reject sibling Flash-Lite/Image models and a changed date. This does
not claim a generation response was observed.

Node 24 diagnostic tests: 106 passed. Scoped strict TypeScript, zero-warning
ESLint, Prettier and `git diff --check` passed. The first test invocation used
Node 20, which cannot load these `.ts` files directly; rerunning under the
project's Node 24 succeeded. An initial type-check invocation referenced a
nonexistent scoped tsconfig; the explicit scoped TypeScript command passed.

The combined $10 figure remains approximate, not a hard bound. This probe
did not provide a billable-token receipt, and the Google spending dashboard
may lag; no charge is attributed to it. D11 remains in_progress; D12,
qualification and worker activation remain pending. No support message,
push, PR or deployment.
