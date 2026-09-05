# Web end-to-end tests

The Playwright suite uses only a dedicated test account. A preflight runs before
the browser starts, and the runtime credential guard repeats the check. Both
reject `oldrefery@gmail.com`, including Gmail aliases.

## Suites

- `npm run web:test:coverage` runs the dedicated web Jest suite and enforces
  its coverage floor.
- `npm run web:e2e:smoke` runs the short Chromium production smoke suite.
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
