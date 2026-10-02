# D08.4 repaired native status verification — 2026-10-01

Status: native repair acceptance completed; subsequent closure review found and
fixed a store personal-state race, rebuilt both apps and completed D08 on October 2
at 01:38 Europe/Amsterdam. All task resources stopped before the 02:30 deadline.
See [final closure evidence](D08-final-closure-review-20261002.md) for the current
source/artifact hashes and 1,640-test result. The chronology below preserves earlier
checkpoints, including superseded in-progress statements and artifact hashes.
User selected GPT-6.1 Sol and continued; reasoning effort is not observable.
Branch feature/shared-dictionary-schema, HEAD c5dfb14; local/uncommitted.

## Environment and build intent

- Verified exact iOS D08 UDID DDEDCE4E-153B-48A4-A47C-B4ED0F499F1F booted,
  Android AVD woordenaar_d08_qa_20260921 on emulator-5584, the four existing
  task Docker containers healthy/running, proxy 55331 and web 55400 listeners.
  Proxy fault flags all false. No other device was operated.
- Read-only pre-build native SQLite snapshots saved under ignored native root:
  ios-state-status-pre-rebuild.json and android-state-status-pre-rebuild.json.
  Three fixture words, zero content commands/hydration, two cached revisions.
- Source root reports/shared-dictionary-cefr/woordenaar-d08-native.20261001;
  stack root reports/shared-dictionary-cefr/woordenaar-d08-qa.ZFsE50. Synthetic
  fixture and all app state retained. Source helper native-only mode refreshes
  only QA source/config without replaying migrations or seeding users.
- Both repaired service hashes exactly match the repair evidence and QA copy.
  Native generated project files had expired; prebuild-ios, prebuild-android and
  pods-ios succeeded (logs under ignored native root). Current Release build
  intents: Android build-android-true-1790891536972.log; inspect iOS build log
  before retrying. No install or new native status acceptance yet.
- Updated missing-dependency probe explicitly requires pending and added a cold
  restart probe. These flow edits are not executed acceptance evidence.

Next: wait for current build exits, record fingerprints, install only on the
named task devices preserving data, verify missing-dependency pending/cursor/debt,
cold restart and recovery on both. Then continue the remaining closure matrix.
No production, hosted writes, EAS, provider calls, cutover or commit/push/PR.

## Android build checkpoint — 2026-10-02

Android Release passed in 10m23s, log build-android-true-1790891536972.log.
APK SHA-256 fc4ed217bff5035785dce0f63fc7113d99bad0676dfbaf5e66b251455896813a.
Installed with adb -s emulator-5584 install -r (Success), retained data.
Loopback reverse tcp:55331 confirmed. Baseline sync flow now running; verify its
XML/debug output before treating it as passed. iOS Release still compiling, log
build-ios-true-1790891575528.log; no iOS install yet.

Android repaired-build manual-sync baseline passed android-1790892204753 (19s).
Created fixture assessment b897d0b6-526e-4ae5-a4c4-4d9fe1cf9c59 at cursor 10 and
enabled hideRevisions only. Repaired Android pending probe passed
android-1790892293713 (25s): pending visible, Up to date absent. Snapshot
android-state-status-cefr-blocked.json and assertions prove cursor 9 retained,
hydration 1, outgoing commands 0 and unchanged learning fields/queues/history.
Cold-restart probe is running; fault remains active until explicit recovery.

Android cold restart passed android-1790892359299 (27s), retaining pending UI.
Snapshot android-state-status-cefr-restarted.json retains hydration 1. Removed
hideRevisions; recovery passed android-1790892417094 (20s). Recovered snapshot
proves cursor 10, hydration/outgoing 0 and new assessment cached. The durable
dependency-recovered assertion passed, including unchanged learning state.
Content-only transport outage now active for private-add; deterministic analysis
translation QA add version, no provider access. Native private-add flow running.

## iOS build and private-add finding — 2026-10-02

iOS Release passed, build-ios-true-1790891575528.log. Installed only on the task
UDID, preserving data. Initial bundle SHA-256
6862d4bdc6cf08dddf4b2c3547c540e9299377d37705e1c21bdc9b63dedb89aa; binary
b23add635533ff01afbf1b5711ae4a6ba1030622cf1f485911e0580a4c428118.
Baseline manual-sync passed ios-1790892789043 (21s). Created fixture assessment
7f3e59ac-4221-4fb3-99ff-42d75b87c08b at cursor 11; missing-revision probe running.

