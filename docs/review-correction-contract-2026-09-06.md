# Review correction contract

## Status and scope

The server contract is implemented and tested in isolated local PostgreSQL.
Migration `20260906160000_add_review_corrections.sql` is **not deployed**.
No application account or hosted database was used during implementation.
Mobile now has a durable correction queue and effective-history reader, tested
against SQLite and mocked transport. Web now has authenticated correction/detail
actions and capability-aware effective-history readers, tested with mocked transport.
The web fast-review/details/history flow now includes capability-gated correction
controls and explicit conflict resolution. Mobile now connects fast review, details,
and read-only session history; correction UI and sync serialization remain the
next stage. Nothing is deployed: the current remote backend cannot enable these
controls until its migration and coordinated client rollout are authorized.

This is the persistence foundation for
[fast recognition with review history](brainstorms/2026-09-06-fast-recognition-history-brainstorm.md).

## Capability and command

Authenticated clients can query `review_correction_protocol()`; version 1 exposes
the following contract. `learning_sync_protocol()` stays at 2. A missing or
unsupported correction capability must disable correction writes, not downgrade
them to ordinary assessments. Capability detection alone is not a rollout gate:
clients must also implement effective history and conflict handling.

```sql
SELECT * FROM public.correct_review_assessment(
  p_word_id := :word_id,
  p_event_id := :original_review_event_id,
  p_correction_id := :stable_operation_id,
  p_expected_revision := :last_known_revision,
  p_assessment := :replacement_assessment
);
```

- Revisions start at 0 for the original answer. Every accepted correction adds
  one revision, including an explicitly submitted unchanged rating.
- The operation ID belongs to one immutable payload. Reuse it for an uncertain
  outcome/retry; create a new ID only for a new edit after resolving the prior one.
- No user ID, SRS values, or replacement review timestamps are accepted from the
  client. Identity comes from `auth.uid()` and progress is calculated server-side.
- The original answer correctness and response duration remain factual evidence.
  Correcting an assessment from Again to Good does not change a false recognition
  outcome into a true one.

## Response and retry semantics

The single returned row contains:

| Fields                                                                                                    | Meaning                                             |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `correction_id`, `event_id`, `accepted_revision`                                                          | Receipt for the requested operation                 |
| `effective_revision`, `effective_assessment`                                                              | Latest accepted correction for that original event  |
| `word_id`, `interval_days`, `repetition_count`, `easiness_factor`, `next_review_date`, `last_reviewed_at` | Current canonical word progress under the word lock |

An old acknowledged operation can be retried after another edit, review, or reset.
It returns its receipt without reapplying anything. `accepted_revision` may then
be smaller than `effective_revision`. Word progress may reflect a later review or
reset, not just the event whose correction receipt is being acknowledged. Do not
replace effective state with an old receipt or recompute a word from that receipt.
After a subsequent reset, `last_reviewed_at` can be null. This is valid canonical
progress, including when returned by a retry of an earlier accepted correction.

| SQLSTATE                                  | Meaning / client action                                                                                         |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `42501`                                   | Missing identity or inaccessible/missing/deleted word/event; stop the write                                     |
| `22023`                                   | Invalid payload, conflicting operation-ID reuse, or unavailable checkpoint; do not retry blindly                |
| `40001` with `Review correction conflict` | Stale revision, newer review/reset, or out-of-ledger progress change; fetch canonical state and show a conflict |
| `23505`                                   | Concurrent operation-ID collision; retry the identical payload to reconcile, never silently allocate another ID |

Transport errors have an unknown commit outcome: retain the exact command until
its receipt is obtained. A failed edit must not be counted as successful.

## Storage and eligibility

- `review_events` stays unchanged. Existing event retries and immutable identity
  validation continue to work, even after a correction has been accepted.
- `review_progress_checkpoints` captures the actual pre-review interval,
  repetition count, and easiness, plus the canonical scheduling anchor and last
  review timestamp. Capture happens in the existing apply trigger so multi-row
  native uploads checkpoint each preceding applied result correctly.
