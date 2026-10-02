# D10 native acceptance — 2026-10-02

Source: `c3f9baf` (documentation `785d9f9`), user-confirmed Astra / High.
R1/R2 re-review passed before native QA; no additional blocking finding in the
repair source. D10.3–D10.5 remain open pending the complete acceptance matrix.

## Scope and environment

Only assigned iOS `DDEDCE4E-153B-48A4-A47C-B4ED0F499F1F`, Android
`woordenaar_d08_qa_20260921` / `emulator-5584`, and four retained
`woordenaar-d08-qa.ZFsE50` containers used. Loopback proxy 55331 forwards only to
55321; external providers are stubbed. No hosted operation, reset/reseed,
publication, runtime flag change, or production access.

Private artifacts: `reports/shared-dictionary-cefr/woordenaar-d08-native.20261001`.
Do not commit fixture credentials, dumps, native DBs, Maestro logs or screenshots.
Local migrations 20261002090000–20261002120000 applied after private pg_dump
`d10-pre-migrations.sql`, with ledger entries in the same transaction.
Personal words, reviews and content state unchanged across migration.

## Build and retained upgrade

Both local release builds succeeded in the retained isolated source copy:
`build-android-true-1790941768875.log`, `build-ios-true-1790941768876.log`.
Installed artifact hashes equal built hashes:

- iOS main.jsbundle: `7644204c1178fadcb8d98faaa454e131f825ff8745fb951b9703458b8ffaf7b3`.
- Android APK: `f71a97414a7fabd296a93ba68a4dd475f75f0b9ee8e601dab3bab784d729fedf`.

Both `*-state-d10-pre-upgrade.json` / `*-state-d10-after-upgrade.json` pairs
compare equal for words/SRS, learning, content states/commands, cursors, hydration,
revisions and CEFR heads while REST was blocked. No app data clear. New v16 import
recovery tables are used by the installed app. `PRAGMA user_version` is not this
app's schema marker; do not use its zero value as migration evidence.
This does not establish a retained v14-intent or marker-only v15 upgrade.

## iOS real application flows

1. JSON document preview/import into D08 Native QA, REST blocked. Synthetic
   `d10herstel` creates personal ID `728f4240-3bfd-402d-b311-4aa69cc39870`, immutable
   root `69eb8157-af56-4751-b4dd-35889e82440c`, one import intent and one content
   command. `d10-ios-confirm-import-fixed.log` passes. Native snapshots
   `d10-saved-offline` / `d10-restart-offline` compare identical after cold restart.
   `d10-ios-pending.log` passes: pending visible, Up to date absent.
2. Lost original import reply: proxy receives HTTP 200, drops response and blocks
   further REST. Server has exactly one word, origin and import receipt; local
   immutable operation/queues remain saved through another cold restart.
   `d10-ios-lost-reply.log` passes pending assertion. Replay uses the exact same
   operation ID, clears import/content queues, acknowledges placement revision 0.
3. Ordinary offline move through the context menu to My Words passes
   `d10-ios-move.log`. Native outbox stores immutable recovery operation
   `2e975717-60f9-474b-b1ba-9f81cf3b9c6f`, expected version 0/original collection,
   local placement revision 1. Server accepts version 1; lost reply retains pending
   (`d10-ios-move-lost-reply.log`). No generic metadata move is used.
4. A synthetic peer calls the same local recovery RPC and moves the card back to
   D08 Native QA at version 2. The device replays its older accepted operation.
   Server remains version 2/original collection, one word, one import receipt,
   two recovery receipts. Native state adopts current collection, preserves root,
   ID/SRS/history and clears recovery/personal queues. One content hydration row
   remains until the next sync pass; UI correctly displays 1 pending. Next pass
   `d10-ios-hydration-retry.log` passes Up to date and hydration count becomes zero.

All pre-existing personal IDs/SRS and the complete learning snapshot remain equal
to the pre-upgrade baseline through these flows. Existing huis/fiets/zolder content
updates are expected reconciliation of retained D09 server changes, not an import
reset. The synthetic peer is a local authenticated API client, not another user's
device or an additional physical/native client.

5. Cancellation ACK with blocked normal word writes: `d10-ios-delete-blocked.log`
   passes after deleting only the new synthetic card. Local cancellation is 1,
   recovery outbox empty, word tombstone still `deleted`. UI remains pending after
   a cold restart (`d10-ios-delete-restart.log`). After unblocking normal writes,
   `d10-ios-delete-delivered.log` passes Up to date; tombstone is delivered. R2
   native behavior is confirmed. Data was not reset or reseeded.

