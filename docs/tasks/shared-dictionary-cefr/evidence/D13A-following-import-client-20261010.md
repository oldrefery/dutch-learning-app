# D13A.5 following import client journals — 2026-10-10

Checkpoint complete locally; D13A.5 remains **in_progress**. GPT-6.1 Sol / High,
owner-confirmed. Same `feature/shared-dictionary-schema`, HEAD
`f97a733407a4d2b37e8f9ca030ad9574de85a794`, local-only and uncommitted. New gates
remain OFF, shared_analysis FALSE, roles/policies unseeded and CEFR OFF.

## Implemented boundary

- Common strict protocol2 import/recovery/cancellation client and journal retain exact
  owner, original intent, personal word ID, operation nonces and bound receipts. Separate
  original intents are not synthesized from protocol1 payloads. Original import replay
  uses only its saved request/nonce; no provider call or private-copy fallback exists.
- Native additive schema20 stores ordered metadata independently of personal words, so
  word absence/deletion does not release an import ID. Exclusive transactions check the
  captured owner before writing and before commit. Indexed word/operation IDs match the
  parsed payload. Existing personal/v1 delivery/recovery IDs cannot be reused by a new
  root. Initialization and interrupted v19-to-v20 recovery leave old imports, reserved
  analysis IDs, words, SRS and learning queues unchanged.
- Browser metadata uses a separate owner key and exclusive Web Lock, one setItem per
  mutation, strict array/owner/nonce/root validation and no unlocked fallback. Concurrent
  tabs cannot replace a winning root with another nonce or changed command. Both journals
  retain at most100 operations and bound serialized metadata to256000 UTF-16 code units
  on writes; browser also bounds stored input before parsing. Capacity fails closed without
  eviction, clearing, expiration or deleting old IDs. Native list parses/index-checks its
  bounded operation count; it does not implement a separate raw-SQL input byte cap.
- A finished result is immutable apart from the idempotent replay bit. Storage failure or
  invalid/changed receipt preserves the pending intent. Finished local delivery returns its
  saved result without dispatch, including after flag withdrawal. Network errors do not
  clear roots or generate replacement nonces. These import RPCs have durable server replay
  semantics and do not use the paid analysis one-shot protocol.
- Recovery preparation reads current actor-scoped server state and verifies exact recovery
  version and collection before persisting a new explicit request. A pending recovery or
  any cancellation prevents another action. Any prepared recovery/cancel fences further
  original delivery locally; the server's existing root/CAS ledger handles late delivery.
  Read-state and cancellation remain possible without the new import flags. Recovery of
  an existing row remains possible after flag withdrawal; creating a missing row rechecks
  capability/local gates before dispatch and the server independently checks its live
  import/source/permission gates. The public capability does not expose the private import
  flag; local readiness alone never guarantees server creation permission.
- Actual native/browser Supabase adapters capture one Auth owner lifetime per online
  action and reject account A-to-B-to-A before accepting results. Local queue is a separate
  explicit API: native uses the captured application owner and Auth-change latch without
  getUser/RPC; browser uses a cached session and Auth-change latch without getUser/RPC.
  Browser getSession can still fail when an expired session cannot refresh offline. These
  are local metadata reservations only; server-authenticated delivery validates authority.
  Constructors send no requests and there is no background auto-delivery.
- Transfer2 planning returns the whole original portable document and review dispositions.
  Only exact canonical content plus matching published revision/entry/hash dependencies
  may propose a published-reference intent. Missing dependencies, unverified hints,
  changed private examples/media or unresolved entries require review; matching spelling
  never establishes identity. Dependencies must be fetched from a trusted public read by
  the future caller; this pure planner does not fetch them or confer publication authority.
- Native transfer text parsing/serialization/preview now understands schema2 and keeps
  preview IDs as document indexes. Existing private-copy import explicitly refuses schema2
  and preserves its original-document workflow. Schema1 parsing/import/export continues
  unchanged. No v2 document is silently downgraded into private copies.

