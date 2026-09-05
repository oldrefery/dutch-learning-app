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
