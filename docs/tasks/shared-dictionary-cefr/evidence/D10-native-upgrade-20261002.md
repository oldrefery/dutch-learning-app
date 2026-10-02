# D10 — native retained v14/v15 migration evidence

Date: 2026-10-02. Astra / High; AUTH-17/AUTH-18. Application source `c3f9baf`,
starting repository HEAD `559321a`, branch `feature/shared-dictionary-schema`.
No application, dependency, server schema or runtime flag changes.

## Result and scope

**PASS on assigned Android**: actual Expo SQLite and AsyncStorage migrated
historically initialized v14 and v15 files to v16 across separate native processes.
The second cold restart retained the v16 markers and identical data. This replaces
the missing native-bridge evidence for these two Android migration cases; it does
not claim a full historical APK upgrade or an iOS v14/v15 run.

| Case                         | Historical initializer | Preserved tables | Recovery result                                                         |
| ---------------------------- | ---------------------- | ---------------- | ----------------------------------------------------------------------- |
| v14 pending immutable intent | `dfdc7f0`              | 10               | Original JSON/operation ID exact, version 0, unknown ACK, `pending`     |
| v15 acknowledgement only     | `5efd6ff`              | 11               | No invented origin/version/ACK, `unverified`, exact-origin gate rejects |

Both cases retain all columns/rows of words and SRS, collection metadata, private
fallback, user progress, review events, corrections, ordered review/reset/correction
commands, content commands, original import queue and personal refresh queue.
The v15 acknowledgement table also remains identical. No recovery command is
synthesized; a foreign owner sees no recovery issues. Native integrity and foreign
key checks pass, as do read-only checks on the archived closed SQLite files.

The main retained QA app stayed stopped. Its complete helper snapshot before/after
is identical; its installed APK still hashes to
`f71a97414a7fabd296a93ba68a4dd475f75f0b9ee8e601dab3bab784d729fedf`.
All 113 application source fingerprints in `D10-source-sha256.json` match.

## Isolation and execution

- Only AVD `woordenaar_d08_qa_20260921`, serial `emulator-5584`, was started.
- Separate package `com.oldrefery.dutchlearningapp.d10upgrade` and separate data
  sandbox; the retained main app was neither reinstalled nor reset.
- Actual APK manifest inspection confirms the separate application ID, no
  INTERNET permission, and no deep-link handlers. No backend/provider calls.
- Thirty historical/current source copies were hashed and compared. Schema SQL
  and recovery view/storage logic are unchanged. Only initializer `DB_NAME`,
  `SCHEMA_VERSION_KEY` and the Sentry import differ; Sentry is a no-network stub.
- Seeded two synthetic fixtures using each actual historical initializer. Real
  AsyncStorage persists version markers and comparison snapshots.
- Three distinct native processes: historical seed PID 4151, current migration
  PID 4235, cold reopen PID 4302. Each phase completes and closes its handles
  before the exact package is force-stopped and restarted.
- The harness rejects a repeat seed, retains failure state, and does not rerun
  completed phases. Inspect retained state before retrying any command.

Committed harness sources: `D10-native-upgrade-prepare.mjs`,
`D10-native-upgrade-app.js`, `D10-native-upgrade-fixture.js`.
Sanitized machine-readable result: [summary](D10-native-upgrade-summary-20261002.json).

Private artifacts are retained under
`reports/shared-dictionary-cefr/woordenaar-d08-native.d10upgrade20261002`:
`build.log`, `source-hashes.json`, `apk-manifest.xml`, `apk-validation.json`,
`installed-hashes.json`, `install.log`, three phase JSON files, closed native DBs,
`emulator.log` and `shutdown.json`. No credentials were needed or copied.
Main before/after snapshots are in the preceding `.20261001` native root,
named `android-state-d10-upgrade-harness-{before,after}.json`.

Build: installed Node 24 / JDK 17 / Expo 57 dependencies, private source copy,
`./gradlew assembleRelease --offline --no-daemon --max-workers=2
-PreactNativeArchitectures=arm64-v8a`. Exit 0, 6m11s, 1168 tasks.
Installed artifact SHA-256:
`7ca30719fbf20d9d7f5c913f2a0a671f732fbfc734c025a0239b33c06be7d8ac`.
Source/fixture/prepare strict zero-warning ESLint, scoped Prettier and diff checks
pass. Normal preservation-commit hooks are mandatory; their captured output is
retained at the private root's `commit.log`.

## Attempts, cleanup and next gate

Two early device reads found Android offline / activity service not ready. No
fixture mutation occurred; a bounded boot-completion wait resolved readiness.
An initial template lint run found unresolved generated import paths; dependency
injection into the template fixed that before build. A port-check command used
duplicate lsof selectors and was corrected; final port checks passed.
No failed native migration, uncertain import or unfinished build remains.

At **12:43:07 UTC**, assigned emulator absent/process exited, assigned iOS
`DDEDCE4E-153B-48A4-A47C-B4ED0F499F1F` Shutdown, all four retained task containers
exited, ports 55331/55400 closed. Harness app is stopped and retained for inspection;
device data and source/build artifacts are preserved. Other sessions untouched.

Remaining scope: full historical APK and iOS upgrade paths were not executed;
transaction interruption is covered by existing file-backed tests, not this native
run. Official/shared/bundled and cross-owner/both-client transfer acceptance remain.
Source review found [missing web transfer integration](D10-web-transfer-integration-gap-20261002.md).
Next GPT-6.1 Sol / High for that bounded implementation, then Astra review/QA.
D10.3–D10.5 stay unchecked; no D11, production, schema cutover, publication,
deployment, paid operation, push, PR or merge. Automation remains paused.
