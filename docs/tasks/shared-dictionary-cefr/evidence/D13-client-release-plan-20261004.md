# D13 client artifact plan — October 4, 2026

Status: store inventory complete; exact publication/mapping preparation and
external operation approvals pending. This is not build, upload, submission, environment-write or cutover
authority. Recommended model: GPT-6 Astra / High.

## Verified inventory

Resumed from `bb3d3233207e3163f0b23adddde49e4694eefd72` on the existing feature
branch. All changes since candidate `13b97b0` are documentation; the ten manifest
source/control hashes and nine migration hashes still match. Application version
sources remain aligned at 2.3.1 (84). Unrelated `.playwright-cli/` is preserved.

Read-only EAS CLI 24.7.0 account/project checks confirmed effective account
`oldrefery`, linked `@oldrefery/dutch-learning-app`, project
`d968536e-1e9b-4224-9ed7-a1e9c6d821c8`. Checks were repeated immediately before
the build-list request. No credentials/account were changed or CLI upgraded.
The latest 50 records contain no newer build than 2.3.1 (84), September 11:

| Platform | Build ID                               | Existing runtime fingerprint               |
| -------- | -------------------------------------- | ------------------------------------------ |
| iOS      | `df49f4ca-0cf6-4609-86ed-b8c2fbbada7b` | `f9fa8a5f7f094e4d4b4606eb5deb4f0c80ab544d` |
| Android  | `8b0ea9d7-cdac-4079-8ea2-56ade98f96b1` | `2ee8484c4e828d17d4f7bd09ae78a5ece9a4baa0` |

Both are finished production builds from `16b7015af242270f304070e3a3ee96f9209b9830`.
EAS history is not proof of every store upload or an unused store number.
The authenticated personal Google Play Console independently showed 37 app
versions for `com.oldrefery.dutchlearningapp`, newest 84 / 2.3.1. Searching 85
returned zero app versions / No results. No upload/release change was made.

