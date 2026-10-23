# D13 native candidate inspection — October 4, 2026

Status: both EAS builds finished; static artifact inspection passed. Held for the
owner's distribution agreement under AUTH-26. D13 remains in progress.

## Exact artifacts

Source `0a3bae137d3e58c406215114cbccadd773f71098`, version **2.4.0 (85)**,
profile `dictionary-release`, distribution `STORE`, personal Expo owner `oldrefery`.
Source is a clean local commit on `feature/dictionary-release-candidate`, based on
merged main `44141e0`. It has not been pushed. Default production profile stays OFF.

| Property             | iOS                                                                | Android                                                            |
| -------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| EAS build ID         | `5d37d6fa-fc60-4137-b694-3b0909071ee9`                             | `84beddfc-9c76-4128-9b8f-d7975c3dd082`                             |
| Completion UTC       | 21:08:26                                                           | 21:17:51                                                           |
| Artifact             | IPA, 23,921,508 bytes                                              | AAB, 86,280,803 bytes                                              |
| SHA-256              | `555bbfea1fdaf62ac9f97eb1ff8f84074952ab60136141e8c0218176cb41959d` | `c3337ddfa287cb36753ea0009c61991e61ee9d99fb6a67758999aab1408c357e` |
| App identifier       | `com.oldrefery.dutch-learning-app`                                 | `com.oldrefery.dutchlearningapp`                                   |
| Embedded runtime     | `94476f50e33e655576f1ef396170c5e29b38664e`                         | `9ddb21d335bb50b7547daa1d5d63122cf4d61fd4`                         |
| Minimum OS           | iOS 16.4                                                           | Android API 24; target 36                                          |
| Debug access         | OFF                                                                | OFF                                                                |
| Intended destination | TestFlight                                                         | Google Play internal testing                                       |

Both signed artifacts contain the correct production backend and update URL for
project `d968536e-1e9b-4224-9ed7-a1e9c6d821c8`; updates are enabled, channel is
`production`, launch checks are `ALWAYS`, wait is zero. EAS API runtimeVersion is
null, but the signed native settings use `file:fingerprint`; the actual packaged
fingerprint files were read and checked against the installed Expo implementation.
Both runtimes differ from build 84. No OTA was published.

Hermes disassembly of each downloaded original bundle shows
`isDictionaryContentEnabled` returning constant true. This verifies the actual
compiled opt-in, in addition to the resolved EAS environment. QA/E2E are forced
false by the reviewed profile and legacy dev-user values replaced with nonworking
values. Primary phones and their databases were not accessed during this operation.

## Signing and package checks

- iOS: `codesign --verify --deep --strict` passed, including nested code. Apple
  distribution chain and team `7FQ395U52U` verified; provisioning and application
  identifiers agree, debugging disabled, no device list/all-device profile.
  Provisioning profile expires July 24, 2027.
- Android: bundletool 1.18.3 `validate` passed; manifest/resource inspection passed;
  JAR signature verified with SHA-256/RSA-2048. Upload certificate SHA-256 is
  `764dbff7fce145e3cd710cb6f08b0e7fc05aa28a61385edc998a3ea28d9fb5fc`, expires
  January 26, 2053. JDK reports the self-signed chain and absent timestamp; retained
  as expected upload-certificate warnings, not hidden. Existing EAS signing
  credentials were reused. Play's acceptance of that upload key remains pending.
- All 54 packaged ARM64/x86-64 ELF libraries have PT_LOAD alignment at least
  16,384 bytes. This does not substitute for Google Play's later generated APK checks.

Methods: [Apple signature verification](https://developer.apple.com/library/archive/technotes/tn2318/),
[Apple entitlements](https://developer.apple.com/library/archive/qa/qa1798/_index.html),
[Android app signing](https://developer.android.com/studio/publish/app-signing),
[Android command-line signing](https://developer.android.com/build/building-cmdline).

## Original source maps and tests

Both cloud logs confirm original Hermes bundles and combined source maps uploaded
to Sentry `oldrefery/dutch-learning-app`, dist 85. Debug IDs are present in the
actual downloaded bundles:

- iOS release `com.oldrefery.dutch-learning-app@2.4.0+85`, debug ID
  `dc7e37e9-9dc2-4008-9cc6-068136c87a86`, artifact bundle
  `761d741f-130b-5bde-8c29-7a0929857999`.
- Android release `com.oldrefery.dutchlearningapp@2.4.0+85`, debug ID
  `735997f8-55d1-497e-84a5-035caa900676`, artifact bundle
  `155d4e73-5ffc-5ef1-add4-0e377935c96b`.

The upload receipts say processing pending; server-side processing was not
independently checked. No reconstructed Metro export was used as evidence.
Normal commit hooks passed mobile 156 suites / 1798 tests / 22 snapshots and web
86 suites / 780 tests / 1 existing skip. Focused config tests: 12/12. Earlier D12
runtime QA remains separate evidence; these exact store artifacts were not launched.

## Resolved inspection issues and limits

The initial IPA download returned HTTP 403 for Python's default User-Agent. The
same official artifact URL returned 200 with a browser User-Agent; download/hash
completed without another build. The first sandboxed codesign/security checks
could not access macOS trust services; identical read-only checks outside the
sandbox passed. Entitlements needed XML output. No artifact was modified or re-signed.

No submission, store processing, installation or automatic tester delivery has
occurred. The main iPhone remains untouched; P2's device/queues remain unknown as
previously accepted. Full D13 completion is not claimed. The production dictionary
capabilities, sources and CEFR worker remain dormant. Existing personal-card
mapping stays empty; no personal learning data is rewritten.

Next: agree the exact coordinated server activation and TestFlight/internal
release using [the activation packet](D13-native-activation-settings-20261004.md).
Fresh hosted deltas and a verified backup precede any separately approved cutover.
Do not repeat AUTH-24 migrations or these successful EAS builds. Submit these exact
IDs only after agreement; never select `--latest` or auto-submit a replacement.

Private originals, receipts, logs, disassembly and inspection scripts are retained
under ignored `reports/shared-dictionary-cefr/d13-native-candidate-20261004/`.
Public JSON: [candidate evidence](D13-native-candidate-20261004.json).
