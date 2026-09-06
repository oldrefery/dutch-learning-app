# Review correction web UI verification

Branch: `feature/isolated-fixture-ci`, following `c106714`.

## Environment and safety

The real Next.js application ran in headed Chromium against a disposable local
GoTrue/Kong/PostgREST/PostgreSQL stack. All current migrations were applied to an
empty database. A sanitized workspace copy excluded application `.env` files;
the server received only local Supabase configuration, with Sentry disabled.
One synthetic `example.invalid` account owned six simple fixture words.
No hosted backend or `oldrefery` application account was accessed.

Cleanup verified zero users, words and correction receipts, then stopped only
the disposable `woordenaar-sync-v2.amfDpS` stack with `--no-backup`. Its web
server and browser were closed. Local screenshots and CLI traces were moved
outside the repository into that temporary directory, not staged for commit.

## Verified through the UI and database

- Email/password login and review setup worked. Manual recognition ratings were
  off by default. Correct recognition saved Good and advanced without Continue.
- Previous word, history selection, Full details and Return to current question
  preserved the active question and did not create extra review events.
- Good → Hard replaced the effective rating: repetition one, interval one day,
  ease 2.35, one immutable original Good event and one correction receipt.
- A second authenticated client changed the same event to Easy. The stale UI
  edit showed a conflict instead of hanging; Keep server version reloaded Easy,
  interval four days and ease 2.50. The rejected edit added no receipt.
- A browser route forwarded a correction to the real server, consumed its
  successful response, then aborted delivery. The UI offered Retry same
  correction. The receipt was confirmed without another review or SRS change.
  This was transport fault injection, not physical airplane mode.
- A wrong answer opened the complete card; Continue saved Again (zero
  repetitions, zero-day interval, ease 2.30 for an initially new word).
- Full details was available before answering. Skip without review left that
  word's progress and event ledger untouched at that checkpoint.
- Enabling manual ratings made a correct answer wait for an explicit grade.
  Completing a four-word session produced the matching summary: one Again,
  one Hard and two Good. History and Full details remained available afterward.
- The dark 390px layout and light 1440px layout had no horizontal overflow.
  Full-card screenshots were visually inspected. Responsive web was tested;
  these checks are not native iOS/Android verification.

The first session intentionally left a wrong-answer word due. Reviewing it again
in the second session correctly created a second event. Replacing that second
Good with Hard yielded ease 2.15 from its existing 2.30 checkpoint, rather than
resetting its learning history. Synthetic data was inspected through an ordinary
authenticated client; administrative access was limited to fixture setup/cleanup.

## Defects fixed during the run

1. A resolved correction notice remained visible on unrelated questions. Notices
   now carry their review event ID and are displayed only on that history entry.
   This also handles reconciliation finishing after the user navigates away.
   Pending commands remain visible globally because they still block new writes.
2. On narrow screens, CSS hid the Exit text and left an unnamed icon button.
   The button now has a persistent `Exit review` accessible label.

The notice fix was repeated in the real browser after a full reload (not only
Fast Refresh). The label was verified in the 390px accessibility snapshot.
Regression assertions cover leaving/returning to corrected history, another
review event, late reconciliation, Full details, and both theme fixtures.

## Verification and remaining work

- Web: **53 suites, 522 tests passed**.
- Web typecheck, lint, changed-file formatting and `git diff --check` passed.
- The intentionally aborted request generated an expected network console error;
  the fresh final session had zero console errors. Development font-preload
  warnings were visible and were not suppressed.
- No mutation score is claimed for this follow-up; the prior full Stryker runs
  are recorded in [the HTTP report](review-correction-http-qa-2026-09-06.md).

Next: build a fresh isolated native QA app and verify correction retry/recovery
across restart against a disposable local backend. That native run and hosted
deployment have **not** been performed by this web UI verification. Migration
`20260906160000_add_review_corrections.sql` remains undeployed.
