# D13A.5 explicit attempts / archive / history — 2026-10-10

Checkpoint complete locally; D13A.5 remains **in_progress**. GPT-6.1 Sol / High,
owner-confirmed. Same `feature/shared-dictionary-schema` dirty checkout, HEAD
`f97a733407a4d2b37e8f9ca030ad9574de85a794`; local-only and uncommitted. New gates
remain OFF, shared_analysis capability FALSE, roles/policies unseeded and CEFR OFF.

## Implemented boundary

- An explicit next attempt first reads the old operation's current actor-scoped server
  receipt. Null, busy, accepted, dispatching, validating and provider-outcome-unknown
  cannot release its local slot. A parsed finished receipt must preserve the original
  command, fence and durable result; the receipt is saved before any replacement.
- Availability and captured Auth owner are rechecked. The journal then verifies the
  exact previous snapshot, owner/word/entry, a distinct unused nonce and the current
  following head. A next command must also be at least as recent as a confirmed
  published/no-change head and match its revision at equal sequence. It atomically archives the previous metadata and prepares the new
  unsubmitted intent. The existing one-shot claim/submission path dispatches only that
  new nonce, with its original readiness/auth/head checks. No old POST is replayed.
- A failure before archive retains the old operation. A failure after archive retains
  its history and the new durable intent/claim. Reopening resumes an unsubmitted intent
  using its original nonce; a submitted intent permits receipt reads only. Competing
  tabs cannot archive the same snapshot twice or replace the winning active nonce.
- Mobile additive SQLite schema19 stores history independently of personal words,
  content queues and SRS, without a word FK. Exclusive archive/update uses the transaction
  handle for every query and rolls back on owner/head/storage failure. Indexed IDs are
  checked against active and archived operations. SQL insert/update triggers also prevent
  old writers reusing an archived owner/operation ID. Schema18 active rows are not rewritten;
  actual interrupted migration/reopen tests preserve reserved operations and personal data.
- Browser storage preserves legacy arrays until the first archive. The same owner key
  and exclusive Web Lock then store an exact version3 envelope containing active and
  archived metadata in one setItem. Reads never migrate or clear storage. Old array-only
  readers reject the envelope rather than replacing its IDs. Unknown versions, duplicate
  nonces, foreign owners and nonterminal archives fail closed. This compatibility boundary
  must be included in activation/client qualification.
- Local history is owner/word-scoped and newest first, containing metadata only. Mobile
  bounds archived records to100 per owner. Browser retains its preexisting100-total-
  operations and256000 UTF-16-code-unit bounds, now including archives. Capacity stops a
  new attempt rather than evicting IDs. There is no clear, delete, automatic expiry or
  archive export/pruning workflow in this checkpoint.
- Mobile and web expose Start new analysis only for a locally finished receipt with
  current availability. The action still rechecks the server receipt before archive.
  Saved status checking and local View analysis history remain available when analysis
  permission or flags are withdrawn. History loads explicitly; it is not fetched on
  mount. A synchronous busy latch guards all actions; history responses after account
  change/unmount cannot restore metadata. The persistent A-to-B-to-A latch remains.
- Web creates the next command from the currently visible validated published reference,
  even before route refresh returns. Existing validated display projection preserves
  personal progress, mode and newer rollback heads. Native display behavior is retained.
- Lost replies, busy and quarantined outcomes have distinct explanations and no next
  button. Checking the same ID can observe explicit server reconciliation, advance a
  quarantined result through validation and obtain its finished receipt without a new
  paid call. Ordinary clients invoke no service-role reconciliation or administrator
  API and cannot clear uncertainty. A null read or lease timeout proves no completion.

History here is the local archive of this word's completed attempts. The current attempt
remains in the existing journal/status UI. Server operation-list import, cross-device
history and recovery after lost local storage are not implemented. Busy/null submissions
remain conservatively reserved; no client-only absence proof or manual release is added.

## Verification

- Full mobile: **171 suites /2132 tests /22 snapshots**, configured coverage, zero
  skipped/todo. Added21 cases:12 actual SQLite attempt/history cases,4 common UI lifecycle
  cases,4 native light/dark controls and1 actual initializer migration/retry case.
  Full coverage: statements73.49%, branches60.48%, functions73.69%, lines74.64%.
- Full web: **96 suites /873 tests**, zero skipped/todo. Added8 cases:6 journal/locking/
  failure/capacity cases and2 DOM controls/current-head cases. Opt-in performance harness
  included with CLI testTimeout30000. Node preparation measured181.893–201.188ms for2500
  cards and369.279–377.145ms for5000; all10 runs report long tasks. This does not complete
  native/browser review performance qualification.
- Repaired focused mobile5/107 and web2/30 passed before eight final native/common cases;
  all are included in full runs. After a test-only duplicated filename was replaced by
  a named constant, the actual migration suite reran **1/23** and passed. Final mobile
  production/test, web route/test-inclusive, domain/contracts types pass. Root/web/domain
  lint pass with zero warnings; scoped Prettier and git diff --check pass. Exact commands,
  source inputs and log hashes are in the JSON packet.
- Initial focused migration inspection used a closed fixture handle after the initializer
  deliberately closed it on failure. The test now opens an independent inspection handle
  and closes it before retry. Web mocks now persist the recovered receipt like the real
  journal, and count both subscriptions created when publication changes the captured
  head. Initial duplicate literals and injected-fault harness complexity were repaired
  with constants and a table of migration fault points, without lint suppression. Failed
  logs are retained; final required checks pass. The final publication boundary caught a
  stale head in the capacity fixture; it now uses the published reference and tests
  capacity without bypassing the boundary.
- Entry278 exact paths /180 source hashes matched.161 prior source hashes are preserved;
  19 declared extensions plus one additional domain module produce a181-path source
  union. All20 source/test paths are listed in JSON. All37 historic test mirrors and47
  sealed artifacts remain unchanged;255 protected baseline paths were rechecked.
- Edge76, selected PostgreSQL95 and target generation/check are carried evidence only.
  Backend/migrations/generated contracts are unchanged. Only native SQLite schema moved
  to19. Tests use actual file-backed SQLite with a replaced native bridge, synthetic SDK/
  Auth/network, DOM/native renderer and modeled browser lock scheduling. Real native
  connections, browser retention/Web Locks, provider/semantic quality and device/release
  acceptance remain separate. All runners exited; no task resource/external operation.

## Resume boundary

Next **D13A.5 — recommended GPT-6.1 Sol / High**: following new-word/import/transfer2
client adoption and recovery. Read existing following import/transfer2 contracts, owner
intent journals, mobile import/transfer services and web command/forms. Connect protocol2
behind the OFF gates, preserve private differences and legacy pending commands, and verify
restart/offline, capability withdrawal, two owners and exact personal IDs/SRS/queues.
No automatic conversion, private publication or paid call. High is recommended for the
coupled owner/intent/reference/cache and mixed-protocol preservation boundaries.

Broader web offline/account-return recovery and server history import, private/mode
reconciliation, review performance/parity and D7/8 model/device/review/release acceptance
remain. D13 observation open; D14 pending; AUTH27–29 consumed. Preserve the entire dirty
bundle/reports/QA/backups/services/.playwright-cli. No reset/clean/switch/rebase/commit/
push/PR, hosted migration/publication, real card conversion, provider/paid, EAS/release,
device or automation operation was started or remains pending.