- `review_progress_heads` identifies the latest applied review for each word.
  This uses server application order, not potentially stale offline timestamps.
- A new reset invalidates the head; an identical reset retry does not. A newer
  same-word review replaces the head. Other-word reviews and metadata edits do not.
- `review_assessment_corrections` is an append-only ledger with unique operation
  IDs and per-event revisions. Authenticated clients have SELECT only and must
  use the ownership-checked command for writes.
- Before changing progress, the command verifies that current word progress
  matches the expected effective result. Administrative progress changes therefore
  fail closed rather than being overwritten with an old checkpoint.
- All mutating commands serialize on the same owned word row. An accepted
  correction plus its SRS update either commit together or roll back together.
- Existing word/account deletion behavior is preserved: deleting review events
  cascades to their checkpoints, head, and correction receipts.

No legacy checkpoint is backfilled and no historical SRS is replayed by this
migration. Existing events remain visible but cannot be corrected without a
trustworthy checkpoint. The next actual review of an existing word captures one
without resetting its prior progress.

The RPC enforces eligibility, not session membership: session history navigation
is a client-side UX boundary. It does not grant access to another user's words.

## Effective history and mobile integration requirements

`effective_review_events` is a `security_invoker` view respecting underlying RLS.
It preserves one row per review, original timestamps/outcome, and adds
`original_assessment` and `revision`. The displayed assessment and next SRS values
come from the latest correction when present.

Consumers of adaptive decisions, insights, and session summaries must use this
effective result. Old clients continue to read the original assessment; they are
write-compatible, **not correction-aware**. Do not claim complete cross-version
behavioral parity or enable corrections until the new readers are ready.

Mobile must persist correction commands separately from the original pending
review, process them in durable order with review/reset commands, and maintain a
local effective projection. Never rewrite a pending review payload after its first
possible upload: the server may already have committed it without an acknowledgement.

The ledger has its own `(user_id, created_at, correction_id)` index. Original
event `created_at` does not change, so the existing event cursor cannot discover
corrections. Mobile reconciles the complete correction ledger in pages of 250 on
each capable sync pass, ordered by correction ID. Every pass restarts at zero:
late commits missed by offset pagination are recovered on the next pass, without
persisting an unsafe timestamp cursor. This favors correctness over bandwidth;
large-ledger optimization requires a separately verified protocol.

### Implemented mobile persistence

- SQLite schema v10 rebuilds the learning-command constraint atomically and
  preserves pending review/reset sequences and the AUTOINCREMENT high-water mark.
- A correction and its queue entry commit together. Commands are user-scoped and
  sent in durable order alongside ordinary answers and explicit resets.
- Original review payloads are never rewritten. Only confirmed receipts affect
  the local effective view used by history and adaptive decisions.
- There is **no optimistic correction SRS update**. Receipt reconciliation is
  followed by a canonical word pull after acknowledgements clear the queue.
- Lost responses retain the same operation ID and payload. The client obtains
  that operation's immutable receipt, not the potentially newer effective state
  returned by an idempotent RPC retry.
- Missing original events are fetched before receipts are stored. Locally
  tombstoned words are not resurrected and do not block their pending deletion.
- Confirmed receipts cannot silently change. SQLite enforces required confirmed
  SRS fields, while transport validation checks ownership, identities, revisions,
  assessment values, numeric bounds, and timestamps.
- An unavailable backend retains pending corrections and stops before later
  commands. Conflict responses persist a conflict state and also stop the queue;
  they are never acknowledged as successful.

### Mobile conflict-resolution adapter

- SQLite schema v11 adds only a nullable `resolved_at` column. It does not rebuild
  word data, replay SRS, rewrite events, or renumber pending commands. Initialization
  tolerates interruption after adding the column and before storing the version.
- `resolveReviewCorrectionConflict` is an explicit user-action adapter, not an
  automatic sync policy. It verifies the immutable local command, rejects pending
  commands with unknown outcomes, checks the authenticated owner and capability,
  reconciles correction receipts, and reads owned canonical word progress.
  Authentication is checked again before the final local transaction.