This checkpoint supplies adapters and durable operation metadata, not completed import
UI or end-to-end personal hydration. Existing new-word, official-pack, shared-collection
and web document forms still use their existing paths. Transfer2 review documents and
selection-to-intent mapping are not yet stored durably; automatic queue pumping, native
personal-row pull plus complete shared dependencies, and web cache/route application of
import outcomes remain the next checkpoint. No new local personal rows/SRS are fabricated
from receipt metadata. Existing v1 queues and protected originals remain intact.

## Verification

- Full mobile **174 suites /2161 tests /22 snapshots**, configured coverage, zero skipped/
  todo. Added29 cases:13 file-backed journal/client,6 native SDK/owner/offline,8 transfer2
  planning/parser cases and2 actual initializer migration/retry cases. Coverage totals:
  statements73.62%, branches60.56%, functions73.91%, lines74.79%.
- Full web **98 suites /887 tests**, zero skipped/todo. Added14 cases:8 journal/storage/
  cross-tab/capacity cases and6 actual SDK/owner/offline adapter cases. Opt-in benchmark
  included with testTimeout30000. Node-only2500 preparation measured396.373–747.875ms,
  5000 preparation880.753–1285.275ms; all10 report long tasks. Full suites/types/lint ran
  concurrently, so these loaded-host samples are not a latency acceptance comparison.
- Final focused mobile6/64 and web2/14 pass; final full suites include the final named SQL
  constant. Mobile production/test, web test-inclusive, domain/contracts types pass;
  root/web/domain lint zero warnings, scoped formatting and git diff --check pass.
- Initial native focused run failed on a fixture without required next_review_date and an
  old exact table list. Both repaired; raw logs retained. Its coverage run was scoped to
  five suites and failed whole-project thresholds, so focused checks use coverage=false
  and the final full mobile run proves the configured thresholds. No config was weakened.
- Initial root lint duplicated an error literal; subsequent migration test repeated a SQL
  literal. Named constants fix both without suppressions. Initial domain lint used the
  root config that excludes packages; corrected to the existing web/domain config.
  An initial web lint wrapper consumed the zero-warning option as an npm option; the
  final direct workspace command passes it to ESLint. Final new web-test formatting was
  repaired; TypeScript non-trivia tokens are unchanged. Failed/preceding logs are preserved.
- Entry234 source/task/artifact paths matched;57 additional historic report/log hashes
  were verified afterward,291 baseline paths total. Prior181 sources:173 preserved,
  eight declared extensions and15 additions,196-path source union. All23 source/test files
  are listed in JSON;37 historic test mirrors and47 sealed artifacts unchanged.279 protected
  baseline paths rechecked. Previous source/receipt/analysis/provider implementations and
  all backend SQL/generated target definitions remain unchanged.
- Edge76, selected PostgreSQL95 and target generation/check are carried evidence only;
  this checkpoint changes clients/native SQLite and an additive generated-type projection.
  Tests use real file-backed SQLite with the native bridge replaced, synthetic SDK/Auth/
  network, renderer-independent planner and modeled browser locks. Real native connections,
  browser storage/session retention, live server/import rights, devices and release
  acceptance remain D13A.7/8 gates. All runners exited; no external operation pending.

## Resume boundary

Next **D13A.5 — recommended GPT-6.1 Sol / High**: integrate explicit following new-word/
import selection and transfer2 document workflow with these journals. Fetch trusted public
revision dependencies, persist the full source document and selected-index-to-intent mapping
before dispatch, expose unresolved/private differences for review and retain exact queued
nonces across restart. Connect import/recovery receipts to owner-fenced personal pull and
complete shared hydration, preserving newer personal placement/learning and avoiding row
resurrection. Connect corresponding web refresh/recovery controls; verify two owners,
offline return, flag/source withdrawal, failed hydration and unchanged legacy queues/SRS.
High is recommended for coupled document/nonce/Auth/personal-row/reference/cache recovery.

Broader private/mode reconciliation, server-history import, review performance/parity and
D7/8 dedicated/device/semantic/release acceptance remain. D13 observation open, D14 pending;
AUTH27–29 consumed. No automatic card conversion, private publication, provider/paid call,
hosted migration, commit/push/PR, EAS/release/device or automation operation was started.
Preserve the complete dirty bundle/reports/QA/backups/services/.playwright-cli.
