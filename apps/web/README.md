# De Woordenaar Web

Next.js App Router application for `woordenaar.app`.

## Commands

Run commands from the repository root:

```bash
npm run web:dev
npm run web:build
npm run web:lint
npm run web:typecheck
npm run web:e2e:install
npm run web:e2e
```

Backend contracts are consumed through workspace packages; the web application
must not import implementation files from the Expo application.

## Browser E2E tests

The Playwright suite covers password authentication, collection and word CRUD,
analysis history, global search, and the first successful SRS transition. It
uses only collections whose names start with `Web E2E` and removes those test
collections after each run.

Provide a dedicated full-access test account without committing credentials:

```bash
export WEB_E2E_EMAIL=test-user@example.com
export WEB_E2E_PASSWORD=replace-me
npm run web:e2e
```

`oldrefery@gmail.com` and its Gmail aliases are rejected unconditionally. To
test an already deployed environment, also set `WEB_E2E_BASE_URL`; otherwise
Playwright starts the local Next.js app on `http://127.0.0.1:3100` using
`apps/web/.env.local`.

The `Web E2E smoke` GitHub Actions workflow runs daily and on manual dispatch
against `https://woordenaar.app`. It reuses the dedicated
`MAESTRO_TEST_EMAIL` and `MAESTRO_TEST_PASSWORD` repository secrets; that
account must retain full access.

## Authentication environment

Copy `.env.example` to `.env.local` and provide the public Supabase values.
Authentication uses Supabase SSR cookies. Configure localhost, Vercel preview,
and the production `https://woordenaar.app/auth/callback` URL in the Supabase
Auth redirect allow list before testing OAuth or password recovery.

Set `NEXT_PUBLIC_SITE_URL=https://woordenaar.app` only for the Vercel production
environment. Preview deployments intentionally use Vercel's runtime
`VERCEL_URL`, while local development falls back to `http://localhost:3000`.
This keeps authentication redirects on a trusted deployment origin instead of
deriving them from incoming request headers.

## Production baseline

The web workspace applies global MIME-sniffing, clickjacking, referrer,
permissions, and transport-security headers. Protected application, auth, and
shared-import routes are marked `noindex`; only the public root URL appears in
the sitemap.

Use `docs/plans/web-production-release-runbook-2026-08-30.md` for the remaining
Vercel, Supabase Auth, OAuth, domain, monitoring, smoke-test, and rollback gates.