Android private-add first failed at an invalid QA expectation: unsaved analysis
does not show CEFR, only stored cards do. Corrected pre-save assertion. The second
run android-1790892575694 failed with native Failed to save analyzed word. This
is a real runtime defect: normal analysis defaults analysis_notes to an empty
string, while dictionary fallback parser accepts only null/nonempty strings.
Two real-SQLite tests reproduce the exact error: Cannot create dictionary fallback:
content.analysis_notes must be a non-empty string. Test log D08-private-add-before.log.

Local fix in dictionaryContentMapping maps blank analysis notes to null before
canonical parsing. Existing nonblank canonical trimming remains, and original
legacy row text is preserved. Blank/whitespace and nonblank preservation tests
pass; final focused 56/56 (D08-private-add-after.log). One initial nonblank test
wrongly expected canonical whitespace preservation; corrected to the preexisting
parser behavior and exact legacy-row preservation, without changing the parser.
Runtime mapping SHA-256 186f89003c399f059f553c64d546a545feba972bdee703803355610f9babd246.
Both QA source copies refreshed for this mapping; incremental native rebuilds
are running. Current installed artifacts do not yet contain this add fix.
Content outage removed; hideRevisions active only for status verification.

iOS missing-dependency pending passed ios-1790892867662 (28s); cold restart
passed ios-1790892932111 (39s). Both snapshots retain hydration 1 and outgoing 0.
Restored hideRevisions false; iOS recovery flow now running.

Both incremental builds for the private-add mapping fix passed:
build-android-true-1790892890793.log and build-ios-true-1790892895567.log.
Final APK SHA-256 24e20bc6930c93fc10e38867f6f11f4f7d9cc4c0c6cea19850602a61dd19772e;
final iOS bundle e34f8072855fda15b32ff50097a41dd5ea6723a74d64e7bab458e04043a2f638;
iOS binary unchanged b23add635533ff01afbf1b5711ae4a6ba1030622cf1f485911e0580a4c428118.
Full mobile after mapping fix: 142 suites, 1637 tests, 22 snapshots passed
(D08-private-add-full-mobile.log); test typecheck and focused strict lint passed
(D08-private-add-typecheck.log, D08-private-add-lint.log). Android final install
started; verify completion before retrying. iOS final install waits for current
recovery flow to finish. No runtime source changed after these builds.

iOS recovery passed ios-1790893032499 (21s), cursor 11 with empty queues and
new assessment cached. Dependency-recovered assertions pass with unchanged
learning. Final iOS/Android add-fix artifacts installed successfully.

Final Android private-add passed android-1790893096843 (33s). New balkon fallback
with unknown CEFR, pending create operation 44cd40ac-f835-4298-be5b-2a56b88cbf56,
expected v0; original fixture learning unchanged. Native image options opened,
but title Choose Image was outside Android accessibility hierarchy, so the
initial image-open assertion failed. Screenshot/hierarchy prove the two options;
use accessible subtitle Select a better image for verification. Second fixture
chosen through the observed grid, android-1790893244239 (4s) passed. Snapshot
android-state-image-final-pending.json proves URL v2 and second edit command
26498dd0-20dd-4424-b55d-504d50732885 expected v1, preserving create intent.
Cold restart running before reconnect. Raw screenshots/logs remain ignored.

Android image cold restart passed android-1790893285155 (21s). Exact operation
IDs/payloads/base versions and private states retained; learning unchanged.
Reconnect passed android-1790893342630 (17s). Snapshot
android-state-image-final-acknowledged.json proves no outgoing/hydration debt;
acknowledged assertion passed, and each create/edit has exactly one isolated
server receipt. iOS private-add now running with tuin under content-only outage.

