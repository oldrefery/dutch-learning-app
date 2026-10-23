# D13A.5 fresh-owner creation client

**2026-10-11 local — Fresh-owner creation client complete locally; D13A.5 in_progress.**

Exact hashes/results: [JSON](D13A-creation-client-20261011.json).
Logs/manifests: reports/shared-dictionary-cefr/d13a5-creation-client-20261011/.

Shared workflow restores owner-bound original request before resolution/command work.
Resolution request is uncharged/idempotent; pending/lost reply uses the same resolution
status, preserving exact private hint/query. Only a resolved new meaning prepares an
ordinary3-key or explicit reviewed recovery4-key command. Empty recovery ID fails
closed, never downgrades. Atomic durable submission claim precedes Edge invoke; every
restored submitted command uses operation status, never another endpoint call or nonce.
Missing/malformed/foreign/regressed replies cannot reset intent or replace durable proof.
Publication returns its reference; no personal card/SRS/adoption/hydration/batch write.

Dormant mobile/web SDK factories add no request on construction and expose explicit
list/readSaved/isAvailable/resolve/recoverResolution/prepareCommand/submit/recover.
Live Auth getUser checks and synchronous listener latch A-to-B-to-A; caller context
asserts surround awaits and optional mounted AbortSignal cancels SDK HTTP. The collected
bearer is separately verified through getUser(token). Each action releases listener
and signal subscriptions. Stored owner/session tags are not permission; no token,
Auth role/profile/provider content or AbortSignal enters journal/wire command.
Existing following+shared-analysis capability/protocol2 and actor permission are checked
before new work and again after claim; creation-specific SQL gates remain authoritative
and unadvertised by this existing capability. isAvailable is preflight, not a creation
approval. Fresh owner status reads bypass new-work flag/actor preflight. SDK typed RPC
projection adds only existing capability/actor names; generated contracts/SQL unchanged.

Installed SDK awaits token acquisition even with explicit Authorization, so invoke
receives a captured AbortSignal. Abort cannot undo an already committed call: retained
submitted state still requires status, not retry. Forms must supply both mounted guard
and lifecycle AbortSignal; they are not wired yet. Native generic Supabase fetch had
retry statuses503/504/520/546 except shared analysis. Creation now also bypasses retry;
actual FunctionsClient with fake fetch proves one request and exact signal/body. Existing
Auth10s timeout, analysis no-retry and ordinary data retries remain covered unchanged.

Fresh native190 suites/2490 tests/22 snapshots with configured coverage, web114/1150
including Node performance harness, focused native130/web105 and Edge108 PASS. Domain/
contracts/mobile production+test/web types, scoped zero-warning lint/format/diff PASS.
Final task/runtime source boundaries180 native/127 web/74 Edge exact. File-backed SQLite,
synthetic browser Storage/locks/Auth/RPC/invoke and real FunctionsClient with fake fetch
are local evidence; no real device/browser/Auth/provider/profile/performance acceptance.

Initial native97 and repaired web99 passed before expanded abort/status cases. Generator
NameError prevented first web test file creation; first web diagnostic72 tests passed
but missing suite failed. Second web98/99 failed because connection error was synchronous;
shared SDK runner made async, then99 PASS. Native Json-interface type error corrected
with explicit object serialization. Import order/duplicate literals fixed; no suppression.
Final focused130/105 and full suites run final bytes. Prior full PG547/worker35 carried
only: client/barrel paths remain outside static relative dependency closures, all actual
SQL/migration/fixture/imported runtime exact. Generated target contracts unchanged;
previous target check carried, contract typecheck fresh. No Docker operation this checkpoint.

1138 baseline references verified;12 source paths (9 additions/3 extensions),334 source
union;37 historical mirrors/47 sealed artifacts unchanged. Local/uncommitted branch
feature/shared-dictionary-schema HEADf97a733; dirty paths in report git-status.txt.
All runners exited. No provider/paid/hosted/Git/publication/release/EAS/device/automation.
New gates OFF, policies/roles unseeded, shared_analysis FALSE/CEFR OFF; AUTH27–29 consumed.

Next **D13A.5 — GPT-6.1 Sol / High recommended**: explicit no-match meaning-hint/forms
using this client, journal restore before fresh nonce, mounted guard/AbortSignal, pending
resolution and read-only submitted recovery UI. Then separate authoritative published-
reference adoption/import receipt and cache hydration; publication is not a personal
card or batch completion. Preserve query/hint/nonces on context changes and ambiguous
results; never expose an unknown retry/new-attempt shortcut. Reviewed recovery remains
explicit server approval; no admin-review authority or recovery from unknown is added.
Broader mode/private/history/account-return/review/performance and D13A.7/8 remain open.

Remaining numbered checkpoints: **10**, including current D13A.5; not sessions.
D13.6 observation; D13A.5 implementation, .6 old-card migration, .7 acceptance review,
.8 approved release, .9 observation; D14.1 retirement return gate, .2 content cleanup,
.3 compatibility cleanup, .4 final regression/review. D13 open/D14 pending. Always
announce next model/effort; no picker switch claimed. No live/paid/Git scope inherited.
