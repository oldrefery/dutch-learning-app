# D01 native baseline

Started 2026-09-12 17:56 UTC, source `e962870`, AUTH-09 recorded.
Status: complete, 40/40 accepted samples across eight matrix cells.
No application source, production data, account or deployment was changed.

## Isolation and artifacts

Both task-owned QA devices run local ARM64 Release builds, version 2.3.1 (84),
Expo 57.0.22 / React Native 0.86.3 / Hermes. The host is ARM64 macOS.

| Platform | Task-only device                                                   | Runtime                              |
| -------- | ------------------------------------------------------------------ | ------------------------------------ |
| iOS      | `BCF57FF0-0D37-451A-AE1C-CBF1F22BF682`, Woordenaar D01 QA 20260912 | iPhone 16 Pro / iOS 26.5             |
| Android  | `emulator-5580`, AVD `woordenaar_d01_qa_20260912`                  | Pixel 8 / API 36 / google_apis ARM64 |

Existing iOS `FF399BE5-35A9-407E-B77A-1CD331250C62`, Android `emulator-5554`,
pre-existing AVDs and installed user apps/data were not touched.

An isolated `git archive HEAD` was prepared at
`/private/tmp/woordenaar-d01-native-0lR6oh`. Installed JS dependencies were linked;
iOS Pods were copy-on-write copies, not shared mutable symlinks. All generated
native configuration, builds and installations were confined to this QA setup.

Clean allowlisted build environment: `EXPO_NO_DOTENV=1`, production JS mode,
QA flag enabled, Expo offline/no telemetry, Sentry uploads disabled, no real env
files loaded. The only backend is `http://127.0.0.1:58170` with synthetic auth.
Both embedded bundles contain that origin, exclude the hosted Supabase origin,
and have OTA disabled. These artifacts must never be released to users.

- Android package: `com.oldrefery.dutchlearningapp`. APK SHA-256:
  `ba5bc8176b8095c686b1404da78bd249d2d24c19d67cef6233b70dc45c748ac3`.
- iOS bundle: `com.oldrefery.dutch-learning-app`. Embedded JS SHA-256:
  `3aef376a757e0687994271280d2507f63ec4aebb7df08eba882bf09da0cd3e9b`.
- Android artifact: temp root + `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`.
- iOS artifact: temp root + `ios-derived/Build/Products/Release-iphonesimulator/DeWoordenaar.app`.
- Android build: `assembleRelease --no-daemon --max-workers=2 -PreactNativeArchitectures=arm64-v8a`.
- iOS: Release simulator build, ARM64, two jobs, code signing disabled.
- QA-only Android manifest uses a network-security resource denying cleartext by
  default and permitting only domain `127.0.0.1`, `includeSubdomains="false"`.
  This was generated in the isolated archive; no production policy was changed.
- iOS local-network ATS setting and embedded QA/update flags were verified.

## Reproduction and metric

Helpers: [build runner](D01-native-build.mjs),
[synthetic backend](D01-native-fixture.mjs),
[login preparation](D01-native-login.yaml),
[warmup](D01-native-warmup.yaml),
[baseline](D01-native-baseline.yaml),
[collector](D01-native-collect.mjs).
The consolidated login helper passed syntax validation; actual sign-ins used
separate equivalent preparation flows (iOS required clearing stray input).

The build runner takes an action and isolated archive path; it does not create
dependency links, copy Pods or generate the Android network-security resource.
Inspect the environment and existing task devices before repeating preparation.
Do not run builds in the application checkout or use real account env files.

Run the fixture with Node 24 and argument `500` or `2500`. Android maps only
its own port via `adb -s emulator-5580 reverse tcp:58170 tcp:58170`.
Use Maestro with explicit task device, `--no-reinstall-driver`,
`APP_ID` and `WORD_PATTERN=500 words.*` or `2500 words.*`.
Each run has its own output/debug directory. The collector reads the five
`JsConsole: D01_NATIVE_SAMPLE` records from that run's Maestro log.

