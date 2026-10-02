# D10 cross-client session revocation review

Starting source/HEAD `6ca149f`, user-selected Astra / High, AUTH-17/18/19.
Application source unchanged (137 fingerprints). This is a reproduced review
finding, not an implemented repair or an assertion that D10 introduced the defect.

## R3 / P1 — Revoked web session cannot reach sign-in

Trigger: primary is authenticated in desktop web and Android. Android's normal
account switch calls `supabase.auth.signOut()` with the SDK default global scope.
The existing web session is revoked while its asymmetrically signed JWT remains
unexpired. Reloading the web shared-collection route enters a redirect loop.

Actual loopback evidence, preserved before clearing this task browser's cookies:

- `GET /app/collections` -> 307 `/login`.
- `GET /login` -> 307 `/app/collections`.
- Browser reports `net::ERR_TOO_MANY_REDIRECTS`.
- Installed SDK `getClaims(savedAccessToken)` accepts verified, unexpired claims.
- The same SDK/client/token `getUser(savedAccessToken)` rejects the session:
  status 400, `Auth session missing!`.
- A fresh synthetic login works after clearing only this QA browser's cookies.

`apps/web/src/lib/supabase/proxy.ts` trusts `getClaims()` for its authenticated
boolean. `apps/web/src/proxy.ts` redirects authenticated login requests to
collections. The protected-page guard in `apps/web/src/lib/auth/session.ts`
requires `getUser()` and redirects the revoked session back to login. Their
contradictory decisions persist until token/cookie state changes. Protected server
access stays denied; this finding is availability, not demonstrated data exposure.

## Repair contract — GPT-6.1 Sol / High

Make proxy and protected-page decisions agree on the server-validated session.
Do not replace the page guard with claims-only authorization or weaken error
handling. Preserve SDK cookie rotation on the downstream request and response,
including redirect responses; preserve safe-next-path behavior and existing valid
session navigation. Handle revoked/missing/failed server user validation without a
login loop. Treat transient validation failures conservatively without destructive
account-data cleanup. Native global/local sign-out policy is not changed by this
repair contract.

Convert `apps/web/src/lib/supabase/revoked-session.review.test.ts` from the passing
counterexample into a safety regression. Cover valid signed claims plus rejected
server session, fresh valid session, missing/expired session, auth failure and
cookie rotation/deletion across redirects. Keep unrelated D10 app/SQL contracts
unchanged. Re-review on Astra / High before runtime acceptance.

The current-thread model picker is unavailable; obtain the manual Sol 6.1 / High
switch, never claim an automatic switch. Local commits are already authorized.
No hosted/production state, schema change, publication or deployment is needed.

## Verification and source basis

Four focused suites / 38 tests PASS, including two new review cases (counterexample
plus valid control). Test-inclusive TypeScript (`tsconfig.stryker.json`), strict
scoped web ESLint and formatting pass. Application repair remains pending.

Current SDK behavior checked with Context7 `/supabase/supabase-js`, resolving first:
[`getClaims`, `getUser` and default global `signOut` implementation](https://github.com/supabase/supabase-js/blob/master/packages/core/auth-js/src/GoTrueClient.ts).
The local SDK result, actual HTTP redirect edges and repository guards establish
the finding independently of documentation.

Private evidence (never commit credentials/cookies):
`reports/shared-dictionary-cefr/d10-catalog-20261002/` contains
`revoked-browser-session.private.json`, `session-review.json`, `review-session.mjs`,
`session-review-tests.log`, `web.log` and browser snapshots. Review cookie snapshot
is a revoked test session, still private; do not replay it into another account.
