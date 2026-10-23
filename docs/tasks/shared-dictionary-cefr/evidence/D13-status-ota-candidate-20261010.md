# D13 status-read OTA candidate — October 10, 2026

Status: **published and verified under AUTH-29**. D13.6 remains in progress.
[Completed delivery](D13-status-ota-delivery-20261010.md). The preparation and proposed
scope below are historical; AUTH-29 and AUTH-28 are consumed.

## Problem and change

Sentry4E records a handled SQLite lock while the settings screen loads status during
sync on the exact iOS OTA. The previous parser error at the same time came from the
embedded bundle, not the repaired OTA. Owner confirms successful online sync.
[Event attribution and diagnostics](D13-post-ota-observation-20261010.md).

The candidate retries only the read-only status snapshot when SQLite reports a
locked database. Three retries use the existing equal-jitter backoff,100ms initial
and400ms maximum delay. Persistent contention and other errors still reach the
existing UI/Sentry handler. No write/transaction retry, fabricated status, global
SQLite setting, schema/native dependency or backend change. The previously delivered
private-content parser repair remains included unchanged.

Delta from the delivered AUTH-28 source is exactly three files: syncStatusService.ts,
its existing unit test, and a new real SQLite concurrency test. Delta from original
build85 source0a3bae137d3e58c406215114cbccadd773f71098 is ten source/test files.
The original AUTH-28 archive/export/maps remain immutable. No new source commit.

## Exact source and artifacts

Source archive SHA256: `493fcb2557373577625ef05b785afbd3cf3b47a2544cc19047666113f40f3d30`.
Original export manifest SHA256: `fb8b5e715c3465ef939fabc4dfbb335b19ea3ae7a1205de04f3956fc497e6b2c`.
All original files/assets/maps are sealed under
reports/shared-dictionary-cefr/d13-status-ota-20261010/.
[Machine-readable packet](D13-status-ota-candidate-20261010.json).

| Platform | Original bundle SHA256                                             | Sentry debug ID                        |
| -------- | ------------------------------------------------------------------ | -------------------------------------- |
| ios      | `2b8d85d0d7d3fb1f4fa031d1d0ebfafe17e27dfbde12cf31f277d902cdb4b92d` | `2a2474ec-c69f-4b4c-9c7f-954627d80268` |
| android  | `1ae99cf1e36f925a2da2d7a6697215e0e7ff744d30c689cb2980e157f12c258c` | `8843bcd9-e89b-477d-9ddc-e08dffcf80ff` |

Both runtime fingerprints still match installed2.4.0(85):

- iOS94476f50e33e655576f1ef396170c5e29b38664e.
- Android9ddb21d335bb50b7547daa1d5d63122cf4d61fd4.

Native Hermes export completed. Both maps contain exact hashes of all five changed
runtime source files; bytecode retains private and canonical parsers and dictionary
opt-in constanttrue. Production configuration is present, old dev credentials absent.
QA/E2E remainfalse. Both maps' original debug IDs are present in their bundles.
Local environment uses the unchanged reviewed dictionary-release overrides plus the
captured production values; live production environment must be compared again
before authorized publication. Do not let EAS rebuild using default profile env.

## Validation

- Full mobile:157 suites,1806 tests,22 snapshots passed.
- Focused status/hook/settings:4 suites,32 tests passed.
- Real two-connection SQLite exclusive-lock reproduction recovers after release,
  with owner-scoped counts, all cards unchanged and total_changes unchanged.
- Persistent locks fail after four total attempts; unrelated schema failures do
  not retry. Existing user-switch/blur and stale-request behavior remains covered.
- Mobile build/test typechecks, full lint:ci, changed-file formatting and diff check pass.
- Source/export sealing and both native runtime checks pass. No on-device run of
  this new candidate yet. Passing tests do not replace D13 offline-return evidence.

## Proposed delivery scope and execution

Publish these exact existing iOS/Android bundles,100% of matching build85 runtime
users, to personaloldrefery/dutch-learning-app project
`d968536e-1e9b-4224-9ed7-a1e9c6d821c8`, production channel/branch/environment, and
upload the matching original Sentry maps to oldrefery/dutch-learning-app.
No native build/store submission, backend/CEFR or phone/data operation, source
push/merge, or background automation is included. This is a new artifact, so the
previous publication approval cannot be reused.

After new explicit approval: run preflight-local.py, verify account and linked
project owneroldrefery, refresh unchanged production environment/channel mapping,
confirm both fingerprints again, and record fresh intent before publishing once.
Use Node24.20.0 and pinned EAS CLI24.7.0 from candidate/apps/mobile, EAS_NO_VCS=1,
explicit EAS_PROJECT_ROOT=<candidate>, EXPO_NO_DOTENV=1 and QAfalse. The operation is
`eas update --channel production --environment production --platform all
--skip-bundler --input-dir <this packet's original dist> --json --non-interactive`
with message identifying the source archive prefix. Never execute the consumed
AUTH-28 publication script or overwrite its receipts. Preserve all returned groups
before verification; reconcile partial/uncertain publication before any retry.

Upload from this packet's separate sentry-upload copy with original debug IDs,
explicit approved org/project and existing scoped credentials, preserving dist
originals. As before, use installed Expo uploader with CLI --wait-for60/--strict
and require server File processing complete for both artifacts.

Verify production manifests and actual bundle downloads, honoring multipart
assetRequestHeaders, and compare update IDs/runtimes and all hashes. Check Sentry
by new OTA IDs; native release/dist alone cannot distinguish these updates. Owner
online success applies to AUTH-28; new candidate status behavior needs observation.
The owner subsequently confirms successful offline study/restart/reconnect with
cards and review results preserved on iOS using delivered AUTH-28. This is not an
on-device test of the new candidate; Android offline return is not newly verified.

If this candidate regresses, the previous compatible artifact groups are
AUTH-28 iOSd5e5379d-2ca5-4d76-86de-02638cac6041 and
Androidefcee60d-d833-4f52-b91c-86c3177bf983. They retain the dictionary parser repair;
embedded rollback would reintroduce its original bug. Any actual rollback needs
its own explicit scope; no rollback is executed or automatically authorized here.

D13 remains open for remaining observation; iOS offline return is owner-confirmed.
D14 pending, CEFR OFF.
All source/task changes are local-only, source base/root unchanged; only the earlier
AUTH-28 OTA/maps are live. Existing backups/QA/phones are preserved.
