# Shared dictionary and CEFR — current handoff

**2026-10-03 — D11 autonomous proposal review and reference complete locally.**
Starting `d51aac0`, existing `feature/shared-dictionary-schema`, AUTH-20/AUTH-18.
User has no teacher and explicitly requested autonomous work. The teacher question
is resolved; do not ask for one again. Astra / High review recommendation announced;
actual model picker attribution unverified. No subagent or external reviewer.
[Review](evidence/D11-autonomous-proposal-review-20261003.md),
[completed worksheet](evidence/D11-pilot-review-worksheet.md),
[model-origin reference](evidence/D11-pilot-provisional-reference.json),
[192-path inventory](evidence/D11-autonomous-review-source-sha256.json).

All 24 meaning inputs checked. Corrected irregular-verb metadata for both opstaan
senses and lopen, clarified the prompt enum and rebound input/prompt/profile hashes.
19 provisional bands, five unknowns; lexical sources support meanings/morphology,
not independent CEFR labels. No predictions collected. Local structural audit PASS:
24 canonical inputs, 12/12 splits, all 11 pooled slices, no family/lemma leakage,
reference bindings, profile and budget arithmetic; neither worklist nor model
reference is accepted as a gold fixture. All prior 184 implementation hashes exact.

**Next checkpoint: GPT-6.1 Sol / High — implement local diagnostic collector/report.**
Announce the model before starting. Use fake transport, durable per-attempt spending
reservations, immutable worklist/reference/profile binding, private no-overwrite
capture and restart/retry/unknown-outcome checks. Keep reference judgments out of
prompts. Emit a separate unqualified agreement report; do not fabricate reviewed
fixture metadata or weaken operational qualification. Teacher availability is not
a prerequisite. Source/account/spending authorization is needed only for a later
concrete live request after local implementation and checks.

D11 remains in_progress; D12 not started. Independent quality/live acceptance remain
unproven. Proposed maximum 48 generations/$1.913472 within $2, not spending approval.
No provider/account/key, device/backend, hosted migration, paid call, activation,
publication/deployment or push/PR/merge. Default controls remain OFF. Private reports
and preexisting `.playwright-cli/` preserved. Local commit uses ordinary hooks;
receipt follows. No pending external operation or restoration.

The following preparation is historical; its pending teacher clarification and
human-review/report instructions are superseded by the autonomous review above.

**2026-10-03 — D11 calibration/sample proposal prepared locally.**
Starting `abc2ea0`, existing feature branch, AUTH-20/AUTH-18. Sol / High preparation
model announced; no automatic picker change claimed. No subagent.
[Concrete proposal](evidence/D11-calibration-sample-proposal-20261003.md),
[24-meaning worksheet](evidence/D11-pilot-review-worksheet.md),
[190-path inventory](evidence/D11-calibration-proposal-source-sha256.json).

24 exact input candidates (four bundled, 20 original unreviewed drafts), 12/12
proposed splits and all eleven pooled slices, prompt/profile and conservative
cost proposal. All labels/reviewers/permissions remain pending. Validation PASS:
24 valid unique canonical inputs, no family/lemma split overlap, profile/digests,
budget arithmetic and rejection of the worklist as a gold fixture. 184 previous
source hashes exact; no application, SQL, dependency or runtime change.

Proposed Gemini 3.5 Flash paid Standard probe: 24 meanings, at most 48 generations,
2000 input +2048 output +2048 reasoning reservation per attempt, concurrency one,
maximum reserved API usage $1.913472 within a proposed $2 allowance. Current prices
and token semantics checked in official docs through Context7/web. No provider
account/key was accessed, and this is not spending or reuse permission.

**Next checkpoint: GPT-6 Astra / High — review the concrete calibration proposal.**
Review coverage, family/meaning inputs, provider bounds/cost and the human-review/
unqualified-collector plan. Announce the model before starting. A clarification
about an existing reviewed fixture or teacher/editor is pending; incorporate the
answer before assigning any label. Then Sol / High may implement the approved-input
collector locally with fake transport/durable reservations, before a concrete
live permission request. The operational worker cannot sample an unqualified
method; do not seed synthetic approval as a shortcut.

D11 remains in_progress, D12 not started. Local preparation complete, real reviewed
quality/source/budget and live acceptance remain open. Default flags/control stay
OFF. No device/backend/provider/migration operation, activation, publication,
deployment or push/PR/merge. Reports and `.playwright-cli/` preserved. Persistence:
proposal/checkpoint commit `2731caf` passed normal hooks: mobile 156 suites /1796
tests /22 snapshots; web 86 suites /780 tests, one existing skipped suite/test.
Post-hook inventory 190/190 exact. Local documentation receipt with ordinary hooks
under AUTH-18 follows. Only preexisting `.playwright-cli/` was untracked before the
receipt; no pending test process or restoration.

The following worker review is historical; this preparation supersedes its next
proposal action without altering its repair evidence.

**2026-10-03 — D11 local worker review and expiry-race repair PASS.**
Starting `9a29b06`, existing feature branch, AUTH-20/AUTH-18. Required Astra / High
review model announced; current picker attribution remains unverified. No subagent.
[Review](evidence/D11-worker-review-20261003.md),
[184-path inventory](evidence/D11-worker-review-source-sha256.json).

One P2 reproduced twice: policy expiry while waiting for head/cursor locks could
publish after the approval deadline. Fixed transactional rollback of assessment,
head and journal while retaining verified accounting. 47 SQL tests PASS (29 budget,
18 queue); target contract reproducibility and scoped lint/format/diff PASS.
181 prior source hashes retained; three SQL/test paths changed. Existing 72 Deno
results retained on unchanged hashes, without an unchanged QA replay.

**Next checkpoint: GPT-6.1 Sol / High — local real-calibration/sample proposal.**
Identify actual reviewed meaning evidence/reviewer and provider configuration,
then prepare an exact bounded sample and spending proposal for separate approval.
No real reviewed fixture, provider reuse/pricing/bounds or sample budget is approved;
do not fabricate labels or run paid calls. D11 remains in_progress; local mechanics
and technical review pass, while full/live acceptance and model attribution stay
explicitly limited. D12 has not started. Announce the model before the next step.

Persistence: repair/review commit `ab789e2` passed normal hooks: mobile 156 suites /
1796 tests /22 snapshots; web 86 suites /780 tests, one existing skipped suite/test.
Post-hook inventory 184/184 exact. Local documentation receipt follows under
AUTH-18, with ordinary hooks; no push. Only preexisting `.playwright-cli/` was
untracked before that receipt.
Preserve `.playwright-cli/` and ignored private review logs. No pending test process,
external operation or restoration; disposable harnesses finished and cleaned up.
No retained device/backend operation, hosted apply, provider call, runtime/schedule
activation, deployment, publication or push/PR/merge.

The following invocation checkpoint is historical; this review supersedes its
pending technical-review action.

**2026-10-03 — D11.6–D11.7 local invocation/accounting ready for review.**
Starting `eb38631`, existing `feature/shared-dictionary-schema`, AUTH-20/AUTH-18.
User continued and requested the required model announcement before each next
checkpoint. Implementation recommendation Sol / High; last explicit confirmation
retained, picker control unavailable. No subagent or inferred Astra attribution.
[Evidence](evidence/D11-budget-invocation-20261003.md),
[184-path inventory](evidence/D11-budget-source-sha256.json); 173 prior hashes retained.

Implemented empty/immutable approved-budget registry, global kill switch OFF,
atomic UTC-day request/token/cost reservation, one-use dispatch permits, conservative
unknown/crash/timeout accounting, verified receipt reconciliation, run metrics,
privileged HTTP handler factory and typed/cancellable RPC adapter. No real secret,
provider adapter, price/bounds approval, runtime endpoint or schedule is activated.