iOS private-add passed ios-1790893557301 (32s); an initial flow attempt failed
only on unsupported Maestro hideKeyboard before analysis. Removed that unnecessary
step; the analyze button is visible above the keyboard. New tuin create command
99b5c6b6-dbc3-4788-a7d6-8cd35664b58b expected v0 has analysis_notes=null.
Image-open passed ios-1790893616396 (10s); screenshot observed the second option
at 74%,34%. Selection passed ios-1790893653847 (5s), edit command
ee57585b-d81a-4c90-bb66-89238c123fad expected v1, local image v2.
Cold restart passed ios-1790893699005 (25s); restart-pending assertion confirms
exact command intent/private states and unchanged learning. Reconnect running.
Build typecheck and full strict lint passed (D08-private-add-build-typecheck.log,
D08-private-add-full-lint.log). Supported legacy web retained its dedicated
loopback session; first reload shows both new words in legacy metadata: 5 due/0 mastered.
Canonical image convergence is still unverified at this point.

iOS reconnect passed ios-1790893758019 (21s). Acknowledged snapshot/assertion
proves commands/hydration empty and unchanged learning. Both iOS create/image
operations have exactly one server receipt. Android receiving the new iOS word;
next verify missing dependency for an updated personal card on both final builds.

Android convergence sync passed android-1790893786148 (17s). Both final clients
now have five fixture words and empty queues. Peer pinned-card image override v3
applied to fiets (operation 8c3bf8db-9211-4ae5-8f18-9596581f89e0, content v3).
Revision responses hidden only through QA proxy. Missing-card pending probes
passed ios-1790893847425 (24s), android-1790893848997 (23s): pending visible,
Up to date absent. Both snapshots prove cursor 11, debt 1, outgoing 0.
Cold-restart probes running before recovery.

Card-dependency cold restart passed ios-1790893906155 (29s),
android-1790893907920 (33s); exact hydration rows/cursor retained. Restore/recovery
passed ios-1790893973859 (23s), android-1790893976229 (24s). Both final snapshots
have image v3, cursor 11, empty content queues/debt and unchanged learning.
Card-dependency-recovered assertions passed on both. This is transport-injected
missing revision, not native network-toggle evidence. Supported legacy web fiets
detail shows unchanged EF2.50/interval1/repetition0/lastNEVER; its existing HTTPS
URL policy intentionally hides the HTTP loopback image. Do not claim image
rendering parity for these local fixtures. iOS final repeated-modal conflict QA
now running under content-only outage, translation QA local version.

Final iOS reanalysis passed ios-1790894038203 (36s); pending zolder operation
7462b748-a47e-4bc8-9d7d-37d7c7eb3eec expected v6. Peer private edit created
v7/QA server version (ff8fa57a-7b23-4b91-85b4-34e85b0cf631). Restored transport;
compare passed ios-1790894123686 (32s), with modal kept open and both choices.
Queue remains original operation in conflict; snapshot read. New local analysis
QA changed version is being applied while this comparison remains open to test
stale-local rejection. No production/provider/runtime-source operation.

Stale-local first combined flow ios-1790894201060 failed to find Keep my version
because reanalysis lost dictionary_content_conflict in the store until refresh.
SQLite proves newer intent 132a90ff-f4a3-483b-abf7-a4739ea7e920 expected v7 and
original conflicting v6 intent retained. Foreground in the same modal restored
the comparison; stale-choice rejection passed ios-1790894317544 (29s), with
Private edits changed. Reload the conflict before resolving it. Both intents
remain; no stale resolution was sent. Refreshed compare passed ios-1790894412789.

Reanalysis store metadata defect reproduced by a new unit regression. A second
test specifies owner safety for the newly added hydration boundary; before the
change, that callback is not invoked (2 failed/34 passed in the combined log,
D08-reanalysis-conflict-before.log). This is not a native account-race reproduction. Local wordActions repair
materializes the persisted word from owner-scoped SQLite before updating store,
checks owner before/after awaits, and merges against latest words. Focused 46/46
across actions/resolver/details and test typecheck pass. Full checks and both
incremental task-native Release builds are now running; existing installed
artifacts do not yet contain this store repair. Keep current private data/queues.

Keep-newer-local choice passed ios-1790894483653 (12s) on the preceding build.
SQLite canonical fallback v8 = QA changed version, null reference, empty queues;
legacy words row can still show old metadata during reconciliation. Stale rejection
preserved both exact operation IDs/payloads and unchanged learning.

