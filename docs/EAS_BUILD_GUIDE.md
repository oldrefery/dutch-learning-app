# EAS Build And Internal Submission Guide

This guide keeps version preparation, native builds, store upload, and public
promotion as separate gated operations. The scripts never create Git commits,
push branches or tags, or promote a release publicly.

## Production Configuration

- Expo version source: local.
- Runtime version policy: fingerprint.
- Production channel and environment: `production`.
- iOS artifact: signed device `.ipa`.
- Android artifact: signed `.aab`.
- Android submit target: internal track with draft status.
- Sentry native release format: `<bundle-id>@<version>+<build>`.
- Sentry dist: the native build number from the exact build context.

## Prerequisites

- The release-readiness and onboarding gates are complete.
- CI, linked Supabase lint, production Sentry triage, and device smoke checks
  pass.
- The intended build number is confirmed as unused in both App Store Connect
  and Google Play Console.
- EAS and store credentials are configured.
- A valid local `.sentryclirc` is available for local build-time source-map
  upload.
- The branch is pushed and the worktree is clean before building.

## 1. Prepare The Version

Preview the mutation first:

```bash
node scripts/prepare-release.js --version 2.0.0 --build 79
```

Apply only after build `79` is confirmed as unused:

```bash
node scripts/prepare-release.js --version 2.0.0 --build 79 --apply
```

The command updates `app.base.json`, `package.json`, and `package-lock.json`.
It does not commit. Review the diff, run the quality gate, and create the
Conventional Commit yourself.

## 2. Build Without Submission

The build command refuses a dirty worktree, version disagreement, mismatched
iOS/Android build numbers, a different confirmed build number, or a runtime
policy other than fingerprint.

```bash
scripts/build-release.sh \
  --platform both \
  --confirmed-build-number 79 \
  --dry-run

scripts/build-release.sh \
  --platform both \
  --confirmed-build-number 79
```

Artifacts and metadata are written under `builds/`. The canonical record is
`builds/build-context.json`, which contains the version, platform build
numbers, bundle identifiers, commit SHA, creation time, runtime policy, built
platforms, and exact artifact paths.

The build command does not use `EAS_SKIP_AUTO_FINGERPRINT`, submit to a store,
or upload an OTA update. If Sentry auto-upload is intentionally disabled for a
diagnostic build, the script runs the manual source-map uploader with enforced
build context before reporting success.

## 3. Inspect The Candidate

Before store upload:

1. Verify both artifact files and their checksums.
2. Confirm `builds/build-context.json` points to the current commit.
3. Install the iOS candidate through the approved internal path and the Android
   candidate on a test device.
4. Run authentication, upgrade, sync, Review, Insights, Difficult Review,
   Audio Review, starter-pack import, batch capture, and onboarding smoke tests.
5. Confirm Sentry release, dist, debug IDs, and source maps for the exact build.
6. Stop if the candidate produces a new P0/P1 issue, data loss, auth regression,
   sync corruption, or crash-loop behavior.

## 4. Submit To Internal Tracks

Submission is a separate external action and requires separate authorization.
Preview first:

```bash
scripts/submit-release.sh --platform both --dry-run
```

Submit the exact recorded artifacts:

```bash
scripts/submit-release.sh --platform both
```

The script validates the app version, both build numbers, current commit, built
platform flags, and artifact paths against `builds/build-context.json`. It uses
the `production` submit profile from `eas.json`.

Submission uploads to App Store Connect/TestFlight and the Google Play internal
draft track. It does not release publicly.

## 5. Public Promotion

Wait for processing and internal validation. Public promotion requires a later
explicit release gate:

- complete store compliance and privacy declarations;
- attach approved release notes and screenshots;
- choose the approved iOS phased-release and Android rollout settings;
- verify the reviewed artifacts are the exact submitted builds;
- create and push the release tag only after the shipped artifacts are known;
- start the monitoring checklist in the release-readiness plan.

## Supporting Commands

```bash
# Validate aligned current versions without mutation.
node scripts/prepare-release.js --check

# Upload native source maps manually only for a build context that disabled
# automatic upload.
SENTRY_ENFORCE_BUILD_CONTEXT=true \
  scripts/upload-sourcemaps.sh --platform both

# Publish a production OTA update only under the separate OTA release process.
npm run update:production -- --message "Describe the update"
```

An OTA update is not a substitute for a native build when runtime fingerprint
or native capability changes require a new binary.
