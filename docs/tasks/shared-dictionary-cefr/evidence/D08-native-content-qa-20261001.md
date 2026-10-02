# D08 native content QA — 2026-10-01

Status: resumed, acceptance incomplete. The user explicitly authorized resuming
QA on the dedicated devices, superseding the September 26 pause. AUTH-15 retains
its original isolated/local-only boundaries. No production, hosted writes, EAS,
paid providers, publication, commits or deployment.

The status defect below is historical: the subsequent
[local repair](D08-sync-status-repair-20261001.md) and synthetic tests pass.
These installed native artifacts still predate that repair and require rebuilding.

## Durable recovery

- The Docker project `woordenaar-d08-qa.ZFsE50` survived; macOS expired the
  temporary configuration, fixture and copied build/source files.
- Recreated CLI configuration under ignored
  `reports/shared-dictionary-cefr/woordenaar-d08-qa.ZFsE50`, retaining the exact
  existing Docker project. API 55321, PostgreSQL 55322. No hosted project link.
- Artifacts/source/private fixture now live under ignored
  `reports/shared-dictionary-cefr/woordenaar-d08-native.20261001`.
  Two new synthetic `example.invalid` users were seeded in this local stack only.
  Old synthetic users were not deleted; no production identities were used.
- Helpers validate exact temp or ignored report roots, fixture basename, and
  task device IDs. Formatter and strict helper lint passed.
- iOS task UDID `DDEDCE4E-153B-48A4-A47C-B4ED0F499F1F` booted successfully.
  Android AVD `woordenaar_d08_qa_20260921`, emulator-5584, boot completed.
  Only these devices are in scope; no unrelated simulator was operated.
- Recovered installed artifacts into `recovered.app` and `recovered.apk`.
  SHA-256 values exactly match the September 26 revised builds:
  Android APK `6b90193347679fd6530bd5622211f94ff232917c38f0c1e49e05deafebb0a8c5`;
  iOS bundle `b016547abaa2df678e9923bb34e08f54b5e05db73b08584c4fda28e02859f859`;
  iOS binary `663ddcd3fb78d12a1a364d40a9977c9e610910f1cfa342b29edb672954e04646`.
- Loopback proxy 55331 forwards only to API 55321; deterministic provider fixtures
  replace all analysis/images. Android reverse port mapping targets emulator-5584.
- Initial Maestro flows passed on both platforms. Clipboard entry delivered the
  exact synthetic password on each (proxy boolean checks only). iOS run
  `ios-1790888427584`: 1m34s; Android `android-1790888552827`: 1m53s.
  Linked A2 estimated/B1 reviewed, private unknown CEFR, translations and manual
  sync passed. Baseline SQLite snapshots have empty queues and two cached revisions.

## Content transport outage and cold start

- Full REST outage hides AI controls because the existing access check defaults
  to read-only on network failure. This is not a dictionary queue failure. The
  proxy now supports content-only outage so deterministic analysis and permission
  checks remain available. This is injected transport evidence, not airplane mode.
- Three initial reanalysis attempts failed to locate the button: full REST outage
  removed it; after restoring access, exact text did not match the icon-bearing
  button. Fragment-scoped swipes and `.*Re-analyze Word.*` fixed the QA selector.
  No runtime application code was changed to obtain these passes.
- Native iOS reanalysis passed (`ios-1790889030511`, 17s). Pending operation
  `e4bbdbf9-ceed-419e-ae45-18b2b584e665`, expected version 0, contains the private
  `QA local version` translation and local image v1. Server still had attic/v0.
- Cold stop/relaunch passed (`ios-1790889081996`, 18s). Exact operation ID,
  expected version, payload, private card overlay and SRS/history survived.
  A first helper assertion incorrectly required the delivery status to stay
  `pending` rather than become retryable `error`. It also treated the refreshed
  legacy words row as authoritative despite the private overlay. The corrected
  assertion checks actual command intent, card state and unchanged learning data;
  native UI separately confirmed the private translation after restart.
