# Settings native QA — 2026-09-06

## Build and isolation

- Fresh local Android release APK, Hermes, version 2.2.1 (82), from the mobile
  code merged in PR #111. No Metro server, EAS build, submission, or OTA publish.
- QA configuration disables the native updater, so an OTA cannot replace the
  tested bundle. The APK uses a local debug signing key, not store credentials.
- APK SHA-256: `871d497433a06ec8b02ac78f6b0808c3b41fb6dcbfe92d36d5dec93db6774e69`.
- Dedicated Android API 36 emulator `emulator-5584`; allowlisted account
  `test.dutch.a.p.p@gmail.com`. No testing against the protected account.
- Public backend: `https://josxavjbcjbcjgulwcyy.supabase.co`.
- Build environment excluded test passwords, Expo tokens, and Sentry upload
  credentials. Sourcemap upload was disabled.

## Observed results

- Login and initial sync succeeded. Settings displayed `Up to date` and a real
  completion time instead of `Never`.
- Manual sync updated the stored timestamp to `2026-09-06T14:39:42.472Z`.
- After network disablement and a process restart, Settings still displayed
  the previous successful sync time and the local data remained available.
- An offline manual retry left the displayed successful sync time unchanged.
  A concurrent direct metadata read hit a SQLite lock; it was not treated as
  an application error or used as evidence of a new timestamp.
- Restoring networking triggered automatic synchronization; the stored timestamp
  advanced to `2026-09-06T14:43:38.493Z`.
- With Settings left open and no manual sync or navigation, the next periodic
  sync changed the displayed time from 16:47 to 16:52 (local time). The stored
  completion timestamp was `2026-09-06T14:52:08.243Z`.
- All three Settings links opened their intended public pages in Chrome:
  Privacy Policy, Terms and Conditions, and the HTTPS Apple standard EULA.
- With Chrome temporarily disabled, each link displayed
  `Could not open link. Please try again.` and kept the app on Settings.
- Light and dark Settings rendered. The dark-theme `Up to date` badge has low
  visual contrast in the tested APK. A subsequent source fix uses the opaque
  `darkModeChipText` token instead of the translucent `darkModeChip` background
  token. A rendered-screen regression test failed before the fix and passes
  afterward; that follow-up color change is not part of the APK tested above.
- UI counts remained 9 active words, 9 collections, 0 progress, and no pending
  items. Raw local counts were 107 words, 0 progress, 0 learning commands, and
  0 review events. No intentional vocabulary or learning-progress writes.

## Runtime hook verification

- `.husky/_/pre-commit` was invoked directly from a Node 20.19.5 `PATH`, without
  creating a commit or staging files. It selected Node 24.20.0 and passed both
  mobile (109 suites, 1276 tests, 18 snapshots) and web (46 suites, 319 tests).
- Ten isolated regression cases cover runtime selection, fail-fast validation,
  a missing version file, and tool ordering without actual Git mutations.
- ESLint, test type checking, formatting of changed files, and diff checks passed.

## Limits

Cleanup completed: airplane mode is off, Chrome is enabled, the original light
theme is restored, the QA application was uninstalled, and the dedicated emulator
was stopped. Only the local test installation/session was removed; the remote
test account and its data were not deleted. The APK remains available locally
for reinstallation.

This is Android emulator QA, not iOS or physical-device validation. Store signing,
delivery, production OTA, Sentry delivery, and remote account deletion were not
part of this run. The existing version/build number was retained for the local
QA artifact; this APK is not intended for store upload.