27 budget SQL tests and 18 queue regressions PASS. Deno calibration/evaluation/
handler/store: 72 PASS. Generated types/reproducibility, scoped lint/types/format
PASS. Initial test-fixture/type failures corrected and recorded in evidence.
Socket-only PostgreSQL and target-generation containers are disposable; retained
QA devices/backend untouched. No remaining test server or external operation.

**Next: GPT-6 Astra / High review of concurrency/provenance/budget boundaries.**
Announce this model before starting the next checkpoint, as requested by the user.
Review exact changed sources and test evidence; do not replay unchanged QA.
D11.3–D11.7 mechanics are locally implemented, acceptance/review remain open.
D11.2 real reviewed quality, source and spending/sample approvals remain absent;
D11 stays in_progress. All runtime/schedule defaults stay OFF.

Persistence: implementation/evidence committed locally as `2329f0b`. Normal
hooks PASS: mobile 156 suites /1796 tests /22 snapshots; web 86 suites /780 tests,
one preexisting skipped suite/test. Post-hook inventory 184/184 exact. Only
preexisting `.playwright-cli/` is untracked before this documentation receipt.
Receipt commit uses ordinary hooks under AUTH-18; no push. Preserve preexisting `.playwright-cli/` and ignored private reports.
No paid/provider network call, hosted migration, retained data mutation, activation,
publication/deployment or push/PR/merge. No pending restoration or uncertain write.

The historical checkpoints below retain evidence and model-attribution limits.

**2026-10-03 — D11.2 local technical review and repairs PASS; model confirmation pending.**
Starting `cf1ffaa`, existing feature branch, AUTH-20/AUTH-18. User continued the
requested review; current Astra / High picker setting has not been confirmed.
Do not claim model-specific review provenance. No subagent. [Review](evidence/D11-offline-review-20261003.md),
[171-path inventory](evidence/D11-offline-review-source-sha256.json).

Two P2 defects reproduced and fixed: returned policy shared the mutable global
coverage list; unsupported/conflicting policy settings were silently omitted from
digest binding. Three pre-fix failures, now 50 offline tests PASS; type/lint/format
checks PASS. Preserve 168 old hashes; two repaired modules and one new test.
No application/SQL/device/backend/provider work. Real reviewed quality, source,
spending and worker checkpoints remain open; D11 is in_progress, not complete.

Next: resolve the already requested Astra / High model confirmation. If confirmed
for this review, record it and route to Sol / High for local D11.3–D11.5; otherwise
retain the prescribed Astra review gate. No unchanged QA replay is needed merely
to record model provenance. Current-thread picker control remains unavailable.
Review/fix commit `039223a` normal hooks PASS: mobile 156 suites /1796 tests /
22 snapshots; web 86 suites /780 tests, one existing skip. All 171 hashes match.
Local documentation receipt follows; no push,
external operation, retained data write, runtime activation or pending restoration.
Preserve `.playwright-cli/` and private `d11-offline-review-20261003` reports.

The following implementation checkpoint is historical; this review selects the
current first incomplete checkpoint.

**2026-10-03 — D11.2 offline mechanics implemented and verified; review next.**
User-confirmed GPT-6.1 Sol / High; starting `2456246`, existing
`feature/shared-dictionary-schema`, AUTH-20/AUTH-18. [Evidence](evidence/D11-offline-calibration-20261003.md),
[170-path source inventory](evidence/D11-offline-source-sha256.json). All 158 previous
reviewed source fingerprints remain exact. No subagent.

Offline fixture/input/partition validation, captured-response binding, reproducible
metrics, explicit policy and fail-closed qualification/decisions are implemented.
New offline 46 tests and existing analysis 48 tests PASS; scoped types/lint/format
and CLI new-file/no-overwrite smoke PASS. All fixtures and approval references are
fictional mechanics data, including reviewed-shaped positive tests.
**D11.2 quality remains open; D11 is in_progress, D11.3–D11.7 are not started.**

**Next: GPT-6 Astra / High review of D11.2 evidence/qualification boundaries**,
especially denominators, abstention, profile invalidation, independent approval
and future privileged registry/source-policy integration. Then Sol / High for
local fake-provider queue/lease/head-CAS work. Current-thread picker is unavailable;
request the manual model switch without claiming it happened.

Devices/retained backend were not needed, inspected or operated. No provider call,
private export, database write, migration, runtime activation, schedule, deployment,
production/cutover or push/PR/merge. Preserve `.playwright-cli/` and ignored reports
under `reports/shared-dictionary-cefr/d11-offline-calibration-20261003/`. No pending
external operation. Necessary local implementation/evidence commit uses normal
hooks under AUTH-18. Existing runtime defaults remain OFF.

Implementation commit `0cb494f` normal hooks PASS: mobile 156 suites /1796 tests /
22 snapshots; web 86 suites /780 tests, one existing skip. Final audit isolates the
permission-check test from caller flags; 46 tests pass both permission modes, with
no network operation. Inventory retains 169 hashes and updates that test only.
Follow-up local test/receipt commit; no push. First incomplete checkpoint remains
Astra / High review, then worker implementation; real quality stays open.

The following pause and D11.1 records are historical; explicit October 3 resume
and the checkpoint above supersede their pause/model/next-action state.

**PAUSED by explicit `/repo pause`, 2026-10-02 20:14:35 UTC /22:14:35 Amsterdam.**
Checkpoint HEAD `02cd51d`, existing `feature/shared-dictionary-schema`; D11.1
implementation `a756680`, review `bf68661` PASS. No new implementation or QA run.
D11 is paused, not complete. D11.2–D11.7 remain open; D10 stays closed.

Resume only after an explicit user continuation. Exact next step: **D11.2 on
GPT-6.1 Sol / High**, using the reviewed calibration/worker contract below:
offline fixture validation, calibration reporting and fail-closed decision policy.
The last confirmed model is Astra / High; a Sol switch has not been confirmed.
Real reviewed quality evidence, live provider/source and spending gates stay open.
Do not turn synthetic fixtures into a quality-calibration claim.

Assigned QA resources OFF reverified at this pause: iOS Shutdown, Android absent,
four exact retained task containers exited, ports 55331/55400 closed. No pending
runtime job, test, uncertain write or restoration. One-time `d09-06-00` automation
is still PAUSED (configuration verified); no automatic resume is scheduled.
Preserve all retained data/reports and preexisting untracked `.playwright-cli/`.
Pause-only edits are this handoff, D11 stage card and sessions log; local checkpoint
commit uses normal hooks under existing authorization. No push/PR/merge, paid call,
hosted migration, production/cutover, publication, deployment or activation.

The following review checkpoint supplies retained evidence; the pause above
supersedes its in-progress status and immediate continuation instruction.

Last checkpoint: **2026-10-02 — D11.1 Astra contract review PASS.**
Starting `9caea2f`, reviewed implementation `a756680`, existing
`feature/shared-dictionary-schema`, user-confirmed GPT-6 Astra / High, AUTH-20/18.
[Review](evidence/D11-analysis-contract-review-20261002.md),
[calibration/worker contract](evidence/D11-calibration-worker-contract-20261002.md),
[review source inventory](evidence/D11-review-source-sha256.json).

No blocking D11.1 finding; application/migration code unchanged. Three added
review tests verify actual fresh-write/cache-read known and unknown estimates,
default-off refresh/re-enable safety and 16 material input mutations. Focused
48 Edge tests PASS with all HTTP in memory and no network permission; scoped
lint/format/diff PASS. 156 prior hashes exact, only two test hashes updated (158
paths total). Earlier SQL/types evidence remains valid; no unchanged DB QA replay.
This validates the dormant contract, not provider quality or worker correctness.

