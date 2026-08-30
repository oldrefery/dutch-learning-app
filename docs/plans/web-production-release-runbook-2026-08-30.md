# De Woordenaar Web Production Release Runbook

**Date:** 2026-08-30  
**Status:** Production deployment ready; custom domain not attached
**Production origin:** `https://woordenaar.app`  
**Vercel project:** `woordenaar-web`  
**Supabase project:** `Dutch Learning App` (`josxavjbcjbcjgulwcyy`)

**Current preview:**
`https://woordenaar-a16jox07y-rustems-projects.vercel.app`

**Preview deployment ID:** `dpl_D6nSYuBopmkvMZgGd6g5YfbtT75g`

**Current production deployment:**
`https://woordenaar-dap4bjiga-rustems-projects.vercel.app`

**Production alias:** `https://woordenaar-web.vercel.app`

**Production deployment ID:** `dpl_7S7q2GYsGiTiZLdCxbc8Eio1kwWZ`

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
- `.vercelignore` excludes local Next.js, native, dependency, coverage, and
  release artifacts from CLI deployment uploads.

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

Current audit result:

- Preview has both required Supabase public variables.
- Preview intentionally has no `NEXT_PUBLIC_SITE_URL`.
- Production has `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and
  `NEXT_PUBLIC_SITE_URL=https://woordenaar.app`, all scoped only to Production
  and stored as Config values.
- Vercel project ownership is `rustems-projects` and the authenticated CLI user
  is `oldrefery`.

The Production values were configured without creating or promoting a
production deployment. No domain or DNS setting changed during this step.

Never add a Supabase service-role key, provider client secret, Sentry auth
token, or other server administration credential to a `NEXT_PUBLIC_*`
variable.

## 4. Supabase Auth URL configuration

This Supabase project is shared with the mobile app. Keep Site URL as
`dutchlearning://`; changing it to the web origin would change fallback and
email-template behavior for the mobile client. The web application always
supplies an explicit trusted `redirectTo` origin.

Current allow-list audit result:

- `dutchlearning://**` and the existing mobile/development URLs are present;
- `http://localhost:3000/**` is present;
- `https://*-rustems-projects.vercel.app/**` is present and covers the current
  preview;
- `https://woordenaar.app/auth/callback` is present;
- `https://woordenaar.app/auth/confirm` is present.

Before production promotion, verify signup confirmation, password recovery,
Google OAuth, and Apple OAuth separately. Do not delete mobile URLs from this
shared allow list. A future cleanup may replace the team-wide Vercel wildcard
with a narrower project pattern only after confirming that no active preview
flow depends on it.

## 5. OAuth providers

### Google

- Keep the provider callback at the Supabase callback URL:
  `https://josxavjbcjbcjgulwcyy.supabase.co/auth/v1/callback`.
- Current Supabase audit: the provider is enabled, Client IDs are configured,
  and the displayed callback matches the project callback above.
- Verify the Google OAuth consent screen and production status.
- Test both a new account and an existing linked account from
  `https://woordenaar.app/login`.

### Apple

- Use a web Service ID associated with the app's Apple developer team.
- Register `woordenaar.app` as a verified web domain.
- Use the same Supabase provider callback URL as the Apple return URL.
- Current Supabase audit: the provider is enabled, Client IDs are configured,
  and the displayed callback matches the project callback above.
- Verify private-email relay behavior and an existing Apple-linked account.

The dashboard keeps saved provider secrets masked. They were not revealed or
changed during this audit. Google consent-screen state, Apple Service ID domain
verification, Apple secret expiry, and end-to-end provider redirects therefore
remain functional release checks.

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
7. Reconfirm that the existing production redirect URLs remain in the Supabase
   allow list without changing the mobile Site URL.
8. Promote the verified deployment or deploy the approved release commit.

Do not switch DNS before the preview, OAuth configuration, and rollback target
are all verified.

Current Git integration audit result:

- provider: GitHub;
- repository: `oldrefery/dutch-learning-app`;
- Vercel production branch: `main`;
- project Root Directory: `apps/web`;
- framework preset: Next.js;
- the preview deployment completed with state `READY` and no production target.

Current domain audit result:

- `woordenaar.app` is owned by `rustems-projects`, registered through Vercel,
  and uses the intended Vercel nameservers;
- the apex and wildcard DNS records already resolve through Vercel-managed
  ALIAS records;
- `woordenaar.app` is not yet attached to `woordenaar-web`;
- the project has a `READY` Production deployment and the standard
  `woordenaar-web.vercel.app` production alias;
- no DNS record, project-domain assignment, or production alias changed during
  this audit.

Production deployment result on 2026-08-30:

- release commit: `2f7bf66`;
- target: Production;
- Next.js 16.3.3 production build completed successfully;
- TypeScript checking completed successfully;
- all 21 application routes were generated;
- Vercel assigned the standard `woordenaar-web.vercel.app` alias;
- `woordenaar.app` remained unattached and no DNS record changed.

Preview smoke result on 2026-08-30:

- email/password authentication reached the protected application successfully;
- the authenticated header showed the current email and access level on every
  checked page;
- Collections, collection detail, word detail, Review, Audio Review, Insights,
  History, Settings, Starter Pack, and Batch Capture loaded against the shared
  Supabase backend;
- Review started and displayed a due card without submitting an answer or
  changing SRS state;
- dark theme applied correctly and the preference was returned to System;
- account-deletion confirmation opened and was cancelled without submitting;
- all checked routes fit a 390 px viewport without horizontal overflow;
- no browser console warnings or errors were captured during the checked flow.

This was intentionally a non-destructive smoke test. Data mutations,
cross-client synchronization, OAuth providers, password recovery, keyboard and
screen-reader coverage, response credential inspection, and production-domain
behavior remain release gates.

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
