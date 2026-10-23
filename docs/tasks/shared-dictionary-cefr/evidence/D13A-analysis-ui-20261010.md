# D13A.5 shared action / status UI — 2026-10-10

Checkpoint complete locally; D13A.5 remains **in_progress**. GPT-6.1 Sol / High,
owner-confirmed. Branch `feature/shared-dictionary-schema`, HEAD
`f97a733407a4d2b37e8f9ca030ad9574de85a794`. Same dirty checkout; local-only and
uncommitted. New gates remain OFF and server shared_analysis capability remains FALSE.

## Implemented boundary

- Mobile following word details and the web following-word page now display shared
  analysis actions through the validated SDK/journal adapters. They explain that
  approved updates apply to everyone following the meaning. Existing personal
  image/reanalysis actions remain unavailable for following cards.
- A common controller loads local owner-scoped metadata. It probes eligibility only
  for a fresh/unsubmitted operation. Mounting does not submit a command or recover a
  receipt. UUID generation and submission require an explicit press. A synchronous
  busy latch rejects repeated presses before the next render.
- Saved submitted operations expose only an explicit read-only status check, including
  after analysis flag or permission withdrawal. Unsubmitted intents retain their
  original nonce. Terminal, busy and uncertain outcomes never become fresh attempts
  automatically. All ten server statuses have friendly messages; raw provider errors,
  tokens, hashes and operation identifiers are not displayed.
- UI cleanup ignores late replies. Auth callbacks latch sign-out/foreign-owner changes
  synchronously and unsubscribe. A-to-B-to-A remains blocked until the card is reopened,
  including when a new shared head or personal props recreate the controller. The
  original SDK/server owner and authorization checks remain authoritative.
- A receipt saved before network/publication/display failure is reread locally and
  retained. Cache/display errors offer status checking, without a second POST. A failure
  before durable intent storage requires reopening rather than creating another nonce
  through the same failed UI action.
- Mobile applies validated cached shared content to current live store rows and shared
  siblings. It checks owner/lifetime before and after the asynchronous read and during
  the synchronous store update. Current review/progress edits are preserved; foreign
  rows, changed entries and non-following modes are never replaced. Older head sequences
  are skipped; equal sequence with a different revision is rejected. No personal word,
  learning, content-command or SRS database writes occur in this display helper.
- Web parses the complete returned batch and verifies publication, word/entry/following
  mode, head and revision before applying shared content. Only the publication snapshot
  is retained; visible detail is projected from current personal props. Newer rollback
  heads remain visible. Router refresh follows a validated publication snapshot and
  updates the current route's server rendering. This is not persisted cross-page web
  cache invalidation or complete account-return/offline recovery.

The existing single-operation journal remains conservative. A terminal operation still
occupies its slot and only exposes status checking. Fresh-attempt/archive/history and
quarantine-resolution APIs are deliberately the next bounded checkpoint. No automatic
paid retry, silent clearing or server-worker resumption is introduced.

## Verification

- Full mobile: **171 suites /2111 tests /22 snapshots**, configured coverage; zero
  skipped/todo. Added41 cases:23 common action/lifecycle cases,12 light/dark panel cases
  and6 file-backed SQLite/display cases. Full coverage: statements73.45%, branches60.38%,
  functions73.68%, lines74.60%. The final full rerun includes the persistent UI Auth latch.
- Full web: **96 suites /865 tests**, zero skipped/todo. Added14 cases:7 DOM UI and7
  snapshot projection cases. Opt-in performance harness included with CLI test timeout
  30000ms; benchmark/assertions unchanged. Node preparation durations were180.473–200.064ms
  for2500 cards and371.128–384.443ms for5000; all runs report long tasks. Native/browser
  performance qualification remains open.
- Focused initial mobile4/57 and web3/30 passed; the separate actual file-backed display
  suite1/6 passed. All are covered again by final full suites. Final mobile production/
  test, web route/test-inclusive, domain/contracts types pass. Root/web/affected-domain
  lint pass with zero warnings; scoped Prettier and `git diff --check` pass. Exact commands
  and log hashes are recorded in the JSON packet.
- Initial web test typing exposed a widened protocol_version fixture. The display
  boundary now accepts unknown input and performs strict parsing; the UI fixture also
  validates its batch without casts. Initial web lint found an unused promise-resolver
  argument; a typed no-op initializer replaced it without suppression. Initial failed
  logs are retained. The additional Auth latch regression rerenders the same open card
  after A-to-B-to-A and verifies that eligibility is not reprobed.
- Entry274 exact paths /169 prior source hashes matched.165 prior sources are preserved;
  four declared extensions and11 additional paths produce a180-path source union. The15
  source/test files are listed in JSON. All37 historic test mirrors and47 sealed artifacts
  remain unchanged. Protected baseline paths were rechecked after source work.
- Edge76 and selected PostgreSQL95 are carried evidence only. Backend, migrations,
  generated contracts and their tests are unchanged in this checkpoint. No database
  target generation or PostgreSQL regression was rerun for this UI-only change.

Tests use synthetic SDK/Auth/network and DOM/native-renderer boundaries. SQLite display
tests use the real file-backed schema/cache with a replaced native bridge. This is not
real browser storage retention/Web Locks, native device, provider/semantic quality or
release acceptance. All runners exited; no task server/database/external operation remains.

## Resume boundary

Next **D13A.5 — recommended GPT-6.1 Sol / High**: design and implement explicit
fresh-attempt/archive/history/quarantine reconciliation on mobile and web. Preserve
unresolved submitted IDs; distinguish authoritative finished receipts from uncertain
provider outcomes and lost replies. Archive and claim a new nonce atomically under the
owner/word lock only when the state permits an explicit new attempt. Never silently
clear, replay a POST or infer completion from elapsed time. Verify restart/offline,
cross-tab contention, Auth A-to-B-to-A, flag/permission withdrawal, terminal history and
unchanged personal/SRS data. Read analysis-client/journal/owner/operation contracts first.
High is recommended for coupled durable nonce, owner lifetime, storage and paid-outcome
invariants; no model-picker switch is claimed.

Following new-word/import/transfer2 adoption, preserved private/mode reconciliation,
broader web offline/account-return recovery, review performance/parity and D7/8 real-model/
device/review/release acceptance remain. D13 observation is open; D14 pending. Preserve
the entire dirty bundle, reports, QA/backups/services/.playwright-cli and sealed releases.
No reset/clean/switch/rebase/commit/push/PR occurred. No provider/paid/hosted/real-card
conversion/Git publication/EAS/release/device/automation operation was started. AUTH27–29
remain consumed; new opt-ins OFF, roles/policies unseeded, CEFR OFF.
