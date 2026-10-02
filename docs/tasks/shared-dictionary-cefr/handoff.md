# Shared dictionary and CEFR — current handoff

Last checkpoint: **2026-10-02 — D10.3 durable offline import implementation; review next.**
Next action: GPT-6 Astra / High review of the new insert-only RPC, immutable
receipts, conflict retry, read-only metadata delivery and deferred personal SRS
hydration. Follow [the new checkpoint](evidence/D10-offline-import-intents-20261002.md),
then finish D10.3-D10.5 integrated import/export coverage. D10 remains open.
Source is committed locally as `dfdc7f0` under AUTH-18 on the existing branch,
following `039f2ff` documentation and `a59acad` implementation. No push/PR/merge.
The following scoped documentation commit preserves this handoff; private
`.playwright-cli/` browser artifacts remain uncommitted.
New SQLite v14 retains v13 state and queues; deployed schemas/flags are unchanged.
Verification: focused mobile 9 suites / 181 tests; full PostgreSQL 188/188; mobile
test typecheck, strict changed-file zero-warning lint and target generation/check
pass. Normal commit hooks also passed: mobile 147 suites / 1682 tests /
22 snapshots; web 75 suites / 642 tests, one pre-existing skipped suite/test.
No test, generator, commit-hook or QA job remains running.
No native/D08 QA resource was started. All new SQL/codegen resources cleaned up.
The [preceding review](evidence/D10-astra-review-20261002.md) is historical evidence
for `a59acad`; the fields below retain that checkpoint's verification history.

Preceding review gates (`a59acad`): full PostgreSQL 183/183; full mobile 144 suites / 1658 tests /
22 snapshots; full web 75 suites / 642 tests (one pre-existing skipped). Mobile test typecheck, strict
changed-file lint, target contract check and staged diff check passed. The normal
commit hooks ran without bypass. The shared-owner, collection-null, pending-command,
phantom-ID and identity-preservation repairs are documented in the review.
No test/generator/QA job remains running. All synthetic clusters and generator
containers/networks cleaned up; retained task native/D08 QA resources stayed off.

D10 local checkpoint: final 10 mobile suites / 124 tests, 4 new web suites / 25
tests and 8 SQL tests pass. Earlier full web run: 74 suites / 640 tests plus one
pre-existing skipped. Typechecks, strict scoped lint and deterministic target
generation/check pass through `20261002100000_add_dictionary_import_protocol.sql`.
Scoped formatting and `git diff --check` pass.
Both generator runs cleaned up only their new temporary containers/networks.
The earlier local checkpoint is superseded by the committed review repairs above.
D10.3-D10.5 are not closed. No running
test/generator/QA job. Exact D10 paths/hashes, limitations and next actions:
[D10 checkpoint](evidence/D10-import-contracts-20261002.md).

Default-off web effective-content integration is complete: owner bulk reads,
one v2 review snapshot, versioned private edits, explicit revision adoption,
CEFR UI, cache refresh and frozen active questions. Actual QA found and fixed
rapid review restart staleness, reset-only server retry, and a badge grid shift.
Final 71 web suites / 617 tests pass (one pre-existing skipped), typecheck,
strict lint, scoped format and diff gates pass. Expanded paired benchmark:
240 samples, 30/cell, 500/2500 words, cold/client; every median/p95 regression
below 10%, maximum increase 2.6%. Exact evidence and limits:
[D09 integration](evidence/D09-web-integration-20261002.md),
[performance](evidence/D09-performance-summary.json),
[source hashes](evidence/D09-source-sha256.json).

**All task QA resources are off.** Named browser, web/proxy runner and four task
containers stopped/verified at 06:59; ports 55331/55400 closed. Native devices
were never started and remain off. Final synthetic benchmark exited 0 with
its temporary servers/browser/backend cleaned up. No pending build/test/QA job.
Data, volumes, copies and reports retained. Other sessions/devices untouched.

Task state: D02–D09 done; D10 in_progress; D11–D14 pending; D01 blocked/partial.
D01.2 device/learning-queue evidence and D01.5 quota limitation remain open;
D13 approval and D14 observation/retirement gates are not waived.
Branch `feature/shared-dictionary-schema`, current implementation `dfdc7f0`
following base implementation `a59acad`; no push/PR. Default runtime dictionary flags remain off outside QA.
No production, schema cutover, publication, deployment or paid provider calls.

