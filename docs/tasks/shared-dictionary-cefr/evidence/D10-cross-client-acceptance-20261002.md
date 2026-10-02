# D10 cross-client acceptance — 2026-10-02

Result: scoped native/web transfer acceptance PASS. D10 remains in progress.
Starting HEAD `6d3d355`, application source `19d98eb`, native baseline `c3f9baf`.
User-authorized assigned devices (AUTH-19); same user-confirmed Astra / High.
[Machine-checked summary](D10-cross-client-summary-20261002.json).

## Isolation and retained state

Only iOS `DDEDCE4E-153B-48A4-A47C-B4ED0F499F1F`, Android AVD
`woordenaar_d08_qa_20260921` / `emulator-5584`, four retained
`woordenaar-d08-qa.ZFsE50` containers and loopback ports 55321/55322/55331/55400.
No reset/reseed, reinstall, migration, runtime flag change, publication, hosted
operation or provider call. Android reverse mapping restored only on this serial.
The proxy stubs providers. No other device/session operation.

Installed iOS bundle and Android APK match the previously reviewed hashes in
[D10 native acceptance](D10-native-acceptance-20261002.md). Before opening apps,
native snapshots retained eight iOS/seven Android personal rows, empty import,
recovery, content, hydration and learning outboxes. Previous import acknowledgements
remain unchanged. A full local pg_dump was saved before this checkpoint's imports.

## Actual acceptance

1. iOS account switch from primary to isolated recipient: primary collection is
   absent; the recipient's My Words contains the three effective translations
   transferred through web in the preceding checkpoint. Its Isolated Owner
   collection contains `anker`, copied `fiets`, and bundled `boek`. Assertions pass.
2. Native Copy collection JSON export creates a real three-entry schema-v1 document.
   Read it from this simulator's clipboard into a private fixture file. Entries
   contain only content, no owner/personal ID/SRS or source-private reference.
3. Return iOS to primary; isolated collection is absent. Put that captured document
   back into the simulator clipboard and use native Paste. Preview offers 2 of 3,
   with existing `fiets` excluded. Select existing D08 Native QA and import two.
   UI reports two saved, zero duplicates submitted. New local personal IDs:
   `bf5c7f11-30c7-40ce-a1b3-b0d7d202562c` (`anker`) and
   `ef62b1bb-5f5e-45fd-acd0-e8b8ccf656fa` (`boek`).
4. Snapshot immediately after creation shows two immutable import intents and two
   content commands. Manual ordinary sync reports Up to date; subsequent SQLite
   snapshot confirms all import/recovery/content/hydration/personal-refresh queues
   empty. Both server rows use those exact local IDs. Complete server fallback
   content equals the captured export for both entries; references remain null.
5. Android initially exports its four-word primary collection; native clipboard
   Paste/preview reports 0 of 4 selected, all already added. After normal peer sync,
   it receives the two iOS IDs, renders `anker` and `boek`, exports the six-word
   collection and previews 0 of 6 selected / 6 already added. No Android reimport
   write was requested; this is export/preview/peer receipt evidence, supplemented
   by previously closed Android document-import lifecycle evidence.
6. A fresh isolated web source copy and dedicated `d10-transfer-qa` browser session
   sign into primary and display six collection words. Both new word links contain
   the exact iOS/server/Android IDs; translations `anchor` and `book` match. Actual
   web and both native screenshots were opened and visually inspected.
7. Full comparison: all 17 prior server word rows, 14 prior content states and eight
   collections remain exactly equal; counts become 19/16/8. All eight prior iOS and
   seven prior Android word projections, SRS, learning snapshots and existing import
   acknowledgements remain equal. New-card SRS uses the already accepted server
   creation default (local interval 0 → server 1), not a reset of an existing card.
   Learning fixtures have empty history; no nonempty-history runtime claim.

## Harness observations, without application repairs

- Initial iOS/Android launch assertions passed the retained collection title but
  did not prove a live session. Android's next deep link showed Collection not
  found; root navigation revealed sign-in. A bounded primary login and explicit
  collections-screen assertion passed before continuing. No import was sent during
  that attempt. This checkpoint does not claim to fix signed-out deep-link UX.
- Two isolated iOS logins using Maestro paste into the secure password field failed.
  A direct `inputText` succeeded; proxy diagnostics confirmed exact isolated email
  and password equality using booleans only. The earlier clipboard-clear timing
  hypothesis was not established. The runner continues to redact fixture credentials.
- Android's brief export toast was missed after the tap's wait, causing an assertion
  failure. Resume via the actual native clipboard produced the correct four-word
  document preview. The final six-word flow omits that transient toast assertion.
- Failed flows were inspected before continuing. No uncertain/repeated import.
  New YAML flows preserve clearState=false/data and use only fixed task identities.
  The return-import flow restores primary; the separate paste-import flow performs
  the single two-word import and must not be replayed against the advanced fixture.
- Proxy helper adds optional isolated-owner credential equality flags; no credentials
  are stored in that trace. Installed application code did not change. All 137
  source fingerprints match. Strict scoped helper ESLint and diff check pass.

## Evidence and cleanup

Private runtime root: `reports/shared-dictionary-cefr/d10-cross-client-20261002/`:
pre-write dump, installed hashes, baseline/server snapshots, redacted flow logs,
proxy traces, browser login log, three screenshots, runner metadata, shutdown record.
Native snapshots and actual clipboard document stay under retained `.20261001`:
`*-state-d10-cross-before.json`, `ios-state-d10-cross-before-import.json`,
`ios-state-d10-cross-created.json`, `ios-state-d10-cross-settled.json`,
`android-state-d10-cross-peer.json`, `*-state-d10-cross-final.json`,
`d10-cross-ios-export.json`. Maestro raw debug directories retain command/results.
Do not commit private fixtures, credentials, native DBs or browser dumps.

At **14:24:04 UTC / 16:24 Amsterdam**, verified iOS Shutdown, Android serial absent,
four exact containers exited, ports 55331/55400 closed, browser closed and runner
PIDs 24414/24435/24436 absent. Native apps were stopped before final snapshots.
Volumes and both apps/data retained; primary is restored on both devices. No pending
mutation/build/QA operation. Automation remains paused.

## Remaining D10 boundary

Do not repeat completed native upgrades/recovery or these transfer checks.
Official/shared runtime matrix still requires an isolated synthetic fixture strategy;
retained stack has no official catalog/mappings/shared collections. Do not publish
existing user collections or contact production to fill that gap. Mobile-browser
acceptance is not established by desktop Chromium or native screenshots. D10.3–D10.5
remain unchecked; D11 not started. Same Astra / High for remaining acceptance; request
Sol 6.1 / High if an application repair is identified.

Preservation commit subject: `test: verify cross-client dictionary transfer`.
Normal hook output is retained privately as `commit.log` in this runtime root.
AUTH-18 permits local commits only; no push/PR/merge or release operation.