Review/test commit **`bf68661`** normal hooks PASS: mobile 156 suites /1796 tests /
22 snapshots; web 86 suites /780 tests, one preexisting skipped suite/test.
Post-hook source inventory 158/158 matches. Only preexisting `.playwright-cli/`
untracked; private `commit.log` retained. Local-only, no push or pending QA job.

**Next: D11.2 on GPT-6.1 Sol / High.** Implement the offline fixture validator,
calibration report and fail-closed decision policy from the accepted engineering
contract. Distinguish synthetic mechanics from reviewed meaning-level evidence.
No real reviewed fixture/provider sample is qualified; D11.2 quality remains open
until its evidence and separate live approval exist. Then local fake-provider
D11.3–D11.7 work may proceed within the contract; stage D11 remains in_progress.
CEFR_ANALYSIS_ENABLED and schedule remain OFF. Current-thread picker unavailable;
request manual switch without claiming one. No subagent used.

Retained QA devices/backend were not started; the next checkpoint does not need
them. No pending runtime job, paid/provider call, retained data write, hosted
migration, production/cutover, publication/deployment or push/PR/merge. Necessary
local test/evidence commits with ordinary hooks remain authorized. Preserve
preexisting `.playwright-cli/` and all ignored reports/data. Private review logs:
`reports/shared-dictionary-cefr/d11-contract-review-20261002/`.

Assigned resources OFF verified 20:08:28 UTC /22:08:28 Amsterdam: exact iOS
Shutdown, Android absent, four retained task containers exited, ports 55331/55400
closed. No device/backend start or retained data mutation during this review.

The following D11.1 implementation and earlier checkpoints are historical;
the review and next action above supersede their model routing.

Last checkpoint: **2026-10-02 — D11.1 implemented and local verification PASS.**
Starting `44de0f5`, existing `feature/shared-dictionary-schema`, user-confirmed
GPT-6.1 Sol / High, AUTH-20 and retained AUTH-18 local commit scope.
[Evidence](evidence/D11-analysis-contract-20261002.md),
[summary](evidence/D11-analysis-contract-summary-20261002.json),
[158-path source inventory](evidence/D11-source-sha256.json).

Default-off optional model CEFR envelope/cache JSONB with server provenance,
input hash/version, stale detection and legacy compatibility. Pure domain parsing;
server-only hashing. Web round-trip, mobile optional types only. No shared meaning
assessment/publishing authority. Old article-free duplicate refresh corrected to
SQL IS NULL with actual-handler regression coverage. 45 Edge, 24 SQL and 13 focused
web tests PASS; types/lint and official target generation/check PASS. D11 in progress;
D11.2–D11.7 not started, independent review and live quality/cost gate remain open.

Source/evidence commit **`a756680`** normal hooks PASS: mobile 156 suites /1796
tests /22 snapshots; web 86 suites /780 tests, one existing skipped suite/test.
Post-hook 158/158 source hashes match. Only preexisting `.playwright-cli/` untracked.
Private `commit.log` retained; local-only, no push. No pending QA/test operation.

**Next: GPT-6 Astra / High contract review before D11.2.** Review model provenance,
material input hashing, meaning/analysis namespace separation and fake transport
coverage. Then define reviewed meaning fixture/calibration and exact worker input
binding. Keep CEFR_ANALYSIS_ENABLED OFF; do not promote uncalibrated aggregate cache
estimates to dictionary assessments. Current-thread model picker unavailable;
request manual switch without claiming one. No subagent used.

**Assigned QA resources OFF verified 19:47:41 UTC /21:47:41 Amsterdam**: assigned
D08 iOS Shutdown, Android absent, four retained task containers exited, ports
55331/55400 closed. No retained data/device/runtime change; disposable SQL and type
check resources cleaned up. No pending job or uncertain write. Private logs
`reports/shared-dictionary-cefr/d11-analysis-contract-20261002/`; preserve this,
`.playwright-cli/` and all retained reports/data. Necessary local commits with normal
hooks authorized; no push/PR/merge, hosted migration, paid call, production/cutover,
publication/deployment or scheduler activation. D10 remains closed.

The following closure and earlier checkpoints are historical and superseded by
D11.1 above. Their preservation/acceptance evidence remains valid.

Last checkpoint: **2026-10-02 — D10 COMPLETE.** Starting `ee71f73`, source
`da41085`, existing `feature/shared-dictionary-schema`; user-confirmed Astra / High,
AUTH-17/18/19. [Final closure](evidence/D10-final-closure-review-20261002.md),
[summary](evidence/D10-final-closure-summary-20261002.json),
[R4 re-review](evidence/D10-import-contrast-rereview-20261002.md).

R4 review PASS; actual desktop and iOS Safari each pass four control/state checks
in both themes. All 143 source fingerprints unchanged. No application edits or
replay of closed imports. Eight server tables exactly preserved (28 words,
22 content states, nine collections); captured iOS database projection exact,
19 word/SRS projections and empty queues retained. Android never started.
Safari primary authenticated; no saved password, pending auth restoration or write.
Private setup failures documented in closure evidence; native Simulator paste
resolved automation input. `.playwright-cli/` and ignored private artifacts retained.

**All assigned QA resources OFF verified 19:28:27 UTC /21:28:27 Amsterdam**:
iOS Shutdown, Android absent, four exact task containers exited, named browser
closed, runner/proxy/web/browser PIDs absent, ports 55331/55400 closed. Original
light appearance restored, host clipboard restored and simulator clipboard empty.
No other session/device touched. Current private root
`reports/shared-dictionary-cefr/d10-r4-review-20261002/`; native snapshots
`woordenaar-d08-native.20261001/ios-state-d10-r4-{before,after}.json`.

**Next: D11.1 on GPT-6.1 Sol / High.** Current-thread picker unavailable; request
manual switch without claiming one. Read [D11](steps/D11.md), focused inputs and
accepted permissions, then implement one checkpoint with fake-provider tests.
Do not start D11 in this closure session or repeat D10 QA. Retain personal IDs,
SRS/history and queues. Necessary local commits with normal hooks remain authorized;
no production, schema cutover, publication/deployment, paid call or push/PR/merge.
D11 schedule stays disabled; live quality/cost sample needs separate approval.
D01 partial items and D13/D14 approval/observation gates remain open.

Closure/evidence commit `7a79223` normal hooks PASS: mobile 156 suites /1796 tests /
22 snapshots; web 86 suites /778 tests, one existing skipped suite/test. All 143
source hashes match after hooks. Private `commit.log` retained. Local-only; no push.

The following checkpoints are historical and superseded by the closure above.

Last checkpoint: **2026-10-02 — R4 action contrast repaired and source-rendered
browser regression PASS.** Source commit `da41085`, starting `b745243`, existing
`feature/shared-dictionary-schema`, user-confirmed Sol 6.1 / High, AUTH-17/18/19.
[Repair evidence](evidence/D10-import-contrast-repair-20261002.md),
[summary](evidence/D10-import-contrast-repair-summary-20261002.json).

Three D10 components now use existing semantic `dw-button` primary/secondary
variants for import/sharing actions, selection controls and success links. CSS
reset/global palette and all action/selection/disabled/navigation logic unchanged.
Baseline primary labels fail 1:1 in light theme; repaired source-rendered browser
matrix 40 checks /16 states /two themes PASS. Minimum enabled painted contrast 5.34:1;
disabled 1.93:1 retains existing theme opacity. Actual React component markup equals
baseline except class attributes. This fixture stubs action state and Link-as-anchor;
it does not replace actual Safari/page acceptance or independent review.
Three focused suites /13 tests, test-inclusive TypeScript and strict scoped
ESLint/Prettier/syntax/diff PASS. All 140 prior hashes retained, three component paths
added to current 143-path manifest. Source commit `da41085` normal hooks PASS:
mobile 156 suites /1796 tests /22 snapshots; web 86 suites /778 tests, one existing
skipped suite/test. All 143 hashes match after hooks. Private `commit.log` retained. Only preexisting `.playwright-cli/` is unrelated.

