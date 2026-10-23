# D13 OTA delivery candidate — October 9, 2026

Historical preparation status: **prepared, verified, not published**.
Subsequently delivered under AUTH-28; see [completion receipt](D13-ota-delivery-20261010.md). D13.6 remains in progress. The owner
confirmed GPT-6 Astra / High and asked to continue preparation. AUTH-27 is consumed;
new scoped delivery authorization is pending. No external mutation occurred.

## Source and exact artifacts

The candidate is an isolated local archive of the original build85 source
`0a3bae137d3e58c406215114cbccadd773f71098` plus exactly the seven source/test files
validated in [the repair evidence](D13-observation-20261009.md). All 1,622 tracked
source files were compared against the original archive; only those seven differ.
Native configuration, package versions and lockfile remain identical to build85.
Root source remains at `f97a733`; the clean managed release checkout is untouched.
No source commit, push, PR or merge was performed.

- Candidate source archive SHA-256:
  `19e8e9bd2c7ef8885554ca45e2582a3d35aa1af8ecad9177cc1a8c1600673daa`.
- Repair patch SHA-256:
  `48a706d0298400c98c3f1513de1750af7996cff6371b7fb16e0f19bc7f1dbdbe`.
- Original export manifest SHA-256 (all 61 files, including original maps):
  `3e4a9696cb9bd5bc6c420e1a8167c23f9739ae981d5ecfee91ef4cb2d3b65a89`.

[Machine-readable evidence](D13-ota-candidate-20261009.json) records complete bundle
and map hashes, debug IDs, runtime comparisons and compiled-code checks. Originals
and executable local validation scripts are retained privately under
`reports/shared-dictionary-cefr/d13-delivery-20261009/`.

## Runtime and destination verification

Every remote EAS command was preceded by `account:view` and `project:info`, both
requiring personal account/owner `oldrefery` and project
`d968536e-1e9b-4224-9ed7-a1e9c6d821c8`. No credential/account switch occurred.
Pinned local tooling: Node24.20.0 and EAS CLI24.7.0.

Both original cloud builds are FINISHED at version2.4.0/build85, source0a3bae1,
profile `dictionary-release`. Cloud fingerprint hashes equal the previously
inspected signed binary runtimes. Local runtime resolution matches those exact
hashes for the original archive, repaired archive, and EAS publication environment:

| Platform | Build ID                               | Runtime                                    |
| -------- | -------------------------------------- | ------------------------------------------ |
| iOS      | `5d37d6fa-fc60-4137-b694-3b0909071ee9` | `94476f50e33e655576f1ef396170c5e29b38664e` |
| Android  | `84beddfc-9c76-4128-9b8f-d7975c3dd082` | `9ddb21d335bb50b7547daa1d5d63122cf4d61fd4` |

Production channel `019ca58c-3a10-79f1-8392-649c9116eba8` is unpaused and maps wholly
to production branch `019ca58c-3911-7abc-af77-1c19784f14f3`. Runtime-filtered update
inventories at21:52UTC are empty for both85 runtimes. Older84 uses different runtimes
and will not match this OTA. This does not establish build85 adoption counts.

## Export and checks

EAS production variables were read privately; account-level production variables
are absent. The original `dictionary-release` profile's explicit overrides were
applied locally: dictionary true, QA/E2E false, and nonworking dev-user placeholders.
Build-profile env is not automatically applied by `eas update`; publishing through
the ordinary bundling wrapper would therefore be unsafe. No EAS environment was
modified. `EXPO_NO_DOTENV=1` prevents local dotenv substitution.

Local `expo export --platform all --source-maps` completed successfully with native
Hermes bytecode. Both compiled bundles contain the private compatibility parser and
strict canonical parser, with all four changed runtime sources matching exact
reviewed hashes in the original maps. Hermes disassembly confirms dictionary opt-in
returns constant true. Both bundles include the expected production Supabase and
Sentry configuration and contain none of the old dev-user credential values.
Original debug IDs match bundle/map pairs:

