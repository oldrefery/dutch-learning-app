# D13A.5 shared analysis client journal foundation — 2026-10-10

Checkpoint complete locally; D13A.5 remains **in_progress**. GPT-6.1 Sol / High,
owner-confirmed. Branch `feature/shared-dictionary-schema`, HEAD
`f97a733407a4d2b37e8f9ca030ad9574de85a794`, same dirty checkout. Local-only,
uncommitted. No UI or production SDK adapter is connected by this checkpoint.

## Implemented boundary

- Shared exact-shape metadata and command/receipt matching. Owner, word, operation,
  entry, expected revision/head and server fence remain bound. Decimal BIGINT strings
  never pass through Number. Published/no-change boundaries are checked; terminal
  receipts and durable result hashes cannot change. Unknown outcome may quarantine
  generation or semantic validation, with explicit server recovery retaining the result.
- A common controller durably prepares and claims the operation before one endpoint
  invocation. A new explicit submit may claim an unsubmitted saved intent, retaining
  its original ID and rechecking the shared head. Any submitted intent, including a
  missing/failed/uncertain reply, can only recover by reading its existing receipt.
  Recovery rejects busy acceptance objects: the actor receipt RPC must return a
  receipt or null. It never invokes the analysis endpoint or automatically creates
  another operation. Receipts persist before a separate cache-refresh callback.
- Dormant SDK-compatible transport ports name `dictionary-analysis`, send only the
  exact command with the captured owner's session JWT, and read
  `get_dictionary_analysis_operation_v2(p_operation)`. Submission requires explicit
  availability plus protocol2 capability, following/shared-analysis readiness and
  command2 support. Receipt reads bypass feature/permission availability while still
  checking the captured owner. Tokens, roles, content and provider keys are not journaled.
- Mobile schema18 adds an owner/word journal with a unique owner/operation ID and no
  word foreign key. Metadata survives word deletion. Exclusive transaction queries
  use the transaction connection; synchronous owner fences surround writes. Claims
  repeat live owner/word/follow/reference/head checks. JSON identity must also match
  the indexed operation ID and exactly one row must be updated. No private word,
  SRS, content command, learning command, existing cache or recovery queue is rewritten.
- Browser journal keeps a single owner-scoped metadata document under an exclusive
  owner-scoped Web Lock. Different tab instances share the lock; localStorage writes
  precede dispatch. No unlocked fallback, silent eviction or operation replacement.
  Corruption, duplicate IDs, owner mismatch, missing locks and storage errors stop
  submission. Bounds:100 retained operations and256000 serialized ASCII characters
  per owner. The browser factory binds real API names; tests simulate their execution.

No new attempt/clear/archive API, cross-device operation-list import, periodic recovery,
UI buttons, trusted actor eligibility signal or platform SDK/cache wiring is implemented
here. Submitted IDs remain conservatively reserved, including terminal/busy/pre-dispatch
failures; an unsubmitted intent is the only resumable submission. A read-only receipt
cannot itself resume a stopped server worker. Explicit history/reconciliation must be
designed before enabling repeated analysis or resolving quarantined outcomes. The cache
callback is injected and synthetic here; actual publication hydration remains next work.

## Verification

- Full mobile:167 suites/2045 tests/22 snapshots, configured coverage, zero skipped/todo.
  Source was final; two repeated test literals were subsequently named constants and
  the final affected tests/types/lint were rerun. Focused mobile3/59 includes real
  file-backed schema18 migration interruption/retry, restart, exact head/owner/index
  guards, lost replies, token/session mismatch, flag withdrawal, quarantine/no-change,
  receipt immutability and preserved word/SRS/learning data.
- Full web:93 suites/835 tests, zero skipped/todo. `PERFORMANCE_HARNESS=1` explicitly
  runs the existing opt-in benchmark. Focused web1/15 verifies two independent journal
  instances with serialized claims, fresh-instance recovery, storage failure before
  dispatch, no replacement, corrupt identities, owner changes, limits and Web Locks
  factory binding. Node benchmark output is CPU context, not browser/device latency
  acceptance; its reported long tasks leave review performance qualification open.
- Mobile production/test types, domain types, web route/type generation, root lint,
  web lint and affected domain lint pass with zero warnings. Scoped Prettier and
  `git diff --check` pass. Check commands, hashes and durable logs are in the JSON packet.
- Thirty mobile and15 web cases added versus the previous checkpoint. Mobile journal
  coverage:94.54% lines/89.47% branches/100% functions. Native bridge only is replaced
  with file-backed Node SQLite; browser locks/storage scheduling are synthetic. Native
  connection locks/FK setup, browser storage eviction, real SDK/browser/device behavior,
  server/provider integration and semantic quality are not proven by these tests.
- Initial relative web test path found no tests; the absolute path passed. Initial
  mock signature/Web Locks promise type errors were repaired. Two duplicated test
  literal warnings were repaired without lint suppression. One wrapper invocation
  did not forward the web lint warning limit; the direct workspace command passed
  with `--max-warnings=0`. All initial logs are retained.

Baseline231 exact paths/149 prior source hashes matched at entry.144 prior source
hashes remain unchanged, five declared migration/export/test extensions and eight new
files form a157-path source union. All37 rehearsal mirrors and47 sealed artifacts
remain unchanged. The thirteen changed/new source/test files and current notes/evidence
are local-only. No package/lock, backend migration, deployment configuration or flags
changed. Edge76/PG90 are carried only; their implementation inputs remain unchanged.
All runners exited; no task database, server or external operation remains.

## Resume boundary

Next D13A.5: connect mobile/web SDK adapters and captured Auth owner lifetimes; obtain
server-derived full_access/admin eligibility while keeping availability default OFF;
add shared-only Analyze again and read-only recovery/status UI, explicit new-attempt/
history/quarantine reconciliation and publication hydration through the existing shared
cache. Validate flag/permission withdrawal, account A-to-B-to-A, offline/restart,
repeated presses and unchanged private/SRS/learning state. Do not infer private admin
membership from client access level or enable a qualified:false provider profile.

Recommended **GPT-6.1 Sol / High** for coupled Auth, server authorization, nonce/paid
retry, receipt progress and cache invariants. Following new-word/import/transfer2 and
explicit preserved private-payload/mode reconciliation, broader web recovery and
following review performance/parity remain. D7/8 real-model, device, enablement and
release acceptance remain separate. D13 observation open, D14pending, AUTH27–29 consumed.

New flags stay OFF, roles/policies unseeded, shared_analysis unavailable, CEFR OFF.
No provider/paid, hosted migration/grant/link/publication, real card conversion, Git
commit/push/PR/merge, EAS/release/device or automation action was authorized or started.
Preserve all dirty files/reports/QA/backups/services/.playwright-cli and sealed releases;
no reset, clean, branch switch or rebase.

Documentation consulted: [Supabase auth/invocation](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/functions/auth.mdx),
[function errors](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/functions/development-tips.mdx),
[Expo SQLite transaction API](https://github.com/expo/expo/blob/main/packages/expo-sqlite/src/SQLiteDatabase.ts),
[Next.js server action authorization](https://github.com/vercel/next.js/blob/canary/docs/01-app/02-guides/data-security.mdx),
[Web Locks specification](https://www.w3.org/TR/web-locks/).
Context7 resolved current library documentation before SDK/transaction design; Web Locks
standard consulted for cross-tab exclusive scheduling. No dependency versions changed.
