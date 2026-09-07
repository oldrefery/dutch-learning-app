# iOS Adaptive Review startup regression — 2026-09-07

## Reproduction

The user reported a blank, unresponsive iOS screen after Start Adaptive Review
with more than 2,000 due words, persisting for over a minute.

A disposable iPhone 16 Pro / iOS 26.5 simulator reproduced this with 2,500
synthetic due words. The QA harness used the real review route, NativeTabs,
audio provider, application store, SQLite and review controller. Auth/bootstrap
was replaced by local synthetic initialization; the backend URL was an unused
loopback port. OTA was disabled and Sentry was not initialized. No hosted or
personal application account was accessed.

The baseline used the review route, native session component, session factory,
question preparation and distractor builder from release commit `48409d0`.
After Start, the review content was blank and the JavaScript heartbeat stopped.
The first-card assertion failed after 60 seconds (over 65 seconds including
the tap command). This reproduces the reported symptom without user data.

## Cause and fix

Previously, initial rendering prepared every question synchronously. Each
Recognition question normalized the entire vocabulary and sorted all candidates,
recalculating string hashes inside the comparator. The combined work blocked
JavaScript before the first card could render.

- Normalize and deterministically order the candidate pool once per session.
- Index candidates by part of speech; rotate the starting position per word
  and stop after finding enough non-overlapping translation alternatives.
- Keep the same correctness, minimum-choice, language fallback and semantic
  duplicate rules. Distractor identities can differ from the old algorithm;
  stable order within a session and vocabulary-order independence are retained.
- Prepare questions outside rendering, yielding after at most 50 questions or
  after a question takes the current batch beyond its 8 ms budget. This is a
  cooperative boundary, not a hard bound on a single operation's runtime.
- Show preparation progress, cancellation and retryable errors. Abort on route
  blur/unmount; do not cache a partial session. Reuse completed controllers on
  remount so existing history and pending assessments remain intact.
- Keep every eligible word. No session-size cap or progress migration was added.

## Verification

- Same iOS simulator and 2,500-word fixture: the final indexed implementation
  reached the first-card assertion about 2.95 seconds after the tap command
  started, including UI automation overhead. This is not a physical-device SLA.
- Correct Recognition answer recorded Good and automatically opened word 2.
- Previous word showed Recorded: good; full details displayed the example.
- Return to current question restored word 2. Early full details followed by
  Skip without rating opened word 3.
- QA SQLite contained 2,500 words and exactly one Good review event. The assessed
  word had repetition 1, interval 1 day and easiness factor 2.5.
- Separate Node 24 distractor-only microbenchmark: 2,500 words took about 26 ms
  and 5,000 about 42 ms after indexing; the original 2,500-word implementation
  took about 27.6 seconds. These are not full native startup timings.
- Regression tests exercise 2,500/5,000 questions, full queue retention, bounded
  batches, cancellation, retryable loading errors and once-per-session indexing.
  Existing review/history/assessment tests and snapshots remain applicable.
- Full mobile suite: 128 suites, 1,503 tests and 22 snapshots passed. Both
  application/test typechecks, scoped ESLint with zero warnings, and
  `git diff --check` passed.

Initial UI automation attempts needed corrected accessibility labels, scrolling
to off-screen buttons and matching the language-prefixed example text. These
selector failures were not counted as passing checks; the corrected flows passed.

## Scope and cleanup

This is real iOS simulator/Hermes execution using fresh embedded JavaScript in
a copy of an existing SDK 57 simulator binary, not a new App Store build or a
physical iPhone test. Remote synchronization and server assessment corrections
were not re-tested by this isolated startup harness. SRS formulas were unchanged.

Temporary harness sources and binary/log/screenshot artifacts were moved outside
the repository to `/private/tmp/woordenaar-review-startup.6c6wI5`. They are not
release artifacts. The disposable simulator and its synthetic database were
deleted after verification. No commit, push, PR, OTA or store publication was performed.
