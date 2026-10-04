# D12 runtime acceptance — 2026-10-04

Source commit `e09f5ca`. Recommended Astra / High. Work is local synthetic QA
under the existing task authorization; no hosted release or CEFR activation.
Private evidence: `reports/shared-dictionary-cefr/d12-verification-20261004/`.

## Runtime matrix

| Case                                                 | Required observation                                                      | Status                                                                     |
| ---------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Retained local database upgrade                      | Identical existing personal/content/learning rows; CEFR disabled          | PASS: three D11 migrations, eight identical table projections              |
| Native build and retained install                    | Current SDK57 patch versions, QA bundle, no data clear                    | PASS: both current artifacts built/installed; complete projections equal   |
| Both native cold restarts with transport outage      | Exact IDs/SRS/content and queue identities survive                        | PASS: both offline cold flows; complete projections equal                  |
| Nonempty learning and independent owners             | Owned progress changes only; other owner's rows/history remain isolated   | PASS: shared zeil owner isolation; native pending event delivered once     |
| Content changes during review and cache invalidation | Captured review content stable, new head refresh does not reset SRS       | PASS: current contract suites; native private content unchanged after sync |
| Web actual app                                       | Read/edit/review/navigation on current source and migrated local database | PASS: login, collections, one Easy, reload and light/dark visuals          |
| Read-path rollback and backfill interruption         | Subsequent learning retained, exact receipts on resume                    | PASS: current backfill and lossless rollback executable rehearsal          |

## Safety and retention

The assigned iOS UUID is `DDEDCE4E-153B-48A4-A47C-B4ED0F499F1F`; Android AVD
`woordenaar_d08_qa_20260921`, serial `emulator-5584`. Both were off on preflight.
No other device is authorized. The two retained synthetic accounts are read from
the existing private fixture; original source fixtures and device data stay intact.

Retained DB/Kong originals are stopped with suffix `-d12-port-backup`; replacements
use the same named volume and loopback-only host ports. `retained-loopback.json`
records original/replacement/image IDs. Auth/REST unchanged. Do not start an old
DB backup while the replacement uses its volume. No `docker rm -v`, `supabase stop
--no-backup`, reset, uninstall or volume deletion is allowed for retained resources.
At exit stop exact four current services, keep data/backups, shut down only assigned
devices and close only `d12-local-qa` plus recorded runner/proxy/web PIDs.

## Limits

D01 real installed-client versions and P1/P2 pending queues remain unverified.
D10 historical Android v14/v15 native-storage tests are distinct from a complete
historical APK or historical iOS upgrade. Do not turn those limits into a release
approval. D11 CEFR remains a reduced diagnostic/dormant deliverable with automatic
qualification blocked. Do not replay provider requests or enable schedules.

## Contract and role evidence map

The final local matrix reruns these current contracts (no provider required):

- `scripts/postgres-tests/shared-dictionary-schema.test.mjs`: authenticated
  current-public reads; no client provenance read/publication; immutable history;
  pinned-owner retired content; legacy-write coexistence and exact personal IDs.
- `scripts/postgres-tests/dictionary-content-protocol.test.mjs`: owner/foreign/
  anonymous command boundaries, version conflicts, private overrides, idempotent
  receipts and lossless read-path rollback to snapshot v1.
- `scripts/postgres-tests/dictionary-backfill.test.mjs`: interrupted transaction,
  receipt resume, changed-input fencing, independent owner IDs and a review
  arriving after plan creation that survives apply and read rollback. The
  current full PG16 run passes the same executable rehearsal described in
  [D06](D06-backfill-rehearsal.md); no historical result is substituted for a rerun.
- `scripts/postgres-tests/cefr-budget.test.mjs`: client ledger/control access
  denied; disabled/mismatched/empty work reserves zero; overlap, immutable price,
  request/token/cost ceilings, stale policy, cancellation and conservative receipt
  settlement. Final affected 29/29 pass; real provider never used.
- `supabase/functions/_shared/cefr-worker/`: unqualified/disabled handler makes
  zero calls; incorrect secrets, cancellation and ignored abort are tested. The
  5ms unit deadline and >5000ms rejection remain unchanged by SQL test tolerances.
- Mobile 156-suite run includes file-backed SQLite upgrade, owner-scoped queues,
  review snapshots, content invalidation and import/recovery persistence; web
  86-suite run covers the equivalent owner/session/transfer boundaries.