**Next: GPT-6 Astra / High R4 independent review**, then only affected real-page /
Safari visual checks, and reconcile D10.3–D10.5 exit evidence. Current-thread model
picker unavailable: request manual switch without claiming one. Do not begin D11
or repeat closed import/recovery/transfer checks. In particular do not replay
operation `217420b8-7a2d-4537-b440-a48ea42133f8` / personal kompas
`db455c40-fdb6-4eb8-9823-d0e50d4e6fd8`. R3 actual revoked-session navigation and
cached official read_only/offline delivery were completed in the preceding checkpoint.

**All assigned resources OFF verified 19:00:50 UTC /21:00:50 Amsterdam**: named
contrast browser closed; fixture PID absent and port 55400 closed; assigned iOS
Shutdown; Android absent; four retained task containers exited. Devices/backend
were never started during R4 repair. No pending QA job or uncertain write.
Private root `reports/shared-dictionary-cefr/d10-r4-repair-20261002/`; fixture/check
commands and limits in repair evidence. No production/cutover, publication,
deployment, paid call, push/PR/merge. Necessary local commits authorized.

Previous retained-runtime checkpoint follows.

Last checkpoint: **2026-10-02 — R3 re-review and retained runtime PASS;
R4 light-theme import action contrast requires repair.** Starting HEAD `833835d`,
source `976d1e7`, existing `feature/shared-dictionary-schema`; user-confirmed
Astra / High. [Runtime evidence](evidence/D10-final-runtime-20261002.md),
[R3 re-review](evidence/D10-session-revocation-rereview-20261002.md),
[R4 finding/repair contract](evidence/D10-import-contrast-review-20261002.md).

R3 actual revoked-session navigation passes. Android cached official import with
read_only access and blocked task REST passes via the accepted private-copy
fallback (manifest cached, mappings unavailable). Cold restart preserves one
personal kompas ID; ordinary read_only sync delivers it once with the same ID.
Operation `217420b8-7a2d-4537-b440-a48ea42133f8`, word
`db455c40-fdb6-4eb8-9823-d0e50d4e6fd8`. **Do not replay the offline import flow.**
Actual Safari duplicate visibility and disabled semantics pass; visual acceptance
is open because import labels match the background in light theme. Desktop
computed CSS confirms enabled and disabled cases. No application edits this turn;
all 140 source fingerprints match. Four focused R3 suites /45 tests pass.
Runtime/evidence commit `55d533c` normal hooks PASS: mobile 156 suites /1796 tests /
22 snapshots; web 86 suites /778 tests, one existing skipped suite/test. All 140
hashes still match after hooks. Private `commit.log` retained in current QA root.
Only preexisting `.playwright-cli/` is untracked.

Server final: 28 words/22 content states/nine collections. All 27 prepared words,
21 preexisting states, original access rows, collections and review tables exact.
Three old synthetic source fixtures needed ru=[] / valid hidden placement and a
precise hidden-tombstone restoration; all 24 unrelated original words are exact.
No schema/trigger definition changed. Hidden Android cache was aligned while the
app was stopped; source share stays revoked. Details/receipts are in runtime evidence.
Android primary restored, real Up to date confirmed; initial 13 words/SRS/learning
preserved, pending queues empty. iOS primary restored and Up to date confirmed;
all initial 19 word/SRS projections and learning rows exact, pending queues empty.

**All assigned resources OFF verified 18:44:48 UTC /20:44:48 Amsterdam**: iOS
Shutdown, Android absent, four task containers exited, named browser closed,
runner/proxy/web PIDs absent and ports 55331/55400 closed. All proxy faults were
false before shutdown; clipboard cleared. No pending QA job or uncertain write.
[Sanitized summary](evidence/D10-final-runtime-summary-20261002.json).
Private attempts retained under `attempted-flows`; no unfinished auth restoration.

**Next: GPT-6.1 Sol / High for R4**, then Astra / High re-review and only affected
visual acceptance. Current-thread model picker unavailable: request manual switch
without claiming one. Use existing semantic button styles/scoped token rules for
D10 import/sharing actions and success links; do not broadly rewrite the reset.
Verify actual computed styles and visible labels in both themes and enabled /
disabled states. Then reconcile D10.3–D10.5 exit evidence; do not begin D11 or
repeat closed import/recovery/transfer checks. AUTH-17/18/19 continue to apply.
No production, cutover, publication/deployment, push/PR/merge or paid operation.
Local commits with normal hooks authorized. Preserve `.playwright-cli/` and ignored
private artifacts. Current private root:
`reports/shared-dictionary-cefr/d10-final-acceptance-20261002/`; native snapshots
under `woordenaar-d08-native.20261001` (`d10-final-before` / `d10-final-restored`).

Historical checkpoint follows.

Last checkpoint: **2026-10-02 — D10 official/shared runtime preservation PASS;
R3 revoked-session redirect loop reproduced, repair required.** Starting HEAD
`6ca149f`, user-selected Astra / High, AUTH-17/18/19. Application unchanged;
137 fingerprints match. [Runtime evidence](evidence/D10-catalog-runtime-20261002.md),
[summary](evidence/D10-catalog-runtime-summary-20261002.json),
[R3 finding and repair contract](evidence/D10-session-revocation-review-20261002.md).

Actual web official/shared and Android shared imports pass. iOS official preview
passes. Four new primary IDs arrive unchanged on both clients; prior server rows,
15 iOS/nine Android word rows and learning preserved exactly. Sharing revoked;
HTTP denies further access and real web shows Link unavailable. Recipient export
contains 10 self-contained content-only entries including the private shared note.
All pending native import/content/recovery/refresh/hydration queues are empty;
primary restored on both devices, Up to date confirmed.

**Next: GPT-6.1 Sol / High for R3**, then Astra re-review. Valid signed but revoked
JWT is accepted by proxy getClaims, rejected by page getUser: /login and
/app/collections redirect to each other. Four focused suites /38 tests pass,
including the passing review counterexample (not a fix); test-inclusive TypeScript
and strict web lint pass. Convert that test to no-loop safety coverage. Preserve
server authorization/cookie propagation; do not change mobile sign-out policy.
Current-thread model picker unavailable: ask for manual switch, never claim one.

D10.3–D10.5 remain open. Remaining runtime: cached official import under read_only /
offline and full mobile Safari acceptance. Safari login/official route rendered,
but input/overlay/zoom automation did not complete the acceptance flow. Android
isolated login hit a Maestro typing timeout before import. No offline block used.
Temporary isolated read_only access restored to its exact original row. Do not
repeat passed recovery/upgrade/transfer/import checks or begin D11.

**All resources OFF verified 15:15:36 UTC /17:15:36 Amsterdam**: exact assigned iOS
Shutdown, Android absent, four task containers exited, named browser closed,
runner PIDs 30260/30275/30276/30277 absent, ports 55331/55400 closed. No pending
mutation/build/QA job. Apps, volumes and private reports preserved; other sessions
untouched. AUTH-19 still applies unless another session reclaims devices.

Private root `reports/shared-dictionary-cefr/d10-catalog-20261002/`; native snapshots
remain under `.20261001`. Seed once only: local synthetic pack
`d10-synthetic-navigation-20261002` v1.0.0 and three immutable mappings now exist.
New source collection D10 Synthetic Shared is revoked; do not reset/reseed/publish.
Final server 27 words /21 content states /nine collections. Primary D08 Native QA
has ten words; new kompas/zeil/getij/duin IDs in summary. Isolated owner still has no
kompas, suitable for the remaining bounded official import. No uncertain write.

