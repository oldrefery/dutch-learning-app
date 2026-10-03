# D11 next personal Gemini full pilot — preflight, 2026-10-03

This is the second of at most five further personal-key attempts authorized
by the user. The first was the metadata-only diagnostic. The combined $10
figure is approximate and has no guaranteed hard cap. This full run retains
the narrower per-run proposed $2 estimate: 24 generation reservations total
$0.956736 at published Standard rates; direct REST metadata/count-control
charges remain unknown. Neither amount is a confirmed bill.

The separate owner-only root is `/private/tmp/d11-gemini-third-1xWFRl`.
Its immutable run ID is `a2cd0e7f-aace-4d98-9e8b-213d3c5e500f`. It binds
the same approved frozen 24 item IDs and input hashes, the same personal
`oldrefery@gmail.com` key hash, and implementation SHA-256
`6dbfb1b72ae6450b6e211eb684f5a5da70968b82c5991db74f2e15b55919c506`.
The private draft SHA-256 is
`7ed6ab8757c9b2141a5ecf2d8f824e0fc2b339c034b44e2fd589dd2cff861804`;
the authorization/execution SHA-256 is
`d98201f62bba2d4f3d116d05f0e300d4ef3b589953b94692345b0250edf34ce7`.
The prior unconsumed draft for an older timing revision was removed before
preparing this one. Neither of the two earlier consumed run registries is
reused.

Node 24 `diagnostic-live.ts --check` returned `ready: true` and
`external_calls: 0`. The exact new run directory and its external
`consumed.json` binding did not exist at that checkpoint. The only intended
next external operation is one `--execute` with this registry: at most one
metadata read, 24 exact-body token counts and one generation per meaning,
sequentially. The HTTP deadline is 30 seconds inside a 45-second journal
lease. There are no control or generation retries in this estimated-cost
mode. The private journal's immutable reservations and external consumption
binding prevent an uncertain operation from being replayed.

```bash
/Users/devrush/.nvm/versions/node/v24.20.0/bin/node scripts/cefr-calibration/diagnostic-live.ts --execute \
  docs/tasks/shared-dictionary-cefr/evidence/D11-pilot-review-worklist.json \
  docs/tasks/shared-dictionary-cefr/evidence/D11-pilot-provisional-reference.json \
  docs/tasks/shared-dictionary-cefr/evidence/D11-pilot-profile.proposed.json \
  docs/tasks/shared-dictionary-cefr/evidence/D11-pilot-prompt.txt \
  docs/tasks/shared-dictionary-cefr/evidence/D11-pilot-proposal-summary.json \
  /private/tmp/d11-gemini-third-1xWFRl/draft.json \
  /private/tmp/d11-gemini-third-1xWFRl/authorization.json \
  /private/tmp/d11-gemini-third-1xWFRl/credential.key \
  /private/tmp/d11-gemini-third-1xWFRl/run
```

After the command, inspect `consumed.json`, the journal and any report before
another provider action. A partial or uncertain outcome still consumes this
attempt. Remove the temporary key and local transfer script. Record only
sanitized counts and digests in the repository. D11 remains in_progress;
D12, qualification and worker activation remain pending. No support message,
push, PR or deployment.