Reanalysis repair full mobile 142 suites/1639 tests/22 snapshots pass, both
build/test typechecks and strict lint pass. Incremental native builds succeeded:
build-ios-true-1790894492300.log, build-android-true-1790894489633.log.
wordActions runtime SHA-256 81996111df57b763f60de95d04d21ffaf55466922a3651caa4d5967ab7378587;
QA copy matches. New APK 1fc16bc96e4490d546a6998511678ad1b9eb648c376e42a240561b5f9821ab47;
iOS bundle 52839a3361a15b6ea1906cb567e992348cacec1ec4317e1e15249a40baa4e631.
Preserving-data installs completed on the same two task devices. Final-build
stale-local/repeated-modal acceptance starting; content-only outage active,
translation QA local version. No other app/device/production operation.

Final repaired iOS reanalysis passed ios-1790894607223 (35s), operation
e54c36d8-7dbb-4d91-9c9d-b61079f5b304 expected v8. Peer v9 created by
4756854e-0238-456d-bb1e-6bdc77e2992c; compare passed ios-1790894678271 (32s).
Immediate stale-local combined flow running on this new build, no foreground
refresh added. Android new-build private reanalysis passed
android-1790894756379 (46s), balkon QA changed version, pending operation
32c06121-2a12-4e28-9ee4-b095baa1fd4a expected v2. Its delivery sync is running.
All status/private-add fixes and current store runtime fingerprints unchanged.

Final-build combined stale-local flow ios-1790894754466 reached the visible
buttons but its first tap did not activate after scrolling; no resolution request,
no command loss. New local intent ce550ea0-3032-4573-bd8c-a801d87d46cf expected v9
remained beside the original v8 conflict. Existing comparison stayed visible
immediately after reanalysis (store repair verified). Waiting for animations and
retryTapIfNoChange, per current Maestro docs, passed the standalone visible choice
in ios-1790894938439 (5s). No foreground refresh or modal close in this continuation.
Native error Private edits changed... visible; exact two payloads/versions/private
states and learning unchanged. The combined flow now includes this tap stability.
Android final reanalysis delivery passed android-1790894836102 (18s), acknowledged
assertion passes and the operation has exactly one receipt. Queues empty.

Refreshed final comparison passed ios-1790894979689 (40s), Keep-newer-local
passed ios-1790895042257 (11s), same modal. Canonical fallback v10 = QA changed
version, reference null; empty queues/debt and unchanged learning assertion.
Android's concurrent balkon change also arrived without being overwritten by
reanalyzing zolder; latest-store merge retained it. A second reanalysis is running
in this still-open modal, with content-only outage and QA local version.

Second reanalysis without closing the same final-build modal passed
ios-1790895094747 (21s). New operation
0215f332-078d-445f-bc7b-1cb423e14a15 expected v10. Peer v11/private server version
created by b00db16d-b171-4011-bfba-358185b3e228; repeated comparison running.

Repeated Compare versions returned in the same modal and passed
ios-1790895165002 (33s). Original second local intent is
still conflict/v10. While comparison stayed open, peer advanced server to v12
(b12e5d0c-fc85-42f6-87f6-cfed2a4d7d21); final-build stale-server rejection running.

Final-build stale-server rejection passed ios-1790895227809 (11s), displaying
Server content changed. Reload the conflict. Exact v10 operation/payload/private
state and learning preserved. Refreshed comparison running before choosing the
latest server v12, still in the same modal.

Final refreshed compare passed ios-1790895286720 (38s); Use-server choice passed
ios-1790895360114 (12s), still without closing this modal. Details immediately
showed QA server version and no local translation. Canonical private v12/null
reference, commands/hydration empty, unchanged learning. Both choices, repeated
conflict and stale-local/server variants are now verified on the final iOS build.
Owner-switch QA starts with these details open, navigates via app settings deep
link (normal UI requires Settings for logout), then isolated login/primary return.
This is a supported navigation/account flow; same-mounted owner mutation also
has the prior Jest regression, not a fabricated native account injection.

Android final convergence sync passed android-1790895422107 (21s), five words,
queues empty. Initial iOS account-navigation flow ios-1790895417563 stopped
before logout because iOS asked Open in De Woordenaar? for the deep link; this
was a missing QA confirmation step, not a router/account defect. Screenshot
recorded only synthetic word content. Confirmed-open continuation now running;
original flow also handles this platform dialog for future runs.