Preservation commit subject `test: capture catalog acceptance and revoked-session loop`;
inspect git log for SHA. Normal hooks required; private `commit.log` records results.
Only QA flows, review tests and sanitized task docs changed. Private reports and
.playwright-cli remain excluded/untracked; root AGENTS excluded. Automation paused.
No push/PR/merge, production, cutover, hosted publication/deployment or paid call.

Historical checkpoint follows.

Last checkpoint: **2026-10-02 — D10 scoped cross-client transfer acceptance PASS**.
Starting HEAD `6d3d355`, same Astra / High. Device handback granted in AUTH-19.
[Evidence](evidence/D10-cross-client-acceptance-20261002.md),
[summary](evidence/D10-cross-client-summary-20261002.json).
Application unchanged: all 137 source hashes match; installed native hashes verified.

Web-imported recipient content renders on iOS after account switch. Real native
export (`boek/fiets/anker`) reimports into primary: two selected, existing fiets
excluded. Both new iOS personal IDs arrive unchanged on server, Android and web.
Android native export/paste previews 0/4, then 0/6 after peer sync. All prior server
rows, native word/SRS/learning projections and import acknowledgements preserved.
Both devices' queues/hydration empty, Up to date confirmed. No uncertain write.

**Resources OFF verified 14:24:04 UTC / 16:24 Amsterdam**: assigned iOS Shutdown,
Android absent, four exact containers exited, browser closed, runner PIDs absent,
ports 55331/55400 closed. Apps/volumes/data retained. Primary restored on both.
Private evidence root: `reports/shared-dictionary-cefr/d10-cross-client-20261002/`;
native snapshots/clipboard remain under retained `.20261001`. Other sessions untouched.

**Next: Astra / High, remaining official/shared runtime matrix and mobile-browser
acceptance.** D10.3–D10.5 remain unchecked, D11 not started. Plan bounded synthetic
fixtures for the empty local official/shared catalog; no publication of existing
user data/production use. Do not repeat closed upgrades/recovery/transfer checks.
AUTH-19 satisfies device handback; recheck availability before reuse if another
session takes them. No additional permission implied beyond assigned resources.

Retained primary collection now has six words, including new
`bf5c7f11-30c7-40ce-a1b3-b0d7d202562c` (anker) and
`ef62b1bb-5f5e-45fd-acd0-e8b8ccf656fa` (boek). Do not replay the two-word import.
Isolated recipient's previous web copies remain. Server 19 words / 16 content states /
eight collections; all 17/14/eight prior rows exactly unchanged. New cards use the
accepted server SRS default. No reset/reseed/flag/schema/publication changes.

Local commit subject `test: verify cross-client dictionary transfer`; inspect git log
for SHA. Normal hook output: private runtime root `commit.log`. Only QA helpers,
flows and sanitized docs changed; private reports/.playwright-cli remain untracked
or ignored, root AGENTS excluded. Automation paused. No push/PR/merge, hosted/paid/
production/cutover/deployment/publication operation.

Historical checkpoint follows.

Last checkpoint: **2026-10-02 — D10 web repair re-review and scoped browser acceptance PASS**.
User-confirmed Astra / High, reviewed source `19d98eb`, starting HEAD `0d9e835`.
[Runtime evidence](evidence/D10-web-acceptance-20261002.md),
[summary](evidence/D10-web-acceptance-summary-20261002.json).
54 focused review tests pass; all 137 source fingerprints match, application unchanged.

Actual web export/copy, source and cross-collection duplicate previews, cross-owner
read_only private-copy import/re-export and bundled Essentials fallback pass.
A real accepted import response was dropped once: uncertainty blocks retry and its
check link stays on the attempted collection after target change. Manual check
confirmed one saved word; no replay. Four document copies plus one bundled word
added only to the isolated recipient. All 12 prior words, nine content states,
eight collections and review/history tables unchanged; original access restored.

**Next: remain on Astra / High for remaining D10 matrix.** D10.3–D10.5 unchecked;
D11 not started. Device availability request pending; do not inspect/start/use
simulators or emulators without explicit handback. Do not repeat closed web/native
checks. The retained stack has no official packs/mappings/shared collections;
remaining runtime coverage needs bounded local synthetic fixtures without publishing
existing data or touching production. Native cross-client/mobile-web checks remain.

**Web resources OFF verified 13:59:14 UTC**: named browser closed, runner exited 0,
its three PIDs absent, ports 55331/55400 closed, four task containers exited. No
pending mutation, build or QA operation. Devices untouched, availability unknown.
Private evidence: `reports/shared-dictionary-cefr/d10-web-acceptance-20261002/`.
Retained `.20261001` primary data unchanged; isolated owner now has four document
copies (`fiets` in Isolated Owner; `huis/zolder/balkon` in My Words) and bundled
`boek` in Isolated Owner. Do not blindly replay imports or reset/reseed.

Preservation commit subject: `docs: record dictionary web acceptance` (inspect git log
for final SHA). Normal hooks are required; their result is retained privately in
`reports/shared-dictionary-cefr/d10-web-acceptance-20261002/commit.log`.
Private reports/.playwright-cli preserved, root AGENTS excluded, automation paused.
No push/PR/merge, production, cutover, publication, deployment or paid operation.

Historical checkpoint follows.

Last checkpoint: **2026-10-02 — D10 web R1/R2 re-review PASS**.
User confirmed requested Astra / High; reviewed `19d98eb`, starting HEAD `0d9e835`.
[Re-review evidence](evidence/D10-web-transfer-rereview-20261002.md).
Three focused suites / 54 tests pass; 137/137 source fingerprints match.
No new finding or application edit. Next: remaining D10 browser acceptance using
retained local stack, then cross-owner/both-client matrix. D10.3–D10.5 stay open.

QA intent: start only four assigned retained containers and existing isolated web
runner (fresh source copy, ports 55331/55400); save pre-write database snapshot.
Do not reseed/reset or repeat closed native checks. Device availability request is
pending; do not inspect/start/use devices without explicit user handback.
No production/cutover/deployment/publication/paid operation; local commits authorized.

Historical checkpoint follows.

Last checkpoint: **2026-10-02 — D10 web R1/R2 repairs implemented**, starting
source commit **`19d98eb`**, starting HEAD `9150845`, application baseline `ab8d603`,
existing feature branch.
User confirmed the requested **GPT-6.1 Sol / High** switch. AUTH-17/AUTH-18.
[Repair evidence and origin policy](evidence/D10-web-transfer-repairs-20261002.md).

R1 now validates the canonical browser Origin against mandatory raw Host; URL scheme
is retained. A different internal Host/TLS scheme requires the existing explicit
site/deployment origin plus consistent single forwarded headers. Missing, malformed,
conflicting and unconfigured overrides fail closed before auth. R2 uncertain feedback
captures the attempted collection ID, preserving its check link when the next target
changes. Both lost transport and uncertain receipt safety regressions pass; explicit
re-preview remains required before another write. No automatic replay/retarget.

Focused **11 web suites / 134 tests**, test-inclusive typecheck and strict scoped
lint/format/diff pass. Four baseline web paths intentionally changed, 129 unchanged;
four paths added to the current 137-file hash manifest. No mobile/SQL/RPC/dependency/
config/env/feature-flag or published-content change. Source `19d98eb` normal hooks
pass: **156 mobile suites / 1796 tests / 22 snapshots; 85 web suites / 769 tests**,
one existing skipped suite/test. Formatter adjusted one test; the manifest is
refreshed and all 137 hashes match. No pending operation. Historical counterexamples
are in `46eb250`, now converted to safety assertions.

