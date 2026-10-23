# D13A.5 actor / SDK / publication adapters — 2026-10-10

Checkpoint complete locally; D13A.5 remains **in_progress**. GPT-6.1 Sol / High,
owner-confirmed. Branch `feature/shared-dictionary-schema`, HEAD
`f97a733407a4d2b37e8f9ca030ad9574de85a794`, same dirty checkout. Local-only and
uncommitted. This checkpoint binds production SDK APIs behind default-OFF gates;
no shared action/status UI has been connected.

## Implemented boundary

- Additive `dictionary_analysis_actor_v1()` is an authenticated, self-only, STABLE
  security-definer read with an empty search path. It uses the existing private
  full_access / trusted administrator predicate. It rejects missing/deleted identities
  and exposes no membership list or client-selected actor. PUBLIC, anon and service_role
  cannot invoke it. It does not enable readiness, seed roles/policies, create operations
  or consume quota. Server dispatch/publication authority checks remain authoritative.
- Target-schema manifest advances to the additive migration; database target types are
  generated with the existing pinned disposable PostgreSQL/Postgres Meta workflow.
  A typed projection includes only the required target RPCs alongside deployed tables.
  No generated artifact was edited manually and no dependency version changed.
- Common synchronous Auth change latch captures each action's owner for its whole
  lifetime, including A-to-B-to-A and sign-out. Server getUser checks surround network
  boundaries; callbacks perform no asynchronous SDK calls and subscriptions always
  unsubscribe. Mobile's existing import owner helper delegates to the same guard.
- Availability requires exact public opt-in, following readiness, protocol2 command
  support and the trusted actor signal. The authority/readiness check repeats after
  the durable journal claim, immediately before obtaining the captured owner's JWT
  and invoking the endpoint. Read-only receipt recovery bypasses analysis permission
  and flag checks while retaining owner validation. Tokens remain outside journals.
- Mobile SDK binding uses the real Supabase RPC/auth/functions interfaces and existing
  file-backed operation journal. The global native transport now bypasses automatic
  503/504/520/546 retries for the exact dictionary-analysis URL, including regional
  query parameters; lost network replies also do not retry. Other requests retain their
  prior transport behavior. Actual FunctionsClient serialization is tested with a
  synthetic fetch, separate from paid server/provider execution.
- Exact shared-head preflight and publication validation use canonical decimal strings.
  Publication hydration requires the same word/entry in following mode and a head at
  least as recent as the receipt. Equal sequence must match the published revision;
  a later valid rollback is accepted without restoring an older receipt's revision.
- Mobile refresh persists debt before a following-flag failure, expands complete local
  shared siblings, validates publication before atomically committing cache/debt, and
  preserves pending private commands, personal words, learning queues and SRS. It uses
  the original outer owner guard. Stale/wrong-entry reads leave the last good cache
  and debt intact. No private detachment or personal linguistic override is introduced.
- Web factory binds the actual browser SDK, existing required Web Locks/localStorage
  journal, strict exact-head preflight and publication reads. It returns a validated
  shared-only snapshot in memory after saving the receipt. The server following gate
  is supplied independently of the public opt-in. Applying the snapshot to visible
  UI/cache and cross-page invalidation are explicitly subsequent work.

No new-attempt, clear/archive, operation-list import or quarantine resolution API is
implemented here. Submitted operations remain conservatively reserved; recovery never
redispatches or resumes a stopped server worker. There is no periodic recovery or UI
mount request. Shared-only Analyze again / read-only status UI remains next work.

## Verification

- Full mobile:168 suites /2070 tests /22 snapshots, configured coverage, zero skipped/todo.
  Added25 cases:19 file-backed SDK/cache cases and6 transport cases. They cover exact
  body/nonce, permission revocation before dispatch, default OFF, denied/malformed/
  foreign actors, lost reply/restart, receipt/debt persistence, disabled following,
  stale/wrong-entry content, no-change, later rollback, pending private commands and
  Auth A-to-B-to-A during permission/token/reply/publication hydration.
- Focused mobile before the final no-change/network additions:4 suites /105 tests.
  Full final run includes both additions. Focused final web:2 suites /31 tests.
  Full web:94 suites /851 tests with PERFORMANCE_HARNESS=1 and --testTimeout=30000; zero skipped/todo. New web adapter contributes16 cases. Required locks, exact head,
  denied/foreign actor, default OFF, lost-reply recovery after flag/permission withdrawal,
  stale/no-change/later rollback and owner changes are exercised with synthetic SDK
  edges and browser scheduling. Benchmark output is Node CPU context, not native or
  browser latency acceptance; long tasks keep review performance qualification open.