## Android retained offline import and iOS clipboard

Android needed its task-only reverse tcp:55331 mapping restored after emulator
boot, then the retained primary session launched successfully. The first document
attempt remained at the signed-out gate and created no import. Subsequent
`d10-android-import-retry.log` passes (2m 9s, mostly Maestro text input). Synthetic
`d10android` has personal ID `935b74b0-6550-4755-9909-b95ec0e42009`, root
`93474317-456c-4716-aa15-51aafaf6f1d8`, one original intent and one content command.
The first snapshot attempt failed on shell quoting before any DB read; after fixing
the read-only helper, `android-state-d10-saved-after-first-restart.json` and
`android-state-d10-second-restart.json` compare fully equal across another cold
restart. No pre-first-restart snapshot equivalence is claimed.

iOS collection export copied its actual self-contained JSON using the native
clipboard, then native Paste inserted it into Import JSON. Visual evidence
`d10-ios-export-result.png` confirms 0 of 4 selected, all 4 already added; source
SQLite also contains exactly 4 active words in this collection. The test's original
hardcoded expectation of 5 was wrong; Maestro's assertion failed although the
actual preview is correct. Initial hideKeyboard also failed after dismissing the
keyboard. Corrected flow is saved but no whole corrected automated pass is claimed.
This establishes native export/paste/duplicate preview, not cross-owner reimport.

Android explicit recovery UI also passes. Its first server read observed uncreated;
an already in-flight original import then won the race and its reply was dropped.
The saved proposal (expected collection NULL) later becomes `placement-conflict`,
with pending visible (`d10-android-stale-recovery.log`). A fresh explicit read shows
D08 Native QA; user-style confirmation into My Words queues a new operation.
`d10-android-recovery-retry.log` passes, saved imports clears, then
`d10-android-settled.log` passes Up to date. Final state has the same root/personal
ID, placement revision 2 acknowledged, server recovery version 1, empty original/
recovery/content/hydration queues, and one original plus one recovery receipt.

The new unreviewed Android card's interval changes from local 0 to server creation
default 1; migration 20261002120000 explicitly uses `(1,0,2.5,CURRENT_DATE,NULL)`.
The accepted contract specifies server defaults on creation. This is not evidence
of byte-identical new-card SRS across first delivery. All other projected new-card
fields and the complete learning snapshot are unchanged. Existing-card SRS is
unchanged. No implementation fix is required by this observation.

## QA harness adjustments and failed attempts

Maestro accessibility text merges the preview lemma/translation; use a regex rather
than exact lemma. Initial preview selector failures left a valid preview and did
not import; inspect native state before retrying. Final confirm-only flow passes.
Settings can return to the top after sync; settled probe scrolls again. An initial
Up to date probe did not pass; it is not acceptance evidence. The stale-receipt
pass genuinely had content hydration debt, correctly visible as pending; the
subsequent pass completed it. One read-only snapshot attempt selected a nonexistent
collection deleted_at column; corrected to the actual schema, no mutation involved.

QA proxy adds specific original/recovery/cancel RPC response fault handling and
normal word-write blocking. Snapshot helper includes optional import tables,
placement and collection sync status. All helpers keep exact task path/device/
loopback guards. The peer helper saves its one-off request before mutation and
refuses overwriting it; reconcile saved request/receipt before any retry.

## Remaining acceptance

R1/R2 iOS regressions and scoped Android offline/recovery lifecycle pass. Retained
v14/v15 upgrade, both-client
export/reimport, official/shared/bundled/offline matrix and owner/lifecycle edges
are not established by the evidence above. Do not mark D10 complete.

## Verification and resource checkpoint

All 113 application/source fingerprints match the reviewed source. Changes in this
checkpoint are QA helpers, flows and documentation only. Scoped strict lint,
format and diff checks pass. Authorized local checkpoint `4e9563f` normal hooks:
156 mobile suites / 1796 tests / 22 snapshots and 75 web suites / 648 tests,
one existing skipped suite/test. Source fingerprints match after hooks. No closed application suites were
manually rerun absent a source change.

One elevated final-snapshot command was rejected because automatic approval review
hit a usage limit; it did not execute. After the user's continue, the same scoped
operation was accepted. There was no policy bypass. Final snapshots and proxy event
log saved before cleanup; exact shutdown verification at 12:23 UTC confirms assigned iOS Shutdown, Android
serial absent, no matching task processes, four containers exited and ports
55331/55400 closed. Retained data/volumes were not removed.