## Next resume

1. Read [D10 stage card](steps/D10.md), its focused inputs and permissions.
   Review the new D10.3 import checkpoint, then finish its integrated coverage; do not repeat closed D08/D09
   acceptance or start all remaining stages.
2. D03-D09 work and the preceding D10 review are preserved in `a59acad`;
   durable D10.3 offline imports are preserved in `dfdc7f0`, with task docs in
   the following documentation checkpoint. The historical pre-commit
   inventory is [dirty paths](evidence/D10-dirty-paths.txt). Current source hashes
   are [D10 fingerprints](evidence/D10-source-sha256.json). Leave `.playwright-cli`
   and ignored QA copies/reports uncommitted; do not delete them for a clean status.
3. QA stays task-only. Reverify exact ownership before authorized restart:
   iOS `DDEDCE4E-153B-48A4-A47C-B4ED0F499F1F`, Android AVD
   `woordenaar_d08_qa_20260921` / `emulator-5584`, local Docker project
   `woordenaar-d08-qa.ZFsE50`. Retained roots under
   `reports/shared-dictionary-cefr/woordenaar-d08-native.20261001` and
   `reports/shared-dictionary-cefr/woordenaar-d08-qa.ZFsE50`.
4. Synthetic server fixture advanced during D09: zolder v14 private, huis v3
   private, fiets v4 on a newer synthetic revision with the old private image
   override intact. Native cursor/queues were not touched. Next native use must
   reconcile delivery; do not assume D08's server head or reset/reseed devices.
5. D10 owns official/shared imports, recipient visibility and export compatibility.
   New default-off sharing uses the authorized content-only projection; flag-off
   behavior remains legacy. Review the implemented immutable import delivery,
   explicit duplicate retry and deferred SRS hydration before closing D10.3;
   preserve personal IDs, SRS and all pending queues. D10.4/D10.5 need final review/coverage despite local code.
   New or ambiguous analyses remain private. No hosted operation is authorized.

## Model and schedule authority

AUTH-16 permits autonomous model/effort selection through supported controls:
GPT-6.1 Sol / High for implementation, Astra / High for prescribed review or
unresolved architecture/concurrency risk. The user confirmed Astra / High for
the preceding review. Actual picker state during this implementation checkpoint
was not programmatically verified. No independent agent was used. The next
focused review requires GPT-6 Astra / High; implementation routing remains
GPT-6.1 Sol / High. Direct current-thread picker control remains unavailable.
Announce confirmed picker changes. Do not use GPT-5.6 Sol for future work.

The one-time 06:00 heartbeat `d09-06-00` ran once and is **PAUSED**, verified in
its saved configuration. No further automatic continuation was scheduled.
Account-wide weekly quota was 31% at startup and 40% before closure, same reset
1791051321; concurrent activity prevents treating that delta as D09-only usage.

Previous D08 closure and both native acceptance remain valid within their stated
limits: [D08 final closure](evidence/D08-final-closure-review-20261002.md).

## Stage ledger

| Stage               | Status      | Evidence / next gate                                                |
| ------------------- | ----------- | ------------------------------------------------------------------- |
| [D01](steps/D01.md) | blocked     | D01.1/D01.3/D01.4 done; device/build evidence needed                |
| [D02](steps/D02.md) | done        | Accepted design, fixtures, compatibility and rollback               |
| [D03](steps/D03.md) | done        | Astra/High review fixed; 145/145 DB tests pass                      |
| [D04](steps/D04.md) | done        | Terra/High; shared contracts pass mobile/web/Edge                   |
| [D05](steps/D05.md) | done        | 12/12 focused; 157/157 DB; dormant compatibility                    |
| [D06](steps/D06.md) | done        | Final D06 16/16; preservation/delta/rollback rehearsal              |
| [D07](steps/D07.md) | done        | SQLite v13; 136/136 mobile suites preserve queues                   |
| [D08](steps/D08.md) | done        | Closure review/fix and final native smoke passed; resources stopped |
| [D09](steps/D09.md) | done        | Web integration/performance verification                            |
| [D10](steps/D10.md) | in_progress | Catalog/import/export compatibility                                 |
| [D11](steps/D11.md) | pending     | CEFR worker safety; live-cost gate separate                         |
| [D12](steps/D12.md) | pending     | Cross-platform integrated verification                              |
| [D13](steps/D13.md) | pending     | Explicit release approval + observation                             |
| [D14](steps/D14.md) | pending     | Adoption gate + compatibility retirement                            |

