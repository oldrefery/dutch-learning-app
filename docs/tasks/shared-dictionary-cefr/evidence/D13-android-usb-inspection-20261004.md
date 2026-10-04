# D13 Android USB inspection — 2026-10-04

Read-only device/package inspection after the owner offered an Android and
confirmed its USB connection. Source HEAD 94424ba, existing feature branch;
recommended GPT-6 Astra / High. Evidence preserved by scoped AUTH-18 local commit; no application source change.

## Observed installed artifact

- Huawei CLT-L29, Android 10 / API 29, ADB authorized over USB.
- Package com.oldrefery.dutchlearningapp, installed version 1.6.0 / versionCode 44.
- Package manager reports installed/not suspended; install/update timestamps both
  2025-10-05 21:07:07 (device-reported timestamps, not independent chronology).
- Package flags have ALLOW_BACKUP but no DEBUGGABLE. A bounded run-as id probe
  failed with package not debuggable. No app database or private files were read.
- Installed APK copied locally, SHA-256
  d8a43dddceda5914f41dcb620b673dfc16a077f4892afc82b8867f00707f5a1b.
- APK manifest independently confirms 1.6.0 (44), minSdk24/targetSdk36;
  expo.modules.updates.ENABLED=false. This identifies the native artifact;
  no runtime/user-state observation is inferred.
- Active Android-10 fullBackupContent points to secure_store_backup_rules,
  resource 0x7f150004 / res/-K.xml. It includes only sharedpref path '.', excluding
  sharedpref/SecureStore. No file/database/root domain is included.

According to the official [Android backup rules](https://developer.android.com/identity/data/autobackup#IncludeExclude),
explicit include elements replace default inclusion. Therefore this installed
configuration cannot provide a complete SQLite/queue backup through normal full
backup. ALLOW_BACKUP alone does not establish data recoverability. No adb backup,
rooting, debug re-signing, install, restore, launch, force-stop, synchronization,
logout or private-data extraction was attempted. No device setting was changed.

## Remaining identity/access gate

The connected phone is not yet assigned to P2. Asked whether this is P2's actively
used Android or another/old device; response pending. Do not mark P2's installed
build verified until assignment is confirmed. Full local queue/schema/owner data
remain unknown; do not treat a non-debuggable app or absent diagnostic as empty.
After identity clarification, select an existing in-app read-only diagnostic if
available, or prepare a separate reviewed preservation/diagnostic plan. No upgrade
is authorized merely to make inspection easier. Original server backup is complete
and must not be replayed. iPhone availability remains unknown.

Protected package/manifest/rule metadata and APK are under ignored
reports/shared-dictionary-cefr/d13-android-device-20261004 (directory 0700/files0600).
Device serial is kept out of committed evidence. No application data was copied.
No device operation remains running; user-connected physical phone remains as found.

## Owner clarification and authorized reinstall

Owner confirms this is an old test phone, not the active P2 phone, and explicitly
authorizes uninstall/reinstall (AUTH-22). P2 installed version/queues remain unknown.
Verified D12 QA APK SHA-256 17127358d0a8a3eef37a2a90863c1d62e62be4f48079c6c16047a716f225114b,
version 2.3.1 (84), minSdk24 and arm64-v8a match this Android10/arm64 device.
This artifact uses only local QA backend and has OTA disabled.

Old package uninstall returned Success. Subsequent streamed installation exited 1
without a detailed Package Manager error. Immediate target-specific package checks
reported device not found: USB disconnected, installation outcome unverified.
Do not assume the new app is installed or blindly repeat uninstall. Ask to reconnect
and unlock the same phone; inspect installed package/version first. If absent,
retry only the already authorized installation (non-streaming if appropriate).
Then verify launch and local QA connectivity. No production account/data operation.

The four retained QA services were inspected by exact saved container IDs; they
remain stopped, loopback ports unchanged. No proxy/backend/device app was launched.
Private reinstall-intent.json is authoritative for operation resumption. No active
installer process remains; on-device outcome requires reconciliation on reconnect.
This follow-up is local-only, not committed. No application source changes.

## Reconnection and completed QA setup

Owner reconnected the same device. Read-only package query confirmed no installed
app, so the consumed uninstall was not repeated. adb install --no-streaming of the
same hash-verified D12 APK returned Success. Package manager confirms 2.3.1 (84).
Cold am start -W returned Status ok (1655 ms Activity startup; not interactive
performance measurement). Screenshot after wake confirms the real login screen.
Limited app-process log contains no FATAL EXCEPTION or Error marker.

Started only the four exact retained local QA services from the D12 cleanup receipt,
then the existing loopback-only D08 proxy with provider fixtures and no external
provider forwarding. Auth health and proxy health return200. USB reverse maps
55331 to the host's 55331. Existing primary synthetic credentials were loaded
privately and entered via stdin-controlled ADB UI; no real account was used.
First local input preflight rejected password punctuation before any UI action;
correct shell quoting allowed the intended input without printing credentials.

Login succeeded and the real collection UI shows 11 words / 8 due, including
D08 Native QA (10) and My Words (1). No review, reset, content edit or import
was performed. This is a fresh disposable physical-device install/login smoke,
not a retained-upgrade or real P1/P2 preservation test.

The physical phone is left signed in for owner testing. Four QA services and
loopback proxy remain running deliberately; USB reverse remains on this device.
Keep the Mac awake/USB connected for local network actions. No scheduler/monitor.
reinstall-intent.json records exact container IDs, proxy PID90449, artifact hash
and completed phase. On resume inspect those live resources before reuse; do not
repeat uninstall/install/login unnecessarily. When testing ends, stop only this
proxy and the four recorded current services, preserve all volumes and stopped
original backup containers, remove only this USB reverse if no longer needed.
Do not shut down the physical phone. No installed automation drivers added.

AUTH-22's reinstall/setup is complete. Actual P2 build/queues and iPhone availability
remain unknown; D13 release gates remain open. Server backup must not be repeated.
Checkpoint metadata/permissions and evidence are saved by scoped AUTH-18 local
commit with normal hooks; private APK/screenshots/logs excluded from Git.

## Physical offline cold-start follow-up

On owner continuation, disconnected only this device's reverse55331 mapping,
confirmed no mappings, force-stopped and cold-started without clearing data.
Offline UI retained 11 words/8 due, D08 Native QA10 words and cached anker with
translation anchor, example and CEFR level unknown. XML/screenshot evidence is
private alongside offline-smoke.json. No learning assessment/reset/import/edit.
Restored the same reverse mapping and removed the device-only temporary UI XML;
returned to collection navigation. This verifies visible cached data, not a full
SQLite/queue-content equality proof. No implementation change or broad test rerun.

Owner offered to connect an actual primary phone instead; instructed to connect
the primary iPhone after this Android check. Await physical connection and trust
confirmation, inspect metadata first. Test-phone wipe authority never applies to
a personal iPhone. Existing September21 iOS evidence remains valid partial evidence.
This follow-up is local-only pending the next scoped checkpoint commit.
