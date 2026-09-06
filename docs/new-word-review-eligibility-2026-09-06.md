# New Word Review Eligibility — 2026-09-06

Status: fixed and tested locally on `feature/new-word-review-eligibility`.
Not committed, pushed or deployed by this change. No production data was modified.

## Cause

Protocol 2's INSERT protection assigned a new word `CURRENT_DATE + 1`, overriding
the same-day date sent by web/native creation. The due selector excluded it and
the vocabulary/SRS smoke waited on disabled `Start · 0`. Its final cleanup then
masked the initial timeout by trying to navigate an already-closed test page.

The trace for run `34024791705` shows the test running on September 6 with its new
word scheduled on September 7. The fresh main smoke run `34025815311` also failed
the vocabulary/SRS scenario (three other checks passed). Main Quality
`34025602412` and the merge commit's Vercel deployment passed; neither substitutes
for the failing hosted learning workflow.

## Correction And Data Safety

- A new forward migration replaces only `protect_word_learning_progress`.
  New authenticated inserts initialize their date to the server's `CURRENT_DATE`.
  This restores the existing UTC-day creation convention, not a new timezone API.
- Existing word progress, stale-upsert protection, ownership and permissions stay
  intact. No existing dates/history are backfilled or replayed. Words created
  before the correction retain their stored schedule.
- Explicit resets still schedule for the supplied reset date plus one day.
- The smoke asserts first-review eligibility before clicking Start. Teardown
  has its own bounded context, removes only its exact collection names and keeps
  the original failure visible. The existing initial test-prefix cleanup remains.

## Verification

- Three new date regressions failed against the old trigger and pass with the fix.
- All 63 isolated PostgreSQL tests pass, including five new cases covering initial
  dates, first review, stale upsert, reset scheduling and preservation of existing
  records/function identity/privileges. Fixtures use synthetic users, never hosted
  credentials or protected-account data. Local PostgreSQL is 15; hosted is 17.
- Web typecheck, lint, formatting and all 319 Jest tests pass.
- A local fake-HTTP/browser harness verified teardown after an already-closed page
  and an intentionally timed-out test. The latter deliberately exits nonzero;
  its original timeout remains visible, cleanup succeeds and an unrelated
  sentinel collection survives. This is not production UI verification.

## Next Gate

Commit/push/PR and hosted migration require separate approval. After applying the
forward migration, rerun the updated smoke against production on a dedicated test
account. No mobile rebuild is needed for this database-body/test-only correction.
Never use the protected application account for QA or clear its device data.
