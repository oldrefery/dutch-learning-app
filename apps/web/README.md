# De Woordenaar Web

Next.js App Router application for `woordenaar.app`.

## Commands

Run commands from the repository root:

```bash
npm run web:dev
npm run web:build
npm run web:lint
npm run web:typecheck
```

The visual product UI is intentionally deferred until the approved design is
available. Backend contracts are consumed through workspace packages; the web
application must not import implementation files from the Expo application.

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