- PostgreSQL:95/95 tests, zero failed/cancelled/skipped/todo, seven selected regression modules through the new migration. New actor suite6/6 also passed independently. Existing endpoint, operation,
  publication, provider-worker, semantic and following-read tests run through the new
  migration with actual SQL and synthetic provider transport. Target generate/check
  pass using disposable fixtures; only task-owned resources are removed.
- Mobile production/test types, web route/test-inclusive types, domain and contracts
  types pass. Root/web/affected-domain lint pass with zero warnings, scoped Prettier
  and `git diff --check` pass. Exact commands/log hashes are in the JSON packet.
- Initial native PostgreSQL initdb failed before any actor assertion because macOS
  exhausted its SysV shared-memory limit. No system limits or unrelated clusters were
  changed. A task-owned Docker fixture used a read-only root, isolated network=none,
  tmpfs data, no host mounts/ports/hosted credentials, with original test scripts and
  cleanup. Initial mobile duplicate semantic-key/invalid private-command fixtures,
  SDK export mock mismatch and two nonexistent test paths were repaired. An attempted
  web typecheck:test script does not exist; the normal web typecheck includes tests.
  Two repeated literals were named constants without suppression. Manifest-only format
  drift was fixed. The initial full web benchmark exceeded the default5000ms timeout; the complete
  suite passed with the CLI test timeout30000ms, without changing the benchmark,
  assertions or measured durations. Its initial metrics/log remain preserved. Initial
  logs are preserved and final required checks pass.

Entry baseline246 paths /157 prior source hashes matched.149 prior sources remain
unchanged;8 declared extensions and12 additional source/test paths form a169-path
source union. The20 changed/additional files are listed exactly in JSON. All37 historic
rehearsal mirrors and47 sealed artifacts remain unchanged. Older Edge76 tests and
unselected PostgreSQL modules are carried only; their source inputs remain preserved.
No full database suite, native bridge locks/FK behavior, real browser storage retention,
real Auth network or provider/model/semantic quality acceptance is claimed.

All runners exited and disposable fixture cleanup completed; no task server, database
or external operation remains. The source, notes/evidence and reports are local-only.
Preserve the entire dirty bundle, QA/backups/services/.playwright-cli and sealed releases.
No reset/clean/switch/rebase or source publication occurred.

## Resume boundary

Next D13A.5: shared-only Analyze again and read-only recovery/status UI on mobile/web;
apply validated web snapshots and invalidate the displayed shared cache. Add explicit
fresh-attempt/history/quarantine reconciliation without replacing unresolved submitted
IDs or automatically repeating paid calls. Check repeated presses, page/account return,
flag/permission withdrawal, offline/restart, pending private content and unchanged SRS.
Keep availability OFF until separate qualification/enablement acceptance.

Recommended **GPT-6.1 Sol / High** because UI/Auth lifetimes, durable nonces, paid-call
uncertainty and cache publication must remain consistent across both clients. Following
new-word/import/transfer2 adoption, preserved private/mode reconciliation, broader web
recovery and review performance/parity remain. D7/8 model/device/release acceptance is
separate. D13 observation remains open, D14 pending, AUTH27–29 consumed.

New flags remain OFF, administrator/policy seeds absent, shared_analysis capability
unavailable, CEFR OFF. No provider/paid calls, hosted migration/grant/link/publication,
real card conversion, Git commit/push/PR/merge, EAS/release/device or automation action
was authorized, started or left pending.

Documentation: Context7 resolved Supabase before SDK/Auth design and retrieved
[advanced Auth guidance](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/auth/server-side/advanced-guide.mdx),
[callback API troubleshooting](https://github.com/supabase/supabase/blob/master/apps/docs/content/troubleshooting/why-is-my-supabase-api-call-not-returning-PGzXw0.mdx)
and [SDK reference](https://github.com/supabase/supabase/blob/master/apps/docs/scripts/__snapshots__/build-reference-content.v2.json).
Installed Next.js client/server component documentation was read under root node_modules
as required by apps/web/AGENTS.md. Actual installed FunctionsClient source was inspected
for serialization and retry ownership. No dependency or package-lock changes.

[Jest29.7 timeout option](https://github.com/jestjs/jest/blob/v29.7.0/docs/CLI.md)
was fetched through Context7 before adjusting the invocation timeout.