D01 is incomplete but does not block separately authorized local work. D02 design outputs and
policy acceptance are complete. No production operation is authorized. Do not
infer live readiness from completed local stages.

## Checkout and persistence

- Checkout: `/Users/devrush/code/pet/DutchLearningApp`.
- Current branch: `feature/shared-dictionary-schema`.
- Branch base/current starting HEAD: `c5dfb14` from synchronized `main`.
- The earlier performance branch was not reused; its squash-merged work is present
  through current `main`.
- Persistence: **committed locally, not pushed**. Latest implementation is
  `dfdc7f0`, following `a59acad`; task docs are in the following documentation
  checkpoint. A new local session can
  resume. A remote clone still needs an explicitly authorized push or transfer.
- Root `AGENTS.md` is excluded by `.git/info/exclude`; its local resume route was
  updated but is not included in normal `git status` or a normal docs commit.
  Preserve this exclusion. For another checkout use the explicit starter-file
  prompt unless its local instructions have also been intentionally transferred.
- Task bundle: root `AGENTS.md` resume section, `docs/session-starter-prompt.txt`,
  `docs/session-runbook.md`, `docs/tasks/_active_task.md`, all files under
  `docs/tasks/shared-dictionary-cefr/`, the linked plan and brainstorm.
- Committed task work: task bundle, D03/D05 migrations and tests, D04
  contracts, D05 cache/protocol adapters, D06 rehearsal SQL/README/tests, D07
  SQLite v13/repository/tests, D08 sync/materialization/CEFR UI/tests, generator/
  target contract, package scripts/README and CI check; D09 web/dictionary routes,
  tests, benchmark harness/helpers and evidence; D10 mapping/import/export contracts
  and review fixes. Verify git status on resume and preserve later user edits.
- Latest implementation commit: `dfdc7f0`; earlier D03-D10 review: `a59acad`.
  No PR or remote push. Dictionary deployments: none.

## Evidence and environment

- D01.1 source map and risk register are saved in [audit evidence](evidence/D01-audit.md).
- Scoped live census: 2,105 active test words, 2,846 readable cache rows, 21 packs.
  This is not a global personal-card or provenance census.
- Verified production protocols: learning 2 / correction 1. Latest EAS builds:
  iOS and Android 2.3.1 (84), both finished; store/adoption status unverified.
- [Sentry observations](evidence/D01-observed-clients.md): three September 6
  production events tagged 2.3.0 (83) and 2.2.1 (82). Not an adoption census;
  do not assume all clients upgraded or retire older compatibility paths.
- API/SQL credential preflight found no configured DB/admin key or connector, but
  subsequent browser inspection found an authenticated Supabase Chrome session.
  Read-only Auth UI confirmed both priority accounts in Dutch Learning App,
  project `josxavjbcjbcjgulwcyy`, production main. No new permissions granted.
  SQL execution through this dashboard was subsequently verified September 21.
  Do not export credentials or unrelated user records.
- September 21: initial expired login was restored by the user. The verified
  production SQL editor returned the read-only P1/P2 report; no new access grants,
  credential extraction, settings changes or explicit query Save were performed.
- [Scoped census](evidence/D01-cohort-census.md): 23 local assertions
  passed with three synthetic owners; production execution complete. P1/P2 have
  2,311/570 active cards and 1,491/94 review events; 231 cards lack a cache key.
  Provenance and individual assessed CEFR counts remain explicitly unknown.
  Sanitized aggregate JSON is durable; rendered identifiers are not in task docs. No need to
  repeat earlier all-owner tests or completed web/native baselines by default.