- Five process-cold launches per platform/size/connectivity cell. SQLite and
  valid synthetic auth are retained. This is not fresh-install or OS-cache-cold.
- Timestamp starts immediately before the automation launch command and ends
  after the expected populated collection row and collection screen are visible.
- **The metric includes automation/driver overhead; it is not app-only TTI.**
- Accepted timing flows run sequentially, with no competing native build.
  Both warmups may overlap, but all warmups complete before timing begins.
- Offline means the loopback backend is stopped and connection refusal confirmed,
  not host-wide airplane mode. Host internet and other apps remain unaffected.
- Auth remains valid for 24 hours. Token expiry, initial offline sign-in, offline
  ratings, pending-operation replay and non-empty histories are not tested here.
- Fixtures contain 500/2,500 words, one collection, zero review events and zero
  auxiliary progress. Counts are confirmed in native UI before measurements.
- 500 -> 2,500 growth uses normal native sync without clearing local data.
- All native online data/protocol requests returned 200. The large fixture
  recorded 204 requests, all 200. Only auth/protocol RPC POSTs occurred; database
  writes are rejected by the fixture. This is not a Supabase/RLS security test.
- iOS read-only SQLite checks at both sizes: expected word count, zero events,
  zero learning commands, zero unsynced words. Android assertions cover UI counts
  and absence of attempted learning writes; its SQLite queue was not inspected.
  No claim is made about preservation of a pre-existing non-empty queue.

## Results and limitations

Durable accepted samples: [D01-native-samples.json](D01-native-samples.json).
All five samples and median per completed cell are preserved there, independent
of temporary files. This is a pre-migration baseline, not an optimization result.

| Platform | Words | Online median (ms) | Backend-offline median (ms) |
| -------- | ----: | -----------------: | --------------------------: |
| Android  |   500 |               5021 |                        3691 |
| Android  |  2500 |               4920 |                        4758 |
| iOS      |   500 |               5053 |                        4947 |
| iOS      |  2500 |               5213 |                        5245 |

All cells reached the expected populated collection screen. Android's offline
median increased with fixture size in this run; iOS medians increased slightly.
These observations include automation overhead and do not isolate a causal app
bottleneck. No optimization or physical-device performance claim follows from them.

Small sample size, emulator/automation overhead, local backend, zero history and
one collection limit generalization to physical devices and production latency.
Do not compare absolute values directly to web browser performance timestamps.
Future before/after runs must preserve this fixture, build mode and timing boundary.

Excluded preparation failures:

1. Pods first failed without a UTF-8 locale; `LANG/LC_ALL=en_US.UTF-8` fixed it.
2. QA Android resource first failed lint for missing `includeSubdomains`; setting
   it explicitly false fixed the resource. No lint rule was disabled.
3. iOS secure input left stray hyphens. Visible-field clearing/retyping fixed
   synthetic sign-in; strict fixture auth validation was not weakened.
4. Initial Android 500 online attempt aborted on a task-device ADB disconnect,
   accepting no samples. Device recovered; only its port reverse was restored.
   Global ADB and existing devices were not restarted.

## Checkpoint and cleanup

Both loopback server instances exited successfully after their online runs.
The task-owned Android emulator and iOS simulator were explicitly identified and
shut down after all samples. QA device data/build files are retained for inspection;
no user data was deleted. Existing devices were not stopped or modified.
No pending deployment, cloud build, paid call, commit or push.

Quota observation: 74% weekly used at 17:56:46 UTC -> 88% at 18:28:43 UTC,
same reset epoch 1789817169. Account-wide/rounded and possibly contaminated by
other activity; not exact task usage or a completed D01-stage estimate.

References: [fixed-bundle QA runbook](../../../mobile-qa-builds.md),
[Android network security configuration](https://developer.android.com/privacy-and-security/security-config).
Context7 returned no Android match; official docs were used as fallback.
Release-mode/QA isolation follows the loaded native performance/data-fetching
guidance; no application feature or network policy was implemented.