- The transaction preserves the original requested rating and terminal status,
  records resolution time, and removes only that correction's queue entry. It
  applies confirmed SRS only if no other learning command remains for the word;
  later offline reviews/resets and unsent word metadata remain intact.
- A storage failure rolls back both the resolution marker and queue removal.
  Repeated resolution is a no-op, including after a later local review. Reusing
  the resolved operation ID never queues it again; a genuinely new edit needs a
  new ID and the effective revision.
- A receipt discovered during refresh can acknowledge the operation before the
  word read completes. If the word read then fails, retry can finish resolution
  from that acknowledged state. Read failures never discard an unacknowledged
  intent; an actual validated receipt may acknowledge it. A late receipt remains
  authoritative even after explicit resolution, without re-enqueuing the command.
- Missing/inaccessible remote words do not trigger local deletion or fabricate
  SRS. Existing tombstone synchronization retains responsibility for deletions.
  Normal synchronization is still required after resolution, especially when
  later queued reviews prevent applying the refreshed progress immediately.
- Conflict resolution, complete background sync passes, fast-review persistence,
  Audio Review assessments, and local progress resets
  now share an in-process FIFO operation queue. Commands are copied before waiting;
  ownership is checked inside the operation. Failed operations release the queue.
  Sync checks the current/refreshed client session owner after acquiring its turn;
  this stale-work guard does not replace server authentication and RLS.
- These storage/transport adapters are not connected to the mobile screen yet.
  Before enabling correction UI, guard stale session callbacks, reload effective
  history/local words, and resume
  the remaining queue. Do not enable correction UI before that integration.
- Audio Review reads owned SQLite progress after acquiring the queue instead of
  calculating from the UI cache. It freezes rating, mode, and answer time before
  waiting. Review and reset actions suppress same-word duplicate calls while in
  flight, recheck ownership after asynchronous work, and merge progress into the
  latest cache without reverting metadata. A late completion cannot advance a
  replaced review session. These guards do not restore sessions after restart
  or provide uncertain-commit retry identity for legacy Audio Review.
- Server receipt and word reads are separate requests, not a transactional
  snapshot. This adapter does not claim immunity to later server-side changes;
  normal sync and server write arbitration remain necessary.

Verification uses disposable file-backed SQLite and mocked authenticated transport,
not an application account. It covers unknown outcomes, wrong owners, malformed
progress, account changes, late acknowledgements, atomic rollback, repeated action,
subsequent command preservation, and interrupted schema upgrades.

### Implemented web server integration

- Authenticated server actions validate caller identity and command fields before
  database access. Full-card reads are scoped to the owned, non-deleted word and
  do not submit a review or change learning progress.
- Correction writes use only the dedicated RPC, preserving the caller's operation
  ID. They distinguish unsupported capability, conflicts, invalid commands, and
  uncertain outcomes that require retrying the exact same payload.
- Responses are validated before returning canonical progress or invalidating
  review, history, insights, and collection paths. Null last-review timestamps
  after a reset are accepted; older receipts never trigger client-side SRS replay.
- Review/adaptive history and global history use the effective view when protocol
  version 1 is available. A missing or unsupported protocol uses original history;
  a capability transport failure or failed effective-view query does not silently
  downgrade to stale original ratings.
- Additive RPC/view types remain feature-local until migration deployment and
  schema regeneration. The adapter uses the existing cookie-authenticated client,
  never an elevated database client.
- The full-card and correction actions are connected to web session navigation.
  Correction controls use effective history and explicit conflict handling; they
  remain disabled when backend capability is missing.
- Web serializes correction writes separately from ordinary reviews, without
  optimistic progress. Unknown outcomes retain the exact command. Terminal
  rejection requires an explicit read-only refresh before releasing the write
  lock; the affected event then remains non-editable in that session.

### Remaining client and rollout requirements

