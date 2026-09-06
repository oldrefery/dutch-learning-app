# Shared review session state

## Status

The framework-independent state transitions for fast review are implemented in
`packages/domain/src/review-flow*.ts`. They are exported by `@woordenaar/domain`
and tested through the mobile Jest runner. Existing web and mobile screens are
**not connected to this state yet**. This is implementation stage 3, not a rollout
of the new review experience.

## Ownership

- A session has a user ID and unique session ID. Each question has a unique
  occurrence ID distinct from the word ID.
- The platform prepares immutable word payloads and question/option snapshots.
  The model copies question metadata and options; generic payloads must already
  be immutable. Do not reference a mutable live word object as a history snapshot.
- `active` retains the unfinished question, option selection, answer time,
  assisted state, per-question manual preference, and save status.
- `history` contains completed assessed or skipped questions. Its cursor is
  separate from `active`; reading history never submits or advances a question.
- `remaining` contains prepared questions. The next question takes the latest
  manual-recognition preference, without changing an in-flight question.
- No timers, UUID generators, storage, networking, UI, or SRS calculations run
  inside these functions. The platform owns those effects.

## Submission protocol

1. Select an option or reveal a manual-recall answer. A wrong recognition choice
   opens details; it does not initiate persistence. A correct fast choice exposes
   automatic Good intent.
2. Allocate an event ID and freeze the complete persistence payload in the
   platform adapter. `beginReviewSubmission` returns a changed state only when
   the command is allowed. Update the authoritative state synchronously before
   starting the side effect, so double clicks cannot start two writes.
3. On web, `saved` means server confirmation. On mobile, it means the original
   review and its queue entry committed atomically to SQLite.
4. An uncertain failure retains the same event ID and assessment. Retry the
   original complete payload, including original timestamps, not a fresh review.
   A changed rating requires resolving that save and using the correction ledger.
5. Settle by session ID and event ID. A late success may confirm a failed retry;
   a late failure cannot undo a confirmed save. Exit/logout must close the flow
   and cancel effects; stale callbacks must read current state, not restore an
   old captured state object.

Pure functions do not authenticate server responses. Adapters must check current
user/session ownership and use the existing server/local persistence contracts.

## Navigation and timing

Correct fast recognition can advance after a saved result and 600 ms from answer
selection. A timer ticket binds the session, question, timer revision, and deadline.
Call `autoAdvanceReview` against the latest state; an expired or duplicate ticket
cannot advance the next question.

Opening details/history or backgrounding invalidates automatic progression for
that question. Closing the view or foregrounding does not restart it silently:
show an explicit Continue action. Host adapters must also clear real timers on
these transitions and on unmount. The model is a second safety check, not a
replacement for lifecycle cleanup.

Wrong answers remain in full details until Again is saved and Continue advances.
The explicit action can advance directly from details; it does not require an
extra close-details click. History remains available after final completion.

Details opened before answering permanently mark that attempt as assisted.
Only Again or Skip is allowed. Skipping produces a history entry but no event,
assessment, or SRS update. A pending/uncertain save cannot be skipped away.

## Corrections and summaries

`reconcileReviewHistory` consumes confirmed ledger results for completed events.
It replaces the effective assessment at a strictly newer revision, retaining the
original assessment, event, selection, question snapshot, and timing. Repeated or
older receipts do nothing. Summaries distinguish assessed and skipped questions;
corrections move counts between ratings without incrementing the total.

Pending/conflicted corrections are deliberately not optimistic session results.
The next client stage must expose them separately, implement explicit conflict
resolution, and block a same-word follow-up assessment until its progress is
reconciled. The shared model does not claim server eligibility for a correction.

## Remaining integration work

The web server prerequisites are now implemented: authenticated full-card reads,
validated correction commands, and capability-aware effective-history readers.
They are covered with mocked transport tests; the hook and controls below remain
unconnected. See the [correction contract](review-correction-contract-2026-09-06.md).

- Replace the web hook's destructive previous/next navigation with this state.
- Add in-session details and history, correction requests, optional persisted
  manual preference, and accessible feedback/keyboard behavior.
- Connect mobile screens, lifecycle events, durable commands, and conflict UI.
- Persist/restore account-bound session state if session restoration is exposed;
  validate restored data and reconcile uncertain commands before resuming.
- Run real browser/native and HTTP/Auth checks on authorized test accounts only.
  Current tests exercise pure transitions, not real rendering or lifecycle APIs.

No remote migration, publication, or protected application-account testing was
performed for this stage.
