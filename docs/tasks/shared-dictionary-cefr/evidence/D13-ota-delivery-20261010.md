# D13 OTA delivery — October 9–10, 2026

**AUTH-28 delivery complete.** Both prepared OTA bundles were published once at
2026-10-09T21:59:12.190Z (October9 23:59 Amsterdam), and delivery verification
completed after local midnight. Both original Sentry map pairs finished server
processing. D13.6 remains in progress for actual sync/offline-return and observation.

## Exact published updates

Personal project `oldrefery/dutch-learning-app`, project ID
`d968536e-1e9b-4224-9ed7-a1e9c6d821c8`, production channel/branch/environment. The
production channel mapping remained unchanged and unpaused. Native version/build
remains2.4.0(85); availability is100% of matching runtime users.

| Platform | Update group                           | Update ID                              | Runtime                                    |
| -------- | -------------------------------------- | -------------------------------------- | ------------------------------------------ |
| iOS      | `d5e5379d-2ca5-4d76-86de-02638cac6041` | `01a122ad-683e-7763-a736-9a522c38cec8` | `94476f50e33e655576f1ef396170c5e29b38664e` |
| Android  | `efcee60d-d833-4f52-b91c-86c3177bf983` | `01a122ad-683e-7c6a-bbbd-d6a42da5437b` | `9ddb21d335bb50b7547daa1d5d63122cf4d61fd4` |

Sources/artifacts are exactly the [approved packet](D13-ota-candidate-20261009.md):
base0a3bae1 plus seven reviewed source/test files, source archive SHA256
`19e8e9bd2c7ef8885554ca45e2582a3d35aa1af8ecad9177cc1a8c1600673daa`,
original61-file export manifest SHA256
`3e4a9696cb9bd5bc6c420e1a8167c23f9739ae981d5ecfee91ef4cb2d3b65a89`.
Fresh native runtime checks, remote environment and channel checks passed before
publication. Account/project owneroldrefery verified before every remote EAS command.
`--skip-bundler` preserved original bytecode/maps; no replacement bundle was created.

## Delivery and Sentry verification

Independent `update:view` reads confirm both groups' platform/runtime/message/branch.
Client-protocol GETs to the actual configured production endpoint return the exact
update IDs and runtime versions. Both launch assets downloaded withHTTP200 and their
SHA256 values equal the original approved bundles. All45 iOS and49 Android asset
hashes in the served manifests match the local export. Served config has QAfalse,
version2.4.0 and both build numbers85. Original source/export hashes still pass.

The first direct asset GETs returned403 because the diagnostic reader omitted
`assetRequestHeaders` from multipart protocol extensions. The response explicitly
required these headers. After implementing the official Expo Updates request
protocol, both downloads returned200 and exact hashes matched. No release or
account changes were made to resolve this diagnostic issue.

Original source maps were uploaded from a separate copy through the installed
Sentry Expo uploader with `--wait-for 60 --strict` added to its CLI invocation.
Both returned **File processing complete**, with matching debug IDs:

| Platform | Debug ID                               | Processed Sentry artifact bundle       |
| -------- | -------------------------------------- | -------------------------------------- |
| iOS      | `1654b320-8f80-4cf1-afb0-3c9a91a5cc2a` | `1491774f-7eb4-5ba7-b1fb-16f350952c36` |
| Android  | `4865f93e-e7a3-473b-9669-199861bebc2b` | `bbed729d-e570-505b-b77b-114467eb1cd4` |

Target Sentryoldrefery/dutch-learning-app. Original export/maps are unchanged;
normalizing debugId to debug_id happened only in the upload copy. No synthetic
production errors were emitted, and existing issues were not manually resolved.

## Initial health and remaining acceptance

At22:00UTC, EAS reported0 users/downloads/failed installs for each new group. This
is an initial empty observation, not evidence that the client is healthy. Those
metrics were queried before diagnostic manifest/asset fetches; later metrics may
include verification traffic and still cannot prove a real user's successful sync.

At22:01UTC, Sentry production/14d queries returned no issues for either exact new
`expo.updates.update_id`, and no build85 issues with an event timestamp after the
publication. Historical4C remains unresolved, latest event21:29:06UTC before OTA;
49 remains unresolved, latestOctober5 14:23:41UTC. Historical aggregate counts are
not post-release failures. A quiet initial window does not prove repair adoption.

On October10 local, the owner answered the post-OTA online/reopen check and
confirmed synchronization completed without the previous error. This confirms
owner-reported online sync success. The exact on-device update ID and platform
were not independently captured. Native offline study/return with preserved cards
and review results remains unverified, alongside the remaining D13 observation. D14 stays pending; the originalOctober12 elapsed boundary alone is not
acceptance. CEFR remains OFF under the accepted reduced release scope.

## Resume and persistence

AUTH-28 is consumed for the exact successful publications and map uploads. Do not
republish/rebuild/reupload them merely to resume. Use exact update IDs above for
further read-only checks; query fresh personal Expo identity before each EAS call.
Private intent/completion receipts, original assets/maps, serving downloads and
health logs are retained in `reports/shared-dictionary-cefr/d13-delivery-20261009/`.
[Machine-readable delivery receipt](D13-ota-delivery-20261010.json).

Rootfeature/shared-dictionary-schema remains atf97a733, seven source/test changes and
task records are local-only/uncommitted. Original managed release0a3bae1 stays clean;
merged main44141e0 is unchanged. No source commit/push/merge, new native build/store
submission, migration/backend flag/CEFR change, phone/data operation or background
automation occurred. All existing backups, QA services and unrelated.playwright-cli
are preserved. No active or uncertain external operation remains.
