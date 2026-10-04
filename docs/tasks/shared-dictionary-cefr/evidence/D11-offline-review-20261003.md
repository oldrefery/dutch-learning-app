# D11.2 — offline qualification review and repairs

2026-10-03, starting `cf1ffaa`, existing `feature/shared-dictionary-schema`,
AUTH-20/AUTH-18. User explicitly continued after the requested Astra / High review
handoff. The current picker/model setting has not yet been confirmed; a concise
confirmation request is pending. Do not attribute this work to Astra or claim that
model-specific review provenance is verified. No subagent.

## Technical outcome

Local technical review found two P2 defects in the dormant offline harness. Both
were reproduced before repair and fixed with regression tests. **Technical checks
PASS after repairs; requested Astra / High review provenance remains unverified.**
D11.2 real-quality evidence and D11.3–D11.7 remain open. There is no operational
approval, qualified live profile, provider sample, publication or runtime activation.

### R1 — returned policy aliases a mutable module-wide coverage list

At `cf1ffaa`, `validatePolicy` returned `REQUIRED_SLICES` by reference. Mutating the
returned report's `policy.required_slices` therefore changed the global list used
by later fixture validation and qualification. The reproduction truncates that
returned array; the next valid fixture fails with `fixture_slices`. Other partial
mutations could alter which coverage slices are evaluated for subsequent reports.
Existing digest-pinned approvals are not bypassed by this alone, but the process
loses stable validation semantics and report consumers can corrupt future runs.

Repair: freeze the exported constant and give each validated policy its own copy.
The regression changes a returned report and verifies the next report still
retains the mandatory list. No statistical threshold or accepted content changes.

### R2 — unsupported policy inputs silently disappear before digest binding

`validatePolicy` ignored unknown fields and an explicit conflicting
`required_slices`. A caller could add a misspelled or future stricter constraint
without rejection or a changed normalized policy/report digest; review artifacts
would not record that the supplied requirement was unenforced. Method profiles
already reject unknown settings, so policy parsing was inconsistent.

Repair: allow only supported policy keys, and when `required_slices` is explicitly
supplied require it to equal the enforced versioned list. Regression tests reject
an unknown constraint and an empty explicit list. A separate round-trip test
verifies that serialized supported policy still produces the exact same report
and digest. Approved thresholds are not altered or inferred.

## Other reviewed boundaries

- Candidate parsing cannot grant editorial status or provenance. The operational
  decision needs an in-process token, exact method/profile digest and confidence
  threshold, and rejects ambiguity. A serialized token cannot confer authority.
- Qualification recomputes evidence from snapshotted inputs and separately
  snapshots approval. Returned report mutations cannot provide qualification;
  approved fixture/report/profile/policy digests are rechecked. The token is not
  database publication, source reuse, budget, lease or head-CAS authorization.
- Denominators are explicit: exact/within-one/severe errors condition on known
  outputs with expected levels; coverage includes all fixture items; abstention
  accuracy includes all expected-abstention items; accepted accuracy counts every
  threshold-accepted item, including incorrect forced answers. Null empty rates
  cannot satisfy gates. Required sample minima apply to scored/accepted subsets.
- Families, equal spellings and linguistic hashes are fenced across splits;
  duplicate linguistic inputs cannot inflate counts. Editorial family/meaning
  assignment and real reviewed labels still require independent review. The
  harness cannot infer semantic equivalence, reviewer authenticity or permission.
- Fully reviewed/provider-shaped metadata alone cannot qualify: the separate
  privileged approval registry must authenticate review and reuse references and
  pin exact evidence. No such registry is implemented or configured here. Fictional
  positive tests are mechanics tests, never actual provider-quality evidence.
- Resolved model version null remains explicitly unavailable. Method, prompt,
  requested/resolved model and settings changes invalidate the in-process token.
  Alias drift and approval revocation remain future live-registry/worker concerns.
- No production client, analysis namespace, database schema, package dependency,
  provider adapter or runtime flag changed. No device/backend was needed or used.

## Evidence

Private root: `reports/shared-dictionary-cefr/d11-offline-review-20261003/`.
`reproductions.log`: three failing regressions before repair (two underlying defects).
`offline-tests.log`: **50 tests PASS**, no runtime permissions or network access.
Deno checks types during tests; scoped Deno lint/ESLint/Prettier and diff check PASS.
The added fourth test verifies supported policy serialization. Previous unchanged
analysis/SQL/device checks were not replayed. Normal local commit hooks remain
required and their receipt is recorded separately.

```sh
/Users/devrush/.deno/bin/deno test --cached-only --config supabase/functions/deno.json supabase/functions/_shared/cefr-calibration/
/Users/devrush/.deno/bin/deno lint --config supabase/functions/deno.json supabase/functions/_shared/cefr-calibration
```

All 170 prior hashes matched at startup. The [review inventory](D11-offline-review-source-sha256.json)
retains 168, updates the two repaired modules and adds the review test (171 total).
No hosted, paid, production, schedule, deployment, publication or Git push/PR/merge
operation; no pending external write or restoration. `.playwright-cli/` and ignored
reports/data are retained.

Next: resolve the pending current-model confirmation before recording the requested
Astra review gate as satisfied. If the picker was Astra / High, record that fact
without rerunning unchanged checks; otherwise leave the prescribed review open.
Then GPT-6.1 Sol / High for local D11.3–D11.5 queue/lease/head-CAS implementation
under the accepted contract. Keep the real D11.2 source/quality/spending gates open.

Review/fix commit **`039223a`** completed with normal hooks: mobile 156 suites /
1796 tests /22 snapshots; web 86 suites /780 tests, one preexisting skipped
suite/test. Post-hook source inventory 171/171 matches. Only preexisting
`.playwright-cli/` is untracked before this receipt. Private `commit.log` retained.
No pending runtime operation or external write. Local-only, no push. Current-model
confirmation is still pending; do not infer Astra provenance from the commit.
