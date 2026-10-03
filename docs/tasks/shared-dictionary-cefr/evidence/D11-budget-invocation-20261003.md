# D11.6–D11.7 local invocation and budget accounting

2026-10-03, starting `eb38631`, `feature/shared-dictionary-schema`, AUTH-20/AUTH-18.
User explicitly continued and requested the required model before each next
checkpoint. Implementation recommendation: GPT-6.1 Sol / High, matching the last
explicit confirmation. Picker control remains unavailable. Next required model:
GPT-6 Astra / High for concurrency/provenance/budget review. No subagent.

## Result

Additive migration `20261003100000_add_dictionary_cefr_budget.sql` supplies an
empty immutable spending/pricing/bounds registry, a global control row defaulting
OFF, one UTC-day ledger across policies/runs, run summaries and durable attempt
receipts. No real policy, secret, provider price, schedule or activation is seeded.

Policies bind exact method/profile/qualification, explicit approval/pricing/bounds
references, expiry, token maxima and prices in USD micro-units. Cost calculation
uses decimal arithmetic and upward rounding. Visible output and reasoning tokens
are disjoint counters; any eventual provider adapter must normalize inclusive
vendor counters and verify their meaning before using these fields. The reviewed
output reservation must cover the qualified generation limit. Missing pricing,
bounds or profile qualification fail closed. Cadence is daily/weekly metadata;
no scheduler is installed.

Dispatch locks control → policy → method → UTC ledger → reservation/job. Atomic
claim and reservation consume one request and a conservative maximum token/cost
charge per attempt, before any provider I/O. Request/token/cost caps each constrain
claims; a rejected budget claim consumes no job attempt. A changed policy cannot
reset or increase the established bucket for a used UTC day. Daily accounting is
independent of session timezone; historical charges survive the next day's bucket.
No-work/disabled paths make no provider call and reserve no request budget.

A separate one-use dispatch permit checks kill switch, current policy, expiry,
UTC day, lease generation, source/method and published/assessment heads again.
Duplicate delivery cannot authorize a second external call on one reservation.
SQL transactions end before network work. Cancellation stops new permits; existing
issued attempts retain their conservative reservations. The handler also checks
UTC day and cancellation immediately before transport dispatch.

Crash, timeout, transport error and unknown usage retain the maximum charge. A
separate verified transport receipt can reconcile tokens/cost once; request count
is never refunded. Receipts are globally unique, immutable once verified, and
cannot be borrowed from model-generated response JSON. Late verified accounting
is allowed for expired/replaced leases while stale assessment writes remain
rejected. Observed bounds violations retain the reservation, record the receipt
and trip the global kill switch; the reserved ceiling is not proof of actual spend
when a reviewed provider bound itself was violated. Such a case requires review
before any restart. No live bound or provider configuration has been approved.

Attempt completion accounts and settles through the existing fenced assessment
transaction, preserving reviewed heads and immutable history. A disabled/replaced
policy discards a late estimate while still retaining/accounting its usage.
Duplicate completion returns the same assessment and reconciles once. Run summaries
are computed from SQL receipts, with selected/claimed/completed/unknown/review/
retry/obsolete/stale/failed/pending counts, budget stops, remaining eligible coverage
and reserved/charged/observed usage. Incomplete expired runs become abandoned.

All new private tables have RLS and no client or service DML grants. Only narrow
RPCs are executable by service_role; public/ordinary authenticated clients cannot
invoke them. Existing low-level queue RPCs remain lease/persistence primitives,
not provider invocation or spending authority. The invocation layer always uses
the new reservation/one-use-permit path.

`handler.ts` accepts server-owned configuration and injected adapters. It verifies
a distinct internal secret using Web Crypto HMAC verification before any privileged
operation. Ordinary apikey/user JWT headers alone fail; HTTP parameters/body cannot
select a method, provider, budget or limits. It is disabled by default and bounds
batch, input/output, provider timeout and persistence calls. `store.ts` binds only
named RPCs to the generated target types, propagates cancellation and hides raw
errors. No client, URL, environment credential, runtime HTTP registration or live
provider transport is constructed by these modules. An eventual deployment must
supply a dedicated random server secret and an approved transport/configuration.

## Verification and persistence

