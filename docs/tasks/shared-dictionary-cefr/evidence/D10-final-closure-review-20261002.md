# D10 final closure review — 2026-10-02

Starting `ee71f73`, source `da41085`, existing feature branch. User-confirmed
Astra / High, AUTH-17/18/19. No application source changed in this review.

## Exit evidence reconciliation

| Gate                                         | Evidence and result                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D10.1–D10.2 immutable manifests / mappings   | [Contracts](D10-import-contracts-20261002.md): backward-compatible explicit provenance; published v1 and bundled fallback preserved.                                                                                                                                                                                                                                                                                                                                 |
| D10.3 duplicate / move / read_only / offline | [Offline review](D10-offline-import-review-20261002.md), [recovery repairs](D10-recovery-review-repairs-20261002.md), [native acceptance](D10-native-acceptance-20261002.md): durable IDs, uncertain replies, newer peer placement, cancellation, restart and queue preservation pass. [Final runtime](D10-final-runtime-20261002.md): cached official read_only offline import uses private fallback when mappings are unavailable, then same-ID ordinary delivery. |
| D10.4 recipient authorization                | [Catalog runtime](D10-catalog-runtime-20261002.md): mapped official/shared imports, private overrides, hidden source rejection, RLS isolation and revocation pass. No republishing in final visual review.                                                                                                                                                                                                                                                           |
| D10.5 self-contained transfer                | [Web acceptance](D10-web-acceptance-20261002.md), [cross-client acceptance](D10-cross-client-acceptance-20261002.md): different-owner reimport, retained personal IDs, recipient re-export, native duplicate preview and revoked-source export pass.                                                                                                                                                                                                                 |
| Native persistence                           | [Upgrade](D10-native-upgrade-20261002.md): retained apps preserved; isolated Android native SQLite/AsyncStorage v14/v15 fixtures migrate to v16 with nonempty learning/queues preserved.                                                                                                                                                                                                                                                                             |
| Web review repairs                           | [Transfer re-review](D10-web-transfer-rereview-20261002.md), [session re-review](D10-session-revocation-rereview-20261002.md): origin validation, uncertain target identity and revoked-session entry pass.                                                                                                                                                                                                                                                          |
| R4 action contrast                           | [Repair](D10-import-contrast-repair-20261002.md), [independent re-review](D10-import-contrast-rereview-20261002.md): source-rendered 40 checks /16 states /two themes, focused 3 suites /13 tests pass. Actual-page/Safari results are recorded below.                                                                                                                                                                                                               |

Limits remain explicit: Android historical migration evidence uses real native
storage with fixtures, not a complete historical APK or historical iOS install.
Interrupted migration is covered by file-backed tests. Cross-client runtime
review histories were empty; nonempty history preservation is covered separately
by file-backed and native Android migration evidence. No production deployment,
cutover, live provider quality/cost sample or public release was tested/authorized.
D01 open items and D13/D14 approval/observation gates are not waived.

## Final R4 real-page acceptance

PASS, 2026-10-02. Real Next.js pages use the retained synthetic backend. Desktop
computed CSS and screenshots cover official Import 0 (disabled), bundled Import
57 (enabled), bundled Import 0 after Clear selection, and Publish collection
(enabled), in light/dark. All controls have 44px height, expected enabled state,
and distinct token foreground/background. Desktop theme measurement temporarily
sets the root dataset and restores it; it is a diagnostic, not a settings test.

Actual iOS Safari repeats those four cases in both system appearances. Both
Maestro flows PASS; all eight full-screen captures visually reviewed. Enabled
labels are legible, disabled labels remain distinguishable with existing opacity,
and selection/disabled semantics pass. No import or publish button was submitted.
The prior 40-check source fixture additionally covers shared import, pending and
success states; source share remains revoked and was not republished just to
reproduce those states. Actual recipient/source authorization was already accepted
in the catalog runtime evidence above.

The saved [visual flow](D10-native-safari-r4-visual.yaml) requires the retained
synthetic primary Safari session and exact local runner/fixtures. Run with the
existing D08-native-maestro wrapper and assigned iOS UUID, first light then dark;
rename the four screenshots by theme between runs. Restore original appearance
and stop task resources afterward. It only navigates and changes local selection.

Safari setup exposed automation input issues: coordinate/selector focus attempts,
nonexistent Done, and keyboard input/paste produced incomplete secure-field text.
These attempts are not counted as acceptance. Native Simulator paste via its UI
submitted both exact fields (proxy boolean checks); password-save prompt declined.
The original host clipboard was privately preserved/restored and its temporary
copy removed; simulator clipboard cleared. A later locked Mac prevented another
CUA observation; the already-running isolated device flow completed without any
unlock or security change. Failed setup flows/logs stay private. No application
fix or authentication bypass was introduced for setup.

## Preservation and shutdown

All eight captured server tables match the pre-QA snapshot exactly: 28 words,
22 content states, nine collections, four access rows, and empty review tables.
The full captured iOS native database projection is also identical; native app
was not launched, its 19 word/SRS/learning projections and empty queues retained.
Android stayed off. No schema, collection share, import or content write occurred.
All fault controls remain false. All 143 application source fingerprints match.

Task-only resources OFF verified **19:28:27 UTC /21:28:27 Amsterdam**: assigned iOS
Shutdown, Android absent, four exact containers exited, named desktop browser
closed, verified runner/proxy/web/browser PIDs absent, ports 55331/55400 closed.
Original iOS light appearance restored. Retained volumes/data and private artifacts
remain available. No pending runtime job, uncertain write or auth restoration.

Private root: `reports/shared-dictionary-cefr/d10-r4-review-20261002/` contains
computed-style results, desktop/eight Safari screenshots, Maestro logs, server
snapshots, preservation/cleanup receipts and failed setup attempts. Native before /
after snapshots remain under `woordenaar-d08-native.20261001` (`d10-r4-before` /
`d10-r4-after`). [Sanitized summary](D10-final-closure-summary-20261002.json).

## Decision and next boundary

D10.1–D10.5 and the D10 exit gate are complete within the documented local QA scope.
No unresolved R1–R4 finding remains. D11 is next, starting D11.1 on GPT-6.1 Sol /
High; this session does not begin D11. Current-thread picker control is unavailable,
so the user must switch manually. Start with existing analysis/cache contracts and
fake-provider-safe local work; schedule stays disabled. A live quality/cost sample,
production/cutover, publication/deployment and push/PR/merge remain unauthorized.
D01 partial gates and D13/D14 release/observation gates remain open.

Closure/evidence commit `7a79223` normal hooks PASS: mobile 156 suites /1796 tests /
22 snapshots; web 86 suites /778 tests, one existing skipped suite/test. All 143
source hashes match after hooks. Private `commit.log` retained. Local-only; no push.
