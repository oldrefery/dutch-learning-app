# D11.2 — offline calibration mechanics

2026-10-03, user-confirmed GPT-6.1 Sol / High, starting `2456246`, existing
`feature/shared-dictionary-schema`, AUTH-20/AUTH-18. No subagent.

## Result and limits

Offline mechanics implemented and locally verified. **D11.2 remains partial;
D11 is not complete.** There is no actual reviewed meaning fixture, live provider
sample, operational approval registry, qualified deployed method or spending
approval. Every committed fixture/label/reference is fictional, including
reviewed-shaped positive unit cases. No measured provider-quality claim follows
from these tests. D11.3–D11.7 have not started.

New modules under `supabase/functions/_shared/cefr-calibration/` validate fixtures,
method profiles and explicit reviewed acceptance policies; bind captured responses;
produce reproducible reports; and enforce fail-closed candidate decisions. The
[offline CLI](../../../../scripts/cefr-calibration/README.md) accepts only explicit
files and creates a new report without overwriting an existing one.

- Existing dictionary canonicalization and schema namespace are reused. The
  aggregate word-analysis CEFR namespace cannot become meaning-level evidence.
  Content is parsed and its exact canonical input/hash rechecked. Duplicate IDs,
  duplicate linguistic inputs and split leakage by family/spelling/hash fail.
- Reviewed known labels require reviewer, adjudication, evidence and permission
  references. Real meaning-family assignment and permission authenticity remain
  editorial responsibilities, checked by separate privileged approval.
- Missing responses remain counted and prevent qualification; malformed candidates
  remain invalid. Duplicate or absent response IDs, mismatched inputs/request/profile
  and missing provenance reject the batch. No private exports are discovered.
- Reports bind fixture, method/settings, request, responses, policy and report
  digests; include counts, split/slice coverage, singleton confusion, acceptable-set
  distance, exact/within-one agreement, severe errors, proposed accepted accuracy,
  expected-abstention accuracy and confidence-bin reliability. Every rate has its
  denominator and null for no observations. No inferred threshold or sample size.
- Qualification re-evaluates evidence, checks explicit minimum metric denominators,
  split/slice gates, real-reviewed/provider provenance, and separate server approval
  pinning all digests plus review/reuse references. No approval registry ships.
  Async inputs/approvals are snapshotted. A serialized qualification is unusable;
  only an immutable in-process token can permit a known model estimate.
- Missing qualification, ambiguity, low confidence or changed method/model/prompt/
  settings yields review; absent/invalid/abstained candidates remain unknown.
  Provider status/source claims cannot produce reviewed/locked assessments.
  A null resolved model version explicitly means unavailable; aliases are not
  immutable provider builds. Live worker eligibility must recheck provenance and
  approval validity, not treat this token as publication or budget permission.

No existing application, schema, lockfile, package dependency, runtime flag or
provider prompt was changed. All 158 previous reviewed fingerprints match.
No database write, retained QA resource start, native operation, real-provider
request, schedule, deployment, publication, push/PR/merge or production operation.
Previous OFF observations are historical; devices were not inspected or operated
in this offline checkpoint.

## Verification

Private logs and CLI artifacts:
`reports/shared-dictionary-cefr/d11-offline-calibration-20261003/`.
Sanitized source inventory: [D11 offline hashes](D11-offline-source-sha256.json).

```sh
/Users/devrush/.deno/bin/deno test --cached-only --config supabase/functions/deno.json supabase/functions/_shared/cefr-calibration/
/Users/devrush/.deno/bin/deno test --cached-only --config supabase/functions/deno.json --allow-env supabase/functions/gemini-handler/cefr_test.ts supabase/functions/gemini-handler/cefrHandler_test.ts supabase/functions/gemini-handler/geminiUtils_test.ts
/Users/devrush/.deno/bin/deno lint --config supabase/functions/deno.json supabase/functions/_shared/cefr-calibration scripts/cefr-calibration/report.ts
/Users/devrush/.deno/bin/deno check --config supabase/functions/deno.json scripts/cefr-calibration/report.ts
```

- New offline suite: **46 tests PASS**, including explicit checks that network,
  read/write, environment and subprocess permissions are not granted.
- Existing analysis regressions: **48 tests PASS**, fake in-memory HTTP and no
  network permission. This checks compatibility with the existing CEFR contract.
- Deno type checking and lint PASS; scoped ESLint/Prettier and diff check PASS.
  Existing cached Deno 2.7.9 used as in the preceding checkpoint; no installation.
- CLI smoke: 22 synthetic items, success exit 0, unqualified mechanics report.
  Repeated output path: exit 1; byte hash unchanged. No network permission.
- Initial development checks exposed two TypeScript narrowing errors and two
  require-await test issues; fixed without suppressions. The initial helper name
  matched an existing ignore pattern; renamed to `synthetic-fixtures.ts` so it is
  included. `deno check --cached-only` was unsupported by the installed CLI; used
  supported `deno check --config ...` with already cached imports. No dependency
  upgrade or network fetch was required. No unresolved validation failure.

## Next checkpoint

**GPT-6 Astra / High review of D11.2 qualification/evidence boundaries** before
using this policy in a worker. This intermediate review is warranted by the new
approval token and statistical acceptance boundary. Review especially denominator
and abstention semantics, evidence authenticity versus digest binding, profile
invalidation, family leakage checks and future registry/source-policy integration.
Then GPT-6.1 Sol / High for D11.3–D11.5 disposable queue/lease/head-CAS work under the
accepted engineering contract. Keep D11.2 real quality gate open; all flags and
schedules remain OFF. No live sample is authorized by this checkpoint.

Necessary local commit uses normal hooks under AUTH-18. Commit receipt follows in
handoff/session records. Preserve `.playwright-cli/` and all private reports/data.

Implementation commit `0cb494f` completed with normal hooks: mobile 156 suites /
1796 tests /22 snapshots; web 86 suites /780 tests with one existing skipped
suite/test. Post-commit audit adjusted only the permission-check test to deny its
own permissions explicitly, so the repository's broader Edge flags do not produce
a false failure. All 46 offline tests pass both with no runtime grants and with
caller-level `--allow-env --allow-net`; the audit itself is denied access in both.
No network operation was performed. Updated inventory retains 169 hashes and
changes only this test hash. Follow-up local test/receipt commit uses normal hooks.
No pending runtime job, external operation or restoration. Private commit logs
and all data retained; no push/PR/merge.
