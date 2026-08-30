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
