---
date: 2026-09-06
topic: fast-recognition-history
status: server-contract-implemented-client-integration-pending
---

# Fast recognition with review history

## Accepted experience

Apply the same behavior to web and mobile. Recognition should normally require
one answer action, with time to inspect mistakes and revisit earlier words.

- Correct choice: show a brief success indication, record Good, then advance.
  Start with 600 ms of feedback; this duration is a tuning value, not an SRS input.
- Incorrect choice: reveal the correct answer and full card. Wait for Continue
  before recording Again and advancing. Never time-limit mistake explanations.
- Full details is visible before and after answering and opens inside the session.
- Keep Previous word and Return to current question available. History supports
  multiple completed words, including after completing the last question.
- History shows the original question, answer result, and effective assessment.
  Full details and pronunciation remain available without recording a review.
- Change assessment offers Again, Hard, Good, and Easy. Again remains available
  after a correct choice because the user may have guessed.
- Returning from history restores the unfinished question and its existing state.
  Browsing history must not rerandomize options, lose a selection, or submit it.
- No auto-advance runs in history or while details are open. Opening details
  during success feedback pauses progression until the user resumes explicitly.
- A remembered manual-assessment preference can disable automatic Good for
  recognition. It is optional, not required for correcting occasional answers.
  Preference changes affect the next question, not an answer being submitted.
- Recall and production retain manual assessment because a mental response
  cannot be objectively checked by the current application.

## Revealing details before answering

Details reveal the translation. Treat this as an assisted attempt, not a new
successful recognition answer. Offer Again or Skip without assessment after
reading. A skipped word must be distinguishable from an assessed word in session
counts; it does not advance SRS or adaptive mode. Do not let closing details
restore the same prompt as an unassisted test.

## Why this approach

Always asking Hard/Good/Easy preserves control but adds an action to almost every
correct answer. Always recording Good loses the ability to express a guess or
unusually easy recall. Fast defaults with persistent history keep the common
path short without requiring users to race an expiring correction button.

## Current implementation findings

- Web `ReviewCard.tsx` exposes Full details after either recognition result.
  `ReviewWorkspace.tsx` already handles D before answering, but navigates away.
  Continue currently records Good or Again rather than asking for confidence.
- Web `useReviewSession.ts` owns in-memory session state. Existing previous/next
  navigation resets card state; it is not a separate read-only history cursor.
- Mobile `ReviewAssessmentControls.tsx` offers three assessments after a correct
  recognition response and Continue/Again after an incorrect response.
- Mobile `ReviewEventRepository.recordAssessment` writes progress and a pending
  event atomically. Sync sends immutable event payloads and acknowledges them.
- Server `prepare_review_event` locks the word and checks event identity.
  `apply_review_event` computes canonical SRS. Events are not editable records.
- Mobile pulls events using a created_at cursor and rejects differing assessment
  payloads for an existing event ID. Mutating assessment in place would break both
  incremental sync and immutable-identity checks.

## Persistence invariants

1. Reading history causes no writes, SRS changes, or completed-count changes.
2. An assessment correction refers to the original event ID and has its own
   idempotency ID. It is not a second review and does not add a repetition.
3. Keep the original answer outcome, response duration, and review date. A later
   correction time must not pretend the word was reviewed again at that time.
4. Compute corrected progress from a trusted pre-review state, not by subtracting
   an interval or easiness delta from the current word snapshot.
5. Do not replay pre-cutover history: existing progress can include legacy events
   whose application cannot be reconstructed safely.
6. Use a correction ledger and effective-result projection, preserving the
   original event for retries and audit. Consumers of history, adaptive policy,
   counts, and insights must use the effective assessment consistently.
7. Web advances only after confirmed persistence; mobile may advance after its
   durable local transaction, retaining pending work across restart and logout.
8. A timeout or retry must reuse the same operation ID. Double taps, repeated
   keys, and duplicate delivery must never create another assessment/correction.
9. A rejected correction must remain visible as failed/conflicted; never silently
   discard user intent or report that it was synchronized.

## Proposed safety boundary for implementation

History navigation is scoped to the current session, not a global history editor.
Initially allow corrections only when a trustworthy pre-review checkpoint exists
and no subsequent review or reset has superseded that word's result. Reviewing
other words does not prevent correcting an earlier word in this session.

If another device reviewed/reset the same word, return an explicit conflict and
refresh canonical progress rather than overwriting it or guessing a replay.
This concurrency exception needs clear UI copy and contract tests before release.
Repeated corrections to the same result use an expected revision to prevent
lost updates. Reading an older result remains available even if editing is blocked.

## Implementation order

1. Define and test the correction contract: checkpoints, ownership, revision,
   idempotency, resets, deletion, and concurrent requests in isolated PostgreSQL.
   Use additive schema changes; do not modify historical assessments/progress.
2. Add mobile durable correction commands and ordered synchronization, with an
   effective-history projection. Cover SQLite rollback/restart and HTTP retry.
3. Separate active-question state from history-view state. Reuse pure session
   rules where practical; keep platform presentation separate.
4. Build the web flow: in-session details, history, safe correction, success
   feedback, explicit error handling, and optional manual assessment.
5. Build the equivalent mobile flow with the same semantics and durable offline
   behavior. Preserve the current full-card experience after an error.
6. Test both platforms and document rollout. Backend capability must exist before
   clients enable corrections; old-client sync compatibility must be tested.

## Required regression cases

- Correct recognition advances once; wrong recognition waits for Continue.
- Details opened during feedback prevent a hidden auto-advance.
- No timer-driven progression while backgrounded, browsing history, or after exit.
- History navigation preserves the pending question and does not create events.
- Last-word completion still permits history inspection and correction.
- Peek/skip never counts as independent success or changes learning progress.
- Good to Again, Again to Good, and repeated edits recompute SRS exactly once.
- Corrections update effective adaptive history, summary counts, and insights.
- Duplicate requests, lost acknowledgements, stale revisions, and cross-user
  operations cannot corrupt progress or leak data.
- Offline review then correction sync in order and survive process termination.
- A later same-word review/reset produces a visible conflict, not lost progress.
- Existing pending events and older clients remain compatible after migration.
- Keyboard/focus, screen-reader announcements, manual timing, and light/dark
  themes work without hiding actions in short-lived feedback.

## Operational constraints and current status

UX accepted by the user. The first implementation stage now includes an additive
server migration and isolated PostgreSQL regression tests. See the
[correction contract](../review-correction-contract-2026-09-06.md) for API semantics,
compatibility boundaries, and the remaining client/sync work. The migration has
not been deployed; mobile and web runtime behavior have not changed yet.

Keep the current feature branch; the user has committed the earlier sync-badge
contrast fix. Do not commit, push, publish, or migrate a remote environment without
explicit authorization. Never test on the protected oldrefery application account.
Start with isolated local fixtures; use only authorized test accounts for live QA.
