# Mobile Releases: Cloud First

Run repository scripts and npm commands from the repository root. The Expo/EAS
project is `apps/mobile`, not the root and not `apps/web`. Install dependencies
once at the root with `npm ci` using the pinned Node 24 / npm 11 toolchain.

## Before Any Remote EAS Operation

The effective account must be `oldrefery` and the linked project must be
`@oldrefery/dutch-learning-app`. A token overrides interactive authentication;
`guardia`, another project, a robot identity, and ambiguous output must stop the
operation. Never switch accounts automatically.

The shared guard performs `account:view` before `project:info`. Local build,
local submission, and production OTA scripts call it automatically. For direct
CLI usage, run the operation only after `verify_eas_identity` succeeds, as below.

## Version And Readiness Gate

- Confirm the intended version and unused build numbers in both stores.
- `node scripts/prepare-release.js --check` validates existing versions.
- To bump them, pass `--version VERSION --build BUILD` to preview, then repeat
  with `--apply` after approval. This updates `apps/mobile/app.base.json`, the
  root/mobile manifests and the root lockfile; it does not commit.
- Run the quality gate and review the diff before committing/pushing yourself.
- Build from the approved clean commit. Keep iOS and Android numbers aligned
  and `runtimeVersion.policy` set to `fingerprint`.
- Configure signing/store credentials and `SENTRY_AUTH_TOKEN` in the EAS
  production environment. Do not disable source-map auto-upload for a release.
- An Expo SDK/native dependency change needs new binaries; an OTA cannot
  upgrade the native runtime. SDK 57 development also needs a rebuilt client.

## Recommended: Cloud Build And Internal Submission

After explicit build and submission approval, from the repository root:

```bash
node scripts/prepare-release.js --check --require-clean
bash -c 'source scripts/verify-eas-identity.sh; verify_eas_identity && cd apps/mobile && npx -y eas-cli@latest build --platform all --profile production --auto-submit'
```

The command uses build quota, builds on EAS workers, and queues the configured
internal submissions: App Store Connect/TestFlight and Google Play internal
draft. It does **not** release publicly. To build without submission, omit
`--auto-submit`. Do not resubmit a build already queued by auto-submit.

Record the build and submission IDs. For every status/read operation, verify
identity first as above. A successful build is not proof of successful store
submission: check each separately, including TestFlight processing and Android
track/status. Check each build's logs for successful Sentry source-map upload.

## Optional: Local Build And Separate Submission

Local iOS builds additionally require Xcode 26.4 or newer. The local wrappers
require a valid root `.sentryclirc`; this is not a cloud credential store.

- `scripts/build-release.sh --help` describes build-only options. Supply the
  confirmed unused build number with `--confirmed-build-number`; use `--dry-run`
  first. The platform values are `ios`, `android`, `both` (EAS CLI uses `all`).
- Artifacts and their exact commit/version metadata go in `builds/`, with
  `builds/build-context.json` as the canonical local record.
- `scripts/submit-release.sh --platform both --dry-run` validates that record.
  Remove `--dry-run` only after approving submission of those exact artifacts.
- `scripts/build-and-submit.sh` is deprecated. Despite its old name it only
  delegates to the local build command; it never submits.
- Do not use a local build context to submit or repair an unrelated cloud build.

### Native Source Maps: Avoid The Old Re-export Workflow

Prefer native build-time upload for both local and cloud builds. The historical
combination `SENTRY_DISABLE_AUTO_UPLOAD=true` plus `upload-sourcemaps.sh
--platform ...` re-exports a bundle locally. Matching version, build number and
commit does **not** prove that this regenerated bundle matches the installed
binary's bundle/debug IDs. This is not a verified repair workflow for a release.
The legacy native uploader and the local build fallback still exist for
compatibility; they must not be treated as evidence that release maps are valid.

If native upload fails, retain the original build's bundle/maps and investigate
its logs and debug IDs. Recover using those exact artifacts or create a fresh
approved build with auto-upload enabled. Never silently substitute an Expo
export from the current workstation.

## Compatible OTA Updates

An OTA is a separate production write and needs release approval. For compatible
JS/assets changes, from the repository root:

```bash
npm run update:production -- --message "Describe the update"
```

The script verifies the effective EAS identity, bundles/publishes with channel
and environment `production`, then uploads **that export's** `apps/mobile/dist`
source maps. Supported options are `--message`/`-m`, `--platform`/`-p` and
`--non-interactive`. Branch/channel/environment/output-directory overrides and
`--skip-bundler` are intentionally rejected. `--help` has no remote effects.

The OTA uploader currently requires a root `.sentryclirc`. Check that credential
before publication. If publication fails, maps are not uploaded. If publication
succeeds but map upload fails, the update is already live: retain `apps/mobile/dist`,
fix Sentry access, and retry **only**:

```bash
npm run sourcemaps:update
```

Do not rerun `eas update`, re-export, or overwrite `dist` before this retry.

## Internal Validation And Public Promotion

Use only approved QA accounts; never test with the application's `oldrefery`
account (the personal EAS owner above is a separate concern). Check login and
refresh, upgrade with existing data, offline review/reconnection, conflict
reconciliation, knowledge levels, collections, review modes, and audio.

Public promotion is a separate explicit gate after store processing and device
validation. Confirm privacy/compliance metadata, screenshots and release notes,
the exact reviewed build IDs, rollout settings, and production Sentry health.
Git commits, tags, PRs, merging, further builds and public rollout are never
implicitly authorized by a prior one-time release approval.
