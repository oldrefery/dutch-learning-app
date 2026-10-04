# D11 personal Gemini v3 pilot — preflight, 2026-10-04

This is planned attempt 3 of the user's at-most-five further personal
`oldrefery@gmail.com` Gemini attempts. The first was metadata-only; the
second completed the v2 24-meaning pilot and its journal/report are immutable.
Three attempts remain before this dispatch. The combined $10 figure is an
estimate, not a guaranteed hard bound. This v3 pilot retains the narrower
per-run proposed $2 estimate: 24 generation reservations total $0.956736
at published Standard rates; direct REST control charges remain unknown.

The new owner-only private root is `/private/tmp/d11-gemini-v3-7zEmDZ`.
Its immutable run ID is `927f5b4e-0a96-49eb-9eea-564b2b4186be`. It binds
the same approved 24 item IDs/input hashes, the v3 prompt/profile/proposal,
and the previously verified personal key hash. The new diagnostic bundle
SHA-256 is
`1248911a0b948e2c84ac1344731f2c7fd898a5ceaad9fd78be3f074199d5ae35`.
Implementation SHA-256 is
`ef06e2155746d0b5e7ccb3b42edb5b3c6d9f4715639079da6548ce50a3008e47`.
Private draft SHA-256 is
`8879aece5a99741f99b82170b086e1fa20820a0418d198934649f46698b3d796`;
authorization/execution SHA-256 is
`fe8b52dcbc71155ef3da4d15ec6a1887588febdd5f44f5068f28db4e16de6766`.

Node 24 `diagnostic-live.ts --check` returned `ready: true` and
`external_calls: 0`. Neither the new run directory nor its external
`consumed.json` binding exists. The next external operation is one
`--execute`: at most one metadata read, 24 exact-body token counts and one
generation per meaning, sequentially, with no retries. The 30-second HTTP
deadline fits within the 45-second journal lease. A partial or uncertain
outcome consumes this attempt and must be inspected before any other request.

```bash
/Users/devrush/.nvm/versions/node/v24.20.0/bin/node scripts/cefr-calibration/diagnostic-live.ts --execute \
  docs/tasks/shared-dictionary-cefr/evidence/D11-pilot-review-worklist.json \
  docs/tasks/shared-dictionary-cefr/evidence/D11-pilot-provisional-reference.json \
  docs/tasks/shared-dictionary-cefr/evidence/D11-pilot-profile-v3.proposed.json \
  docs/tasks/shared-dictionary-cefr/evidence/D11-pilot-prompt-v3.txt \
  docs/tasks/shared-dictionary-cefr/evidence/D11-pilot-proposal-summary-v3.json \
  /private/tmp/d11-gemini-v3-7zEmDZ/draft.json \
  /private/tmp/d11-gemini-v3-7zEmDZ/authorization.json \
  /private/tmp/d11-gemini-v3-7zEmDZ/credential.key \
  /private/tmp/d11-gemini-v3-7zEmDZ/run
```

After the command, inspect `consumed.json`, journal and any report. Remove
the temporary key and transfer/preparation scripts. Record only sanitized
aggregate outcomes and digests in the repository. D11 remains in_progress;
D12, qualification and worker activation remain pending. No support message,
push, PR or deployment.