- Production web baseline: build `c5dfb14`, 15 guarded measurements, client setup
  median 687.7 ms and Start-to-card 72.7 ms; sanitized samples saved in evidence.
- No live production mutation, paid enrichment, release or scheduled job was made.
- Workflow-document validation is recorded in [sessions.md](sessions.md).
- D03 post-review local gates on 2026-09-21: 145/145 PostgreSQL tests, including
  D03 20/20; isolated deterministic target generation/check; contract typecheck,
  lint and formatting pass. Exact artifacts/fixes/fingerprints are in the review.
- D05 final local gates on 2026-09-21: focused D05 12/12 and full PostgreSQL
  157/157; Edge 74/74; mobile/web contract tests 4/4 and 7/7; relevant typechecks,
  lint, formatting, target generation/check and diff checks pass. Exact artifacts,
  compatibility behavior and fingerprints are in the D05 evidence.
- D06 gates on 2026-09-21: full PostgreSQL 172/172, followed by a reproduced
  receipt-lock counter regression, its fix and final focused D06 16/16. Lint,
  formatting and diff checks pass. Synthetic six-way dry run and all personal/
  learning preservation checks are documented in D06 evidence. This utility is
  outside automatic migrations and was installed only on disposable databases.
- D07 gates on 2026-09-21: full mobile Jest 136/136 suites, 1,571/1,571 tests and
  22/22 snapshots; final focused storage 8/8; build/test typechecks, full lint,
  formatting and diff checks pass. SQLite v13 is additive and dormant; real
  file-backed upgrade tests preserve words, tombstones and learning queues.
  Details and hashes: [D07 evidence](evidence/D07-mobile-storage.md).
- D08 pre-review gates on 2026-09-21: full mobile Jest 140/140 suites,
  1,591/1,591 tests and 22/22 snapshots; mobile typecheck, repository lint,
  formatting and diff checks pass. Dependency-first hydration, durable offline
  commands, revision cursors, account isolation, restart recovery, effective
  content and CEFR UI are implemented locally. This historical pre-review
  checkpoint is superseded by the D08.4 evidence below. Details:
  [D08 evidence](evidence/D08-mobile-integration.md).
- D08 post-review gates on 2026-09-21: 141/141 mobile suites, 1,614/1,614 tests,
  22/22 snapshots; full PostgreSQL 174/174; build/test typechecks, lint and target
  contract check pass. Explicit default-off mobile gate, protected pending edits,
  atomic acknowledgement, durable hydration debt, metadata-only coexistence,
  private conflict choices and old-client fallback version capture are implemented.
  Review evidence supersedes affected D05/D07 artifact hashes. See
  [D08 review](evidence/D08-review.md); formatting/diff checked at closure.
- D08.4 platform QA on 2026-09-21: iOS offline correction/reset cold-start and
  reconnect, exactly-once server reconciliation, two-owner isolation, loopback
  web convergence, Android dormant-client upgrade and both exact-tree Release
  smokes passed. QA found and fixed durable capability/recovery-session gaps.
  Final mobile gates: 141/141 suites, 1,620/1,620 tests, 22/22 snapshots;
  build/test typechecks, `lint:ci`, formatting and diff checks passed. See
  [D08.4 platform QA](evidence/D08-platform-qa.md).
- D08 closure review on 2026-09-26: six regressions reproduced and fixed stale
  conflict controls and stale modal content, including account-change/deletion
  visibility. Full mobile: 142 suites, 1,626 tests, 22 snapshots passed; build/test
  typechecks, strict lint, formatting and diff checks passed. Native verification
  remains necessary for revised UI and
  missing dictionary edit/conflict scenarios. See [closure review](evidence/D08-closure-review.md).