Confirmed-open account continuation ios-1790895506516 reached login but returned
Invalid email or password before isolated collection assertions. Protected UI
hierarchy confirms exact isolated email; secure password is masked, so its length
is not an actual input-length measurement. Direct local Auth verification of the
isolated fixture succeeds (only success boolean printed, no token/credential).
Password-only native retry is running with field clear and animation waits around
clipboard paste. No runtime auth change/reset/reseed; primary data retained.

Password retry ios-1790895755325 successfully signed into the isolated owner:
D08 Isolated Owner and anker visible, D08 Native QA/fiets absent. It then stopped
on Settings because generic back did not leave the iOS collection. Replaced with
the visible Back button; primary-return continuation running from the existing
isolated session, not repeating login/reset. This is QA navigation correction.

Primary-return continuation passed ios-1790895837467 (43s). Primary collection
visible, isolated collection absent; zolder latest server version and unknown CEFR
visible after reopening. SQLite retains five primary words plus the isolated
anker's separate owner row, as intended; old primary SRS and all learning rows
unchanged, queues empty. Account flow was verified across explicit continuation
segments after QA-only confirmation/clipboard/back-navigation corrections.
Opening synthetic tuin on iOS before legacy-web tombstone test.

Synthetic tuin details opened via ios-1790895932524 (25s). Legacy web delete
first redirected to local /login: normal native global sign-out invalidated the
same synthetic owner's web session. Server read-only snapshot verifies deleted_at
is still null; no deletion occurred. Restoring only dedicated d08-content-qa
web auth with the guarded fixture login helper; raw credentials remain protected.
iOS details stay open. No real owner/session/device touched.

## Final native checkpoint — 2026-10-02

After restoring only the dedicated synthetic web session, Delete word completed
from the checked tuin detail form. Server snapshot server-final-tombstone.json
confirms deleted_at = 2026-10-01T23:10:38.693+00:00. iOS modal was recorded open
immediately before the mutation (ios-tuin-before-delete.png), with no manual close.
Deletion/foreground flow ios-1790896372077 passed (6s): modal closed and tuin absent.
Final iOS sync ios-1790896418465 passed (22s), Up to date visible.

Android final sync android-1790896402398 stopped before Settings. Screenshot
confirmed a login screen: native global synthetic-owner logout had invalidated
this task's session too. No unrelated owner/session was touched. Guarded primary
login android-1790896485408 succeeded and proved four-word content/deletion; the
flow then stopped on Back text because Android exposes an icon there. This was
QA navigation, not an app content failure. Android back continuation
android-1790896568212 passed (19s), including final Up to date. Installed app/DB
were preserved throughout; no clearState/uninstall/reseed.

Final ios-state-final-closure.json and android-state-final-closure.json were
compared with pre-deletion snapshots and local server state using guarded
assert-final-convergence.py in the ignored native root. Assertion passed,
final-convergence-assertion.json: same word IDs/owner IDs and SRS fields, identical
learning queues/history, exact server translations/image URLs/tombstone, four
active primary words (balkon/fiets/huis/zolder), primary cursor 11, no outgoing
content commands or hydration debt. iOS also retains isolated anker under its
separate owner; supported account UI showed no cross-owner collection leak.

Dedicated d08-content-qa web snapshot web-final-convergence.txt confirms 4 words,
4 due, 0 mastered, balkon = QA changed version and zolder = QA server version;
tuin is absent. Legacy web intentionally filters loopback HTTP image URLs through
its existing HTTPS-only renderer. Native/server URL parity passed; legacy-web
fixture-image rendering parity is not claimed.

### Acceptance evidence and limits

