# D11 worker concurrency, provenance and budget review

2026-10-03, starting `9a29b06`, `feature/shared-dictionary-schema`, AUTH-20/AUTH-18.
Required review model GPT-6 Astra / High was announced before work. The current
picker setting is not independently verified; this records a local technical
review and repairs, without claiming confirmed Astra-specific attribution.
No subagent, live provider or retained QA resource was used.

## Outcome and repaired finding

**Local technical review PASS after one P2 repair.** D11 remains in_progress;
real calibration, provider/source reuse, pricing/bounds and spending/sample gates
remain open. No live quality or deployment acceptance is inferred.

**P2: a policy expiring during completion could still publish an estimate.**
`finish_dictionary_cefr_attempt_v1` checked policy validity before calling the
queue settlement function. Waiting for a revision-head lock or the delivery-cursor
lock could outlive `valid_until` while the longer job lease remained valid. The
settlement function rechecked lease expiry, but knew nothing about policy expiry.
Both deterministic regressions returned `completed` before the repair, although
publication after the policy deadline should have been rejected.

The wrapper now captures the immutable deadline and contains settlement in an
exception block, then checks the deadline again after all publication/journal
work. Expiry rolls back the assessment, head, change event and job completion;
the current live lease becomes obsolete (otherwise stale). Usage accounting is
outside that block, so verified spend persists. A duplicate completion returns
the saved obsolete result and never refunds twice. This changes only the body of
an undeployed local migration, with no RPC/schema shape change or hosted apply.

Two real concurrent PostgreSQL regressions use observed `pg_stat_activity` lock
barriers, wait for the actual policy deadline, and check zero assessment/head/
CEFR journal rows, retained verified usage (15 tokens /35 fictional micro-USD),
obsolete run metrics and idempotent repetition. All data and prices are fictional.

## Reviewed boundaries and limits

- Opaque in-process qualification binds the profile and accepted threshold;
  registry/profile/source hashes are rechecked before dispatch/settlement.
  Synthetic reviewed-shaped fixtures prove mechanics only. No live method or
  policy registry entry exists by default.
- Selection reads current published dictionary revisions/provenance only;
  personal words, fallback/override content and analysis cache are not inputs.
  Referenced content sources/revisions are immutable; provider approval is locked
  through settlement. Reviewed heads, input changes and replacement leases are
  protected by SQL validation and CAS, with losing writes rolled back.
- Control/policy/method/UTC-ledger locks serialize budget claims and receipt
  reconciliation. Unknown or interrupted calls retain full reservations; verified
  receipts reconcile once, and retries consume additional request reservations.
  Policy replacement cannot reset the established UTC bucket. One-use permits
  precede provider I/O; locks do not span that network call.
- The handler authenticates before store work, takes configuration only from the
  server, bounds input/output/timeouts and rejects malformed identities. The RPC
  store propagates cancellation and sanitizes errors. Default control is OFF;
  there is no deployed endpoint, real provider adapter or active scheduler.
- Low-level service-only queue RPCs remain trusted lease/persistence primitives,
  not spending authority. Operational bootstrap must use the budget path. A live
  adapter still needs reviewed input/output/reasoning limits, exact prompt/model
  binding, transport-verified disjoint usage counters and byte-limited reads.
  A bound violation kills new dispatch but cannot undo already incurred spend;
  an abort is not evidence that a provider stopped billing.

## Verification

Private logs: `reports/shared-dictionary-cefr/d11-worker-review-20261003/`.
[Source inventory](D11-worker-review-source-sha256.json): 184 paths; all 184
matched the previous inventory before edits; 181 retained afterward. Only the
budget migration, budget test and its fixture helper changed. No app/client code,
provider configuration, generated types or dependency changed.

```sh
node --test --test-concurrency=1 --test-timeout=120000 --test-name-pattern='policy expiry while completion' scripts/postgres-tests/cefr-budget.test.mjs
node --test --test-concurrency=1 --test-timeout=120000 scripts/postgres-tests/cefr-budget.test.mjs scripts/postgres-tests/cefr-queue.test.mjs
node_modules/.bin/eslint scripts/postgres-tests/cefr-budget-fixtures.mjs scripts/postgres-tests/cefr-budget.test.mjs
node_modules/.bin/prettier --check scripts/postgres-tests/cefr-budget-fixtures.mjs scripts/postgres-tests/cefr-budget.test.mjs
npm run supabase-contracts:target:check
git diff --check
```

- Before fix: **2 FAIL**, both actual `completed` versus expected `obsolete`
  (`sql-before.log`). These are reproduced defects, not setup failures.
- After fix: **47 PASS** =29 budget +18 queue tests (`sql-after.log`). Includes
  the two expiry races, reviewer/lease/CAS races, invocation/fake-provider paths,
  caps, receipts, retries, kill switch and policy changes.
- Official target contract reproducibility **PASS**, generated artifact unchanged
  (`types-check.log`). Scoped ESLint, Prettier and diff checks **PASS**.
- Existing 72 Deno results remain applicable to unchanged source hashes and were
  not rerun; their evidence is retained in the preceding invocation checkpoint.
- Node 24.20.0, disposable socket-only PostgreSQL 15; target check uses the existing
  pinned, disposable generator containers. Both harnesses finished successfully
  and clean up their own resources. Retained backend/devices and reports untouched.
- PostgreSQL 15 exception rollback semantics verified through Context7 against
  [official documentation](https://www.postgresql.org/docs/15/plpgsql-control-structures.html#PLPGSQL-ERROR-TRAPPING).
  Writes inside the caught block roll back; preceding accounting remains.

Necessary local repair/evidence commit uses normal hooks under AUTH-18. Actual
commit and hook results are recorded in the handoff/session receipt after success.
No push, PR, hosted migration, paid call, activation, publication or deployment.

## Next checkpoint

**GPT-6.1 Sol / High**: prepare a concrete local D11.2 real-calibration/sample
proposal, identifying eligible meaning inputs, reviewer evidence and provider
profile, token/pricing bounds, sample size and exact maximum spending for approval.
Do not invent reviewed labels or infer approval from synthetic fixtures. First
resolve missing real fixture/reviewer/provider inputs; do not call a paid provider
or activate a scheduler before the separate scoped approval. Announce the model
before beginning. Current review model attribution remains unverified, not a
reason to replay unchanged QA. D12 has not started; D11 is not fully accepted.

## Persistence receipt

Repair/review commit **`ab789e2`** passed normal hooks: mobile 156 suites /1796
tests /22 snapshots; web 86 suites /780 tests, one preexisting skipped suite/test.
Post-hook inventory **184/184 exact**; only preexisting `.playwright-cli/` untracked
before the documentation receipt. Private `commit.log` retains hook results.
The hook length/complexity checks found no matching TS/JS paths; changed MJS
files passed the separate scoped ESLint check. No push or pending operation. Next remains Sol / High local calibration/sample proposal,
with real evidence and separate live approvals still required.