- October 1 revised native QA: both baseline smokes, private reanalysis and cold
  restart, iOS stale-server-choice rejection/Keep/server choice, Android lost-reply
  idempotent retry and native/legacy-web convergence passed. Repeated-modal
  controls returned, but the complete repeated-choice flow still needs a rerun.
  Missing-dependency recovery passed on both devices without learning changes.
  Settings incorrectly reports up-to-date while a durable hydration item remains;
  one new unit test reproduced this (2 existing passed, 1 new failed).
  This historical failure is superseded by the local repair below. See [current QA evidence](evidence/D08-native-content-qa-20261001.md).
  The repair now counts hydration debt and persists refresh obligations before
  pull; focused and full mobile tests pass. See
  [repair evidence](evidence/D08-sync-status-repair-20261001.md).
  This earlier rebuild/remaining-QA checkpoint is superseded by the final
  October 2 evidence. Both clients were rebuilt; status/private-add/image,
  stale-local/server/repeated-modal, supported account-return/deletion and final
  convergence passed. New mapping/store repairs require Astra / High review.
  Task proxy PID 65646, web PID 63984 and all QA devices/containers/browser
  were subsequently stopped; exact final hashes are in current QA evidence.
  No fault or automation job remains pending. See shutdown evidence before reuse.
- Synthetic web: full 160-sample matrix passed; durable evidence JSON saved.
- Owner aggregate SQL: 12 assertions passed on a disposable local PostgreSQL
  cluster. It has not run against production.
- Native baseline complete: both Release QA artifacts installed on new devices;
  see [native setup/results](evidence/D01-native.md) and
  [accepted samples](evidence/D01-native-samples.json). No production app touched.
- Retained task-owned devices: iOS `BCF57FF0-0D37-451A-AE1C-CBF1F22BF682`, Android
  `emulator-5580` / `woordenaar_d01_qa_20260912`. Temp artifacts at
  `/private/tmp/woordenaar-d01-native-0lR6oh`. Inspect before reuse/cleanup; never
  substitute existing user devices. Both shut down after all measurements;
  loopback backend port 58170 stopped. Data/artifacts retained, not erased.
- September 21 D08 shutdown completed for the local web server, Supabase stack
  and Android emulator; the iOS shutdown command succeeded but its later device
  listing failed while macOS was locked. September 26 Docker inspection found no
  running D08 container. Old temporary roots remain, but setup config, copied
  migrations and the fixture file are missing; do not assume artifacts survived.
  No native service/device was started during the closure review.
- AUTH-15 is exercised for isolated local QA, explicitly resumed October 1;
  D08.4 completed October 2 and task resources stopped. It does not authorize
  real-user sync, hosted services, EAS, deployment, activation or cutover.
- Historical classification inventory is ignored/private; never commit its word
  contents or private identifiers to make a handoff portable.

## Decisions, permissions, and quota

Read [decisions.md](decisions.md) before proceeding beyond the current scope.
Keep personal card IDs, history, SRS and pending operations intact. Do not publish
personal examples or merge different meanings based only on spelling/POS/article.

Audit session one observed 66% -> 72% weekly used (17:38–17:52 UTC); native session
observed 74% -> 88% (17:56:46–18:28:43 UTC), reset 1789817169. These account-wide
rounded observations are not exact stage costs. Read fresh limits on resume.
Latest resume: 90% at 18:32:55 and 18:34:48 UTC; same weekly reset with one-second
timestamp drift. No completed-stage cost can yet be inferred.
New weekly window: September 21, 3% at 09:50:27 -> 5% at 09:53:27 UTC, reset 1790440763. Do not subtract across the September 12/21 reset boundary.
Read-only census continuation: 6% at 09:57:05 -> 7% at 09:58:37 UTC, same reset;
rounded account-wide observation, not exact stage consumption.
Do not redeem/purchase credits or schedule future work automatically.

September 21 review checkpoint: 26% weekly used at approximately 11:11 UTC,
reset 1790440763. This is one account-wide observation, not a measured stage delta.

D05 closed without a fresh quota sample. Do not infer an exact stage cost.
D06 also has no fresh quota sample; no stage cost is inferred.

September 26 closure review: 2% weekly used, reset 1791051321. This is a new
account-wide window; do not subtract from September 21 observations.

## Handoff maintenance

After a checkpoint, replace the current-stage/next-action and checkout/evidence
fields above with verified state, update the ledger, and append a session record.
Keep this file short; detailed output belongs in stage evidence or the session log.
If interrupted, preserve the same stage and unfinished checkpoint. Do not restart
the plan just because the session, model, week, or quota window changed.