**Next: GPT-6 Astra / High repair re-review**, then remaining browser/cross-owner/
both-client acceptance. Inspect raw Host/scheme validation, trusted deployment-origin
proxy boundary, negative headers and immutable uncertain destination. Current-thread
picker unavailable; request manual Astra / High confirmation. D10.3–D10.5 stay
unchecked. Do not start D11 or repeat completed native upgrades/mobile recovery checks.

No backend/browser/device inspection or operation. Explicit device availability
handback remains required before simulator/emulator use; another session may use
those devices. No pending mutation, build or QA job. Private fixtures/.playwright-cli
remain intact, root AGENTS excluded, automation paused. No push/PR/merge, production,
cutover, publication, deployment or paid operation. Historical review follows.

Last checkpoint: **2026-10-02 — D10 web transfer implementation review: changes required.**
User confirmed the requested **GPT-6 Astra / High** switch. Reviewed source
`ab8d603`, starting HEAD `5d95165`, existing branch `feature/shared-dictionary-schema`.
[Review and repair contract](evidence/D10-web-transfer-review-20261002.md).

Two reproduced findings: **R1/P1** the origin guard rejects legitimate requests
when Next.js normalizes 127.0.0.1 to localhost or uses a wildcard/internal request
URL; **R2/P2** an uncertain import's check link follows a subsequently changed
collection selector instead of the attempted destination. Application unchanged.
Two new review suites / five tests pass (four counterexamples plus a valid control);
these demonstrate defects, not feature acceptance. Test-inclusive web TypeScript,
strict scoped lint/format/diff pass; all 133 application fingerprints unchanged.
Review/test checkpoint **`46eb250`** committed with normal hooks: mobile 156 suites /
1796 tests / 22 snapshots; web 84 suites / 720 tests, one existing skipped suite/test.
All 133 source and two review-test hashes match after hooks; no pending operation.

**Next: GPT-6.1 Sol / High for R1/R2 web repairs**, then Astra / High re-review.
Use the exact repair contract and convert review counterexamples into safety
regressions. Preserve strict origin/auth/document checks, readonly import, content-
only payload, SRS/placement and uncertain-write no-replay policy. Current-thread
picker is unavailable; request the manual switch, never claim an automatic switch.
D10.3–D10.5 remain unchecked. Do not start D11 or repeat completed native upgrade /
mobile recovery checks. Browser/both-client acceptance waits for the web review fix.

No backend/device/browser inspection or operation in this checkpoint. Latest device
constraint remains: notify the user and wait for explicit availability handback
before simulator/emulator use, since another session may be using them. No pending
mutation, build or QA operation. Existing private fixtures and `.playwright-cli/`
remain intact; root AGENTS stays excluded. AUTH-17/AUTH-18 allow local commits.
No push/PR/merge, production, schema cutover, publication, deployment or paid call.
Automation `d09-06-00` remains paused. Historical completed checkpoint follows.

Last checkpoint: **2026-10-02 — D10 web document transfer UI implemented**,
source commit **`ab8d603`**, starting `b302d71`, existing branch
`feature/shared-dictionary-schema`.
Model-switch event received after requested GPT-6.1 Sol / High; no automatic picker
change claimed. AUTH-17/AUTH-18 remain applicable. [Implementation and verification](evidence/D10-web-transfer-ui-20261002.md).

Default-off collection export and `/app/dictionary-import` now call the existing
strict schema-v1 helpers through an authenticated same-origin bounded POST route.
Explicit preview/selection, existing owned target and fresh hydrated global duplicate
checks preserve readonly import and existing-card/SRS/placement policy. Prepare/copy
are separate gestures with manual clipboard fallback. Auth epochs hide private state
and suppress delayed replies after owner changes/ABA. Uncertain imports require a
collection check and manual re-preview; no automatic replay/retarget. Saved success
survives cache/synchronous router-refresh failures and malformed receipt counts.
No dependency/config/SQL/RPC/mobile/feature-flag change.

Focused **8 web suites / 80 tests**, test-inclusive web type generation/TypeScript,
strict scoped lint, formatting and diff checks pass. All previous 113 application
fingerprints match; 20 web paths added to the current 133-path manifest. Local
preservation commit `ab8d603` succeeded with normal hooks: **156 mobile suites /
1796 tests / 22 snapshots; 82 web suites / 715 tests**, one existing skipped suite/
test. All 133 hashes match after hooks. No pending mutation/build/QA job.

**Next: GPT-6 Astra / High implementation review**, then remaining D10.3 integrated
acceptance. Review production route/page wiring, fresh auth/target/duplicates,
content-only payload, reply/clipboard/account races, body limits and truthful saved/
uncertain feedback. Current-thread picker control is unavailable; obtain a manual
Astra / High confirmation, never claim an automatic switch. D10.3–D10.5 remain
unchecked; do not begin D11 or repeat completed native upgrades/R1/R2 checks.

No backend/device/browser inspection or operation in this checkpoint. The latest
user instruction requires an explicit availability handback after pausing the other
session before simulator/emulator QA. Do not assume the preceding OFF verification
is current availability. Existing private QA fixtures and `.playwright-cli/` remain
intact/untracked; root AGENTS remains excluded. Automation `d09-06-00` remains paused.
No push/PR/merge, production, schema cutover, publication, deployment or paid operation.
Historical completed checkpoint follows.

Last checkpoint: **2026-10-02 — D10 Android v14/v15 native migration PASS;
web transfer UI integration missing.** User-confirmed GPT-6 Astra / High.
Application source `c3f9baf`; starting repository HEAD `559321a`, same branch
`feature/shared-dictionary-schema`. No application changes in this checkpoint.
[Native evidence](evidence/D10-native-upgrade-20261002.md),
[sanitized result](evidence/D10-native-upgrade-summary-20261002.json),
[web integration finding and implementation scope](evidence/D10-web-transfer-integration-gap-20261002.md).

A separate network-disabled Android package ran actual historical initializers
`dfdc7f0` (v14), `5efd6ff` (v15), then current v16 across three processes.
Exact retained IDs/SRS/private data/history/ordered queues pass comparison (10/11
tables); v14 exact origin/nonce retained, marker-only v15 stays unverified with
unknown ACK/version and a closed exact-origin gate. Second cold reopen passes.
This is native Expo SQLite/AsyncStorage evidence, not a full historical APK upgrade
or an iOS v14/v15 claim. Main Android DB snapshot and APK remain unchanged.
All 113 application source hashes match; strict harness lint/format/diff pass.

**All assigned QA resources are OFF, verified 2026-10-02 12:43:07 UTC.** Exact
Android AVD/process absent, iOS assigned UDID Shutdown, four retained task containers
exited, ports 55331/55400 closed. Build and native runner exited 0. No uncertain
mutation, pending QA job or device cleanup. Other sessions/devices untouched.
Private harness root `reports/shared-dictionary-cefr/woordenaar-d08-native.d10upgrade20261002`
retains source hashes, APK/manifest/hash evidence, three phase reports, closed native
DBs and shutdown record. Separate package `com.oldrefery.dutchlearningapp.d10upgrade`
is stopped and retained. Do not rerun prepare/seed or reset either app.
The `.20261001` main QA root and all prior retained fixtures remain unchanged.

**Next: GPT-6.1 Sol / High for missing web JSON transfer integration.** Web
`dictionary-transfer.ts` helpers currently have only test callers; no production
page/action exposes document export/reimport. Follow the linked bounded scope:
default-off owned export without publication, validated pasted-document preview/
selection, existing owned target, account safety and unchanged duplicate/SRS policy.
No app repair has begun. Current-thread model switching is unavailable; ask for
manual Sol 6.1 / High confirmation, never claim a switch without confirmation.
Then Astra / High review and remaining official/shared/bundled/cross-owner/both-client
acceptance. D10.3–D10.5 remain unchecked; do not begin D11 or repeat closed checks.