- The owner confirmed that they are currently the only user and tester. Prefer
  a coordinated client/server update over staged rollout machinery or extra
  compatibility layers for hypothetical users. Retain data-integrity guarantees
  for interrupted writes, retries, and restarts; the protected application account
  must not be used for testing.
- Mobile now has correction controls and a controller transport contract for
  saving, immutable retry, conflict, and explicit server refresh. Production
  session creation deliberately supplies no correction transport: history shows
  an unavailable notice and cannot send correction writes. Deployment of the
  migration alone does not enable the controls.
- Before connecting the transport, add a durable, account-bound canonical-progress
  barrier. A synced correction receipt can remove its queue command before the
  following canonical word pull succeeds. That acknowledgement must not release
  new learning writes against stale SRS. Persist and restore the barrier across
  restarts; release it only after validated canonical progress is applied or the
  conflict is explicitly resolved. Cover all learning entry points, not just the
  mounted review screen. The existing in-process FIFO is not this durable barrier.
- Keep a same-word follow-up review from using unconfirmed correction progress.
  The session layer must wait for reconciliation or explicitly resolve the edit;
  do not calculate a new assessment from a guessed optimistic state.
- Mobile now preserves active-question/history state and completion history in
  memory, including route remounts. Add account-bound restoration if persistence
  across application restarts is exposed on either client.
- Verify real HTTP/Auth integration and native runtime behavior before rollout.
  No fallback may send an extra ordinary review to simulate a correction.

## Verification

Run `npm run test:db` with the repository's Node version. The runner starts private
temporary PostgreSQL clusters over Unix sockets, ignores ambient database
credentials, disables TCP listeners, and removes only its own temporary directories.

Coverage includes:

- Good/Again replacement, all target assessments, original answer preservation;
- 64 correction combinations compared with shared SRS, including EF bounds,
  rounding, repetition stages, knowledge levels, and review dates;
- uncertain acknowledgement retries, repeated corrections, stale revisions;
- actual overlapping correction/review/reset transactions and ID collisions;
- RLS, anonymous access, forged word/event binding, forbidden direct writes;
- caller rollback, tombstones, legacy multi-row retries, and late offline dates;
- applying the migration over existing data without changing its contents.

Mobile tests additionally cover actual SQLite rollback, close/reopen persistence,
migration failure/retry, effective history without duplicate events, ownership,
tombstones, and review/correction/reset ordering. Transport is mocked for lost
acknowledgements, unsupported capability, stale conflicts, account switches,
receipt validation, and full-ledger pagination/reconciliation.

The native correction controller/UI milestone adds isolated transport tests for
single claiming (including re-entrant subscribers), immutable uncertain retries,
write/exit blocking, conflict refresh failures, deleted events, malformed results,
late account changes, assisted-answer protection, and unavailable production
transport. Rendered controls are exercised in light and dark themes. These tests
do not establish durable recovery or real HTTP/Auth integration. A transport must
return success only after durable intent and canonical SRS reconciliation, not
merely after enqueueing or receiving a correction receipt.

At this milestone the full mobile suite passes 1,467 tests across 123 suites,
including 22 snapshots. Mobile application/test typechecks, repository mobile
lint, and changed-file formatting checks also pass.

Web server tests cover authentication redirects, cross-account rejection, exact
retry payloads, conflict/error classification, malformed acknowledgements, reset
retries, read-only full details, effective assessment reads, and 501-event paging.
The server-integration milestone passed 371 tests across 48 suites. These are local tests with
mocked transport, not proof of deployed RPC or browser behavior. New correction
adapters have not yet been added to the mutation-testing target set.

The web UI integration milestone passes 427 tests across 51 suites, including
double-click claiming, immutable retries, no optimistic SRS, effective summary
replacement, stale/unmounted responses, conflict refresh, deleted words,
capability gating, and rendered correction controls. Server refresh tests verify
authentication, user/word/event filters, deleted-word handling, malformed effective
events, and generic errors without provider-detail leaks.

HTTP/Auth integration and native/web runtime checks for this feature are not yet
performed. Remote migration and rollout require separate explicit authorization.
