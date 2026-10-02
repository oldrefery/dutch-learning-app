# D10 revoked-session redirect repair

Starting HEAD `ad89c5e` on `feature/shared-dictionary-schema`. User confirmed the
requested GPT-6.1 Sol / High switch; the thread has no verified model picker.
AUTH-17/18/19 remain scoped. This checkpoint repairs R3 from the
[review](D10-session-revocation-review-20261002.md); it does not close D10.3-D10.5.

## Result

The Proxy now calls `getUser()` before redirecting a request away from `/login`,
`/signup`, or `/forgot-password`. A signed but revoked JWT therefore reaches the
sign-in page after the protected page's server guard rejects it. A valid live
session still redirects to collections. A missing user, returned auth error, or
thrown validation error leaves the auth page reachable. SDK cookie rotation and
deletion remain attached to the downstream request and browser response, including
redirect responses. No explicit destructive cookie/account cleanup was added.

Protected routes retain the existing optimistic `getClaims()` Proxy check. Their
server page guard still requires `getUser()` before returning protected data. The
server validation is therefore added only where a false authenticated decision
caused the loop, without an extra auth-server call on each protected navigation.
The mobile sign-out policy, database, schema, RPCs, source content, and feature
flags are unchanged.

## Verification

- Before the fix, the converted safety test failed with `/login` returning 307
  instead of 200, and the cookie propagation cases failed. The valid-session
  control passed.
- After the fix, four focused web suites / 45 tests pass, including revoked
  protected-to-login navigation, valid sessions, missing/error/throw cases,
  signup/recovery routes, rotated cookie chunks, and cookie deletions.
- Test-inclusive web TypeScript, strict scoped ESLint, Prettier, and `git diff
--check` pass. The 137 prior source fingerprints remain intact; three changed
  paths were added to [D10-source-sha256.json](D10-source-sha256.json) (140 total).
- Source and evidence commit `976d1e7` passed normal hooks: 156 mobile suites /
  1796 tests / 22 snapshots; 86 web suites / 778 tests, with one existing skipped
  suite/test. All 140 fingerprints match after hook formatting. Private hook output:
  `reports/shared-dictionary-cefr/d10-r3-repair-20261002/commit.log`.

No backend, browser, simulator, emulator, or hosted resource was started for this
repair. The last exact task-resource shutdown verification is recorded in the
[handoff](../handoff.md). `.playwright-cli/` and private reports are retained.

## Next

Re-review this repair on GPT-6 Astra / High, checking auth-route validation,
transient failures, cookie forwarding, and protected-page authority. Then finish
only the remaining D10 cached official read_only/offline runtime and mobile Safari
acceptance. Do not repeat completed imports, reset fixtures, or begin D11.
