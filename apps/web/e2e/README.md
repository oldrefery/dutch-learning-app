# Web end-to-end tests

Authenticated Playwright suites use only a dedicated test account. A preflight runs before
the browser starts, and the runtime credential guard repeats the check. Both
reject `oldrefery@gmail.com`, including Gmail aliases.

## Suites

- `npm run web:test:coverage` runs the dedicated web Jest suite and enforces
  its coverage floor.
- `npm run web:e2e:smoke` runs the short Chromium production smoke suite.
- `npm run web:e2e:fixtures` runs three isolated fixture contracts without an
  app server, credentials, saved sessions or production access.
- `npm run web:e2e:extended` runs authenticated UI, sharing, validation, and
  mobile Chromium scenarios.
- `npm run web:e2e` runs smoke and extended Chromium coverage.
- `npm run web:e2e:cross-browser` runs lightweight Firefox and WebKit
  compatibility checks.

Install Chromium with `npm run web:e2e:install`. Install all browser engines
with `npm run web:e2e:install:all`.

Set `WEB_E2E_EMAIL` and `WEB_E2E_PASSWORD` to a disposable account. Set
`WEB_E2E_BASE_URL` to test an already-running local or deployed application.
The anonymous cross-browser compatibility command does not require account
credentials.

Stateful tests create only collections prefixed with `Web E2E` and remove them
in cleanup. They never submit the account deletion form. OAuth consent, email
delivery, and password-reset links require provider-controlled test accounts
and are intentionally limited to local validation and error-state coverage.

The vocabulary/SRS smoke keeps its initial `Web E2E` prefix cleanup to recover
the fixed analysis word from older failed runs. Its own teardown deletes only
the exact UUID-named collection (original or renamed), using a fresh authenticated
browser context and an independent 60-second fixture budget. A closed/timed-out
test page no longer masks the primary failure with a cleanup navigation error.
The Start button must be enabled within the normal assertion timeout; a new word
scheduled incorrectly for tomorrow fails explicitly instead of waiting 180 seconds.

Fixture names retain all UUID digits without hyphens, leaving room for the rename
suffix within the 50-character form limit. Create/rename steps assert the actual
input value before submitting, so browser truncation cannot silently orphan a
collection. `smoke-collection.spec.ts` checks validation, UUID preservation and
the browser maxlength behavior without application requests or authentication.
Run just these contracts from the repository root (Chromium must already be installed):

```bash
npm run web:e2e:fixtures
```

`playwright.fixtures.config.ts` selects only `smoke-collection.spec.ts` and does
not import the authenticated configuration. It has no setup dependency, webServer,
base URL or env-file loading. The Chromium context is offline, service workers
are blocked and storage is empty. No `WEB_E2E_*` values are required or used by
this runner. Tests use in-memory HTML rather than a live application. This is
browser isolation, not a network sandbox for arbitrary Node.js test code.

The Quality workflow runs the same command in its parallel `web-fixtures` job
on PRs and main/develop pushes, without repository secrets. Dependency/browser
installation needs network access; the three test scenarios need none. The job
is configured in this change but has not yet run remotely. Repository branch
protection is not changed; making the new check mandatory is a separate setting.

The server-side initial-date migration
`20260906110000_make_new_words_immediately_reviewable.sql` was applied on
2026-09-06. The first subsequent hosted smoke exposed the fixture name-length
regression before reaching SRS; that test-only issue was corrected in PR #109.

The corrected local suite on `feature/fix-smoke-collection-name` passed against
production on 2026-09-06: 7/7 checks, including same-day first review, persisted
Easy progress and fixture cleanup. After PR #109 merged as `15b5c73`,
[GitHub production smoke](https://github.com/oldrefery/dutch-learning-app/actions/runs/34030539690)
also passed 7/7 in 41.6 seconds without retries. That run used a dedicated test
account and completed word deletion and exact-name collection cleanup.

## Session and review recovery

The extended Chromium suite includes `session-recovery.spec.ts` and
`review-recovery.spec.ts`. Both start with empty browser storage and sign in as
the configured dedicated account. They do not reuse or invalidate another
browser's saved session. Trace, video and screenshot recording are disabled
for these scenarios to keep session cookies and credentials out of artifacts.

- Session tests move the cookie's `expires_at` into the past, then exercise the
  real Supabase refresh through a private page and an authenticated `/login`
  redirect. Refresh-token rotation, cookie persistence and user continuity are
  checked. The signed access JWT is unchanged: this is not a test that waits
  for its actual provider-issued expiry.
- An invalid refresh token must clear auth cookies and redirect to login with
  the original path/query; signing back in must return to that destination.
- Review tests disconnect Chromium before a write, or execute the real server
  action and drop its successful HTTP response. A second tab reads persisted
  progress before/after retry. The retry payload must remain identical and a
  single Easy assessment must produce exactly one repetition, including after
  reload. The lost-response scenario does not mock a successful server result.

The account must allow collection creation and have at least one unimported
starter-pack word. Fixtures import one available word without AI calls, then
remove only their own UUID-named `Web E2E recovery` collection through the UI.
No service-role key, account deletion, provider setting or schema change is
needed. These tests cover an in-memory retry while the review tab stays open,
not a durable offline queue across reloads, real device connectivity, concurrent
auth refresh, or a remotely revoked session.
