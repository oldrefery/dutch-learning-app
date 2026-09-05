# Fixed-bundle mobile QA builds

Local native QA and E2E builds should test their embedded JavaScript bundle,
without checking for or installing OTA updates during a test run.

Set `WOORDENAAR_QA_BUILD=true` during native project generation **and** bundling.
The dynamic Expo config sets `updates.enabled=false`, disabling both native
startup checks and the `expo-updates` APIs. The existing Settings badge is hidden
when updates are disabled. This flag does not enable test authentication or
change accounts, application identifiers, runtime policy, or backend selection.

For a local build, run from the repository root in a scoped shell:

```bash
(
  export WOORDENAAR_QA_BUILD=true
  npm run mobile:prebuild -- --no-install
  npm run mobile:ios -- --configuration Release
)
```

For Android, replace the last command with:

```bash
npm run mobile:android -- --variant release
```

Select only the dedicated QA simulator/emulator when prompted. These commands
regenerate local native configuration, build and install the app; they are not
diagnostic-only commands. With an existing native project, rerun prebuild with
the flag before building. Setting the flag only at app launch cannot change an
already installed binary. If using Xcode or Gradle directly, keep the same flag
in the build environment after prebuild.

The `e2e-test` EAS profile supplies this flag explicitly, alongside its existing
`EXPO_PUBLIC_E2E_TEST_MODE` setting. Local QA does not need that public E2E flag.
Do not store the QA flag in shared `.env` files or production environments.

Without the flag, the original OTA configuration is preserved. A QA flag combined
with `EAS_BUILD_PROFILE=preview` or `production` fails config evaluation rather
than silently disabling release updates. For direct native OTA testing, unset
the QA flag and regenerate native configuration with an explicitly configured
test channel. `eas.json` channels alone are not injected by Xcode or Gradle.
Use the preview EAS profile for a deliberate OTA delivery check, subject to the
repository's identity checks and explicit build/publication authorization.

Do not reuse QA-generated native configuration or QA artifacts for distribution.
Regenerate and rebuild through the normal release workflow. Changing only the
Settings label would not disable the native updater and is not an alternative.

References: [Expo app config](https://docs.expo.dev/versions/latest/config/app/#enabled-1)
and [EAS Update without EAS Build](https://docs.expo.dev/eas-update/standalone-service/).

## Verification

`appConfigOta.test.ts` evaluates the real dynamic config in an isolated Node process
and runs the installed Expo iOS/Android update config plugins in memory. It checks
the QA flag, E2E profile, default behavior, and preview/production safeguards.
The update-status hook also has a release-mode regression test proving disabled
OTA does not invoke check, fetch, or reload APIs.

The implementation pass ran all 86 mobile test suites: 1,074 tests and 16 snapshots
passed. Both mobile typechecks and lint passed. No native project was regenerated
and no installed app was replaced in this pass; the existing QA simulator binary
still needs a rebuild before this policy takes effect. No OTA was published or
installed, and no remote EAS operation was run.

The subsequent iOS device pass rebuilt and installed the QA variant successfully,
then verified persisted login and the absence of update-check errors across a
simulator reboot. See the final section of
[the native QA report](native-qa-2026-09-05.md). Android runtime verification of
this variant remains separate.
