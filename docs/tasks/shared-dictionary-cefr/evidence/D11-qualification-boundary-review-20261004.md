# D11 qualification boundary review

2026-10-04, starting `9a47b16`, `feature/shared-dictionary-schema`.
Local review and repair under AUTH-20/AUTH-18. Recommended review model
GPT-6 Astra / High was announced; picker attribution is not independently
verified. No subagent or external reviewer was used.

## Finding and repair

**P2: missing or malformed ambiguity was converted to an unambiguous input.**
The worker passed `raw.ambiguous === true` into `decideCandidate`, whose
contract requires explicit absence of ambiguity. A response with a correct
binding and a high-confidence candidate could become `estimated` when its
ambiguity field was absent, null, a string, a number or an object.

A new regression reproduced six incorrect estimates before the repair; the
explicit true control already remained unknown. The worker now treats every
value except boolean false as ambiguous. All seven cases remain unknown,
and their verified transport usage is preserved. Existing positive worker
and SQL integration fixtures now explicitly send `ambiguous: false`.
This is an adapter-envelope requirement, not a claim that a model's boolean
alone proves a meaning is unambiguous. Qualification and input validation
remain separate mandatory checks. No deployed adapter is changed.

## Boundaries checked

- Diagnostic reports use a separate namespace and hard-code `qualified: false`
  and `calibration_eligible: false`. Owner learning-level feedback does not
  enter the frozen reference, scoring or operational approval registry.
- Qualification rebuilds evidence from captured inputs, requires reviewed
  fixture metadata, provider provenance, explicit policy, split/slice sample
  minima and exact fixture/report/profile/policy bindings to server approval.
  Authenticity of review and permission references is an external trusted
  registry responsibility; nonempty strings do not establish independent gold.
- Decisions require an in-process token. Serialized/fabricated tokens, changed
  method settings, low confidence and ambiguity cannot authorize an estimate.
  A model response cannot promote its status to reviewed or source-backed.
- Worker preflight rejects missing/fabricated qualification before reservation
  or provider work. Configuration stays server-owned and disabled by default.
  No production qualifier registry or active worker endpoint was found.
- Reviewed offline mechanics and worker implementation already exist, including
  the October 3 queue/budget review. Recent handoffs referring to a fresh D11.3
  implementation were stale. Do not rebuild or repeat completed work.

## Verification

- Regression before repair: one failing test, six incorrect estimates out of
  seven cases; this was a behavioral failure, not an environment failure.
- Cached Deno calibration/worker suites: **73 passed**, zero failed, including
  the regression. No network permission; Deno type checking passed.
- Fake diagnostic suites: **24 passed**, zero failed. No real provider calls.
- Scoped Deno lint, MJS ESLint and Prettier passed. ESLint excludes Edge files;
  those files were checked by Deno lint instead.
- PostgreSQL budget/queue integration checks: **47 passed**, zero failed
  (29 budget and 18 queue), after the local environment recovery below.
  Initial Node 20 attempts could not load TypeScript; Node 24.20.0 fixes that
  setup issue. PostgreSQL startup then hit the macOS shared-memory ID limit,
  both inside and outside sandbox. Read-only inspection found 32 unattached
  56-byte user-owned segments and no PostgreSQL process. Only the segment
  from the current failed startup (creator PID 57232) was removed after
  rechecking identity, zero attachments and absent creator. The other 31
  segments, retained databases and host settings were unchanged.

Commands (repository root):

```sh
/Users/devrush/.deno/bin/deno test --cached-only --config supabase/functions/deno.json supabase/functions/_shared/cefr-calibration/ supabase/functions/_shared/cefr-worker/
/Users/devrush/.deno/bin/deno lint --config supabase/functions/deno.json supabase/functions/_shared/cefr-worker/
/Users/devrush/.nvm/versions/node/v24.20.0/bin/node --test scripts/cefr-calibration/diagnostic.test.ts scripts/cefr-calibration/diagnostic-review.test.ts
/Users/devrush/.nvm/versions/node/v24.20.0/bin/node --test --test-concurrency=1 --test-timeout=120000 scripts/postgres-tests/cefr-budget.test.mjs scripts/postgres-tests/cefr-queue.test.mjs
node_modules/.bin/eslint --max-warnings=0 scripts/postgres-tests/cefr-budget.test.mjs scripts/postgres-tests/cefr-queue.test.mjs
node_modules/.bin/prettier --check supabase/functions/_shared/cefr-worker/evaluate.ts supabase/functions/_shared/cefr-worker/evaluate_test.ts supabase/functions/_shared/cefr-worker/handler_test.ts scripts/postgres-tests/cefr-budget.test.mjs scripts/postgres-tests/cefr-queue.test.mjs
git diff --check
```

## Resume boundary

Next **GPT-6.1 Sol / High**: reconcile D11.3 local acceptance against the
existing queue selection, provenance filtering and bounded invocation, using
`D11-worker-review-20261003.md` and `D11-budget-invocation-20261003.md`.
Record any actual missing requirement before adding implementation. Keep
local mechanics and operational acceptance distinct; no checkbox is closed
solely because D11.2 was narrowed. D11 remains in_progress, D12 pending.

D11.2 remains closed only diagnostically. Independent meaning-level quality,
adequate denominators and prospective approval remain open activation gates.
Two Gemini attempts remain restricted to the original 24 inputs; no repeat
pilot or new-input transmission occurred. No support inquiry, push, PR,
hosted migration, publication, worker activation or deployment. Scope is
local-only; preserve preexisting untracked `.playwright-cli/`.
The [source inventory](D11-qualification-boundary-source-sha256.json) binds
reviewed code and changed fixtures. Normal local commit hooks are required;
no external operation is pending.