| Platform | Bundle SHA-256                                                     | Sentry debug ID                        |
| -------- | ------------------------------------------------------------------ | -------------------------------------- |
| iOS      | `679b8f65f2cc027540b8f4dfb7cfce74867b5c734a340f2771c024766e1cccb4` | `1654b320-8f80-4cf1-afb0-3c9a91a5cc2a` |
| Android  | `cf1aa5c93b2a799a07ca5d632848b5ed1a0f6da25d8b5c995a074f24686e2f0e` | `4865f93e-e7a3-473b-9669-199861bebc2b` |

The exact staged source passed3 suites/42 regression tests. The first attempt was
blocked by sandbox access to the existing Watchman socket; `--watchman=false`
passed without changing product code. Prior full mobile/web/type/lint and saved
snapshot preservation results remain in the repair evidence. Final local preflight
verifies source/archive/environment/export hashes. No exact OTA has run on a device.

Preparation-only issues resolved: env:list does not support JSON format in pinned
CLI, so its long output was captured privately; the host Python tar API lacks the
new filter argument, so trusted git archive extraction used local tar; an initial
bytecode assertion matched both a closure reference and declaration, then was
corrected to anchor declarations. None caused remote writes or altered source.

## Proposed scoped delivery

Approve publication of **these existing original bundles** to personal
`oldrefery/dutch-learning-app`, production channel/branch/environment, for the two
exact build85 runtimes above, plus their original Sentry maps to
`oldrefery/dutch-learning-app`. Availability would be100% of matching runtime users.
No new binary/store submission, backend migration, runtime flag/CEFR change,
personal-data rewrite, phone operation, source push/merge or automation is included.

After approval, first revalidate sealed hashes, account/project, unchanged channel
mapping, current production environment and runtime fingerprints. Any changed
artifact/destination requires reconciling this packet before publication. The
prepared export must not be regenerated by the publishing command.

Execution from `candidate/apps/mobile`, using the pinned CLI through Node24.20.0:

```text
EAS_NO_VCS=1
EAS_PROJECT_ROOT=<absolute candidate directory>
EXPO_NO_DOTENV=1
WOORDENAAR_QA_BUILD=false

eas update --channel production --environment production --platform all   --skip-bundler --input-dir <absolute original dist directory>   --message "Fix legacy private dictionary sync on 2.4.0 (85); source 19e8e9bd2c7e"   --json --non-interactive
```

The archive is artifact-bound, not a new commit. `EAS_NO_VCS=1` and explicit project
root avoid falsely attributing this nested prepared directory to rootf97a733.
Capture intent before the mutation and save returned group/update IDs immediately.
EAS may produce separate runtime groups; if interrupted, inspect both exact
runtimes/message/IDs before retrying. Never replay an ambiguous publication.

Upload maps from the prepared `sentry-upload/` copy using the installed
`sentry-expo-upload-sourcemaps` with existing scoped credentials loaded privately.
That uploader normalizes debugId metadata in maps, so `dist/` originals are kept
unchanged. Use explicit SENTRY_ORG/PROJECT and https://sentry.io/; do not regenerate
maps or infer successful server processing from an upload attempt. Record receipts
and inspect matching artifact/debug IDs. Preserve the original export manifest.

Post-publication: verify both platform/runtime groups and exact launch-asset hashes,
then inspect Sentry4C/49 and EAS health by the new update IDs. Native version stays
2.4.0(85), so native release/dist alone cannot distinguish repaired from embedded
clients. Successful online sync and offline study/return with preserved cards and
reviews remain required; owner/authorized device evidence is still missing.

Rollback planning: no earlier OTA exists for these runtimes. A runtime-specific
rollback-to-embedded would restore the known broken85 parser, so it is an emergency
availability response, not a repair. Do not change backend flags or pause the whole
production channel. Any rollback/replacement outside the approved publication
needs explicit scope; stop and report new failures with exact update IDs. D14 stays
pending and CEFR OFF; elapsed time is not health acceptance.

References checked through Context7 and installed CLI source:
[Expo runtime versions](https://docs.expo.dev/eas-update/runtime-versions/),
[EAS environment variables](https://docs.expo.dev/eas/environment-variables/).
The repository [runbook](../../../session-runbook.md) requires release authority to
identify environment, revision/artifact, operation and allowed scope.