- Reconnect/manual sync passed iOS `ios-1790889140635` (23s), Android
  `android-1790889144420` (18s). iOS pending queue and hydration debt became empty;
  exactly one server receipt exists for the operation. Android SQLite has the new
  private translation and empty queues. SRS remained interval 1, repetitions 0,
  ease 2.5, null last review; no learning events/commands/corrections/progress.
- Supported legacy local web login/collection passed. Reloaded collection snapshot
  `page-2026-10-01T21-13-39-831Z.yml` shows the new translation, 3 due and 0 mastered.
- A second iOS pending edit passed (`ios-1790889208934`, 36s), operation
  `4004ac5c-8737-47ac-b554-f9ec32e46a48`, expected version 1. A second synthetic
  client changed zolder to `QA server version`/v2.
- The first compare attempt waited only 60s without triggering lifecycle sync,
  shorter than the five-minute interval. A second attempt found the conflict but
  tapped a clipped header control; the modal closed before comparison assertions.
  The QA flow now requires an already-visible modal and uses short, slow swipes
  to expose the header without triggering the sheet dismissal gesture.
  These failed attempts are not successful repeated-modal evidence.
- iOS comparison passed (`ios-1790889461843`, 21s), showing both translations
  and both choices. While comparison stayed open, the peer changed server content
  to v3. Stale Keep-my-version rejection passed (`ios-1790889518920`, 12s),
  displaying `Server content changed. Reload the conflict.`. SQLite proves the
  original operation/payload/private overlay and learning state remain unchanged.
- Refreshed compare + Keep-my-version passed (`ios-1790889580278`, 31s).
  Replacement operation `26fd7ab4-cec5-466a-bba1-fc2432554285` produced private
  content v4 with null reference and the local translation; queue/debt empty,
  unchanged learning state. Native details displayed the chosen content.
- A second edit passed without closing that same modal (`ios-1790889650557`,
  21s). After a peer edit to v5, `ios-1790889744365` found the returned Compare
  control in the same open modal, but its wide scroll gesture dismissed the sheet.
  This failed flow is not a complete repeated-modal/server-choice pass.
  Reopening and choosing the server passed (`ios-1790889865056`, 44s): native
  details immediately displayed `QA server version`, not the local translation.
  SQLite confirms private v5, empty commands/hydration and unchanged learning.
  The comparison helper now uses short slow swipes, but a complete repeated-modal
  choice flow remains to be rerun.
- Current-tree focused regression checks passed: conflict/details 10 tests;
  word-card usage notes 7 tests and 4 snapshots. Helper strict lint and formatting
  passed; runtime source hashes still match the recovered builds.

## Android restart, lost acknowledgement and convergence

- Android private reanalysis passed `android-1790889962123` (34s), followed by
  cold restart `android-1790890028623` (16s). Operation
  `dbc6b76b-1963-4e0e-8d91-48217b0faaca`, expected v5, its exact payload and
  private overlay survived. Native details showed `QA android version`.
- Injected loss of the successful server reply during foreground delivery
  (`android-1790890083420`, 4s). The server had one receipt while Android kept
  the same operation in its retryable queue. The proxy then blocked REST to make
  the acknowledgement gap observable; this is transport injection, not airplane mode.
- Restored transport and synced: `android-1790890128658` passed (24s). The proxy
  recorded two successful responses for the same operation ID; the server still
  had exactly one receipt. Commands/hydration became empty and private content v6
  remained. SRS fields and all learning queues/history were unchanged.
- iOS received the Android translation (`ios-1790890133426`, 20s). Supported
  legacy local web reload `page-2026-10-01T21-30-12-720Z.yml` also shows it, with
  3 due and 0 mastered. Both native databases have empty content queues.

## Missing dependency: recovery safe, status defect reproduced

- Created a new fixture CEFR head in the local database only, preserving the
  assessed A2/estimated value. Delivery cursor became 9, while iOS had committed 8.
  The proxy returned an empty revision response despite the revision existing
  upstream. This tests a missing transport dependency, not deletion of cached data.