AUTH-17/AUTH-18 allow local work and necessary commits. Preservation commit subject:
`test: verify native dictionary upgrade preservation`; inspect git log for its SHA.
Normal hooks are required, with output retained in the private harness `commit.log`.
QA/evidence commit **`70f9eb9`** succeeded with normal hooks: mobile 156 suites /
1796 tests / 22 snapshots; web 75 suites / 648 tests, one existing skipped
suite/test. Post-hook fingerprints 113/113 and both installed harness templates
match. No pending operation; only private `.playwright-cli/` remains untracked.
Keep `.playwright-cli/` private/untracked and root AGENTS excluded. No push/PR/merge,
production, cutover, publication, deployment or paid call. Automation stays paused.

Historical preceding checkpoint follows; routing above supersedes it.

Last checkpoint: **2026-10-02 — D10 repair re-review and scoped native acceptance passed.**
User-confirmed GPT-6 Astra / High reviewed application source `c3f9baf` (starting
HEAD `785d9f9`). R1/R2 re-review passed; no application change in this checkpoint.
[Native acceptance evidence](evidence/D10-native-acceptance-20261002.md).

Both retained iOS/Android release upgrades preserve pre-existing words/SRS/history/
queues; installed artifacts match built hashes. iOS confirms offline import/cold
restart, original lost reply/replay, ordinary guarded move, lost recovery reply
plus newer peer placement/stale replay, and cancel ACK with blocked tombstone across
restart/final delivery. Android confirms offline queue durability, explicit recovery,
an original-delivery race causing safe placement-conflict, fresh explicit retry and
Up to date only after queues clear. iOS native JSON export/paste/duplicate preview
visually confirmed for the four active source words. Exact scope/failed harness
attempts and new-card server-default interval 0→1 are documented in evidence.

**All assigned QA resources are OFF, verified 2026-10-02 12:23 UTC.** iOS UDID
`DDEDCE4E-153B-48A4-A47C-B4ED0F499F1F` Shutdown; emulator-5584 absent; no matching
AVD/native/proxy/Maestro jobs; four retained `woordenaar-d08-qa.ZFsE50` containers
exited; ports 55331/55400 closed. Proxy faults reset before shutdown. No pending or
uncertain mutation/test/build. Other sessions/devices untouched; data retained.

Private artifacts remain at `reports/shared-dictionary-cefr/woordenaar-d08-native.20261001`:
pre-migration pg_dump, migration hashes, native snapshots, installed artifact hashes,
Maestro logs/screenshots, final proxy log/server snapshots and shutdown verification.
Four D10 migrations 20261002090000–20261002120000 applied to the retained local
stack only, without reset/reseed or runtime flag changes. On next native startup,
restore task-only Android reverse tcp:55331 mapping after emulator boot.

Do not blindly rerun mutation flows: synthetic `d10herstel` is deliberately cancelled/
tombstoned (server version 3), `d10android` is active in My Words (server version 1).
Their exact IDs/roots are in evidence. Peer recovery request/receipt are one-off
private artifacts; the helper refuses overwriting them. No duplicate/reseed needed.

**Next: remain on GPT-6 Astra / High, D10.3 integrated acceptance.** First inventory
retained v14-intent and marker-only v15 native upgrade evidence; use an isolated
fixture/install strategy without resetting retained QA data. Then finish the
remaining official/shared/bundled and cross-owner/both-client export/reimport
matrix. Do not repeat closed R1/R2 checks or D08/D09. If an application repair is
required, save a concrete reproducer and request GPT-6.1 Sol / High; current-thread
model picker is unavailable. D10.3–D10.5 stay unchecked; do not begin D11.

QA helpers/flows and task docs committed locally as `4e9563f`. Normal hooks pass:
156 mobile suites / 1796 tests / 22 snapshots; 75 web suites / 648 tests, one
existing skipped suite/test. All 113 application/source fingerprints still match
after hooks. Scoped strict lint/format/diff checks pass. No pending operation.
No push/PR/merge, production, schema cutover, publication, deployment or paid call.
Automation `d09-06-00` stays paused. Private `.playwright-cli/` remains untracked.

Historical preceding checkpoint follows; routing above supersedes it.

Last checkpoint: **2026-10-02 — D10 checkpoint 6 R1/R2 repairs implemented.**
User-confirmed GPT-6.1 Sol / High; source `c3f9baf`, starting `fa286e4`. Ordinary settled imported moves
now queue the existing immutable version/placement recovery request atomically;
tracked unbound debt is gated in Saved imports and cannot use generic metadata
UPDATE. Pending status includes unsent word/collection tombstones across cancel ACK,
failed delivery and restart. Roots/IDs/SRS/private content/learning queues retained.
[Repair evidence](evidence/D10-recovery-review-repairs-20261002.md).

Focused mobile 8 suites / 139 tests, final regression/status 2 suites / 19 tests,
isolated recovery SQL 17/17, test-inclusive TypeScript and strict scoped lint pass.
Ten safety regressions replace the two old mobile counterexamples; pinned SQL
baseline stays historical. No schema/RPC change or assigned QA resource start/reset.

**Next: GPT-6 Astra / High for R1/R2 re-review**, then assigned-device/both-client
acceptance only if it passes. Current-thread picker unavailable; require manual
model confirmation. Inspect immutable ordinary move preparation, retained debt gate,
lost replies, owner ABA, stale replacement and cancellation-to-tombstone counting.
Native upgrade/OS lifecycle and both-client acceptance remain unverified. D10.3–D10.5
open; do not repeat D08/D09 or begin D11. Private QA data/.playwright-cli retained.

Repair source committed locally as `c3f9baf`. Normal hooks passed **156 mobile
suites / 1796 tests / 22 snapshots**, **75 web suites / 648 tests**, with one existing
skipped web suite/test. All 113 source fingerprints match after hooks. Exact task
QA resources reverified off at 11:42 UTC: assigned iOS Shutdown, task AVD process
absent, four task containers exited. No pending test/build/QA job or uncertain
operation remains. Only private `.playwright-cli/` is untracked; no push/PR.

Historical preceding review checkpoint follows:

Last checkpoint: **2026-10-02 — D10 checkpoint 6 implementation review: changes required.**
User-confirmed Astra / High reviewed application source `b7f207c`. Two defects are
reproduced: **R1/P1** ordinary imported moves overwrite newer recovered placement;
**R2/P2** cancellation ACK hides an unsent normal word tombstone from pending status.
[Review evidence and repair contract](evidence/D10-recovery-implementation-review-20261002.md).
Mobile file-backed counterexamples 2/2; real PostgreSQL reverse-order race 1/1;
test-inclusive TypeScript and strict scoped lint pass. These passing counterexamples
prove unsafe behavior, not acceptance. No application/server repair in this checkpoint.

**Next: GPT-6.1 Sol / High for R1/R2 repairs**, followed by Astra / High review and
assigned-device/both-client acceptance. Current-thread picker unavailable; request
manual model confirmation. Convert mobile counterexamples to safety regressions;
retain the pinned SQL baseline and add guarded delivery tests. Preserve existing
placement debt and all roots/IDs/SRS/queues. Exact resources verified off at 11:26 UTC: assigned iOS Shutdown, task AVD absent,
four task containers exited. No QA resource restart or reset occurred.
D10.3–D10.5 remain unchecked. Do not repeat D08/D09 or begin D11.

Review checkpoint committed locally as `4f7a6a6`. Normal hooks passed **156 mobile
suites / 1787 tests / 22 snapshots** and **75 web suites / 648 tests**, with one
existing skipped web suite/test. All 113 source fingerprints match. No pending
operation remains after hooks; `.playwright-cli/` stays private and untracked.

Historical preceding checkpoint follows:

