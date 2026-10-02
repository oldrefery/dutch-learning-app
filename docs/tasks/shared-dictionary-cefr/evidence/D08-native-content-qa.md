# D08 native content QA — 2026-09-26

Status: native work paused by explicit user request; not an acceptance claim.
The user reported interference with another session. Do not restart native
automation or operate devices until the user explicitly resumes that scope.
No production operations, EAS,
paid providers, commits or deployment. Resume the remaining acceptance matrix
in `D08-closure-review.md`.

## Recreated isolated environment

- Stack: `/private/tmp/woordenaar-d08-qa.ZFsE50`, Docker project
  `woordenaar-d08-qa.ZFsE50`, API 55321, PostgreSQL 55322.
- Source/artifacts: `/private/tmp/woordenaar-d08-native.Nk2lH0`.
- Durable setup: `D08-qa-setup.mjs`; fresh CLI init, copied migrations, no seed,
  no remote project link. Only DB/Auth/REST/Kong enabled. Dictionary flags enabled
  only in this isolated local database.
- Private fixture: `fixture-private.json` under the artifact root, mode 0600;
  two synthetic `example.invalid` accounts, no production credentials copied.
- Initial server state: linked fiets A2 estimated/v1, linked huis B1 reviewed/v1,
  private zolder unknown/v0. All three retain interval 1, repetition 0, ease 2.5,
  null last review and due date 2026-09-26.
- `D08-qa-proxy.mjs`: loopback 55331, upstream fixed to loopback 55321;
  deterministic analysis/images, no hosted provider forwarding. REST outage,
  missing revision and accepted-but-dropped command reply controls. The latter
  also blocks following REST requests until explicitly restored, permitting
  inspection of the unacknowledged local command. Event log contains no tokens.
- Proxy self-check: block REST => HTTP 503; restoring it succeeds; synthetic
  `zolder` analysis returns the fixed translation without a provider call.
- `D08-qa-peer.mjs`: second synthetic client for competing content commands and
  read-only server snapshots. A first snapshot attempt used incorrect SRS column
  names; corrected to the actual contract, then the baseline read passed. This
  was a harness error, not a product failure.

## Native operations

- iOS task device: `DDEDCE4E-153B-48A4-A47C-B4ED0F499F1F`,
  `Woordenaar D08 QA 20260921`; booted successfully. Unrelated booted iPhone
  `FF399BE5-35A9-407E-B77A-1CD331250C62` was not touched.
- Android task AVD: `woordenaar_d08_qa_20260921`, emulator port 5584. Startup
  remained offline/hung while both builds ran. Exact task process 64819 was
  verified and stopped with TERM, preserving data. Restart after compilation.
- Fresh prebuild iOS, CocoaPods install without repo update, and Android prebuild
  passed. Release builds use dictionary flag true and native API 55331.
- Build logs: `build-ios-true-1790449847408.log` and
  `build-android-true-1790449851288.log` under the artifact root.
- Pending: install final artifacts on the task devices, run initial CEFR smoke,
  then `D08-native-content-edit.yaml` under controlled REST outage, inspect exact
  SQLite operations before/after restart, restore and verify acknowledgements.
  Conflict/retry/dependency/image/add/web checks remain unexecuted.

Helper lint (zero warnings) passed after formatting. Runtime app source has not
changed during this QA setup. Do not treat pending builds/flows as passing tests.

## Interruption checkpoint

- Both Release builds finished successfully. The three revised UI source hashes
  match the repository and the closure-review report exactly.
- Android APK SHA-256:
  `6b90193347679fd6530bd5622211f94ff232917c38f0c1e49e05deafebb0a8c5`.
- iOS `main.jsbundle` SHA-256:
  `b016547abaa2df678e9923bb34e08f54b5e05db73b08584c4fda28e02859f859`.
- iOS executable SHA-256:
  `663ddcd3fb78d12a1a364d40a9977c9e610910f1cfa342b29edb672954e04646`.
- Android installed on emulator-5584. Initial flow verified A2/B1, then failed
  opening zolder. A focused retry also failed. After changing graphics/restarting
  the emulator, zolder opened and unknown CEFR passed. Rendering/input appeared
  delayed; this is not yet a conclusively diagnosed application defect.
- First Android reanalysis reached the local fixture endpoint but saved nothing:
  the fixture incorrectly returned translation strings, not arrays. Corrected
  the fixture to match the contract. A subsequent flow failed to scroll to the
  reanalysis button before its timeout. No successful content edit is claimed.
- Android read-only snapshots `android-state-baseline.json` and
  `android-state-after-reanalysis.json` in the artifact root confirm the original
  three words, empty content command/refresh queues and two cached revisions.
  `D08-qa-native-state.mjs` supports read-only snapshots for both task devices.
- iOS installed on the task device. Two initial flows failed at authentication.
  The proxy safely verified `emailMatches=true`, `passwordMatches=false`; no
  credential values were logged by that diagnostic. Retrying with explicit field
  erasure did not fix typing. Current initial flow uses documented Maestro
  `setClipboard`/`pasteText` for the synthetic password. That retry was interrupted
  by the user; its result is **not verified**. No account password was changed.
- Maestro output helper now masks synthetic credentials. Its private debug
  artifacts may still contain them; never copy raw logs into portable evidence.
- Local supported web UI login succeeded in Playwright session `d08-content-qa`.
  Collections and all three original words/3 due/zero mastery were visible.
  This is baseline web evidence, not post-edit cross-platform convergence.
- The active iOS Maestro/node processes 76879 and 76865 were verified against the
  exact flow and artifact root and terminated with SIGTERM at the user's request.
  No device was closed/restarted after the pause request. Other session devices
  must not be inspected or operated as part of resuming this task.
- Retained background services: task Docker stack; proxy process started in
  tool session 47408 (55331); local web in session 6815 (55400); task Android
  emulator in session 19121, task iOS simulator, and the local Playwright browser.
  Build sessions are complete. Inspect exact process identity before stopping any
  service later; no broad kill/stop commands.
- Next after permission: coordinate device ownership; finish iOS password-entry
  verification and CEFR smoke, stabilize scoped Android navigation/scrolling,
  then run actual content/offline/restart/conflict/idempotency/dependency checks.
  D08.4 remains unchecked and D09 has not started. Recommended Sol / High for QA;
  Astra / High if a protocol/concurrency defect is established.
