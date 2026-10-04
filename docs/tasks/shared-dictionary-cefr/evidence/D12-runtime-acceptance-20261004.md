# D12 runtime acceptance — 2026-10-04

Source commit `e09f5ca`. Recommended Astra / High. Work is local synthetic QA
under the existing task authorization; no hosted release or CEFR activation.
Private evidence: `reports/shared-dictionary-cefr/d12-verification-20261004/`.

## Runtime matrix

| Case                                                 | Required observation                                                      | Status                                                                             |
| ---------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Retained local database upgrade                      | Identical existing personal/content/learning rows; CEFR disabled          | PASS: three D11 migrations, eight identical table projections                      |
| Native build and retained install                    | Current SDK57 patch versions, QA bundle, no data clear                    | Android built/installed with full projection equality; iOS build running           |
| Both native cold restarts with transport outage      | Exact IDs/SRS/content and queue identities survive                        | Pending                                                                            |
| Nonempty learning and independent owners             | Owned progress changes only; other owner's rows/history remain isolated   | Shared zeil same-entry test PASS over real Auth/REST; native pending               |
| Content changes during review and cache invalidation | Captured review content stable, new head refresh does not reset SRS       | Current DB/mobile/web regression suites pass; runtime reconciliation pending       |
| Web actual app                                       | Read/edit/review/navigation on current source and migrated local database | Login/collections/review PASS so far; one Easy event and reload under verification |
| Read-path rollback and backfill interruption         | Subsequent learning retained, exact receipts on resume                    | Current PostgreSQL regression suite passes; runbook reconciliation pending         |

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

These passing contracts support D12.4/D12.5 but do not replace the pending
native runtime observations above. Tests do not claim real P1/P2 preservation,
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
App has not yet launched on the new APK. Android startup initially delayed storage
availability; after `sys.boot_completed=1`, the original database path was readable.
A system Bluetooth crash was observed during startup; no app crash is inferred.

Installed APK/bundle hashes and closed database backups are private. Android
backup includes existing WAL/SHM when present; iOS uses SQLite backup API from a
read-only source connection. `native-installed-before.json` records original
artifacts. No original application data was edited to manufacture a pass.

Local REST is now blocked through the QA fault proxy for native preservation.
The old iOS app is running a one-Good UI flow to produce a real pending learning
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
backup before installing the new app. iOS compilation is still running.

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