- Native status probe `ios-1790890255048` failed (40s): after a failed sync the
  Settings badge still read `Up to date`. SQLite retained cursor 8, so the
  incomplete page was correctly not acknowledged. No outgoing commands existed.
- Two image-override harness attempts were rejected (`invalid-content`, then
  `invalid-revision`) because the helper first used a raw value instead of a set
  operation and then tried to link an already-linked card. No mutation was
  accepted. The corrected helper uses canonical `edit-private` with image set.
  Accepted operation `1670cf99-1240-4c03-b6fc-a403015cc339` makes fiets v2 with
  the same reference and image v2. This peer-fixture update is not native image UI QA.
- Repeated probe `ios-1790890426666` failed (41s) with the same incorrect badge.
  `ios-state-dependency-card-blocked.json` proves **one durable hydration item**,
  zero outgoing commands and cursor 8. This establishes a concrete status defect,
  beyond the earlier change-cursor-only observation.
- Added a failing unit regression in `syncStatusService.test.ts`: a requested
  owner's missing card must count as pending. Focused Jest with `--coverage=false`
  passes the existing two tests and fails only the new test (expected 1, actual 0).
  The initial focused command also enforced repository-wide coverage thresholds;
  those additional coverage failures are a harness issue, not independent defects.
- Root cause: `syncStatusService.getSnapshot` counts legacy metadata and outgoing
  dictionary commands but ignores `getMissingCardWordIds`. In addition,
  `refreshChanges` does not record a card-refresh obligation before pulling a
  change page, so cursor-only refresh failure needs separate regression/review.
  Keeping the old last-success timestamp is valid; presenting incomplete work
  as up-to-date is not. No runtime fix has been made in this QA session.
- All proxy faults were disabled before recovery. iOS `ios-1790890500877`
  passed (24s) and Android `android-1790890504780` passed (25s). Read-only
  snapshots `ios-state-dependency-recovered.json` and
  `android-state-dependency-recovered.json` show both cursors at 9, zero hydration
  and outgoing commands, identical word content/image and the new assessment
  `507fcb13-af3e-4658-b226-3196455fb0ef` cached on both. Automated assertions
  verify unchanged SRS and all learning queues/history. An initial comparison
  used the older baseline snapshot which lacked the learning field; comparison
  against the recorded pre-dependency acknowledged snapshot passed.
- Checkpoint gates: strict lint for the three changed helpers and regression
  test passed with zero warnings; mobile test typecheck, focused formatting and
  `git diff --check` passed. The sync-status regression remains deliberately red;
  the complete mobile suite has not been rerun after adding it. Runtime source
  fingerprints and branch/HEAD still match the recorded values.

## Running operations

- Proxy: tool session 68080, PID 65646 at this checkpoint; previous PID 62731 was specifically verified and
  terminated for the content-only outage helper upgrade. Check the current PID
  via port 55331 before any later shutdown.
- Android emulator: tool session 99185, port 5584.
- All native Maestro flows have finished; no device automation remains active.
- Web server: tool session 22956, PID 63984, loopback 55400;
  browser session `d08-content-qa`.
- Proxy state: all four fault flags false; deterministic translation remains
  `QA android version`. Inspect `/__qa` before starting another scenario.
- Local Docker stack and both task devices remain available.
- Debug artifacts are ignored/private and may contain synthetic credentials.
  Do not copy raw command/process argument output into portable evidence.
- October 1 Playwright artifacts were moved from the untracked `.playwright-cli`
  directory into the ignored native root's `web-artifacts`; September 26 files
  were left untouched. Do not accidentally commit old raw artifacts either.

Next: **GPT-6 Astra / High** for the reproduced status/dependency-debt finding.
Fix with owner-scoped, deduplicated accounting and safe change-page recovery,
then rebuild/verify the affected native clients and finish the remaining closure
matrix. D08.4 stays open; D09 not started. Do not claim full native acceptance.