Last checkpoint: **2026-10-02 — D10.3 explicit recovery UI, accepted checkpoint 5.**
User-confirmed GPT-6.1 Sol / High; source `b7f207c`, following sync `abc0b86` /
resume coverage `a7315bb`, SQLite `1748066` and server `1828f57`. AUTH-17/AUTH-18,
local only. [UI evidence](evidence/D10-recovery-ui-20261002.md). Existing-target
recovery now reads current server state explicitly and persists a fresh proposal
only after confirmation, preserving the original root/personal ID/SRS/queues.
Captured local revision/outbox CAS prevents stale-dialog overwrite. Saved imports
keeps pending/conflicting/unverified cards and missing-target placements reachable,
including after the original collection disappears. Sign-out invalidates an open
view even when the same owner returns. Blocked moves never report success.

Verification: focused mobile 6 suites / 82 tests; web 2 suites / 22 tests. Normal
source hooks passed **155 mobile suites / 1785 tests / 22 snapshots**, **75 web
suites / 648 tests**, one existing skipped suite/test. Mobile test-inclusive
TypeScript, strict scoped lint, format/diff pass. Server/migration source unchanged
from its 213/213 SQL/determinism verification; no new SQL run claimed. Synthetic
file fixtures cleaned up. Exact assigned QA resources reverified off at 10:57 UTC;
no device/backend restart, retained-data reset or pending operation after hooks.

**Historical checkpoint 5 continuation (superseded by the review above): Astra / High.**
The agent cannot operate the current-thread model picker. Ask for a manual switch
if Astra / High has not been confirmed; never claim an automatic switch. Review
server/domain, SQLite and complete sync/UI, including private registry/root binding,
CAS/replay/cancellation, account ABA, pending counts, current-placement hydration,
retained v14 and marker-only v15 gates, ordinary move feedback and web applicability.
Then perform assigned-device/both-client acceptance within existing QA authority;
use Sol 6.1 / High for any required implementation repairs. Native upgrade,
OS/in-flight lifecycle and both-client import/export/reimport remain unverified.
No OS background worker exists or was added; AppState resumes the same coordinator.

[Accepted contract](evidence/D10-target-recovery-contract-20261002.md) checkpoints
1–5 are implemented; checkpoint 6 remains open. Marker-only v15 exact provenance is
an explicit safe gate, never reconstructed from spelling/ACK bits. Web's immediate
content-copy imports do not retain mobile recovery roots; uncertain/target failures
are tested without retargeting or downgrade. Legacy direct-write coexistence remains
a release gate. D10.3–D10.5 unchecked; do not repeat D08/D09 or start D11.
`.playwright-cli/` and ignored QA data stay private. Default flags remain off.

Previous implementation `42c9bfd` completed default-off mobile clipboard JSON export
and pasted-document reimport: fresh personal IDs/default SRS, owned targets,
duplicate skips and atomic private content/command/import queues. See
[document reimport evidence](evidence/D10-document-reimport-20261002.md).

Earlier Astra review repaired six reproduced races/preservation failures in
`5efd6ff`: imported-ID resurrection, read-only target INSERT, pending-import loss
on target cleanup, concurrent learning overwrite, incomplete dictionary hydration
and deleted-card debt. SQLite v15 retains v14 intents/queues and durable import
acknowledgements. [Review evidence](evidence/D10-offline-import-review-20261002.md).
Earlier [implementation](evidence/D10-offline-import-intents-20261002.md) and
[contract review](evidence/D10-astra-review-20261002.md) remain historical evidence.

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

**All task QA resources are off.** During D09, the named browser, web/proxy runner and four task
containers stopped/verified at 06:59; ports 55331/55400 closed. Native devices
remained off during D09 and these D10 checkpoints. Final synthetic benchmark exited 0 with
its temporary servers/browser/backend cleaned up. No pending build/test/QA job.
Data, volumes, copies and reports retained. Other sessions/devices untouched.

Task state: D02–D10 done; D11 in_progress (D11.2 offline mechanics implemented; review/real quality open); D12–D14 pending; D01 blocked/partial.
D01.2 device/learning-queue evidence and D01.5 quota limitation remain open;
D13 approval and D14 observation/retirement gates are not waived.
Branch `feature/shared-dictionary-schema`, D11.1 implementation `a756680` (starting `44de0f5`); no push/PR. Default runtime dictionary and CEFR analysis flags remain off outside QA.
No production, schema cutover, publication, deployment or paid provider calls.

## Next resume

Resumed explicitly on 2026-10-03; execute the first incomplete checkpoint.

1. Read [D11 stage card](steps/D11.md), [offline evidence](evidence/D11-offline-calibration-20261003.md)
   and [reviewed engineering contract](evidence/D11-calibration-worker-contract-20261002.md).
   Review D11.2 on GPT-6 Astra / High before worker integration. The current
   implementation passed synthetic tests; real calibration/live sample remains
   a separate open gate. After review, Sol / High continues D11.3–D11.5. Do not
   repeat D10 or claim real qualification from TEST-ONLY metadata.
2. Preserve the existing branch and 170-path [offline source inventory](evidence/D11-offline-source-sha256.json).
   Leave `.playwright-cli/` and ignored retained reports/data uncommitted; do not
   reset/reseed or replay completed imports. In particular operation
   `217420b8-7a2d-4537-b440-a48ea42133f8` already completed once.
3. D11 local contract/job work uses fake providers, schedule disabled. No paid
   provider call, hosted migration, publication, deployment, push/PR/merge or
   schema cutover is authorized. Any live quality/cost sample is a separate gate.
4. QA resources stay off unless needed and reverified as task-owned: iOS
   `DDEDCE4E-153B-48A4-A47C-B4ED0F499F1F`, Android AVD
   `woordenaar_d08_qa_20260921` / `emulator-5584`, four local Docker containers
   `supabase_{db,auth,rest,kong}_woordenaar-d08-qa.ZFsE50`.
   Retained roots `woordenaar-d08-native.20261001` and `woordenaar-d08-qa.ZFsE50`
   remain under `reports/shared-dictionary-cefr/`. No other session resources.
5. Latest retained data is documented by D10 closure, not old D08/D09 cursors.
   Preserve all personal IDs, SRS/history, content and pending queues.

## Model and schedule authority

AUTH-16 permits autonomous model/effort selection through supported controls:
GPT-6.1 Sol / High for implementation, Astra / High for prescribed review or
unresolved architecture/concurrency risk. User-confirmed GPT-6 Astra / High reviewed
D11.1 and the calibration/worker contract. User-confirmed Sol / High implemented
D11.2 offline mechanics on October 3. Next: Astra / High review of the new
evidence/qualification boundary, then Sol / High worker work. No agent was used.
Direct current-thread picker control is unavailable; request manual switch and do
not claim an automatic change. Do not use GPT-5.6 Sol for future work.

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
| [D10](steps/D10.md) | done        | Final review, real desktop/Safari visuals and preservation PASS     |
| [D11](steps/D11.md) | in_progress | D11.2 offline mechanics PASS; Astra review/real quality then worker |
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
- Persistence: **committed locally, not pushed**. Latest application implementation is `c3f9baf` (R1/R2 repair), following `b7f207c` recovery UI and `abc0b86` sync and document reimport
  `42c9bfd`, following `5efd6ff`, `dfdc7f0` and `a59acad`; task docs are in the following documentation
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
- Latest mobile UI implementation: `b7f207c`; resume coverage: `a7315bb`. Latest mobile sync implementation: `abc0b86`; SQLite recovery implementation: `1748066`; server implementation: `1828f57`; architecture review/tests: `b92eba9`; document implementation: `42c9bfd`; preservation review: `5efd6ff`; earlier D03-D10 review: `a59acad`.
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
