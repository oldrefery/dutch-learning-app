# D13A.5 — Mobile v2 sync adapter checkpoint

Date: 2026-10-10. Model: GPT-6.1 Sol / High, owner-confirmed.
Status: complete locally; D13A.5 remains in_progress.
Branch: feature/shared-dictionary-schema. HEAD: f97a733407a4d2b37e8f9ca030ad9574de85a794.
Persistence: local-only/uncommitted. Preserve the entire dirty task bundle.

## Result and boundary

Prepared dictionaryFollowingSync with explicit capability2, effective-content2 and
change-page2 reads backed by the actual schema17 repository. It requires both exact
build-time flags; EXPO_PUBLIC_DICTIONARY_FOLLOWING_ENABLED is new and defaults OFF.
No environment/deployment configuration enables it. The application facade, screen
materialization, status service and private-action paths are not wired to this adapter
yet. They must be integrated together in the next checkpoint before runtime serving.
This checkpoint completes the network-to-storage boundary, not all client integration.

A requested refresh persists owner-scoped debt before even its capability probe.
Effective batches contain at most1000 requested cards; a complete group contains at
most10000 unique cards. Every batch validates exact requested coverage/dependencies;
aggregate validation rejects inconsistent heads/CEFR across chunks. If newly returned
following references discover cached/v1 siblings, the adapter refetches the whole group
instead of combining different passes. At most3 expanding passes are attempted. An
unstable/oversized group fails without publishing a partial cache or advancing cursors.

Change pages request200 events and verify the exact requested decimal cursor. Each
page's dependencies, heads, cards, debt completion and cursor commit atomically. Empty
local-reference pages can commit their cursor without any effective-card request.
An ongoing stream is bounded to50 pages per run; reaching that limit throws a retry
error after preserving successful page commits. A failed later page resumes from the
last successful cursor. Plain pulls never advance the publication delivery cursor.
Rollback chooses the new event sequence even when its immutable revision is older.

The existing import-owner helper now exposes a common captured-owner guard, preserving
the old wrapper/API/error context. The listener is synchronous, latches sign-out or
any foreign/null owner, and unsubscribes in finally. Same-owner token refresh/repeated
SIGNED_IN is allowed. getUser checks also catch identity changes without notifications.
Auth checks never await inside SQLite transactions or Auth callbacks. The repository's
prepareHydration accepts a synchronous guard and checks before writes and before its
transaction completes; commit already applies the same guard. The v2 service supplies
it to both transactions and checks the opt-in at response/commit boundaries.

Offline errors, invalid batches, unknown capability, stale response generations and
account A-to-B-to-A retain the last valid cache and retryable debt. No v1 fallback,
legacy command acknowledgement, automatic mode restoration, private reanalysis or
learning mutation is introduced. Pending private commands and follow-to-legacy reads
require reconciliation. The old facade/push/receipt implementation is unchanged.

## Validation

Exact hashes/commands/results: [evidence packet](D13A-mobile-sync-20261010.json).
Logs: reports/shared-dictionary-cefr/d13a5-mobile-sync-20261010/.
Node24.20.0 / npm11.19.0; installed Supabase JS2.98.0, Expo57.0.26/SQLite57.0.3.

- Focused real-SQLite sync/repository/import recovery: 3 suites /70 tests PASS,
  including39 new sync cases.
- Full mobile CI: 164 suites /1972 tests /22 snapshots PASS with configured coverage;
  zero skipped. New sync adapter lines100%, branches97.87%; owner helper100%.
- Production and test TypeScript checks PASS.
- Root lint with maximum0 warnings PASS.
- Source/report format and git diff checks PASS.
- Initial162 hashed paths /111 source union matched. All110 nonextended source hashes
  and37 rehearsal mirrors remain unchanged. The one intentional source extension is
  dictionaryFollowingRepository.prepareHydration's captured-owner guard. Four other
  source/test files are new to this evidence chain; source union now115.
- Initial33 test failures were a missing getUser in the existing network mock; no
  database was created. A second run had2 incorrect expected error strings. Fixture
  setup and assertions were repaired; protected guards remained intact. Initial test
  types failed on a canonical-content object assigned to a raw legacy-read projection;
  the fixture now supplies explicit JSON-compatible null/array fields. Three duplicate
  fixture-literal lint warnings were repaired with constants. Final format check initially
  found the last added test blocks; formatting was applied. The evidence writer stopped
  at that failed style check before creating JSON; repaired checks now pass. Failed logs
  are retained.

Network responses are synthetic. Tests execute actual repository SQL in disposable
file-backed Node SQLite, replacing only the native bridge. They cover restart/offline,
page failure/retry, exact BIGINT cursors,1001-card two-request batching, group expansion,
owner change during preparation/final transaction, late response fences and protected
v1 queues/originals/learning. They do not prove native connection locking, per-connection
foreign-key setup, browser/device latency or real-provider semantic quality. No following
review performance or end-to-end runtime acceptance is claimed.

Current Context7 Supabase docs were fetched for auth callbacks and RPCs. The installed
auth-js implementation also warns against async callbacks under its lock; the guard
uses a synchronous callback and performs getUser outside it. Sources:

- https://github.com/supabase/supabase/blob/master/apps/docs/content/troubleshooting/why-is-my-supabase-api-call-not-returning-PGzXw0.mdx
- https://github.com/supabase/supabase/blob/master/apps/docs/scripts/__snapshots__/build-reference-content.v2.json
- https://github.com/supabase/supabase/blob/master/apps/www/_blog/2025-05-17-simplify-backend-with-data-api.mdx
- Installed node_modules/@supabase/auth-js/src/GoTrueClient.ts (onAuthStateChange).

## Preserved state and next checkpoint

All runners exited; disposable SQLite directories were removed; no external operation
is pending. Web92/820, Edge76 and PG90 are carried evidence, not rerun in this checkpoint.
Sealed artifacts, SQL mirrors, existing task/QA/backups/services and .playwright-cli
remain intact. No provider/paid/Supabase hosted HTTP, real card conversion, hosted apply/
grant/link/publication, Git commit/push/PR/merge, release/EAS/device or automation operation.
New flags OFF; real policies/roles unseeded, shared_analysis unavailable, CEFR OFF.
D13 existing-release observation remains open; D14 pending; AUTH27–29 consumed.

Next D13A.5, recommended GPT-6.1 Sol / High: integrate this adapter with
DictionaryContentSync/syncManager as one coordinated runtime checkpoint. Route typed
read materialization/revision/CEFR metadata and status debt to the v2 cache; preserve
legacy push/verified receipts/pending private originals; prevent following words from
private provider/mutation paths before wiring. Verify immutable active/preparing native
review questions, offline account return and independent learning delivery. Keep mode
restoration an explicit approved reconciliation, not a silent downgrade. Read current
materialization/word actions/wordRepository/transfer, status/syncManager and review
consumers; fetch current SDK docs for APIs touched. High is recommended for the coupled
Auth/queue/cursor/action/session invariants. Shared-only Analyze again/receipt recovery,
web offline recovery and following review-start performance remain later D5 work;
D7 real-model/device/acceptance/qualification and D8 enablement/release stay separate.