| Scenario                                                                | Evidence                                                                                       | Scope                                                                                                                       |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Missing revision from CEFR-only cursor change                           | Both status-cefr-blocked/restarted/recovered snapshots and runs above                          | Status repair artifacts; service fingerprints unchanged on final builds                                                     |
| Missing revision from personal-card update                              | Both card-dependency blocked/restarted/recovered snapshots and runs above                      | Add/mapping repair artifacts; service fingerprints unchanged on final builds                                                |
| Private add/image selection/restart/delivery                            | Android balkon and iOS tuin runs/receipts above                                                | Both native platforms; exact pending commands preserved, one receipt per operation                                          |
| Reanalysis/conflict metadata                                            | Focused 46/46; Android final reanalysis and delivery; iOS immediate stale-local continuation   | Final store-repair artifacts                                                                                                |
| Both choices, repeated conflict and stale-local/server rejection        | iOS 4938439, 4979689, 5042257, 5094747, 5165002, 5227809, 5286720, 5360114 (prefix ios-179089) | Same open modal, final artifact; stale intents preserved                                                                    |
| Account switch/return                                                   | iOS 5755325 and 5837467 continuation segments                                                  | Supported Settings navigation; same-mounted owner mutation covered by Jest, not native injection                            |
| Remote deletion with details open                                       | iOS 5932524 precondition and 6372077 closure; exact server tombstone                           | Final artifact; Android deletion convergence also passed                                                                    |
| Final native/legacy-web convergence                                     | Final snapshots/assertion, iOS 6418465, Android 6568212, web snapshot                          | Content/tombstone/SRS parity; web HTTP image limitation above                                                               |
| Lost successful reply / older mobile / learning review-correction-reset | Prior October 1 content QA and September 21 platform evidence                                  | Not all rerun on final October 2 artifacts; closure reviewer must assess unchanged protocol and current regression coverage |

Final runtime SHA-256 and QA source copies reverified identical:

- syncStatusService: 232d23ec02ac7d8a7c58b01406e6e41c7eb5cb193567d3b91b29522635c15f1c.
- dictionaryContentSync: 8178f92944c1f2afd5eb35d33fa2755f3a379e5fff5af5d2da54036788feab2a.
- dictionaryContentMapping: 186f89003c399f059f553c64d546a545feba972bdee703803355610f9babd246.
- wordActions: 81996111df57b763f60de95d04d21ffaf55466922a3651caa4d5967ab7378587.
- Final APK: 1fc16bc96e4490d546a6998511678ad1b9eb648c376e42a240561b5f9821ab47.
- Final iOS bundle: 52839a3361a15b6ea1906cb567e992348cacec1ec4317e1e15249a40baa4e631.

Final full mobile: 142 suites / 1,639 tests / 22 snapshots pass, log
reports/shared-dictionary-cefr/D08-reanalysis-full-mobile.log. Build/test typechecks
and full strict lint pass in D08-reanalysis-build-typecheck.log,
D08-reanalysis-typecheck.log and D08-reanalysis-full-lint.log. Final task helper
lint, formatting and diff checks are recorded in the session checkpoint.
Runtime flags default off outside isolated QA artifacts. No learning/schema/server
protocol change was introduced by these three repairs.

Retained task-only environment: iOS DDEDCE4E-153B-48A4-A47C-B4ED0F499F1F,
Android emulator-5584 / woordenaar_d08_qa_20260921, Docker project
woordenaar-d08-qa.ZFsE50 (API 55321), proxy 55331/PID 65646, web 55400/PID 63984,
dedicated d08-content-qa browser. Both apps returned to synthetic primary.
proxy-final-state.json proves all faults false; translation QA local version.
No build/Maestro operation remains active. Raw fixture, state, screenshots, logs
and October 1 browser artifacts are protected/ignored under the native root;
older browser artifacts were left untouched. Do not replay login/reset/seed
steps or operate a different device. Reverify exact task resources on resume.

Next: GPT-6 Astra / High review of status debt accounting, blank-note canonical
mapping and reanalysis owner/materialization boundaries plus this acceptance
matrix. No independent review is claimed. Keep D08.4 unchecked until that review
resolves findings/limits. D09 not started; D01 pre-release gaps remain unwaived.
All changes local/uncommitted; no production, cutover, hosted provider, EAS,
deployment, Git publication or other-session operation occurred.

## Subsequent shutdown — 2026-10-02

The retained environment recorded above was stopped after the user requested
freeing the machine before 02:30 Europe/Amsterdam. Exact task simulator/emulator,
four containers, proxy/web and named browser shutdown verified around 01:20–01:21.
Data/artifacts intact; no other session touched. D08 paused, closure review pending;
do not restart QA resources for that local review. See [shutdown evidence](D08-task-shutdown-20261002.md).
