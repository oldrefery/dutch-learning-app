# New Word Review Eligibility — 2026-09-06

Status: SQL correction merged in PR #108 and applied to production on 2026-09-06.
The subsequent fixture-name fix merged in PR #109. Local and GitHub production
smokes both passed; no additional SQL change was needed for the fixture fix.

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

## Hosted Rollout And Follow-up

- PR #108 merged as `16736f61d0b925e8131814dc6395c66a67b82ad1` after green CI.
- The approved dry run listed only the initial-date migration. A fresh private
  schema/data snapshot was saved before applying it; the earlier restore-verified
  backup checksums were also checked. A final dry run reported up to date.
- Before/after COPY-content comparisons preserved all 11 public tables / 9,539
  rows. The protected-account comparison also preserved its original data across
  seven public tables, including 12 collections, 2,288 words and 144 review events.
  No protected-account login or test action was used.
- The merged Vercel deployment succeeded. GitHub smoke `34028548652` failed before
  word creation: UUID plus rename suffix produced 52 characters but the form
  allows 50. The browser saved the truncated name, so assertions and exact-name
  cleanup missed it. Its remaining empty fixture was subsequently removed using
  verified dedicated-account credentials and exact ownership/name/ID filters.
- The follow-up preserves every UUID digit but removes its hyphens, producing
  40/48-character names. Both form values are checked before submitting. Three
  contract tests cover validation, UUID uniqueness and browser maxlength behavior;
  the old implementation reproduced both the 52-character violation and actual
  browser truncation before the corrected tests passed.
- The corrected local Chromium suite passed 7/7 against `https://woordenaar.app`
  in 41.9 seconds on 2026-09-06. It verified collection create/rename, word analysis,
  search/history, immediate first-review eligibility, and persisted Easy progress:
  interval 1 to 4 days, repetition 0 to 1, New to Learning, EF remaining 2.50.
  Word deletion and exact-name collection teardown completed successfully.
- All 319 web Jest tests, lint and typecheck passed for the test-only follow-up.

## Completed Production Verification

PR #109 merged as `15b5c73bb020b8340c2b253cfb612813ffd8f3ea` after green CI.
The automatic Vercel deployment succeeded, and
[production smoke 34030539690](https://github.com/oldrefery/dutch-learning-app/actions/runs/34030539690)
passed all seven checks in 41.6 seconds without retries from that main revision.
It covered login/account safeguards, three fixture contracts and the complete
collection/word/SRS scenario, including test-data cleanup. No protected-account
QA, additional migration or native build was used for this follow-up.

The next CI-only improvement runs the same fixture contracts in an isolated
credential-free PR job; see `apps/web/e2e/README.md`. It does not replace the
hosted smoke or the unverified device/session scenarios in `docs/TESTING_PLAN.md`.