After the owner completed login, App Store Connect app6752469146 showed latest
version2.3.1/build84. All Statuses Build Uploads, newest first, showed84 Complete,
then83/82/81/80; no newer upload. Build84 ID is
3382cc76-e2e4-4917-a85a-158ba5f8eac1. No credentials or settings were changed.
Team (Expo) settings display Build Distribution: Automatic for Xcode Builds.
Do not infer the exact EAS submission behavior or the device auto-update setting
from that label. Treat an internal submission as potentially user-visible delivery,
not a harmless storage upload; it requires release authority. TestFlight can
install available builds automatically when device automatic updates are enabled.
See [Apple TestFlight guidance](https://beta.itunes.apple.com/).

[Sanitized inventory](D13-release-inventory-20261004.json) records exact IDs and
the private raw-response hash. Raw output remains in ignored, protected
`reports/shared-dictionary-cefr/d13-release-inventory-20261004/eas-builds.json`.

## Proposed version and artifacts

Select **2.4.0 (85)** as the planning target after both store inventories.
Recheck both stores immediately before upload; this observation reserves nothing.
`prepare-release.js --version 2.4.0 --build 85` passed in dry-run mode; no version
source changed. No build or submission has been started.

| Artifact                           | Exact target/configuration                                                                                             | Required evidence before use                                                                                                             |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| iOS IPA                            | `com.oldrefery.dutch-learning-app`, Apple team `7FQ395U52U`, ASC app `6752469146`, production profile, physical device | New release SHA, final version/build, archive SHA256, embedded runtime/channel/backend, signing and original bundle/map upload           |
| Android AAB                        | `com.oldrefery.dutchlearningapp`, production profile, store bundle                                                     | Same provenance checks; signing identity and versionCode; internal draft submission only if separately approved                          |
| Web                                | Existing Next.js `woordenaar-web` on Vercel, `woordenaar.app`, backend `josxavjbcjbcjgulwcyy`                          | Fresh personal project/owner/environment inspection, exact release SHA/deployment ID and artifact-specific QA                            |
| Edge                               | Only changed `gemini-handler` plus its resolved shared dependencies, backend `josxavjbcjbcjgulwcyy`                    | Exact source/dependency hashes and targeted deployment approval; no all-functions command or paid live analysis smoke                    |
| Dictionary publication and mapping | Approved official source manifest and bounded mapping/delta plans                                                      | Separate provenance, private-content dispositions, local apply/rollback with subsequent learning writes preserved, final DEC-09 approval |

New native binaries are required after D12 native Expo dependency changes. Do not
OTA this candidate onto installed84. No existing QA binary is suitable: it embeds
loopback endpoints and disables OTA. The preview profile targets an iOS simulator.
Old `builds/build-context.json` is for 2.1.0 (80), not this candidate; preserve it,
but never pass it to current submission tooling.

## Feature flags and release order

All current repository defaults remain OFF; this inventory did not reveal remote
environment values. AUTH-24 verified server operations/reads/legacy-guard OFF and
CEFR worker OFF. Recheck effective environments before any build or deployment.

A build with `EXPO_PUBLIC_DICTIONARY_CONTENT_ENABLED=false` cannot later become
the functional dictionary client merely by switching the server. D08 also records
that enabled clients require server capability and do not silently downgrade.
Therefore do not distribute a flag-enabled client against the dormant backend,
or spend a build on an interim disabled client without an explicit purpose.
Recommend finishing publication/mapping/preservation plans first, then approving
one coordinated functional artifact set. A future enabled candidate may be built
and held unsubmitted for inspection under a scoped build approval. Its release
and any installation remain subject to the final cutover gate.

The final native opt-in and web `DICTIONARY_CONTENT_ENABLED=true` must be bound to
the approved artifact/environment, not inherited accidentally from a shell or
remote variable. Require `WOORDENAAR_QA_BUILD` and `EXPO_PUBLIC_E2E_TEST_MODE` off,
production backend, expected public client keys, production channel/update URL,
and new platform fingerprints. CEFR remains OFF and unscheduled throughout.

## Source and build preflight

1. Store inventory is complete; recheck before upload. Use an isolated clean
   release checkout of the chosen revision; do not clean the current user's
   untracked directory or copy private backups/QA reports into that checkout.
2. Apply the four-file version update there, review/commit it, recompute source
   manifest and archive hashes. Current candidate hashes must not be relabeled
   as a later version commit. Preserve all three protected backup directories.
3. Inspect the exact EAS and Vercel upload file sets. No private `builds/`,
   `reports/`, `.playwright-cli/`, credentials, environment files, signing keys,
   native QA outputs or local logs may be uploaded. A clean checkout is essential:
   root `.vercelignore` does not itself explicitly exclude every report directory.
4. Record hosted CI against the actual release SHA after separately approved source
   push/PR. Feature-branch push alone does not trigger the Quality workflow:
   it runs on PRs targeting main/develop, pushes to those branches, or dispatch.
   Inspect repository/Vercel integrations before approval because source publication
   can trigger preview builds. Do not auto-merge or deploy to obtain CI evidence.
5. Present the exact native build execution route (cloud or local), source archive,
   environment, credential access, destination and any cost for approval. Existing
   build tooling is local EAS; previous successful83/84 builds were cloud builds.
   Do not equate a local build with zero remote credential or Sentry activity.
6. Preserve and verify original platform bundle/maps and Sentry upload receipts;
   no reconstructed export may stand in for the binary's maps. Record final IPA/
   AAB SHA256 and store-processing status separately from upload success.
7. Only the final approved release sequence may publish content, enable server
   guards/reads/operations, apply bounded personal mappings and distribute enabled
   clients. Preserve old-client/offline behavior for unavailable P2. Rollback must
   retain learning writes after deployment; restoring an old whole database is
   not an acceptable rollback. No D14 removal before the observation/adoption gate.

## Checkpoint and next action

D13.3 identity check and D13.4 native-route decision have evidence. Identity checks
must still recur before later EAS operations. No build/upload/deployment has begun,
no primary phone was operated, and completed AUTH-24 migrations were not replayed.

Next: continue the exact source/publication/mapping packet. Local offline
verification of the historical approved official pack release passed:21 packs,
2053 entries, aggregate5e02d4e1e02c1d56222ced6dca23f720a479e991f16c0af13bc124de707ac90b,
zero production writes, network function replaced with a throwing stub. This
confirms file integrity only: transformed D04 content hashes, meaning identities,
license/attribution propagation and exact source approval for the new shared
publication must still be prepared. Pack-level CEFR does not authorize meaning
assessments. No private personal card becomes public by matching this catalog.
The historical release/ledger must remain immutable; no republishing is authorized.

Documentation: [EAS CLI reference](https://github.com/expo/eas-cli#readme), retrieved
through Context7 for identity/build inventory and archive inspection. The first
repository guard invocation was accidentally sourced in zsh (BASH_SOURCE path
failed); its waiting npx lookup was interrupted. The successful guarded read-only
commands used explicit Bash and the already installed CLI. No write was retried.