These passing contracts support D12.4/D12.5 alongside the completed
native runtime observations below. Tests do not claim real P1/P2 preservation,
independent CEFR gold or a reviewed live rollout manifest.

## Current live observations

- iOS booted; `ios-state-d12-before-update.json` captures 19 retained words,
  zero content/hydration queues and five cached revisions before app update.
  Source copy matches 561 mobile/domain/contract files by SHA-256.
- Real web UI: primary synthetic login, collections and Meaning recall render;
  unknown CEFR remains unknown. One Easy on `huis` records event
  `7cf43b57-464f-4aa4-ae7e-7533e5c5d786`, repetitions 1 and interval 4.
  Other 27 rows, all collections/access/content state are identical. Server
  snapshots and `web-review-intent.json` bind the result; do not repeat it.
- `shared-progress.mjs` used two newly authenticated local sessions under the
  retained fixture accounts. Both zeil cards pin entry
  `5e5f83c5-f2b0-4b89-bf20-5342739955a2` and the same revision with distinct
  personal IDs/owners. Foreign assessment is denied without changes; owner's
  Easy records once; replay with the same event ID returns the same receipt.
  Peer word/SRS remain byte-identical and peer cannot read the owner's event.
  Both temporary auth sessions sign out with local scope only. Receipt
  `shared-progress.json` binds the exact request and results. This is real
  Auth/REST evidence, not a second browser/native UI assessment.
- Android first snapshot failed because its SQLite path was unavailable during
  startup. No install, launch, wipe or reset occurred. Inspect boot/storage state
  before proceeding; missing data must not be papered over with reseeding.

### Android build and retained install

Release APK build PASS. SHA-256
`17127358d0a8a3eef37a2a90863c1d62e62be4f48079c6c16047a716f225114b`;
manifest confirms original QA package identity, OTA disabled, and compiled bundle
contains only the configured local QA backend for this app. `adb install -r`
PASS with no uninstall/data clear. Complete before/after SQLite helper projections
are equal: 24 words, SRS/content/import/recovery state, empty learning/content queues.
The new APK later passed the offline cold flow below. Android startup initially delayed storage
availability; after `sys.boot_completed=1`, the original database path was readable.
A system Bluetooth crash was observed during startup; no app crash is inferred.

Installed APK/bundle hashes and closed database backups are private. Android
backup includes existing WAL/SHM when present; iOS uses SQLite backup API from a
read-only source connection. `native-installed-before.json` records original
artifacts. No original application data was edited to manufacture a pass.

Local REST is now blocked through the QA fault proxy for native preservation.
The old iOS app completed a one-Good UI flow, producing a real pending learning
command before upgrade. Inspect `native-pending-review-intent.json`, flow log and
SQLite before retrying any assessment. Restore the proxy after preservation tests.

### Genuine pending learning before iOS update

Old installed iOS app passed `D12-native-pending-review.yaml` (30 seconds),
using normal Meaning recall UI and exactly one Good with local REST blocked.
`ios-state-d12-old-pending.json` has one learning event and one durable learning
command; the previous snapshot had neither. Exact event/operation/word/user IDs
are bound in private `native-pending-review-intent.json`. This consumed the
one-off assessment: do not rerun the flow to recover a missing screenshot.
The old app is stopped and `ios-pending-before-update.sqlite` saves a coherent
backup before installing the new app. iOS compilation subsequently passed.

Web reload accepted the beforeunload prompt and displayed 8 due in the collection
and 9 overall, down from 10 and 11 after the two intentional assessments. Exactly
two distinct expected server event IDs remain; no duplicate. These intentionally
new events are the baseline for subsequent native synchronization.

### Browser visuals and Android setup retry

Actual web review selection captured under both system color schemes. Both
screenshots were visually inspected: controls/text readable, selected Meaning
recall and collection scope retained, 8 due/9 overall as expected. This is an
OS-media theme test, not a saved account setting change. The named browser session
is closed; web/proxy remain for native QA.

First Android cold-start flow failed its collection assertion. Its captured screen
shows a System UI ANR over the app, not an application error view. The post-attempt
full data projection still matches the pre-update snapshot. The task-only reverse
mapping tcp:55331 had also been absent after emulator boot; restored it. The flow
now conditionally taps Wait on the observed system dialog before the same cold
start/assertions. Retry is in progress, no app reset or extra learning assessment.

