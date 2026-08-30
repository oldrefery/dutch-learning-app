# De Woordenaar Web Production Release Runbook

**Date:** 2026-08-30  
**Status:** Ready for external configuration  
**Production origin:** `https://woordenaar.app`  
**Vercel project:** `woordenaar-web`  
**Supabase project:** `Dutch Learning App` (`josxavjbcjbcjgulwcyy`)

## 1. Release scope

Release the existing online-first Next.js application against the shared
Supabase backend. Offline queues, service workers, installable PWA behavior,
and web Sentry instrumentation are not part of this release unless separately
approved.

The visual redesign remains a separate design-handoff task. Do not describe the
current neutral interface as final brand design.

## 2. Local baseline completed

- Next.js production build is part of repository CI.
- Mobile, shared-domain, Supabase-contract, and web TypeScript checks are part
  of CI.
- Global response headers prevent MIME sniffing and framing, restrict unused
  browser permissions, reduce referrer leakage, and enable HTTPS transport
  persistence.
- The Next.js implementation header is disabled.
- Protected application, authentication, and shared-token pages are `noindex`.
- `robots.txt` disallows private routes and references a root-only sitemap.
- Authentication callback origins come from configured deployment state, not
  user-controlled request headers.

Content Security Policy is intentionally deferred. The current application has
an inline pre-hydration theme script and several required remote services; add
CSP only with a nonce-based design and a verified Supabase, image, and
observability allow list.

## 3. Vercel environment

Configure these values for the `woordenaar-web` project:

| Variable                               | Production                 | Preview                                          | Development             |
| -------------------------------------- | -------------------------- | ------------------------------------------------ | ----------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Production project URL     | Same project until a preview backend is approved | Local `.env.local`      |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Production publishable key | Same project until a preview backend is approved | Local `.env.local`      |
| `NEXT_PUBLIC_SITE_URL`                 | `https://woordenaar.app`   | Leave unset so `VERCEL_URL` is used              | `http://localhost:3000` |

Never add a Supabase service-role key, provider client secret, Sentry auth
token, or other server administration credential to a `NEXT_PUBLIC_*`
variable.

## 4. Supabase Auth URL configuration

In Authentication URL Configuration:

1. Set Site URL to `https://woordenaar.app` only when the production domain is
   ready to receive auth redirects.
2. Add exact production redirect URL:
   `https://woordenaar.app/auth/callback`.
3. Keep local callback URL while local testing is required:
   `http://localhost:3000/auth/callback`.
4. Add a narrowly scoped Vercel preview wildcard matching only this project and
   team, for example:
   `https://woordenaar-*-rustems-projects.vercel.app/auth/callback`.
5. Verify signup confirmation, password recovery, Google OAuth, and Apple OAuth
   separately after saving the allow list.

Do not use a broad `https://*.vercel.app/**` rule. Remove obsolete preview URLs
and wildcards after the release is stable.

## 5. OAuth providers

### Google

- Keep the provider callback at the Supabase callback URL:
  `https://josxavjbcjbcjgulwcyy.supabase.co/auth/v1/callback`.
- Verify the Google OAuth consent screen and production status.
- Test both a new account and an existing linked account from
  `https://woordenaar.app/login`.

### Apple

- Use a web Service ID associated with the app's Apple developer team.
- Register `woordenaar.app` as a verified web domain.
- Use the same Supabase provider callback URL as the Apple return URL.
- Verify private-email relay behavior and an existing Apple-linked account.

Provider secrets belong in Supabase provider configuration, never in the web
repository or browser environment.

## 6. Domain and deployment gate

External changes require explicit release authorization:

1. Confirm the GitHub integration points to the intended repository and branch.
2. Produce a Vercel preview from the release commit.
3. Run the preview smoke checklist below.
4. Attach `woordenaar.app` to `woordenaar-web`.
5. Apply the required DNS records at the domain provider.
6. Wait for Vercel TLS issuance and verify HTTPS without certificate warnings.
7. Update Supabase Site URL and the exact production redirect URL.
8. Promote the verified deployment or deploy the approved release commit.

Do not switch DNS before the preview, OAuth configuration, and rollback target
are all verified.

## 7. Required smoke tests

Use a non-critical test account. Never submit account deletion during a general
smoke test.

- Public root, `robots.txt`, and `sitemap.xml` load over HTTPS.
- Email/password sign-in and sign-out work.
- Signup confirmation returns to the intended safe internal path.
- Password recovery completes and invalidates the local session afterward.
- Google and Apple OAuth return to the correct domain.
- Current user identity is visible in the authenticated header.
- Collections list/detail, add word, image selection, and reanalysis work.
- Review writes SRS state and creates review history visible on mobile.
- Starter pack, Batch Capture, sharing, and shared import work.
- Insights, History, Settings, theme persistence, and build information work.
- Account-deletion confirmation can be opened and cancelled; destructive
  submission is tested only with a disposable account and explicit approval.
- Light, dark, desktop, tablet, and 390 px layouts have no blocking issues.
- Keyboard navigation reaches authentication, primary navigation, forms, and
  review controls with visible focus.
- Browser console has no unhandled errors and responses include the expected
  security headers.
- No service-role key, provider secret, or Sentry auth token appears in browser
  assets or network responses.

## 8. Monitoring and stop conditions

Before public promotion, choose and configure web error monitoring. The current
`NEXT_PUBLIC_SENTRY_DSN` placeholder does not by itself initialize Sentry in the
Next.js application.

Stop or roll back when any of the following occurs:

- auth callbacks loop, leave users unauthenticated, or land on another domain;
- RLS or access-level checks expose another user's data;
- create, review, import, or delete mutations fail consistently;
- Edge Function quota or authorization errors regress for normal users;
- browser assets contain a private credential;
- error rate materially increases after promotion;
- DNS or TLS behavior is inconsistent across the apex domain.

## 9. Rollback

1. Keep the last verified Vercel deployment available before promotion.
2. Roll back the production alias to that deployment if an application defect
   appears.
3. If the failure is limited to OAuth, restore the last working Supabase Site
   URL and redirect allow list while keeping password auth available.
4. If DNS is the cause, restore the previous provider records and wait for TTL
   propagation.
5. Do not roll back database migrations destructively. Forward-fix shared
   schema or RLS problems with a reviewed migration.
6. Record the failed deployment URL, commit SHA, observed symptoms, and rollback
   time before resuming release work.
