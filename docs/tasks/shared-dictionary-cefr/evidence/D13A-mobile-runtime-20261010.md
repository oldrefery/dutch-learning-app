# D13A.5 — Coordinated mobile following runtime checkpoint

Status: complete locally; D13A.5 remains in_progress. Model: GPT-6.1 Sol / High,
owner-confirmed. Local-only/uncommitted on feature/shared-dictionary-schema,
HEAD f97a733407a4d2b37e8f9ca030ad9574de85a794. No external operation authorized,
started or pending. New flags remain OFF; shared_analysis unavailable, CEFR OFF,
roles/policies unseeded. D13 observation open; D14 pending; AUTH-27/28/29 consumed.

## Result

The existing mobile facade now selects capability2/effective2/change2 only under
both explicit build opt-ins, requires a captured owner and never downgrades v2
reads to v1. Full-vocabulary pulls use owned live words. When hydration expands
an entry to its cached siblings, the facade reports coverage of the original
request while the adapter commits the complete group. Both protocol paths retain
their exact receipt checks and the original legacy projection/command APIs.

Verified v1 command receipts can now acknowledge their exact local intent in the
same SQLite transaction as a complete v2 cache result. Exact decimal result
versions must cover every acknowledged command. Changed payloads, conflict rows,
missing/insufficient results, remaining private commands or account changes roll
back command deletion and cache writes together. Lost read replies retain the
same operation ID/payload and generation debt for idempotent retry after restart.
Unverified intents remain preserved for explicit reconciliation; hydration alone
never acknowledges them. V1 originals and personal learning/collection rows are
not overwritten by this process.

Old dictionary_card_refresh_queue requests are bridged into durable, generation-
fenced v2 debt during preparation, before network work. The same transaction
removes only the old requests being transferred. A newer old request arriving
after preparation remains visible for another pass; failure/restart retains v2
debt, and owner loss rolls back the transfer. Status unions the appropriate missing
cache and old/new debt with commands/import/recovery/placement obligations without
counting a missing v1 projection as false debt for a hydrated v2 word.

Owner-scoped display materialization reads the common revision and exact decimal
revision/head/watermark metadata, including CEFR status/level/confidence. It keeps
word identity, collection and SRS fields. Cached following content never receives
an unresolved private overlay and stays shared when the following opt-in is
withdrawn. V2 legacy cards with pending edits retain their v1 private projection.
Raw legacy JSON/null removals are preserved in storage; a safe display projection
filters malformed nested display fields without turning normalized output into
an import/publication authority. Export validates raw content: canonical following
content produces an existing self-contained schema1 snapshot; incompatible raw
legacy content fails rather than silently dropping fields. Protocol2 transfer and
new-word/import adoption remain separate unfinished work.

Private reanalysis checks the database before the existing provider call and
checks account identity again before dispatch. Repository reanalysis/image writes
repeat the mode/version guard inside their exclusive write transaction. Following
cards are blocked even after withdrawing the following flag; unknown/stale v2
legacy content must synchronize or reconcile before a private edit. Existing
private action buttons are hidden for materialized following words while shared
images and learning information remain visible in light/dark themes. Shared-only
Analyze again and receipt UI are not implemented by this checkpoint.

SyncManager captures the owner for capability checks. Dictionary capability or
read/command failure is retained and reported without stopping independent
learning delivery. When opted-in capability is unavailable, personal-word writes
are deferred and content/placement protections remain active; no old snapshot
write path is selected. A queued review's synthetic server acknowledgement is
verified in a regression test. An incomplete dictionary pass does not record a
successful sync timestamp.

Native review preparation copies all owned words, nested revision/CEFR metadata,
configuration, adaptive decisions and distractor translations before its first
UI yield. Changes during preparation cannot alter early or late questions; a new
session can use the newer content. Cancellation never publishes a partial queue.
The extra initial copy cost has not received native performance acceptance.

## Validation

Exact sources, logs and integrity: [evidence packet](D13A-mobile-runtime-20261010.json).
Logs: reports/shared-dictionary-cefr/d13a5-mobile-runtime-20261010/.
Node24.20.0 / npm11.19.0; installed Supabase JS2.98.0, Expo57.0.26/SQLite57.0.3.

- Full mobile CI: 166 suites /2015 tests /22 snapshots PASS, configured coverage;
  zero skipped or todo. Compared with the previous checkpoint: 2 new suites and
  43 added cases, including33 file-backed runtime cases and4 light/dark action cases.
- Final focused runtime/legacy/review checks: 10 suites /271 tests PASS.
- Production and test TypeScript checks PASS; root lint maximum0 warnings PASS.
- Scoped source/report/task formatting and git diff checks PASS.
- Initial184 hashed paths /115 prior sources matched. Seven deliberate prior-source
  extensions are listed in JSON;108 source hashes remain unchanged. Forty-one
  current source/test files are recorded; the source union is149. All37 rehearsal
  mirrors and47 sealed artifact hashes remain unchanged.
- Initial targeted failures came from old mocks/fixtures that did not account for
  the new read facade/preflight, missing strict private translation fields, the
  network mock's unavailable getMockImplementation, a private projection fixture
  without its v1 card, and a nested Text matcher. Type/lint failures came from
  incomplete/widened fixtures and duplicated literals. Fixtures/constants/matchers
  were repaired without weakening validation, suppressions or skips. Failed logs
  are retained. The first full CI passed2014 tests; one explicit queued-review
  acknowledgement regression was then added, and final full CI passed2015.

Actual repository SQL runs against disposable file-backed Node SQLite, replacing
only the native bridge. Network/provider edges are synthetic; no real provider,
Supabase hosted request, card conversion or native app database was used. Native
connection locking, per-connection foreign keys, browser/device timing, semantic
quality and end-to-end client acceptance remain unproven. Web820/Edge76/PG90 are
carried evidence only because their sources and mirrors were unchanged.

Current Context7 documentation was fetched for synchronous Supabase Auth callbacks,
RPC ownership and Expo static environment access; no package or lockfile changed:

- https://github.com/supabase/supabase/blob/master/apps/docs/content/troubleshooting/why-is-my-supabase-api-call-not-returning-PGzXw0.mdx
- https://github.com/supabase/supabase/blob/master/apps/www/_blog/2025-05-17-simplify-backend-with-data-api.mdx
- https://github.com/expo/expo/blob/main/docs/pages/guides/environment-variables.mdx

## Next checkpoint and preserved state

Next D13A.5: shared-only Analyze again and durable operation receipt/recovery on
mobile and web, using captured-owner/actor nonce, explicit authorization, terminal
receipt replay and cache refresh after validated publication. Read domain analysis
contracts, dictionary-analysis endpoint/runtime, mobile wordActions/provider and
word detail consumers, web dictionary commands/WordManagementForms and the current
owner/cache helpers. Recommend GPT-6.1 Sol / High for coupled account, permission,
receipt, paid-call retry and cache invariants. Real paid calls and enablement remain
separate authorization gates. Following new-word/import/transfer2 adoption,
explicit mode/private-payload reconciliation, web offline/account-return recovery
and representative following review performance/parity remain incomplete; D7/8
real-model/device/review/release gates remain separate.

Preserve the complete dirty task bundle, ignored reports, QA/backups/services,
.playwright-cli and sealed OTA artifacts. No reset/clean/switch/rebase/pull, Git
commit/push/PR/merge, hosted apply/grant/link/publication, real paid/provider call,
conversion, EAS/release/device or automation occurred. All runners exited; no task
SQLite database or external operation remains. After each checkpoint state exact
next work/model/effort; choices include a recommendation/reason and pros/cons.
