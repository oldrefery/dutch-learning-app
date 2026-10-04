# D11 second authorized Gemini run — pre-dispatch checkpoint

The user explicitly authorized one new run on October 3, 2026 with the
personal `oldrefery@gmail.com` key, the same 24 frozen meaning inputs,
at most one generation per meaning and an estimated, not guaranteed, $2
API-use figure. This is a new one-run permission; the first run remains
consumed and preserved.

AI Studio showed the signed-in `oldrefery@gmail.com` account, the paid
Tier 1 / Postpay `Gemini API` project and the selected key matching the
user's five-character identifier. The key was transferred only to a new
owner-only local file and was not printed. Its SHA-256 matched the key
bound to the first registry. The first private journal and unqualified
report were not changed.

The new owner-only private root is `/private/tmp/d11-gemini-second-CyodKn`. It has a separate
draft, authorization, credential, run directory and consumption-record
path. The registry binds run ID
`95aa2f8c-2be7-413b-871c-8b05412a6a42`, 24 distinct frozen source
IDs and hashes, the current implementation digest
`6d603e17dc837055aaca1a80d55022cb4a436cd0ce76c56484c06bebd40460f9`,
and an October 3 UTC expiry of 23:55. The code permits at most one
metadata control, 24 token-count controls and 24 generations. Published
generation maximum is $0.956736; direct REST control costs remain
unknown, so $2 is not a hard total limit.

Node 24 `diagnostic-live.ts --check` returned `ready: true`,
`external_calls: 0` and execution binding SHA-256
`f3d935056d706f6211c63cfbbeb4820558b15c0d75220f6c32386fdcee791e8e`.
The new run directory and consumption record were absent after the
check. The next operation is exactly one `--execute` against this new
registry. On any failure or interruption, inspect the private journal,
consumption record and report before considering another action; this
permission never allows a replacement run.
