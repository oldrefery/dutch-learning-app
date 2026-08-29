# Release Readiness Baseline: 2.0.0

Date: 2026-08-29
Branch: `feature/memorila-learning-roadmap`
Baseline release: `com.oldrefery.dutch-learning-app@1.13.0+78`
Sentry query: unresolved production issues from the last 14 days

## Production Error Triage

No user-entered vocabulary, account identifier, email address, IP address, or
location is copied into this document.

| Issue                   | Level   | Count / users | First / last seen (UTC)             | Decision                                                                                                                                                                                  |
| ----------------------- | ------- | ------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DUTCH-LEARNING-APP-43` | error   | 4 / 1         | 2026-08-17 09:59 / 2026-08-19 06:40 | Fixed after build 78 by `ff666e5`; semantic-key collisions during re-analysis preserve the existing key. Covered by repository regression tests.                                          |
| `DUTCH-LEARNING-APP-44` | error   | 1 / 1         | 2026-08-17 09:59 / 2026-08-17 09:59 | Same pre-fix re-analysis path as issue 43; the current implementation updates the existing row instead of inserting the same `word_id`. Covered by repository and store regression tests. |
| `DUTCH-LEARNING-APP-45` | error   | 1 / 1         | 2026-08-25 21:51 / 2026-08-25 21:51 | Fixed after build 78 by `ff666e5`; `PGRST303` future-JWT responses trigger one session refresh and one retry. Covered by service regression tests.                                        |
| `DUTCH-LEARNING-APP-46` | warning | 1 / 1         | 2026-08-25 21:51 / 2026-08-25 21:51 | Wrapper symptom of issue 45 from the same operation and timestamp. The initialization action now defaults safely without producing a second exception.                                    |

The issues remain unresolved in Sentry because the fixes have not yet shipped in
a native candidate. They are not current-branch release blockers after the
targeted regression suite passed. Candidate testing must exercise session
refresh and word re-analysis before they are resolved in Sentry.

## Linked Supabase Baseline

- Added and applied
  `20260829120000_fix_sync_user_access_levels_return_type.sql`.
- Dry-run identified exactly that one pending migration.
- Local and remote migration history match through `20260829120000`.
- Linked `supabase db lint --linked` result: `No schema errors found`.
- The migration explicitly casts `auth.users.email` from `varchar(255)` to the
  function's declared `TEXT` return type.

## Native Capability Baseline

- Audio Review is playback-only and explicitly configures foreground playback.
- The Expo Audio plugin disables microphone permission, Android recording,
  background recording, and background playback.
- iOS introspection reports an empty `UIBackgroundModes` array and no microphone
  usage description.
- Android introspection removes `RECORD_AUDIO` and
  `FOREGROUND_SERVICE_MEDIA_PLAYBACK`; no Expo Audio service is present.
- `MODIFY_AUDIO_SETTINGS` remains because it supports playback and routing.

## Release Tooling Baseline

- `scripts/prepare-release.js` validates and aligns all version sources; it is a
  dry run unless `--apply` is supplied.
- `scripts/build-release.sh` is build-only, requires a clean worktree and an
  explicitly confirmed build number, preserves runtime fingerprint generation,
  and writes an exact build context.
- `scripts/submit-release.sh` submits only artifacts recorded for the current
  version, build, and commit.
- `scripts/build-and-submit.sh` remains only as a build-only compatibility
  wrapper.
- No release script commits, pushes, tags, submits, or publishes implicitly.

## Dependency Baseline

- Aligned Expo SDK 55 packages to the current compatible patch set, including
  Expo `55.0.30`, React Native `0.83.10`, Expo Audio `55.0.18`, Expo Updates
  `55.0.30`, and Jest Expo `55.0.22`.
- Added the required Expo Asset config plugin for the dynamic app config.
- Expo Doctor passes all 20 checks.
- A normal `npm audit fix` removed all high-severity findings through compatible
  transitive patch updates to `brace-expansion` and `js-yaml`.
- Npm still expands one build-tool advisory chain (`xcode` through `uuid`) into
  12 moderate findings. It is not present in shipped application logic, and
  npm's only automatic remediation requires an incompatible Expo 55 to Expo 46
  downgrade. `npm audit fix --force` is therefore intentionally not used; track
  the upstream Expo config-plugin dependency instead.

## Remaining Candidate Checks

- Verify privacy declarations against the generated binaries.
- During the release-candidate package, confirm the next unused native build
  number in both stores before applying the version bump.
- Perform the upgrade and contextual-onboarding validation defined in
  `docs/plans/release-readiness-onboarding-2026-08-29.md`.
