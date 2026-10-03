# D11 first authorized Gemini attempt — 2026-10-03

The user approved one run of the 24 frozen meanings through the personal
`oldrefery` Gemini key with an estimated, not guaranteed, $2 API-use figure and
at most one generation per meaning. Implementation commit `cf44395` and the
pre-dispatch checkpoint `c679bc7` preceded execution. The private `--check`
returned `ready: true` and `external_calls: 0`; the run directory and
consumption record were absent at that point.

Exactly one `diagnostic-live.ts --execute` invocation was made. It exited 1
with the CLI's sanitized generic failure. The durable private SQLite journal
and consumption record were then inspected without dispatch. They show one
`model_metadata` control reservation with no receipt, zero `count_tokens`
reservations, zero generation attempts and zero captures. The control request
may have reached Google; its response and charge are unknown. No frozen
meaning input was transmitted, no generation charge was reserved, and none of
the 24 meanings received an answer. The private unqualified report has SHA-256
`dde1b5911e1a3e8d57939288df8c6165cf6b3075bbab4ab21288d963bb96612d`;
it records one unknown control, 24 missing items, unknown total cost and
`qualified: false`. The report, SQLite journal and consumption record remain
together in owner-only `/private/tmp/d11-gemini-a9ouRo` outside the repository. The
temporary key file and local transfer script were removed.

The runner did not retain a sanitized HTTP status or failure class for this
control, so the cause cannot be determined from the journal. A keyless `curl`
request and a keyless Node `fetch` to Google's public pricing documentation
both returned HTTP 200, which checks general connectivity but says nothing
about the Gemini API endpoint. The AI Studio aggregate Usage page returned an
unknown page error and supplied no diagnostic evidence. No support message
was sent. The model ID and advertised limits remain documented in Google's
[Gemini 3.5 Flash model page](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash),
but that does not establish the outcome of this specific request.

The `oldrefery@gmail.com` Google Cloud Console dashboard for the selected
project displayed two aggregate Gemini API requests and 0% errors over its
one-day interval. Its Traffic chart failed to load, and the Gemini API
detail page also failed to load. Those aggregate counters cannot attribute
either request to this attempt or prove whether its metadata control reached
the provider, succeeded, failed, or incurred a charge.

The single-run approval is consumed. Do not call `--execute` again against
this registry or create a replacement registry under the old approval. Any
future provider attempt needs a newly scoped authorization and a private
key-binding check. Before proposing that, local work may improve sanitized
control-failure receipts and fake-test them, without touching the preserved
private journal or treating this attempt as completed calibration evidence.

## Subsequent local diagnostic improvement

After preserving the first report, the runner was updated to write only a
safe failure class (`http`, `timeout`, `envelope`, `validation` or `transport`)
and, for HTTP, its numeric status alongside an unknown control receipt. It
does not store the response body, key or raw error, and the failed control
still cannot replay. A fake HTTP 403 test confirms a metadata failure records
only class/status and prevents later generation or retry. Node 24 diagnostic
tests: 104 passed with `node --test scripts/cefr-calibration/diagnostic*.test.ts`;
scoped TypeScript (`--module esnext --moduleResolution bundler --types node`),
zero-warning ESLint, Prettier and diff check passed. The new implementation digest is
`6d603e17dc837055aaca1a80d55022cb4a436cd0ce76c56484c06bebd40460f9`.
This code change cannot recover the cause of the already consumed attempt or
authorize another provider call.
