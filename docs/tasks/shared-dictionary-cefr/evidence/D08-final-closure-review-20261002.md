# D08 final closure review — 2026-10-02

Status: review and repaired-artifact acceptance complete; D08.4 and D08 done.
All task QA resources stopped and verified at 01:38 Europe/Amsterdam. User resumed current-stage work with a hard 02:30 Europe/Amsterdam
stop/save deadline. Internal QA cutoff 02:15, followed by scoped resource shutdown.
Model switch signaled; exact picker/effort not independently observable. Recommended
Astra / High; no independent subagent review claimed. Branch feature/shared-dictionary-schema,
HEAD c5dfb14d49b9a53521b53e13bdd19991999ede5d; all work local/uncommitted.

## Review result and repaired finding

The status/debt and blank-analysis-notes repairs pass review. Owner-scoped missing
card IDs plus commands/metadata are deduplicated behind the default-off flag;
requireCardRefresh persists known page debt before pull, and incomplete/failed
pull cannot advance the cursor. Partial success clears only completed card debt.
The file-backed restart test and both native fault/recovery families cover the
original false Up to date defect. Canonical blank notes become null while the
legacy word row is retained; meaningful text is parsed/trimmed normally.

Reanalysis correctly retains derived conflict metadata and checks the active
owner before DB mutation and after hydration. Review found one additional P2
race: while the new hydration await is pending, learning or collection changes
on the same word can update the store, but reanalysis publishes the old personal
fields captured before analysis. The DB's content-only SQL does not overwrite
SRS/collection; the store/returned word nevertheless regress until refresh.
A deterministic regression changes all five SRS fields and collection during the
hydration boundary and adds another word. Before fix: 1 failed / 36 passed. The
fix takes the latest personal fields immediately before publication, retaining
new analysis/materialization and concurrent other-word changes. It introduces no
new async boundary, schema/protocol or network request.

## Local verification

Node 24, current dirty tree, Jest from apps/mobile:

- New regression before fix: D08-closure-concurrent-learning-before.log,
  1 failed / 36 passed, showing all six personal fields reverted.
- Seven focused status/sync/restart/Settings/actions/details/conflict suites:
  D08-closure-focused-after.log, 88/88 passed.
- Full mobile `node ../../node_modules/jest/bin/jest.js --watchman=false
--runInBand --silent`: D08-closure-full-mobile.log, 142 suites / 1,640 tests /
  22 snapshots passed (32.544s).
- `npm run mobile:typecheck`, `npm run mobile:typecheck:test`, `npm run lint:ci`:
  passed, D08-closure-typecheck-build.log, D08-closure-typecheck-test.log and
  D08-closure-lint.log. Runtime and regression formatted before source copy.
- Logs are ignored under reports/shared-dictionary-cefr. The new concurrency
  regression is synthetic unit evidence, not a fabricated native race injection.

## Prior native evidence assessment

The completed October 2 matrix proves status/debt, private add/image/restart,
conflict choices and stale local/server rejection, supported account switch and
open-detail deletion; its explicit continuation segments/harness failures remain
recorded. Same-mounted owner mutation is also covered by the existing UI Jest
regression, while native account testing uses supported Settings navigation.
Legacy-web loopback HTTP image rendering is excluded; native/server URL parity
and web translations/SRS/deletion convergence are verified separately.

September 21 learning reset/correction recovery, dormant-client upgrade and
October 1 lost-reply/idempotent delivery remain valid targeted evidence for
unchanged paths. Current SHA-256 exactly matches six of the seven recorded
September 21 fingerprints; only dictionaryContentSync differs: reviewCorrectionSync,
correctionTransport, reviewActions, syncManager, dictionaryContentRepository and
CefrBadge. dictionaryContentSync changed only the documented refresh-debt path;
receipt/acknowledgement tests still pass. The current source does not change
learning transport/schema/command ownership or dormant-client activation. No
claim that every old scenario ran again on the final artifacts is made.

The last source change is limited to reanalysis store publication. Final native
smoke uses freshly rebuilt iOS/Android artifacts to exercise that actual action,
then compares exact SRS/learning/command/receipt state. Prior unaffected matrix
coverage need not be repeated wholesale; new native results are recorded below.

## Rebuild intent and fingerprints

QA source refreshed in native-only mode; no reseed/reset/reinstall data wipe.
Exact four runtime file copies match closure-runtime-hashes.json in the ignored
native root. New wordActions SHA-256:
121fe364e49e7fe8f9d1d6af69a3f0eeca1593b4b751379977de794c7b4f91dd.
Both Release builds passed: build-ios-true-1790897289102.log and
build-android-true-1790897287497.log. Final iOS bundle SHA-256:
2b3d705f223dc3a04318e9bbf03590b3666b1cde7e2ce5f0b7f21c98326d3953.
Final Android APK SHA-256:
d32be13dcfb1377d283f831f8d25cb75ccc7dcc863fab32443cfb0b94387554c.
Task stack/proxy and exact two QA devices temporarily resumed under the user's
continuation; only existing synthetic owners/data, no paid providers. Mandatory
shutdown/save remains before 02:30; no deployment or production schema switch.

