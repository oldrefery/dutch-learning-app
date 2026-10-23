# D13 status-read OTA delivery — October 10, 2026

AUTH-29 completed: exact second OTA published once at **2026-10-10 00:28:25
Europe/Amsterdam** (2026-10-09T22:28:25.284Z), personal oldrefery production,
for both installed 2.4.0 (85) runtimes. Both original Sentry map pairs fully processed.
[Approved packet](D13-status-ota-candidate-20261010.md) and
[machine-readable receipt](D13-status-ota-delivery-20261010.json).

## Published artifacts

| Platform | Update group                         | Update ID                            | Runtime                                  |
| -------- | ------------------------------------ | ------------------------------------ | ---------------------------------------- |
| iOS      | e46de173-daaf-4713-8a23-ac60d65ac70d | 01a122c8-2844-7c42-807e-2595f8b8b287 | 94476f50e33e655576f1ef396170c5e29b38664e |
| Android  | 34cfafa2-e672-4bd1-a0c0-649dbeed8f5e | 01a122c8-2844-7513-91a9-3a42b2672229 | 9ddb21d335bb50b7547daa1d5d63122cf4d61fd4 |

Source archive SHA256 `493fcb2557373577625ef05b785afbd3cf3b47a2544cc19047666113f40f3d30`.
Original export manifest SHA256 `fb8b5e715c3465ef939fabc4dfbb335b19ea3ae7a1205de04f3956fc497e6b2c`.
No rebundling or new source commit. Ten source/test files from build85 baseline;
three files added/changed relative to AUTH-28. The private parser fix remains included.

## Verification

Fresh account and linked project owner were oldrefery before each remote EAS command.
Production environment and channel mapping matched the prepared packet. Both native
runtime calculations matched build85 immediately before publication. Channel remains
unpaused and fully mapped to the same production branch. Independent update:view
reads confirm exact platform/update/group/runtime IDs and no embedded rollback.

Production manifest and launch-asset downloads returned HTTP200 for both platforms.
Downloaded original bundle SHA256 values match the approved packet; all45 iOS and49
Android asset hashes agree with the original export. Served configuration is2.4.0(85),
QAfalse. Original source/environment/export sealed hashes still pass after delivery.
Asset reads honor official multipart assetRequestHeaders without exposing them.

Sentry original debug IDs match bundles/maps. Upload used a separate copy and
wait-for60/strict; both server receipts state File processing complete:

- iOS debug ID2a2474ec-c69f-4b4c-9c7f-954627d80268, artifactcc41a8a2-20ab-5a1a-a867-e2d4dd816463.
- Android debug ID8843bcd9-e89b-477d-9ddc-e08dffcf80ff, artifact06e735f7-c48f-591c-a299-07cac8997dfe.

Sentry production/14d checked at22:28:57UTC: zero issues for each new OTA ID and
post-publication dist85 query. Historical4E lastSeen22:06:48UTC,4C22:06:40UTC and
49 October5 are unchanged. Issues were not resolved manually and no test event was
sent. EAS metrics through22:29:03UTC show zero users/downloads/failures on both.
These immediate zeros do not establish adoption or runtime health; telemetry lags,
and verification downloads may affect later metrics.

## Remaining observation and persistence

Owner confirmed offline reviews/restart/reconnect preserve cards/results on iOS
with AUTH-28. After the requested AUTH-29 online/reopen check, the owner confirms
synchronization and status display without errors on iOS. Recorded at
2026-10-09T22:42:38Z (October10 00:42 Amsterdam). This is owner-reported success;
the exact device update ID was not independently captured. The previous offline
scenario was not rerun for AUTH-29. Android offline return is not newly verified.
D13 remains open for
observation, D14 pending, CEFR OFF. No background monitor has been created.

AUTH-29 is consumed; do not republish/reupload. No active/uncertain release operation.
Private receipts: reports/shared-dictionary-cefr/d13-status-ota-20261010/,
publication phase published-and-serving-verified, Sentry phase processed.
Original AUTH-28 artifacts/receipts remain immutable in their separate directory.
Rootf97a733 source/test/task changes remain local-only/uncommitted; no source
push/merge, native build/store/backend/phone/provider mutation occurred. Preserve
existing backups, QA services, checkouts and unrelated.playwright-cli.