Second Android attempt reached the cached 10-word collection successfully; its
zolder assertion failed because the word was below the viewport. Screenshot
inspection shows normal collection content, not a missing word or crash. The
flow now scrolls to zolder before the same detail assertions; final retry running.
These setup failures are retained separately from acceptance results.

### Android offline cold start PASS

Final corrected flow `android-1791135753113` PASS in 46 seconds. Updated app
cold-started with REST unavailable, opened retained D08 Native QA, scrolled to
zolder, and showed the exact private translation `QA local version` plus
`CEFR level unknown`. No provider call or new assessment. Earlier failed setup
attempts remain documented; no app-source repair was needed for them.

### Fresh iOS artifact and install preservation

Release simulator build PASS after the SDK57 patch changes. Compiled bundle SHA-256
`d7955b537cd10f673a1b708aadaf917c433a65d0d6603dd776855b38a23f8255`;
original app identity retained, OTA disabled, loopback QA backend embedded and no
hosted Supabase endpoint found. `simctl install` preserved all 19 words and the
complete old-app pending projection, including the exact single event/command.
`verify-ios-installed.json` records full equality. Offline cold flow later passed.
Android post-cold snapshot also equals its full pre-update projection (24 words,
zero pending learning); `verify-android-cold.json` records the comparison.

## Final convergence and criterion reconciliation

- iOS offline cold flow `ios-1791136041878` PASS (31 seconds). All 19 words,
  content/import/recovery state and exact old-app pending event/command survived
  install and cold restart byte-for-byte in the captured projections.
- Restored local REST after both offline checks. A control-response assertion
  initially looked for `blockRest` at the wrong nesting level; the POST had
  succeeded. A read-only GET confirmed `state.blockRest: false`; no assessment
  or request was replayed to repair the receipt.
- iOS settled sync `ios-1791136117971` PASS (26 seconds); Android
  `android-1791136176941` PASS (20 seconds). Both show Up to date.
- Server and both clients contain exactly the three intended event IDs: web
  huis, Auth/REST zeil and old-iOS duin. Each client has zero pending learning
  commands and identical canonical SRS for the three words. Personal ID sets
  remain 19/24, all other local words are unchanged, and all collections,
  placement, import receipts, private content, revisions and CEFR heads equal
  their pre-update projections. Content/hydration/import/recovery queues are empty.
- Server final snapshot equals its post-iOS snapshot even after Android sync:
  28 words, 3 events, 3 checkpoints, 3 heads, no corrections. All 25 unassessed
  words and all collections/access/content rows remain unchanged. Receipts:
  `verify-convergence.json`, `native-content-preservation.json`,
  `server-preservation.json`, `server-final.json`.

D12.3 is satisfied for the retained synthetic iOS/Android installations and actual
web application on current source/dependencies. The native test updates the
previous QA build; it does not claim a historical production APK/iOS upgrade.
D12.4 combines real two-owner Auth/REST isolation and unchanged private content
with the current complete role/RLS and client-session suites listed above.
D12.5 combines exact before/after identifiers, nonempty queue preservation and
cross-client learning with the rerun interrupted-backfill/receipt-resume and
post-link-review rollback tests. The operator procedure in
`scripts/shared-dictionary/README.md` retains references, learning authority and
new review writes while disabling the read path; the 16-case backfill rehearsal
and content-protocol rollback case pass in the current PG16 run. No old snapshot
was restored over learning writes. Review-content freezing and content-only
invalidation pass in current mobile content-sync/restart and web dictionary-session
regressions; those cases are automated contract evidence, not new UI mutations.

No unresolved local data-loss, privacy, authorization or learning-protocol defect
was found. Local workflow-equivalent checks pass; hosted CI is not run. D01
real-device/queue and D13 operation approvals remain release prerequisites.

## Cleanup

Verified complete: four current task containers and two original DB/Kong backups
are stopped; both assigned devices are off; runner/proxy/web PIDs are absent;
ports 55321, 55322, 55331 and 55400 are closed. All fault flags were false before
proxy shutdown. `cleanup-receipt.json` records exact IDs and verification time.
Retained device databases, Docker volumes, original containers and private backups
remain intact. No uncertain operation remains.