Final build installs preserved data. iOS baseline sync ios-1790897378355 passed
(24s). Android task AVD cold boot completed in 64.829s; exact name reverified,
APK install -r returned Success and reverse tcp:55331 was restored. Reanalysis
on iOS is running with content-only transport blocked, fixture translation
QA closure version; baseline ios-state-closure-pre-reanalysis.json saved.
Proxy session 75864 and emulator session 56646 are task-owned shutdown targets.

Final iOS reanalysis ios-1790897463467 passed (44s), showing QA closure version
on the rebuilt artifact. Pending operation b2083ca8-8381-4393-ad84-23c5896fa0c8,
expected v3, persisted with exact original identities/SRS/learning. Restored
transport; delivery ios-1790897545539 passed (23s), queues empty, acknowledged
assertion passed, server receipt count exactly one. State snapshots:
ios-state-closure-pending.json and ios-state-closure-acknowledged.json.

Android sync android-1790897549493 stopped before Settings. Screenshot proves
the app is authenticated and showing its four-word collection, with the emulator
System UI isn't responding dialog overlaid. This is a cold-boot System UI ANR,
not a login/content failure. A scoped Wait-dialog continuation is running; no
app reset, owner switch, auth change or global process operation.

Android System UI Wait continuation android-1790897627819 passed (22s),
including Up to date. Baseline android-state-closure-pre-reanalysis.json confirms
private balkon v4 and QA closure version from iOS, empty queues. Final installed
iOS bundle and Android base.apk were read from their exact device app paths and
hashes matched the rebuilt artifacts above. Android reanalysis now uses a
content-only outage and QA changed version to restore the original final fixture
translation while verifying a fresh command. No learning write is part of smoke.

Initial repository format check flagged only the new review document and changed
handoff; final formatting will be applied after recording smoke/shutdown results.

## Final native verification and closure

Android reanalysis android-1790897681637 passed (46s), displaying QA changed
version. New operation e170e040-4b55-4162-bc3a-599aa1203881 expected v4 persisted
with unchanged word IDs/SRS/learning. Delivery android-1790897762873 passed (21s),
acknowledged-state assertion passed, exactly one server receipt, queues empty.
Final iOS convergence ios-1790897805879 passed (22s).

Final snapshots ios-state-closure-final.json / android-state-closure-final.json,
server-closure-final.json and guarded assert-closure-convergence.py produced
closure-convergence-assertion.json (passed). Both clients have four active primary
words, identical server translations/media/tombstone, private balkon v5 with null
reference, cursor 11 and no content/hydration debt. Original identities and all
SRS/learning fields/queues/history match their pre-reanalysis snapshots. The final
translations return to the same values already verified in legacy web at the
preceding checkpoint; the unchanged web was not restarted for this narrow delta.
Both actual installed artifacts were hash-verified, not inferred from source alone.

No unresolved blocking finding remains in this closure review. The one new race
has a failing-before/passing-after regression, fresh full mobile/type/lint checks,
and rebuilt native action/delivery smoke on both platforms. Existing native
matrix evidence remains accepted for the unchanged paths assessed above. D08.4
is complete; D08 is done. D09 is next and was not started. D01 pre-release evidence,
D13 release/cutover approval and D14 observation/retirement gates remain mandatory.
No hosted readiness or full release approval is implied.

## Final shutdown and persistence

At 01:38 Europe/Amsterdam, task iOS shutdown succeeded and was independently
asserted Shutdown; task emulator-5584 emu kill succeeded and follow-up get-state
reported device not found. The emulator process session exited 0. Only the four
woordenaar-d08-qa.ZFsE50 containers stopped; inspect confirms all exited. Verified
proxy PID 25083 received TERM and exited 143 (expected). No 55331/55400 listener
or proxy PID remained. Web/browser had not been restarted. All build/Maestro/test
jobs completed. Fault flags were disabled before shutdown. Native app data,
AVD/simulator files, stopped DB containers/volumes and ignored artifacts retained.
Other sessions/devices and production were not operated; no reset/uninstall,
paid call, EAS, deployment, cutover, commit/push/PR or automatic restart.

This review changed wordActions and its regression, one task-only System UI
Wait continuation flow and checkpoint documents. All prior dirty D03–D08 work
is preserved. Final formatting/diff gates are recorded in the session checkpoint.
Next stage recommendation: GPT-6.1 Sol / High for D09 local web integration,
using the already available model; stop at the stage boundary for explicit resume.

Final repository `npm run format:check` passed after checkpoint formatting
(D08-closure-final-format-check.log); scoped Markdown/YAML check and
`git diff --check` also passed. No runtime change after the hash-verified builds.
