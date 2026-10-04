# D11.3–D11.5 local queue and fake-provider foundation

2026-10-03, starting `9454552`, `feature/shared-dictionary-schema`, AUTH-20/AUTH-18.
User confirmed GPT-6.1 Sol / High; no model switch or earlier Astra review is
inferred from that confirmation. No subagent. This checkpoint is local mechanics,
not real calibration, a deployed worker, a spending approval or stage acceptance.

## Implemented

- Additive migration `20261003090000_add_dictionary_cefr_queue.sql`: empty private
  method registry and queue. Methods default disabled, bind immutable profile,
  fixture/report/policy/qualification digests and explicit provider reuse/review
  references. Only an administrator can register/enable them; ordinary clients
  and service workers cannot mutate registry tables. Revocation is irreversible.
- Selection reads eligible current published meaning/revision/source tables only.
  It recomputes content and linguistic hashes, excludes drafts, retirement and
  non-unknown/locked assessments, and never joins personal words or analysis cache.
- Service-only enqueue/claim/settle RPCs, RLS, explicit grants/revokes and empty
  search paths. Per-method locking bounds concurrent unexpired leases; jobs bind
  entry/input/method, expected head, random token and monotonic attempt. Expired
  leases can be reclaimed; attempts/backoff/Retry-After are bounded.
- Completion rechecks method/source, current linguistic input, expected head and
  unexpired lease. Media-only successors remain applicable. A reviewed head wins;
  successful completion appends only an unlocked model estimate and advances the
  matching head atomically. Duplicate payloads return the same assessment;
  changed payloads and replaced leases cannot write.
- Lease expiry is checked after waiting for head locks and again after head/change
  journal writes. An expired attempt rolls back its unpublished assessment/head
  and journal change. Concurrent absent-head reviewers leave no orphan estimate.
- Pure evaluation module verifies the opaque qualification, profile and canonical
  input before a provider call. Captured data is isolated from caller/adapter
  mutation. Input/output bounds, concurrency/duplicate bounds, timeout/abort,
  retryable 429/5xx/transport classification, permanent failure, abstention and
  response identity checks are covered. Defaults are disabled; empty work makes
  zero calls. Fictional fixtures stay explicitly TEST-ONLY.
- Official target types regenerated and checked through the new migration with
  pinned PostgreSQL/Postgres Meta images in disposable internal-only containers.
  Three RPC contracts added; private tables are not exposed in generated types.

## Verification

Private logs: `reports/shared-dictionary-cefr/d11-queue-20261003/` (ignored).
Source fingerprints: [177-path inventory](D11-queue-source-sha256.json). It retains
168 of the prior 171 fingerprints, changes the target manifest/generated artifact
and adds a qualification preflight helper to `policy.ts`, plus six new files.

Commands use Node 24.20.0 and local Deno 2.9.4, without dependency installation:

```sh
node --test --test-concurrency=1 --test-timeout=120000 scripts/postgres-tests/cefr-queue.test.mjs
node --test --test-concurrency=1 --test-timeout=120000 scripts/postgres-tests/dictionary-content-protocol.test.mjs scripts/postgres-tests/analysis-cefr-cache.test.mjs
node --test --test-concurrency=1 --test-timeout=120000 scripts/postgres-tests/shared-dictionary-schema.test.mjs
node_modules/.bin/deno test --config supabase/functions/deno.json supabase/functions/_shared/cefr-worker/ supabase/functions/_shared/cefr-calibration/
node_modules/.bin/deno test --cached-only --config supabase/functions/deno.json --allow-env supabase/functions/gemini-handler/cefr_test.ts supabase/functions/gemini-handler/cefrHandler_test.ts supabase/functions/gemini-handler/geminiUtils_test.ts
npm run supabase-contracts:target:generate
npm run supabase-contracts:target:check
```

- Queue/fake-provider PostgreSQL: **18 PASS**. Actual sessions overlap on observed
  PostgreSQL locks for capacity, reviewer and expiry cases; no timing-only race
  claims. Includes unknown supersession, retirement/revocation, attempts, stale
  qualification, concurrent duplicates and missing required profile fields.
- Existing content protocol/cache: **17 PASS**. Earlier combined log includes the
  initial 16 queue tests (33 total); the final 18-test queue run supersedes those.
- Existing dictionary schema: **19 PASS**, one upgrade case could not create its
  nested cluster because macOS had 31 existing System V shared-memory segments.
  Repeating the suite alone reproduced that IPC limit. The same upgrade test body
  was extracted unchanged into the private report directory with absolute import
  paths and its original migration URL, without the unrelated outer fixture.
  **Isolated legacy upgrade: 1 PASS.** Original test/harness and system settings
  remain unchanged. Do not describe the original combined invocation as green.
- Offline calibration plus evaluation: **57 PASS**, with no network permission.
  Existing analysis regressions: **48 PASS**, env permission only, fake HTTP.
- Scoped ESLint, Deno lint/type checking, Prettier and `git diff --check` PASS.
  Official type generation and separate reproducibility check both PASS.
- Initial sandbox `initdb` failed before migrations (shared-memory permission);
  authorized disposable-cluster runs succeeded outside that sandbox. Initial
  evaluation-test lint rejected unnecessary `async`; fake transports now return
  values or promises and lint passes. No rule suppression.
- Read-only process audit found no remaining socket-only test server. Each harness
  and generator closed only its own temporary resources. Existing IPC segments
  belonging to other work were not removed. Retained QA devices/backend untouched.

PostgreSQL locking/SECURITY DEFINER guidance was fetched through Context7 from
PostgreSQL official docs. Local socket tests use PostgreSQL 15; generated types
use the repository's pinned image. React Native skill applies at repository level;
no mobile components or third-party network adapter changed.

## Remaining checkpoint

D11 stays `in_progress`; D11.3–D11.5 are partial until invocation integration and
final review. No HTTP worker entrypoint, server credential validation, run ledger,
atomic daily request/token/cost reservation, accounting reconciliation, configured
cadence, real provider adapter or schedule is supplied by this checkpoint.
A lease is not spending authorization. The pure evaluator is not a deployable
worker; its future caller must reserve budget before any provider work and settle
only through the fenced RPC.

Next on Sol / High: D11.6–D11.7 local server invocation/auth, run/budget ledger,
atomic conservative reservations and fake-provider cap/crash/unknown-usage tests.
Keep runtime disabled; no live provider/pricing configuration is qualified. Then
Astra / High review of concurrency, provenance and budget boundaries. Real reviewed
meaning-level quality/source evidence and a separately approved small live sample
remain required. No hosted migration, paid call, activation, publication, deployment,
push/PR/merge or retained data change occurred.

## Persistence receipt

Implementation/evidence commit `aded98f` passed ordinary pre-commit hooks: mobile
156 suites /1796 tests /22 snapshots; web 86 suites /780 tests with one preexisting
skipped suite/test. The advisory file-length check reported the comprehensive SQL
test file; no lint rule was suppressed. Post-hook inventory 177/177 exact. Local
documentation receipt follows; no push or external operation.
