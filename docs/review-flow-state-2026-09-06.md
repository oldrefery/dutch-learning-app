# Shared review session state

## Status

The framework-independent state transitions for fast review are implemented in
`packages/domain/src/review-flow*.ts`. They are exported by `@woordenaar/domain`
and tested through the mobile Jest runner. The web screen is now connected for
fast Recognition, optional manual ratings, in-session details, and read-only
history. Web now includes explicit correction controls and conflict resolution.
Mobile screen integration remains incomplete. This is a local implementation,
not a deployed rollout; correction controls require the undeployed backend capability.

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
Web exposes them separately and blocks new assessment writes, restart, and the
session Exit action until reconciliation. Browsing remains available. The shared
model does not claim server eligibility for a correction.

## Remaining integration work

The web server prerequisites are implemented: authenticated full-card reads,
validated correction commands, and capability-aware effective-history readers.
The web controller uses the shared state with immutable question snapshots,
synchronous submission claiming, identical-payload retry, and independent history
navigation. Authenticated details are loaded inside the session; stale detail
responses cannot replace a different word. See the
[correction contract](review-correction-contract-2026-09-06.md).

- Connect mobile screens, lifecycle events, durable commands, and conflict UI.
- Persist/restore account-bound session state if session restoration is exposed;
  validate restored data and reconcile uncertain commands before resuming.
- Run real browser/native and HTTP/Auth checks on authorized test accounts only.
  Current web tests exercise React rendering in jsdom and mocked server actions;
  they do not prove real browser layout, HTTP/Auth, or native lifecycle behavior.

## Web interaction and verification

### Assessment correction

- History shows separate Change to Again/Hard/Good/Easy controls for assessed,
  unassisted entries when correction capability is available. Selecting the
  existing rating does nothing. Skipped and assisted entries cannot be upgraded.
- One immutable correction command may be outstanding per session. It is claimed
  synchronously before I/O, so repeated clicks cannot issue a second operation.
  Unknown outcomes expose only Retry same correction; they cannot be abandoned
  in favor of a different rating or an ordinary review submission.
- A confirmed receipt updates the effective history rating, summary counts,
  adaptive evidence, and canonical word pool without adding a review. The active
  question and original history snapshots remain intact. Open full details reload
  after reconciliation to show current progress.
- Conflicts, invalid commands, and unavailable capability expose Keep server
  version. This performs authenticated, user/word/event-scoped reads, not a write.
  Read failures retain the unresolved edit. Successful reads replace canonical
  progress and effective history where available; deleted words are removed from
  the next-session pool without destroying readable session snapshots.
- A resolved conflicting event is locked against further edits in that session.
  The notice retains the requested rating and says it was not confirmed, rather
  than falsely claiming it never reached the server. Transport retries may have
  followed a previously accepted operation whose receipt was later deleted.
- Receipt reconciliation is atomic in the correction RPC. Conflict refresh uses
  separate read-only word/event queries, not a transactional snapshot; later
  concurrent changes are still arbitrated by the server's next write command.
- Corrections remain in memory on web, with the existing unload warning. This
  does not provide recovery after reload or intercept every application navigation.

### Session behavior

- Fast mode saves Good immediately after a correct Recognition selection and
  advances only after acknowledgement and at least 600 ms of feedback.
- Wrong answers open the full card and wait for Continue (Again). A pre-answer
  peek permits Again or Skip only; skipping does not change SRS or review totals.
- Manual Recognition is off by default and stored in account-scoped web settings.
  The setup switch enables explicit ratings after a correct choice. Preference
  changes apply to the next activated question, never an in-flight response.
- Previous word, a history selector, full details, and Return to current question
  preserve the pending question/options. Completion retains the same history.
- Details/history/background transitions cancel timers. Returning requires an
  explicit Continue for an already answered question. Focus moves to the content
  region when changing question/view; D, arrows, Space, and rating keys are scoped
  so browsing history does not submit another review.
- Exit/restart is blocked while an assessment is saving or its outcome is unknown.
  Browser unload warns about session loss. Full reload restoration is not
  implemented; this is an in-memory session, not a durable offline web queue.
- Account changes remount the workspace and invalidate old asynchronous results.
  Historical question payloads stay unchanged; confirmed canonical SRS is used
  when preparing the next session.

The web regression suite covers delayed/failed saves, exact retry identity,
double selections, hidden-tab timers, peeking/skipping, manual preferences,
history after completion, stale detail responses, account changes, keyboard
interaction, and rendering under both theme attributes. Real visual and
screen-reader validation remain required before release.

No remote migration, publication, or protected application-account testing was
performed for this stage.