Private logs: `reports/shared-dictionary-cefr/d11-budget-20261003/` (ignored).
[184-path inventory](D11-budget-source-sha256.json): 173 prior hashes retained;
four changed paths (manifest/generated types, evaluator, synthetic fixture helper)
and seven new paths (migration, two SQL fixtures/tests, handler/tests, RPC store/tests).
No application, client-secret or personal-data file changed.

```sh
node --test --test-concurrency=1 --test-timeout=120000 scripts/postgres-tests/cefr-budget.test.mjs
node --test --test-concurrency=1 --test-timeout=120000 scripts/postgres-tests/cefr-budget.test.mjs scripts/postgres-tests/cefr-queue.test.mjs
node_modules/.bin/deno test --config supabase/functions/deno.json supabase/functions/_shared/cefr-worker/ supabase/functions/_shared/cefr-calibration/
node_modules/.bin/deno check --config supabase/functions/deno.json supabase/functions/_shared/cefr-worker/handler.ts supabase/functions/_shared/cefr-worker/store.ts
node_modules/.bin/deno lint --config supabase/functions/deno.json supabase/functions/_shared/cefr-worker
node_modules/.bin/eslint scripts/postgres-tests/cefr-budget*.mjs
npm run supabase-contracts:target:generate
npm run supabase-contracts:target:check
```

- Final budget PostgreSQL suite: **27 PASS**, including exact cap dimensions,
  observed lock overlap for cap/kill-switch races, rollback, one-use permits,
  receipt reuse/immutability, concurrent completion/refund, conservative crash/
  timeout/retry accounting, profile/output-bound mismatch, policy replacement,
  UTC-day separation and fractional pricing. Fake HTTP integration covers 429,
  503, 401, malformed output, transport and timeout without any provider network.
- Existing queue PostgreSQL regressions: **18 PASS** under the new migration.
  Combined earlier log is 43 PASS (25 budget +18 queue); final 27-budget log
  supersedes its budget portion after the final RPC adapter/constraints/tests.
- Deno: **72 PASS** (50 calibration, 7 evaluation, 12 handler, 3 typed RPC store),
  without environment/network permission. Tests validate authentication ordering,
  payload injection rejection, empty/disabled paths, captured configuration,
  malformed/duplicate leases, late authorization after timeout and sanitized errors.
- Official generation and reproducibility check PASS using pinned images and
  disposable internal-only containers. New private tables remain unexposed;
  five budget/dispatch/accounting RPC contracts are generated.
- Scoped types, Deno lint, ESLint, Prettier and diff checks PASS. Node 24.20.0,
  local Deno 2.9.4 and socket-only PostgreSQL 15; no dependency installation.
- Initial SQL attempt: 13 PASS /2 test-setup failures, retained separately. Fixed
  cross-test job counting and added pending work before checking a spent request
  cap. Handler tests exposed a HeadersInit inference error and shared mock-profile
  aliasing; corrected types and independent fake DB data. No checks suppressed.
- Only test-owned temporary resources are created/closed. Retained QA devices,
  backend, data/reports and unrelated `.playwright-cli/` remain untouched. No paid
  call, hosted migration, schedule, production operation, deployment or Git push.

PostgreSQL 15 transaction/locking/UTC semantics and Deno Web Crypto documentation
were fetched through Context7 from official documentation. Existing unrelated
analysis/schema results remain in earlier evidence; no unchanged QA replay is
claimed here. Necessary local implementation/evidence commit uses ordinary hooks
under AUTH-18; actual commit and hook receipt follow.

## Exact next checkpoint

**GPT-6 Astra / High** review of `handler.ts`, `store.ts`, both D11 queue/budget
migrations, qualification/profile binding, accounting and the synthetic evidence.
Focus on lock order/cap races, one-use permits, UTC boundaries, expired/replaced
leases and policies, immutable receipt reconciliation, conservative unknown spend,
provider-bound assumptions, source/privacy boundaries and disabled defaults.
Preserve 184 source fingerprints; run new checks only for changes/findings.

D11.3–D11.7 local mechanics are implemented but acceptance remains open until this
review. D11.2 real meaning-level quality/source evidence is still unqualified, and
a separate bounded live sample/spending approval remains absent. D11 is
`in_progress`; a fake-provider pass does not close the whole stage or permit bulk
work. No runtime bootstrap, real transport or cadence activation is authorized.
