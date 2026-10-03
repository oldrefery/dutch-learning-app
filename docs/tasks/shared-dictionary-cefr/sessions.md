# Session checkpoint log

Append concise records. Keep current resume state in `handoff.md`; do not require
a new session to read this entire history. Never log private vocabulary or secrets.

## 2026-09-12 — Resume workflow setup

- Scope: documents and instruction-level resume routing only.
- Stage: D01 remains pending; next checkpoint D01.1.
- Created: starter/runbook, active pointer, task handoff, decisions, 14 stage cards.
- Updated: root resume instructions and plan continuation section.
- Application code / production writes / paid calls: none.
- Branch at setup: `feature/web-review-navigation`, HEAD `e962870`.
- Persistence: local-only; no commit, push, PR or remote publication.
- Validation: read-only Node assertions passed for 21 Markdown files, 126 local
  links, 14 stage cards and 70 sequential checkpoints; all stage scopes match the
  main plan after normalizing Markdown indentation. Starter/active/handoff routing
  resolves to D01.1. Initial strict comparison flagged only formatter indentation;
  the normalized content comparison passed without removing any scope requirements.
- Formatting: scoped Prettier check passed; `git diff --check` passed. Application
  tests were not run because no application code changed. Fresh-client slash-menu
  invocation was not tested; the documented route is an instruction-level alias.
- Portability check: root `AGENTS.md` is locally excluded by `.git/info/exclude`;
  the explicit starter-file prompt is the fallback in another checkout. No ignore
  rule was changed and nothing was force-added.
- Current-session quota measurement: not taken; do not reuse historical percentages.
- Next model: GPT-6 Astra / High.

## 2026-09-12 — D01 read-only audit, first session

- D01.1 complete; D01.2–D01.4 partial evidence; D01.5 start/end recorded for this
  session, not the whole unfinished stage. First incomplete checkpoint: D01.2.
- Model: GPT-6 Astra / High (session configuration reported by user; no switch).
- Source map/risk register, production test-account/cache aggregate census,
  native build/protocol matrix and performance evidence saved in `evidence/`.
- Permission consumed: AUTH-02 read-only audit and local documentation. EAS owner
  verified as `oldrefery`; no account switch, app/DB change, learning write, paid
  enrichment, deployment, commit or push. D02 decisions remain unaccepted.
- Code `e962870`, branch `feature/web-review-navigation`; only local task bundle
  changes. No tracked application diff. These documents are not yet portable to
  another checkout without authorized transfer/commit.
- Web production: 15 samples at live `c5dfb14`, zero page errors/long tasks and
  attempted learning writes. Client setup median 687.7 ms, Start-to-card 72.7 ms.
- Synthetic web: `node scripts/web-performance/run.mjs`, Node 24.9.0; full 160
  samples passed. Durable `evidence/D01-web-synthetic.json`; ignored raw output
  `apps/web/output/performance/navigation/1789235156324-1x/`.
- SQL: `node docs/tasks/shared-dictionary-cefr/evidence/D01-owner-census.test.mjs`
  passed 12 assertions against disposable local PostgreSQL/current migrations.
  The owner report has not run on production. No private rows/credentials saved.
- Failed approaches: initial sandbox Expo/device inventory retried with read-only
  approval; public store reads failed non-retryably; no bypass attempted. Android
  version probe returned no fields. iOS simulator is old 1.13.0 (78), untouched.
- Paused gaps: installed-client evidence, owner-run aggregate report, and current
  isolated native fixtures. User version question unanswered at this checkpoint.
- All audit processes complete; temporary browser/server/SQL fixtures closed.
- Handoff validation passed: 111 local task Markdown links, 14 stage cards, one
  completed checkpoint (D01.1), D01.2 resume pointer, 160 synthetic/15 production
  samples. Scoped Prettier formatting and `git diff --check` passed. No application
  test suite run: application source was not changed.
- Weekly observations: 66% at 17:38:40 UTC -> 72% at 17:52:22 UTC, reset epochs
  1789817169/1789817168. Six account-wide percentage points; rounded and possibly
  contaminated by other usage, not a full-stage/project estimate.
- Next: same checkout, `/repo continue`, D01.2; Astra / High. Read handoff/evidence,
  close only the listed gaps; do not repeat the inventory or start D02/D03.

## 2026-09-12 — D01 isolated native baseline session

- D01.4 completed: 40/40 process-cold launch samples on 500/2500 synthetic words,
  iOS/Android, online/backend-offline. Earlier web evidence remains unchanged.
- Model: GPT-6 Astra / High as reported by the user; no model switch.
- AUTH-09 exercised: new task-owned devices and local Release builds only.
  Existing user devices/apps untouched. No production, account, cloud build,
  release, purchase, app implementation, commit or push operation.
- Source `e962870`, branch `feature/web-review-navigation`; untracked task bundle
  only. Durable native samples, method, build/fixture/flow helpers in `evidence/`.
  Persistence local-only; another worktree still requires authorized transfer.
- Native app 2.3.1 (84), Expo 57.0.22/RN 0.86.3, ARM64 Release/Hermes, OTA off,
  no real env loaded; local synthetic auth and backend. Preparation/build failures
  and artifact hashes recorded in `evidence/D01-native.md`.
- Commands: local Gradle Release and xcodebuild Release passed; Maestro baseline
  with explicit QA device/APP_ID/WORD_PATTERN passed eight five-sample flows.
  Metrics include automation overhead, not app-only TTI. No assessments performed.
- iOS SQLite at 500/2500: exact expected counts, zero events/learning commands/
  unsynced words. Android UI/count/read-request assertions passed; Android SQLite
  queue not inspected. Non-empty pending queues and token expiry are untested.
- Failed approaches: Pods UTF-8 env, Android QA network-resource lint, iOS secure
  input automation; corrected locally. Initial Android ADB disconnect discarded
  with no accepted samples. No global ADB restart or existing-device reset.
- Both backend processes exited; new Android AVD and iOS simulator shut down.
  QA data/artifacts retained at `/private/tmp/woordenaar-d01-native-0lR6oh` and
  task-owned device stores. No cleanup deletion. Durable results need no temp state.
- Validation: helpers syntax/format, eight-cell sample medians/40 samples,
  local Markdown links and checkbox/handoff consistency checked before handoff.
  Application test suite not run: no application source changed.
- Weekly use: 74% at 17:56:46 -> 88% at 18:28:43 UTC, reset 1789817169.
  Fourteen rounded account-wide points, potentially contaminated by other tasks;
  not exact native or complete D01 consumption. No reset/credit purchase.
- Pause: D01.2 actual installed-version/support evidence and D01.3 owner-run
  aggregate report still missing. D01.5 remains a partial-stage measurement.
- Next: `/repo continue`, Astra / High, close D01.2/D01.3 evidence only;
  preserve D01.1/D01.4, do not auto-start D02 or dictionary implementation.

## 2026-09-12 — D01 resume and observed-client evidence

- Resumed D01.2 under AUTH-02; source/branch unchanged (`e962870`,
  `feature/web-review-navigation`). D01.1 and D01.4 were preserved, not rerun.
- Existing Sentry credentials used only for the scoped project's read-only
  unresolved production issue query, 14d/limit 10, then up to three events for
  each of the three returned issues. Three events returned and passed the local
  environment/time filter: releases 2.3.0 (83), 2.2.1 (82), September 6.
- Sanitized release/dist/time evidence saved in `evidence/D01-observed-clients.md`.
  This is not a population census; D01.2 stays partial and D02 is not started.
- Scoped environment key-name/tool preflight found Sentry access but no database
  connector or configured DB/admin credential key. No secret values printed,
  broader access requested, account changes or production writes performed.
- Completed source map and 40 native/175 web samples left unchanged. No builds,
  devices or fixture servers restarted; no application code, commit or push.
- Validation: local evidence links, unchanged checkpoint gates, scoped formatting
  and `git diff --check`. Application tests not rerun for documentation-only work.
- Weekly observations: 90% at 18:32:55 -> 90% at 18:34:48 UTC, reset epochs
  1789817168/1789817169 (one-second drift). Rounded account-wide values; unchanged
  displayed percentage does not imply zero consumption. No credits/reset used.
- Pause: owner input still needed for current installed version/support inventory
  and the project-scoped aggregate SQL report. Local-only handoff updated.
- Next model remains Astra / High; no switch. Next action: reconcile supplied
  evidence into D01.2/D01.3, not repeat this bounded Sentry sample or D01.4.

## 2026-09-12 — Priority cohort clarification

- User identified two priority accounts; DEC-08 recorded using P1/P2 aliases.
  Primary owner requires full preservation; secondary recent learner may consider
  a restart only as a last resort. No reset/deletion approval inferred.
- Exact user-provided mapping retained in ignored local
  `reports/shared-dictionary-cefr/priority-accounts.json`; no DB identity lookup,
  personal IDs or emails added to portable task docs. Never force-add this file.
- Updated plan, decisions, D01 card and handoff. D01.2 now needs the two users'
  active device/build/sync evidence, not full population adoption. D01.3 still
  needs cohort-scoped aggregate/shared-cache evidence; SQL adaptation is pending.
- Source/branch unchanged, documents local-only, no commit, app change, remote
  operation or test rerun. Scoped formatting/ignore/privacy checks performed.
- Next: obtain P1/P2 platforms/builds and prepare scoped report; Astra / High.
  No new quota observation for this short documentation-only clarification.

## 2026-09-12 — Final-only cutover constraint

- User requires switching to the new schema only at the end after verification.
  DEC-09 recorded; plan, D13/D14 cards and handoff aligned. No stage advanced.
- Current production path remains authoritative during preparation; P1/P2 are
  not early canaries. Final cutover needs completed implementation/verification,
  preservation/delta/queue checks, backups, lossless rollback and explicit approval.
- D14 remains post-observation cleanup; the old safety net is not removed before
  cutover. No deployment, DB write, reset, feature activation or approval consumed.
- Local documentation only, same branch/revision, no commit/push. Formatting and
  diff checks run; application tests not applicable. No fresh quota measurement.
- Resume remains D01.2; device/build and cohort aggregate evidence still pending.

## 2026-09-12 — Priority user platforms

- User confirmed P1 uses iOS/web; P2 Android and possibly web. Recorded in DEC-08,
  D01 card, handoff and private mapping. Builds/pending sync remain unknown.
- P2 email spelling changed in the latest message; retained the first address and
  latest candidate in the ignored private mapping, marked ambiguous. Confirm
  before account targeting; no remote lookup or silent identity replacement.
- Documentation-only update, no production operations, code changes or commits.
  JSON/format/ignore checks performed; no app tests or fresh quota observation.
- Resume remains D01.2 with completed baselines preserved.

## 2026-09-12 — Supabase priority identity verification

- User confirmed P2 original email spelling and requested Supabase verification.
  Existing Chrome session opened the specific Dutch Learning App production Auth
  page; both requested exact email/UID pairs were present and verified.
- P1/P2 IDs saved only to ignored `reports/shared-dictionary-cefr/priority-accounts.json`.
  No unrelated user records persisted, account mutations, resets, new credentials
  or grants. The default Auth list rendered other rows incidentally; no bulk
  export or additional unrelated account inspection was performed.
- Corrected the access blocker: no API/DB connector was found, but authenticated
  Supabase dashboard access works. SQL UI execution remains untested; a later
  audit should prepare/validate cohort SQL before using the existing session.
- Context7 checked Supabase's documented Auth Users page; native browser UI used
  for verification, no admin token extraction. Two task-created dashboard tabs
  remain available; no background job or query running.
- Updated decisions, handoff and D01 card; version/pending-sync and aggregate
  evidence still missing. Source unchanged, local-only docs, no commit/push.
- JSON/ignore/privacy and scoped formatting checks passed. No app tests or fresh
  quota observation. No schema switch or implementation authority inferred.

## 2026-09-12 18:43 UTC — Explicit repository pause

- User invoked `/repo pause`; checkpoint only, no resumed audit or implementation.
- State: paused at D01.2; D01.1/D01.4 complete, D01.2/D01.3/D01.5 open.
  Both P1/P2 Auth identities verified; P2 original spelling reconfirmed by user.
  Platforms: P1 iOS/web, P2 Android/possible web. Exact builds/sync state unknown.
- DEC-08 preservation priorities and DEC-09 final-only cutover remain binding.
  No reset or early production switch authorized. D02 not started.
- Branch `feature/web-review-navigation`, HEAD `e9628704d0b35c548b8fac324ac5f49510c4334f`.
  Git status still shows only the untracked task documentation bundle. Private
  account mapping remains ignored; no commit, push, branch switch or file deletion.
- Persistence: same-checkout local files; fresh clone/worktree needs authorized
  task-bundle transfer and private identity mapping separately. No chat dependency.
- No new tests, remote queries, builds, browser navigation, quota checks or jobs.
  Only local checkpoint formatting/link/state validation; earlier results retained.
- Last verified native devices/backend are shut down; two Supabase tabs left open
  from read-only identity verification. No known running task-owned operation.
- Resume: `/repo continue`, Astra / High, D01.2 and scoped D01.3 report preparation;
  revalidate browser access, preserve completed checks. No automatic continuation.

## 2026-09-21 09:53 UTC — D01 resumed, scoped census ready

- Explicit continuation resumed D01 after pause; branch/HEAD still
  `feature/web-review-navigation` / `e962870`. Existing task files preserved.
- Used repository bootstrap, mandatory native-project guidance and Context7 for
  PostgreSQL transaction behavior. Recommended model remains Astra / High; user
  asked to report later switches, no switch performed or current picker inferred.
- Added cohort SELECT template and local test, 23 assertions passed with a third
  excluded synthetic owner, missing/duplicate owner checks, read-only enforcement
  and unchanged snapshots. Details in `evidence/D01-cohort-census.md`.
- First sandboxed PostgreSQL startup failed shared memory access; approved local
  retry using Node 24 passed. Temporary synthetic clusters cleaned up by harness;
  no existing database or personal data touched. Application suites not rerun.
- Supabase SQL Editor shell later redirected to sign-in: cached initial UI was
  not authenticated access. No production SQL was typed/executed. New sign-in
  tab marked for user handoff; no grants, credentials extracted or settings changed.
- User asked asynchronously for P1 iOS/P2 Android build and pending-sync evidence;
  reply outstanding. Platform/identity facts preserved without re-asking spelling.
- Local-only docs/test additions; no tracked app diff, commit, push, deploy, reset,
  backfill, paid call or schema activation. D01.1/D01.4 not rerun; D02 not started.
- Validation: 23 test assertions, JS syntax, scoped format, task links and
  unchanged stage gates. No task-owned DB/server process remains running.
- Weekly observation 3% -> 5%, 09:50:27–09:53:27 UTC, reset 1790440763;
  rounded account-wide data. New window; no subtraction from September 12 usage.
- Blocked on login and installed-build evidence. Next: restored project-scoped
  access, run validated cohort report with private mapping, reconcile D01.2/D01.3.

## 2026-09-21 09:58 UTC — D01 priority-cohort production census

- User restored Supabase sign-in and requested continuation. Existing project
  scope verified in Chrome: Dutch Learning App, production main, oldrefery.
- Validated SELECT transaction ran once in a new empty editor. Result showed
  read-only on, two distinct targets and two matched Auth owners. Explicit
  ROLLBACK included; no schema/data writes, setting changes or explicit Save.
  Normal SQL service query logging may retain the privately rendered query.
- D01.3 completed. Aggregate JSON and interpretation saved in
  `evidence/D01-cohort-production.json` and `evidence/D01-cohort-census.md`.
  No emails, UUIDs, vocabulary or rendered SQL saved in portable task files.
- P1/P2: 2,311/570 active cards, 1,491/94 review events. 231 cards without cache
  key; 11 candidate keys with differing translations. No individual CEFR or
  provenance columns found in the two inspected tables; verified coverage and
  public/private content counts remain unknown, not zero or publication approval.
- D01.2 still blocked on active phone versions/builds and local sync evidence;
  current matrix recorded in `evidence/D01-observed-clients.md`. D01.1/D01.4 not
  rerun; D02 not started. No implementation, reset, commit, push or deployment.
- Branch/HEAD unchanged: `feature/web-review-navigation` / `e962870`; only the
  existing local/untracked task bundle changed. Same-checkout resume available.
- Validation: accepted live result guards; scoped Prettier, JSON consistency,
  privacy and task-link checks. Application tests not rerun for evidence-only edits.
- No running database job or uncertain mutation. Browser result extracted;
  no live-tab handoff required after completion.
- Quota: 6% at 09:57:05 -> 7% at 09:58:37 UTC, reset 1790440763; rounded
  account-wide usage, not precise attribution. No credits redeemed or purchased.
- Next: user supplies phone version/build and visible sync status; reconcile
  D01.2 and close D01.5 at the stage exit. Recommendation remains Astra / High.
  Current picker not inspected; no model change performed.

## 2026-09-21 10:00 UTC — D01 device-evidence limitations

- Resumed using repository bootstrap; branch `feature/web-review-navigation`,
  HEAD `e962870`, task bundle local/untracked and preserved. No new remote query.
- Read Settings, status service/hook and learning-queue consumers. The UI pending
  total excludes separate review/reset/correction queues; `Up to date` does not
  establish complete queue drainage. Displayed version uses app config rather
  than native-binary metadata. Added exact screenshot guidance and caveats to
  `evidence/D01-observed-clients.md` instead of claiming phone access.
- D01.2 still blocked on device evidence. No automatic advancement to D02, no
  code changes, new diagnostic, device extraction, sync/reset, commit or deploy.
- Validation: scoped documentation format check; source references inspected.
  Runtime tests not run because only evidence/hand-off documents changed.
- Recommended model remains Astra / High; actual picker not inspected. No quota
  estimate added and no running or uncertain external operation introduced.
- Next: obtain Settings version/Sync Status screenshots, or obtain an explicit
  workflow exception to prepare D02 with device checks left open and mandatory
  before release. No such exception is currently approved.

## 2026-09-21 10:05 UTC — P1 iOS evidence and D02 foundation draft

- User provided two iOS Settings screenshots, confirmed primary mobile priority
  and requested continuation after the offered design-only path. Recorded this
  narrowly: local proposal preparation, no D01 completion or release-gate waiver.
- App-reported 2.3.1 (84); visible sync pending 0/0/0, last sync 12:03 PM as
  displayed; local 2,311 words/12 collections match earlier P1 server aggregates.
  Update badge is not data sync; separate learning queues and exact OTA ID unknown.
  P2 Android evidence remains open. No further phone screenshot of P1 requested.
- Added sanitized evidence with original image hashes. Raw images/account email
  not copied into portable task files. No device interaction or remote operation.
- Used repository bootstrap and existing brainstorm to draft D02 responsibilities,
  privacy, pinned revisions and CEFR policy. Compared existing protocol/rollout
  boundaries. No proposed decision marked accepted; D02.1 remains open.
- Branch/HEAD `feature/web-review-navigation` / `e962870`, local task docs only.
  No code, migrations, queue operations, generated types, commits or deployment.
- Validation: scoped Prettier and local task-link checks; no runtime tests for
  documentation-only work. No running or uncertain task-owned operation.
- Next: obtain user direction on proposed private/pinned-content policy, then
  detail identity and stale legacy-write behavior. D01 gaps retained alongside
  D02 preparation; D03 and final cutover remain gated. Astra / High unchanged.

## 2026-09-21 10:10 UTC — Foundation accepted, compatibility specified

- User confirmed the three presented foundation rules: shared meaning/CEFR with
  personal IDs/learning intact, private edits/examples, explicit revision adoption.
  Recorded DEC-01/DEC-02 policy acceptance without expanding implementation or
  release authority. Existing D01 gaps and final-only cutover remain binding.
- Added `D02-compatibility-contract.md`: identity cases, minimum UI, logical
  constraints, versioned/idempotent content commands, legacy-client matrix,
  generated-target provenance, rollback/retirement and 16 acceptance fixtures.
- Source inspection verified semantic duplicate repair may replace mobile IDs,
  personal server uniqueness remains legacy-key-based, and old metadata errors
  can stall learning sync. Proposed transition limit and reject/reconcile policy
  are explicit new product decisions, not quietly accepted by foundation approval.
- Context7 checked official Supabase CLI local generation/target flags. No CLI,
  database, remote project or paid provider operation ran. Pin/version-check the
  actual tool before a future local type-generation implementation.
- Used bootstrap and native architecture guidance; retained durable offline
  content and learning queues, platform coverage and batch reads in the contract.
- Only local docs changed on `feature/web-review-navigation` / `e962870`; no
  application implementation, migration, generated artifact, commit or deployment.
- Validation: documentation formatting, task links and privacy/stage assertions.
  Acceptance scenarios are unexecuted specifications; no runtime pass is claimed.
- Next: review proposed same-key-card and legacy-write restrictions, then finish
  D02 acceptance. D03 remains gated. Astra / High retained; no model switch.

## 2026-09-21 10:15 UTC — D02 specification ready, implementation handoff

- User confirmed both transition restrictions. Recorded DEC-03/DEC-04 acceptance
  within that scope; no repeat approval request for these rules.
- Completed the six D02 specification outputs with `D02-schema-blueprint.md`:
  concrete table/field layout, privacy/override authority, revision/assessment
  integrity, operation receipts, publication and recovery boundaries.
- Final self-review added F17–F20: receipt retry after tombstone, forged/direct
  bypass attempts, cross-owner relations, commit-order-safe shared cursor.
  Twenty cases are design fixtures, not executed database tests. No subagents used.
- D02 checkboxes mean specified; formal advancement remains blocked on D01
  dependency treatment and explicit local implementation authority (DEC-07).
  Android/full local queues stay unverified; no source publication or retirement
  date is assumed. Proposed next scope is local synthetic D03 only.
- Branch/HEAD remain `feature/web-review-navigation` / `e962870`; task documents
  local/untracked. No application edits, migrations, generated types, git mutation,
  device interaction, deployment, paid calls or running task-owned operation.
- Used repository bootstrap and native architecture guidance to preserve offline
  state; OpenAI Docs verified Sol supports High. This corroborates the saved D03
  recommendation, not an API-pricing-to-subscription quota estimate. Picker unchanged.
- Validation: scoped Prettier, local links, 20 unique fixture IDs and stage/privacy
  guards. Runtime suites not run for documentation-only output.
- Next: user selects GPT-5.6 Sol / High and approves local D03 with the retained
  D01 pre-release gate, or supplies outstanding D01 evidence first. Later schema/RLS
  review returns to Astra / High. No automatic continuation or quota purchase.

## 2026-09-21 10:55 UTC — D03 local implementation complete, review handoff

- User granted AUTH-03, selected GPT-5.6 Sol / High and retained D01 Android/full
  queue evidence as a mandatory pre-release gate. Created
  `feature/shared-dictionary-schema` from synchronized `main` at `c5dfb14`.
- Completed D03.1–D03.5 locally: additive shared entries/revisions/current heads,
  CEFR history/heads, optional trusted card pins, owner-private content state,
  private provenance/receipts, deletion/reference guards, RLS and an invoker read
  view. Legacy fields, IDs, SRS/history and current application paths remain intact;
  no live references, adapter, backfill, worker or feature capability was enabled.
- Added fresh/upgrade/RLS regression coverage and reproducible pre-deployment
  target types. The target manifest pins migration head, PostgreSQL image,
  Supabase CLI 2.117.0 and Prettier 3.9.6. The deployed generated contract remains
  unchanged and shipped clients do not import the target artifact.
- Final verification on the uncommitted working tree: `npm run test:db` 133/133;
  dedicated D03 suite 8/8; deterministic target generation/check; contracts
  typecheck; `lint:ci`; and full format check all pass. Temporary Docker resources
  were removed and an exact-name cleanup check found none remaining.
- Reconciled the implementation with the accepted blueprint before handoff:
  candidate lookup stays non-unique, private fallback is nullable, versions use
  bigint, and content receipts remain in the private schema. Added a documented
  trusted current-revision head; personal pins never move automatically.
- Failed type-generation paths: do not retry host Unix sockets or Supabase CLI
  2.75.0 container networking. The working generator uses a disposable pinned
  Docker PostgreSQL, random password/port and pinned current toolchain.
- Scope consumed: local implementation/testing only. No production/staging SQL,
  source publication, paid provider call, schedule, account/device change,
  commit, push, PR or deployment. All task/D03 changes remain local/uncommitted.
- Next: user switches to GPT-6 Astra / High for independent migration/RLS/test
  review. Fix findings and rerun affected/full gates; if clean, close D03 and
  select D04 without starting it automatically. No running uncertain operation.

## 2026-09-21 11:13 UTC — D03 independent review complete

- Model: GPT-6 Astra / High, selected by the user. D03 only; no subagents.
- Reproduced six regression failures before fixes; corrected CEFR successor/head
  bypasses, reviewed-level protection, retired links, mutable shared identity,
  receipt deletion cascades and inconsistent private fallback layout.
- Added publication/provenance/head serialization, forged-flag/default-grant tests,
  source approval checks and no-auto-adoption/CEFR-input regression coverage.
- Isolated type generation on a private Docker network with pinned Postgres Meta;
  removed the LAN-port dependency and anonymous-volume leak. No hosted access.
- Final code gates: DB 145/145 (D03 20/20), deterministic target check, contracts
  typecheck, lint pass. Handoff formatting was the only formatting issue and was
  corrected at closure. [Evidence and fingerprints](evidence/D03-review.md).
- Branch `feature/shared-dictionary-schema`, base `c5dfb14d49b9`; all implementation
  and task documents local/uncommitted, no push/PR. No running/uncertain operation.
- AUTH-03 used for review/fixes/tests only; no production/staging migration,
  publication, paid calls, jobs, app/device changes or activation.
- D03 done; D04.1 selected but not started. Next: GPT-5.6 Terra / High and explicit
  local D04 scope. D01 Android/complete learning queues remain release gates.
- Weekly usage observation approximately 11:11 UTC: 26% used, reset 1790440763;
  no stage-start sample, so no exact review cost or cross-model quota inference.

## 2026-09-21 — D04 shared contracts complete

- Model: GPT-5.6 Terra / High. User explicitly authorized local D04; AUTH-10
  exercised for contracts, fixtures, documentation and local checks only.
- Added one dependency-free shared module for strict dictionary/revision/reference,
  override, CEFR and versioned-content command contracts; canonical CEFR input and
  effective-content/CEFR resolvers are exported through `@woordenaar/domain`.
- Same source is proven on mobile (4 tests), web (1) and Edge/Deno (1 within full
  Edge 74/74). No endpoint/RPC/runtime client import was added.
- Domain/mobile/web typechecks, explicit new-file lint, repository lint and root
  formatting passed. Evidence: [D04 contracts](evidence/D04-contracts.md).
- Branch remains `feature/shared-dictionary-schema`, base `c5dfb14d49b9`; all
  D03/D04 changes are local/uncommitted. No remote operation or uncertain job.
- D04 done. Next D05: GPT-5.6 Sol / High plus new explicit local authorization.
  D01 Android/full learning-queue evidence and all production cutover gates remain.

## 2026-09-21 — D05 local server compatibility complete

- Model: GPT-5.6 Sol / High. AUTH-11 was exercised for local D05 only.
- Completed D05.1–D05.5: trusted idempotent canonical persistence, strict personal
  content commands, cache-to-canonical mapping, bounded effective-content reads,
  commit-order-safe delivery cursor, legacy projection/guard and v2 web snapshot.
- All new runtime flags default off. The legacy application path and v1 snapshot
  remain authoritative; no production/staging mutation, deployment, paid call,
  schedule, activation, cutover, commit, push or PR occurred.
- Final exact-tree verification: focused D05 12/12 and full PostgreSQL 157/157;
  Edge 74/74; mobile/web shared contracts 4/4 and 7/7; relevant typechecks, lint,
  formatting, target generation/check and diff checks pass. Durable detail and
  hashes: [D05 evidence](evidence/D05-server-compatibility.md).
- An ambient Node 20 run and a target check without Docker on PATH were invalid
  preflights, not product failures. Correct Node 24/tool PATH runs passed. No
  task-owned operation remains running or uncertain.
- Branch `feature/shared-dictionary-schema`, base/current HEAD `c5dfb14d49b9`;
  all D03–D05 changes remain local and uncommitted.
- Next: separately authorize local D06 and remain on GPT-5.6 Sol / High. After its
  implementation, use GPT-6 Astra / High for migration/backfill safety review.
  D01 Android/full learning-queue evidence remains a mandatory release gate.

## 2026-09-21 — D06 local backfill rehearsal complete

- User continued after the D05/D06 handoff and reported a model switch; AUTH-12
  covered local tooling, synthetic rehearsal, verification and documentation.
  Model family: GPT-6; exact picker variant/effort unverified. Same-session review,
  no separate reviewer or subagent claimed.
- Completed D06.1–D06.5: reviewed official seeding, strict meaning-bound CEFR,
  six-way dry-run mapping, immutable plans/receipts, bounded compare-and-set
  batches, concurrent/retry handling, inventory delta reports and read rollback.
- Administrator-only SQL lives outside automatic migrations. No real account,
  hosted database, production manifest/private export or device was used.
- Full PostgreSQL suite passed 172/172 before the last counter fix. Fault
  injection reproduced a false applied count after receipt-lock rollback;
  moving counters after receipt insertion fixed it. Final focused D06 16/16,
  lint, formatting and diff checks passed. Tests preserve exact personal rows
  and learning streams and prove post-link reviews survive read rollback.
- [D06 evidence](evidence/D06-backfill-rehearsal.md) records the reviewed synthetic
  report, commands, hashes and scope limits. All temporary test clusters closed;
  no running or uncertain operation. No quota sample/cost estimate this session.
- Branch `feature/shared-dictionary-schema`, HEAD `c5dfb14d49b9`; all D03–D06
  work remains local/uncommitted. No commit, push, PR, hosted operation or activation.
- D06 done locally. Next: D07 mobile SQLite storage, GPT-5.6 Sol / High. D01
  Android/full learning queues and all D13 release/cutover gates remain open.

## 2026-09-21 — D07 local mobile storage complete

- Model: GPT-5.6 Sol / High. AUTH-13 was exercised for local D07 only.
- Added the non-destructive SQLite v13 read model: immutable revision/CEFR caches,
  owner-scoped card state, durable ordered content commands and monotonic change
  cursors. Existing `words`, SRS, review/reset/correction queues and progress
  authority remain unchanged; runtime paths are still dormant.
- Added strict shared-contract parsing, canonical immutable storage, chunked bulk
  materialization, missing-dependency state, exact retry after tombstone, owner
  isolation and storage/reconciliation APIs. Only supplied dependencies are cached;
  there is no full-dictionary download.
- Real file-backed SQLite covers v8-to-v13 recovery and exact v12-to-v13 preservation.
  Full mobile Jest passed 136/136 suites, 1,571/1,571 tests and 22/22 snapshots;
  final focused storage 8/8; mobile build/test typechecks, full lint, formatting
  and diff checks passed. Evidence: [D07 mobile storage](evidence/D07-mobile-storage.md).
- The first focused run inherited shell Node 20 and could not load `node:sqlite`;
  the repository Node 24 run passed. No product failure or workaround remains.
- Context7/official Expo SQLite guidance confirmed that exclusive transaction
  queries must use the transaction object; v13 and repository batches do so.
- Branch `feature/shared-dictionary-schema`, HEAD/base `c5dfb14d49b9`; all D03–D07
  code and documents remain local/uncommitted. No hosted mutation, production
  access, device/app replacement, deployment, activation, commit, push or PR.
- No running or uncertain operation. D08 requires a new explicit local-stage
  authorization. Keep Sol / High for implementation, then switch to Astra / High
  for D08 review. D01 Android/full learning queues remain release gates.

## 2026-09-21 — D08 local implementation complete, Astra review handoff

- Model: GPT-5.6 Sol / High. AUTH-14 was exercised for local D08 implementation
  and synthetic verification only.
- Completed D08.1–D08.3 and local D08.5: dependency-first dictionary hydration,
  owner-scoped revision cursors, durable offline command chains, transactional
  add/reanalysis/image edits, effective content materialization and CEFR state UI.
- Existing learning protocol 2 remains authoritative and is checked before the
  dictionary capability. All shared-dictionary runtime flags remain off.
- File-backed restart/account tests preserve one owner's fallback, command and
  cursor without cross-owner visibility. This is partial D08.4 evidence only;
  real iOS, Android, web, two-device and returning-old-client verification remains.
- Final mobile regression passed 140/140 suites, 1,591/1,591 tests and 22/22
  snapshots. Mobile typecheck, repository lint, formatting and diff checks passed.
  Evidence: [D08 mobile integration](evidence/D08-mobile-integration.md).
- Invalid attempts: root Jest selected the wrong harness; Watchman is unavailable
  in the sandbox; direct protocol-2 Node tests lacked their disposable local stack.
  Use the exact corrected commands/prerequisites recorded in the evidence.
- Branch `feature/shared-dictionary-schema`, HEAD `c5dfb14d49b9`; all D03–D08
  work remains local/uncommitted. No hosted mutation, real-user sync, device/app
  replacement, deployment, activation, paid call, commit, push or PR occurred.
- No running or uncertain operation. Next: switch to GPT-6 Astra / High, review
  D08 conflict/account/cursor/old-client safety, fix findings and rerun gates.
  Physical D08.4 and D01 Android/full learning-queue evidence remain release gates.

## 2026-09-21 — D08 Astra review completed; isolated QA gate

- Model: GPT-6 Astra / High following the user's confirmed model switch. AUTH-14
  exercised for local review/fixes and synthetic tests; no independent reviewer.
- Fixed pending-edit overwrite (reproduced by a failing regression), non-atomic
  acknowledgement, missing durable card refresh, linked whole-row writes,
  incomplete private override replacement, hidden conflicts, learning blockage,
  account races, assessment pagination/removal and old-client fallback staleness.
  Added an explicit default-off mobile flag and conflict comparison/choice UI.
- Final mobile: 141 suites, 1,614 tests, 22 snapshots passed. Full PostgreSQL:
  174/174. Mobile build/test typechecks, lint and target contract check passed.
  Formatting/diff checks passed at documentation closure. Evidence and artifact
  fingerprints: [D08 review](evidence/D08-review.md).
- Intermediate migration inventory/test typing/mock failures fixed. PostgreSQL
  and Docker sandbox preflights required approved escalation; reruns passed.
  No unresolved product test failure is carried forward.
- Branch `feature/shared-dictionary-schema`, committed HEAD `c5dfb14d49b9`;
  all D03–D08 code/docs remain local, uncommitted/unpushed. Changed surfaces include
  mobile sync/repository/schema/UI/hooks/store/tests and the local D05 protocol
  migration/regression. Earlier local work is preserved.
- No hosted mutation, real-user synchronization, device/app installation,
  deployment, activation, paid call, commit, push or PR. All test commands exited;
  no new native/HTTP stack was started. No fresh quota sample or stage cost claim.
- Next: D08.4 on isolated iOS (primary) and Android plus supported legacy web/client
  interoperability; obtain disposable device/build/local synthetic stack scope
  and execute the saved matrix. Recommended GPT-5.6 Sol / High. D08 stays
  `in_progress`; D01 Android/full learning queues and final cutover remain gated.

## 2026-09-21 — D08.4 isolated platform QA complete; Astra closure review next

- Model: GPT-5.6 Sol / High. AUTH-15 was exercised only for task-owned local
  Supabase, synthetic owners, disposable iOS/Android builds/devices and loopback
  web verification.
- iOS primary-platform QA passed CEFR/materialization, owner switching, durable
  offline correction, cold-start restoration, exactly-once retry, offline reset,
  restart and reconnect convergence. Android passed owner isolation, dormant-client
  compatibility/upgrade, final full smoke and exact-tree smoke. Loopback web/mobile
  content and reset state converged.
- QA found and fixed two product defects: a confirmed correction capability was
  not retained for offline enqueue, and a cold-start pending correction whose word
  was no longer due could not recreate its controller. Regression tests cover both.
  Metro caches are now isolated between enabled and dormant QA builds.
- Final exact-tree gates: mobile Jest 141/141 suites, 1,620/1,620 tests and 22/22
  snapshots; build/test typechecks; `lint:ci` with zero warnings; formatting,
  native YAML formatting and diff checks; final iOS/Android Release builds and
  exact-tree smoke all passed. Evidence: [D08.4 platform QA](evidence/D08-platform-qa.md).
- Final enabled hashes: iOS JS bundle
  `313ef52f89ea3599f9834c0d0411ac9656a29c7818e023cfcaf86d8e549e41f1`;
  Android APK
  `f2529798630c7aefc1bb9d378323a1c4947a7250b3a0ff2d9640c2fd4765f1aa`.
- The local web server, Supabase stack and Android emulator were stopped. The iOS
  task device shutdown command succeeded; a later read-only device-list check could
  not reconnect to CoreSimulatorService while macOS was locked. Temp builds/device
  data are retained, not erased. No product operation remains running.
- Branch `feature/shared-dictionary-schema`, committed HEAD `c5dfb14d49b9`; all
  D03–D08 code/docs remain local, uncommitted/unpushed. No hosted mutation,
  production account, deployment, activation, paid call, commit, push or PR.
- D08.4 execution is complete but its checkbox remains open until the planned
  exact-diff closure review. Next: switch to GPT-6 Astra / High, review the current
  D08 diff/evidence, rerun affected gates only if code changes, then mark D08 done
  and select D09 (GPT-5.6 Terra / High) without starting it automatically.

## 2026-09-21 — User-requested pause before D08 closure review

- Stage/checkpoint: D08 is paused after completed D08.4 platform QA and exact-tree
  gates; the final GPT-6 Astra / High closure review remains the first incomplete
  checkpoint. No implementation or verification was started during this pause.
- Branch/revision/persistence: `feature/shared-dictionary-schema` at
  `c5dfb14d49b9a53521b53e13bdd19991999ede5d`; all D03–D08 work remains
  local-only, uncommitted and unpushed. The dirty tree was preserved unchanged.
- Operations: none running or uncertain. Runtime flags remain off. No hosted
  mutation, activation, deployment, commit, push or PR was performed.
- Resume: switch to **GPT-6 Astra / High**, then send `/repo continue`. Review the
  exact D08 diff and saved QA evidence; rerun affected gates only if code changes.
  If the closure review is clean, mark D08.4/D08 done and select D09 using
  **GPT-5.6 Terra / High** without starting D09 automatically.

## 2026-09-26 — D08 closure review fixes; native acceptance still open

- Resumed the paused checkpoint with `/repo continue`. Branch/HEAD and all seven
  recorded runtime hashes matched. The interrupted initial read made no edits or
  started processes. Model family: GPT-6; recommended Astra / High, exact picker
  variant/effort not independently observed. No independent review agent.
- Reproduced six regression failures covering inaccessible repeated/new conflicts,
  removed words, stale content after server choice and account-switch visibility.
  Fixed resolver visibility to follow current owner-scoped state and details to
  render the current stored word. Learning session snapshots remain unchanged.
- Full mobile Jest passed 142/142 suites, 1,626/1,626 tests and 22/22 snapshots.
  Both mobile typechecks passed. After test-only duplicate-string cleanup, strict
  lint passed with zero warnings, focused verification passed 17/17 tests and
  4/4 snapshots, and test typecheck passed again. Repository formatting and diff
  checks passed. No schema/server/storage runtime was changed.
- The September 21 report overstated D08.4 completion: its recorded native flows
  cover CEFR/owner/learning recovery, but not the full planned dictionary-content
  edit/conflict/retry matrix. D08.4 stays unchecked and D08 stays `in_progress`.
  The revised UI also needs fresh native builds/smoke. D09 was not started.
- Read-only local checks found Docker available with unrelated project containers,
  no D08 container, and expired temporary config/migration/fixture files in the
  retained D08 roots. No new native build, device operation or stack launch ran.
  No hosted mutation, real-user sync, paid call, activation, commit, push or PR.
- Persistence: `feature/shared-dictionary-schema`, HEAD
  `c5dfb14d49b9a53521b53e13bdd19991999ede5d`, all D03–D08 work local/uncommitted.
  This session changed conflict resolver/header, word details, their tests and
  task documents. Prior dirty work was preserved. No operation remains running.
- Fresh quota observation: 2% weekly used, reset 1791051321; a different window
  from September 21, not an exact stage cost.
- Next: **GPT-5.6 Sol / High**; restore isolated QA setup and run the explicit
  remaining matrix in [D08 closure review](evidence/D08-closure-review.md).
  Do not replay expired temporary paths or claim old artifacts verify revised UI.

## 2026-09-26 — D08 isolated native QA resumed, then user-paused

- Recreated local stack/config/migrations and two synthetic accounts using saved
  setup helpers. Both revised iOS/Android Release builds passed; source/artifact
  hashes and partial attempts saved in [native content QA](evidence/D08-native-content-qa.md).
- Android verified linked A2/B1 and later private unknown CEFR, but no full flow
  passed. Fixed a test-fixture translation shape mismatch; content-edit/offline/
  conflict/retry scenarios remain unverified. Read-only SQLite baseline recorded.
- iOS login typing corrupted the synthetic password (safe proxy boolean checks).
  Clipboard-based retry was interrupted, not passed. Local web baseline passed.
- User explicitly paused simulator/emulator work because it interfered with
  another session. Stopped only the verified running native QA automation;
  left devices untouched afterward. Do not resume native scope without explicit
  user permission and coordination. Local stack/proxy/web/device state is listed
  in the QA checkpoint; no broad shutdown or deletion was performed.
- Current stage remains D08 in_progress/D08.4 unchecked. No D09, deployment,
  production mutation, paid provider call, commit or push. All work stays local
  on feature/shared-dictionary-schema, HEAD c5dfb14; prior dirty work preserved.
- Recommended next model remains Sol / High for QA, Astra / High for established
  concurrency/protocol findings. Exact current picker/effort not independently
  observed; no fresh quota measurement was taken.

## 2026-10-01 — D08 native QA resumed; sync-status defect reproduced

- User explicitly resumed QA on the dedicated task devices. The September 26
  pause is superseded only for the original AUTH-15 isolated scope. No unrelated
  devices/apps, real accounts, hosted projects, EAS, paid providers, commit/push,
  publication, activation or cutover were used.
- Recovered the surviving local Docker stack into durable ignored report roots,
  seeded two fresh synthetic users and verified recovered installed artifacts
  match revised September 26 hashes. Runtime source did not change in this session.
- Both native baselines passed. iOS reanalysis, pending intent cold restart,
  conflict comparison, stale-server-choice rejection, Keep-my-version and server
  choice passed. Repeated-modal controls returned but scrolling interrupted the
  complete repeated-choice flow; do not claim that whole flow passed.
- Android edit/restart and injected lost-acknowledgement retry passed: exact
  operation ID/payload preserved, two deliveries but one server receipt, empty
  reconciled queues. iOS and supported local legacy web received the Android
  translation. Learning state and personal word identities were preserved.
- Missing-revision response injection retained cursor 8 while server was at 9.
  After a synthetic linked-card image override, iOS retained one durable refresh
  item yet displayed Up to date. Two native probes fail; the new owner-scoped
  hydration test also fails (expected pending 1, actual 0; two older tests pass).
  No runtime fix has been made. The initial focused test command also triggered
  irrelevant global coverage thresholds; rerunning with --coverage=false isolates
  the single genuine regression.
- Removed all proxy faults; recovery passed both native clients, cursors 9,
  empty content/hydration queues, new CEFR assessment cached, identical word
  content and unchanged SRS/learning queues/history. Peer image helper was
  corrected after two rejected invalid-command attempts; this is not native
  image-replacement UI acceptance.
- Persistence: feature/shared-dictionary-schema, HEAD c5dfb14d49b9a53521b53e13bdd19991999ede5d;
  all D03–D08 changes remain local/uncommitted. This session changed QA helpers,
  Maestro flows, one regression test and task documents only. Raw credentials/
  debug artifacts stay ignored; October 1 web artifacts moved to the ignored
  native root, older September 26 raw files preserved.
- Durable evidence and exact native run IDs:
  [October 1 content QA](evidence/D08-native-content-qa-20261001.md).
  Final strict helper/test lint, mobile test typecheck, focused formatting and
  diff checks passed. The new regression remains red; no current full-suite
  pass is claimed. Runtime hashes and branch/HEAD were reverified unchanged.
  No Maestro automation remains active. Local stack, task devices, proxy
  session 68080/PID 65646 and web session 22956/PID 63984 remain available;
  Android emulator session 99185. Recheck exact processes/devices before reuse.
- Model/effort actually selected: not independently observable. QA recommendation
  was Sol / High. Next recommendation: **GPT-6 Astra / High** for the reproduced
  status/dependency-debt defect, then Sol / High for remaining routine native QA.
  No independent agent review or fresh quota sample; no stage-cost claim.
- First incomplete checkpoint: D08.4. Fix owner-scoped/deduplicated hydration
  accounting and assess durable change-page debt before pull. Add regressions,
  rebuild affected clients, rerun dependency/status/recovery and remaining
  private-add/native-image/stale-local/repeated-modal/deletion/account-switch
  matrix. D09 has not started and D01 pre-release evidence remains required.

## 2026-10-01 — D08.4 sync-status repair checkpoint

- Resumed the saved regression on feature/shared-dictionary-schema, HEAD c5dfb14.
  Fixed missing hydration counts and persisted change-page debt before pull.
  No schema/server/learning-protocol change or runtime activation.
- Before fix: 5 failing / 17 passing targeted tests. Full mobile after fix:
  142 suites / 1,632 tests / 22 snapshots passed; final focused 53/53 after helper
  refinement and two Settings theme tests. Typechecks and strict lint pass;
  final formatting/diff validation recorded in the repair evidence.
- Model/effort unknown; Astra / High recommended, no independent agent review.
  No fresh quota reading or stage-cost claim. Local-only persistence; no commit,
  push, PR, production access, device/service operation or hosted mutation.
- Changed in this session: two runtime services, status/sync/restart/Settings
  tests and task documents. All prior D03–D08 dirty work retained. Intermediate
  harness/type/lint corrections are documented in the evidence.
- Evidence: [sync-status repair](evidence/D08-sync-status-repair-20261001.md).
  Previous native processes/builds were not reverified and contain no new fix.
  No new persistent operation is running from this repair session.
- Next: GPT-5.6 Sol / High; inspect only authorized task resources, refresh the
  isolated source copy, rebuild iOS/Android and verify missing-dependency badge,
  cursor/debt/restart/recovery. Finish the remaining native acceptance matrix.
  D08.4 open; D09 not started; D01/D13 release gates unchanged.

## 2026-10-02 — D08.4 repaired native acceptance checkpoint

- Continued saved handoff on user-selected GPT-6.1 Sol; effort not observable.
  No independent agent review or fresh quota reading; no stage-cost claim.
- Status/dependency-debt repair verified on exact task iOS/Android through missing
  revision, pending status, restart and recovery. Private add/image replacement,
  pending restart and exactly-once receipts passed on both. Native QA found two
  additional business-logic defects: blank analysis notes rejected canonical
  parsing; reanalysis discarded derived conflict metadata until sync. Fixed
  canonical blank-to-null mapping and owner-scoped materialized store publication,
  with regressions including the new hydration await's owner boundary.
- Final mobile checks: 142 suites / 1,639 tests / 22 snapshots pass; build/test
  typechecks and strict lint pass. Focused actions/resolver/details 46/46 pass.
  Both final Release artifacts built/installed on task devices preserving data;
  exact source/artifact hashes and logs are in
  [final native evidence](evidence/D08-native-status-verification-20261001.md).
- Final iOS immediate stale-local rejection, both choices across repeated conflict
  in the same modal, stale-server rejection, supported account switch/return and
  remote deletion while details were open passed. Android final reanalysis/delivery
  and deletion convergence passed. Native/legacy-web final state: four active
  primary words, cursor 11, matching content/tombstone, empty queues, unchanged
  word IDs/owners/SRS/learning. Web loopback HTTP image rendering is not claimed;
  supported account navigation is not same-mounted owner race injection.
  Older lost-reply/old-mobile/learning scenarios retain prior evidence and were
  not all rerun on final artifacts; closure review must assess this explicitly.
- QA-only corrections: iOS deep-link Open confirmation, clipboard/password waits,
  visible iOS Back versus Android back action, and stable conflict tap after scroll.
  Global synthetic-owner logout invalidated this task's web/Android sessions;
  restored only those fixture sessions with no reset/reseed. Rejected/partial
  attempts and successful continuation run IDs are preserved in evidence.
- Persistence: feature/shared-dictionary-schema, HEAD c5dfb14d49b9a53521b53e13bdd19991999ede5d;
  all D03–D08 work remains local/uncommitted. This continuation changed mapping/
  mapping regressions, wordActions/action regressions, guarded task QA helpers,
  flows and task docs; status services retain the prior repair. Preserve all dirty
  files, including earlier migrations/contracts/storage/UI. No commit/push/PR.
- Retained local DB/API stack woordenaar-d08-qa.ZFsE50, proxy 55331/PID 65646,
  web 55400/PID 63984, iOS DDEDCE4E-153B-48A4-A47C-B4ED0F499F1F and Android
  emulator-5584 / woordenaar_d08_qa_20260921. Dedicated d08-content-qa web session.
  All faults disabled, both apps synthetic-primary, no build/Maestro job pending.
  Raw state/fixture/logs/browser outputs remain ignored under
  reports/shared-dictionary-cefr/woordenaar-d08-native.20261001; older browser
  artifacts untouched. Reverify identities before further operation.
- Final task helper lint, scoped Markdown/YAML/helper formatting, full repository
  format:check and git diff --check pass. Logs under reports/shared-dictionary-cefr:
  D08-final-checkpoint-helper-lint.log, D08-final-checkpoint-format-write.log and
  D08-final-checkpoint-repository-format.log. No runtime change after final builds.
- AUTH-14/AUTH-15 local scope only; user resumed only dedicated-device QA. No
  other session/device, production/schema switch, deployment, provider, EAS,
  hosted mutation or publication. Runtime activation remains QA-only.
- First incomplete checkpoint: D08.4 closure review. **Next model/effort:
  GPT-6 Astra / High**. Review all three repairs/regressions and final native matrix,
  resolve any findings/acceptance gaps, then update the stage checkbox/handoff.
  Do not start D09 automatically; D01 release evidence remains mandatory.

## 2026-10-02 — User deadline and task-resource shutdown

- User required completing current work and stopping emulators/simulators before
  02:30 Europe/Amsterdam for another project's runner. Completed QA checkpoint
  retained; no new implementation, review, build or test started. D08 paused;
  D08.4 closure review remains the first incomplete checkpoint.
- Around 01:20–01:21 local time, only exact task iOS/Android stopped. Verified iOS
  Shutdown and Android absent. Only four woordenaar-d08-qa.ZFsE50 containers
  stopped/exited; volumes intact. Verified task proxy/web PIDs terminated and
  ports closed; named d08-content-qa browser closed. No global quit/kill-all,
  unrelated session/device/project or production operation. No reset/deletion.
- Evidence: [shutdown checkpoint](evidence/D08-task-shutdown-20261002.md).
  Private state/builds/fixtures/volumes remain in the same ignored roots. No task
  operation pending. Reverify before any later user-authorized resource restart.
- Model: user-selected GPT-6.1 Sol; effort unobservable. No fresh quota reading.
  feature/shared-dictionary-schema, HEAD c5dfb14; all work local/uncommitted.
  This turn changed checkpoint/approval/evidence docs only; prior 1,639 passing
  mobile tests unchanged. Scoped document formatting and git diff --check passed;
  logs: reports/shared-dictionary-cefr/D08-shutdown-format-write.log and
  reports/shared-dictionary-cefr/D08-shutdown-format-check.log.
- Remaining: six stages D09–D14 (31 checkpoints), D08.4 closure review and D01
  pre-release evidence/quota limitation. Next explicit resume: GPT-6 Astra / High
  local closure review, without restarting QA resources. No D09 auto-start,
  deployment/schema-switch or destructive retirement authorization.

## 2026-10-02 — D08 closure review, repair, final native acceptance and shutdown

- Explicit user continuation with hard 02:30 Europe/Amsterdam finish/save deadline.
  Clock checked repeatedly from 01:23; QA cutoff 02:15. Final resource shutdown
  verified at 01:38. Current stage only; D09 implementation not started.
- Model switch signaled; exact picker/effort not independently observable;
  Astra / High was recommended. No independent subagent or fresh quota sample.
- Reviewed status/debt, blank-note mapping and reanalysis materialization plus
  final/historical matrix. Reproduced a P2 same-word SRS/collection store rollback
  during hydration (1 failed/36 passed); DB content update already preserved it.
  Store now takes latest personal fields before publication. No new async boundary,
  schema/learning transport or server change. New deterministic unit regression.
- Final focused 7 suites/88 tests and full 142 suites/1,640 tests/22 snapshots pass;
  build/test typechecks, full strict lint pass. Source formatted before QA copy.
  Initial full formatting check flagged only two in-progress docs; final scoped
  and repository formatting plus git diff --check passed. Logs:
  reports/shared-dictionary-cefr/D08-closure-final-format-write.log and
  D08-closure-final-format-check.log.
- Rebuilt both Release apps locally, preserved installations/data, verified actual
  installed bundle/APK hashes. iOS/Android reanalysis and one-receipt delivery
  passed; final guarded state assertion proves four active primary words, private
  balkon v5, cursor 11, no content/hydration debt, matching server content/tombstone,
  original IDs/SRS/learning intact. Prior unaffected native matrix accepted by
  matching source fingerprints and fresh regressions; limits explicitly recorded.
- Android cold-boot System UI ANR initially blocked Settings. Observed screenshot,
  selected Wait on only task emulator; continuation and later smoke passed.
  No app reset, owner switch, auth manipulation or other-session operation.
- Only task resources temporarily resumed under continuation and then stopped:
  iOS DDEDCE4E-153B-48A4-A47C-B4ED0F499F1F verified Shutdown; emulator-5584 verified
  absent/process exited; four woordenaar-d08-qa.ZFsE50 containers all exited;
  proxy PID 25083 terminated, ports 55331/55400 closed. Web/named browser remained
  closed. All faults disabled; no build/Maestro/test job pending. Data/volumes and
  ignored artifacts retained, no scheduled restart.
- Branch feature/shared-dictionary-schema, HEAD c5dfb14; all work local/uncommitted.
  This continuation changed wordActions, its regression, one Android Wait flow and
  task docs/model routing; all pre-existing D03–D08 dirty work preserved. No
  production/cutover/provider/EAS/deployment/Git publication operation.
- Evidence and exact paths/hashes/run IDs: [final closure review](evidence/D08-final-closure-review-20261002.md).
  **D08.4 checked; D08 done. Next explicit resume: D09.1, GPT-6.1 Sol / High.**
  Do not restart QA automatically for the other project's runner. D01 pre-release
  evidence/quota limitation, D13 approval and D14 observation gates unchanged.

## 2026-10-02 — Scheduled morning continuation and model routing

- User authorized a one-time 06:00 Europe/Amsterdam continuation and autonomous
  model/effort switching; future Sol assignments use GPT-6.1 Sol, not GPT-5.6 Sol.
- Created and verified same-thread heartbeat `d09-06-00`, ACTIVE, one occurrence
  at 06:00 on October 2; prompt resumes D09.1 and pauses the automation afterward.
  Target thread: `01a0f96a-d69c-7a90-b480-c1bb56217915`.
- Updated handoff, D09 notes, future stage cards and plan routing. Historical
  actual model records preserved. No actual picker/effort switch claimed: the
  heartbeat tool exposes no same-thread model override. Use supported controls
  at a needed boundary and report any inability to switch.
- No implementation, native/device/service restart or new tests. D08 remains done;
  D09 remains pending until 06:00. All local dirty work remains on the same branch
  and HEAD; all task QA resources retain the verified 01:38 stopped state.
- Documentation-only validation: scoped Prettier and git diff --check. No new
  production, deployment, schema-switch, paid-operation or Git publication scope.
- Next: D09.1 on GPT-6.1 Sol / High at the authorized time; six stages D09-D14
  remain, plus incomplete D01 pre-release evidence/quota requirements.

## 2026-10-02 — D09 scheduled continuation and closure

- 06:00 heartbeat consumed once; automation `d09-06-00` paused and saved PAUSED
  configuration verified. Work stayed within D09; D10 not started.
- D09.1–D09.4 complete at 07:11. Web bulk effective content, v2 review snapshot,
  CEFR display, private versioned writes, explicit revision adoption and boundary
  cache handling implemented behind default-off server flag.
- Actual browser QA found/fixed rapid review restart staleness, server reset-only
  retry and badge grid shift. Stale form prevents mock AI invocation; successful
  private reanalysis/adoption retain IDs/SRS and image overrides. Active questions
  freeze; next session reads fresh content. Error/retry and light/dark passed.
- Full web: 71 suites / 617 tests pass, one pre-existing skipped suite/test.
  Typecheck, strict web/harness lint, scoped formatting and diff gates pass.
  Four performance fixture tests pass. Production benchmark builds succeeded.
- Initial 80-sample benchmark passed; final-code 10/cell run had isolated p95
  outliers. Expanded 240 measured samples (30/cell) on same review source showed
  all median/p95 increases below 10%, maximum 2.6%, same request counts and one
  v2 snapshot. All samples retained; evidence records synthetic/local limits and
  short gate-process overlap in the first block. No production/native claim.
- Failed attempts not to repeat: workspace-relative Jest paths and retained-copy
  haste collisions; raw CLI run-code without callback; interpreting stale dev
  cached error component as the new handler; exact translation text locator after
  nesting badge in the translation cell; media emulation overriding saved theme.
- At 06:59 exact task browser, runner/proxy/web and four containers were verified
  stopped; native iOS Shutdown and task Android AVD absent. Expanded benchmark
  later exited 0 and removed its own temporary source/server/backend/browser.
  No pending operation. Retained synthetic fixture has newer content versions;
  native queues/cursor not opened. Do not reseed on next resume.
- Model recommendation GPT-6.1 Sol / High. Current-thread switch control was
  unavailable; no confirmed model/effort switch or independent review claimed.
  Account-wide quota observed 31% then 40%, reset 1791051321; not D09-only usage.
- Existing branch `feature/shared-dictionary-schema`, HEAD `c5dfb14`. Local-only,
  uncommitted; D03-D08 dirty files preserved. No commit/push/PR/merge, production,
  schema switch, deployment, real publication or paid provider operation.
- [Full D09 evidence](evidence/D09-web-integration-20261002.md),
  [source hashes](evidence/D09-source-sha256.json),
  [dirty paths](evidence/D09-dirty-paths.txt). Exact next action: D10.1 using
  GPT-6.1 Sol / High. Five stages / 27 checkpoints plus remaining D01 evidence;
  release and compatibility-retirement gates remain separately controlled.

## 2026-10-02 — D10 local import/sharing/export checkpoint

- D10.1/D10.2 complete; D10.3 current. D10.3-D10.5 local code/tests retained,
  stage exit not claimed. One-stage scope maintained; D11 not started.
- Separate immutable mapping receipts preserve published v1/bundled JSON. Server
  uses explicit approved provenance; imports allocate new personal identities and
  preserve existing duplicates/private content/SRS/collection. SQLite caches full
  dependencies before atomic create-private/link queues.
- Authorized shared projections and selected-source imports implemented in both
  clients. Server/self-contained reimport works after source personal-row deletion;
  mobile offline export preserves SRS/queues and rejects incomplete dependencies.
- Final mobile 10 suites / 124 tests; new web 4 suites / 25 tests; D10 SQL 8/8 pass.
  Earlier full web 74 suites / 640 tests plus one pre-existing skip. Build/test/
  contract typechecks, strict scoped lint, formatting, diff and target generation/check pass.
- Fixes: immutable fixture review/source data, full pin cache/fallback invariant,
  duplicate collection preservation, pending local progress/private edits, account
  change/foreign-owner rejection, legacy usage-notes normalization, test type/
  access-level function argument, import helper complexity and duplicate literals.
- Target types refreshed through `20261002100000_add_dictionary_import_protocol.sql`.
  Two isolated codegen runs removed only their own random containers/networks;
  Unix-socket synthetic SQL clusters cleaned up. Native/D08 stack never started.
  Exact iOS Shutdown, task Android AVD process absent and four D08 containers exited.
  No running/uncertain operation; other sessions/devices untouched.
- Model recommendation GPT-6.1 Sol / High for implementation; no confirmed current
  switch claimed. Astra / High requested for unresolved offline identity/access
  architecture; supported current-thread control unavailable, picker confirmation
  pending. No independent agent review used. No fresh quota measurement.
- Branch `feature/shared-dictionary-schema`, HEAD `c5dfb14`, all local/uncommitted;
  pre-existing D03-D09 work preserved. AUTH-17 local/synthetic scope only. No
  production, cutover, publication/deploy, paid operation or commit/push/PR/merge.
- [Checkpoint evidence](evidence/D10-import-contracts-20261002.md),
  [source hashes](evidence/D10-source-sha256.json),
  [dirty checkout](evidence/D10-dirty-paths.txt).
- Exact next action: D10.3 review read-only offline import persistence and unknown
  remote semantic duplicates without changing private cards or losing IDs/SRS/
  history/review/reset/content queues; then affected regression/contract gates and
  D10.4/D10.5 review/coverage. Do not repeat D08/D09 QA or start D11 automatically.

## 2026-10-02 — D10 Astra review, preservation repairs and local commits

- User confirmed GPT-6 Astra / High and authorized necessary local commits,
  recorded as AUTH-18. D10.3 remains current; no D11 work or scope expansion.
- Reproduced/fixed explicit-null collection reassignment, phantom server IDs in
  the store, pull overwrite while dictionary commands remain pending, and opaque
  personal-ID remapping failures. Enabled sync no longer acknowledges unresolved
  semantic duplicates. These guards preserve local data; duplicate recovery is
  still required, not claimed complete.
- Reproduced/fixed shared preview/import exposure through foreign-owner words
  attached to the shared collection. Source owner must match sharing owner.
  Duplicate return now locks its row or reports a retryable disappeared conflict.
  Lock-barrier regression verifies concurrent imports and concurrent deletion.
- Architecture contract saved for durable import intents, stable personal IDs,
  insert-only authenticated receipts, read-only targets, ordered delivery and
  explicit non-destructive conflict recovery. Ordinary upsert or implicit SRS/
  meaning merging is not an acceptable offline import repair.
- Verification: initial 4 new mobile regressions failed, then focused 80/80 and
  sync 72/72 passed; source-owner SQL regression failed, then full SQL 183/183
  passed. Full pre-commit mobile 144 suites / 1658 tests / 22 snapshots and full
  web pass. Test typecheck, scoped strict lint, target check and diff checks pass.
- Ordinary Jest web config now ignores generated reports in its module map;
  the hook no longer requires ad-hoc exclusion of retained QA copies. Context7
  Jest 29.7 documentation consulted. Hooks were not bypassed.
- Implementation commit `a59acad` preserves 142 task source/config/test files
  from D03-D09 plus partial D10 and review repairs. Following docs checkpoint
  preserves the task bundle and this handoff. No push/PR/merge/deployment.
- Native/retained D08 QA remained off. Synthetic SQL/codegen resources cleaned
  up; no pending operation. Browser dumps/ignored QA data remain uncommitted.
- Exact next action: D10.3 implementation on GPT-6.1 Sol / High using
  [review contract](evidence/D10-astra-review-20261002.md). Picker change requires
  the user's available UI because direct current-thread control is unavailable.
  No fresh quota observation; no new automation or paid operation.

## 2026-10-02 — D10.3 durable offline import implementation checkpoint

- D10.1/D10.2 remain complete; D10.3 current, D10.3-D10.5 unchecked. No D11.
- Immutable owner-scoped import intents and receipt ledger, server-default SRS,
  read-only metadata UPDATE, explicit conflict retry and personal-row hydration
  debt implemented. Local identities, private content and every pending learning/
  dictionary queue remain intact on failures/conflicts. SQLite v14 preserves v13.
- Commit `dfdc7f00f2ddb30dd5f2a55c255e8a9ff47f1bd3` on the existing
  `feature/shared-dictionary-schema` under AUTH-18; documentation checkpoint follows.
  No push/PR/merge. Private `.playwright-cli/` and ignored reports stay uncommitted.
- Verification at `dfdc7f0`: focused mobile 9 suites / 181 tests; full PostgreSQL
  188/188; normal commit hooks mobile 147 suites / 1682 tests / 22 snapshots and
  web 75 suites / 642 tests, one pre-existing skipped suite/test. Typecheck,
  strict changed-file zero-warning lint, scoped formatting/diff and deterministic
  target contract generation/check passed without hook bypass or rule suppression.
- [Durable implementation/test evidence](evidence/D10-offline-import-intents-20261002.md)
  and [current source hashes](evidence/D10-source-sha256.json) preserve exact scope,
  failure repairs and remaining integration limits. Earlier review counts are historical.
- All new synthetic PostgreSQL/codegen resources cleaned up; retained task native/
  D08 QA stayed off. No running/uncertain operation. Other sessions/devices untouched.
- Implementation recommendation GPT-6.1 Sol / High; actual picker state not verified
  through tools. Next: GPT-6 Astra / High review of insert/receipt/concurrency,
  owner transitions, zero-version ordering, conflict retry and hydration debt,
  then remaining both-client integration. Current-thread switching API unavailable;
  no confirmed switch or independent-agent review claimed. No fresh quota sample.
- No production, cutover, deployment, publication, paid operation or new automation.

## 2026-10-02 — D10.3 offline import review and six preservation repairs

- User confirmed switching to Astra; High effort carries forward from the accepted
  routing. No independent agent. D10.3 remains current; no D11 or release scope.
- Reproduced/repaired six issues: remote-deleted import resurrection, read-only
  target upsert, pending-import loss during remote-target cleanup, concurrent
  learning overwrite, incomplete dictionary hydration and deleted-card refresh debt.
- SQLite v15 stores owner/ID acknowledgements atomically and preserves v14 intents,
  private content and all prior queues through interruption/restart. Server schema,
  immutable manifests, generated contracts and runtime activation remain unchanged.
- Implementation commit `5efd6ff093765672e74dc071996b5d866c62a7c6` on
  `feature/shared-dictionary-schema`, AUTH-17/AUTH-18. Documentation checkpoint follows.
  Private `.playwright-cli/` and ignored QA reports remain outside commits.
- Final focused mobile 8 suites / 170 tests; D10 PostgreSQL 16/16; normal full hooks
  mobile 147 suites / 1689 tests / 22 snapshots and web 75 suites / 642 tests,
  one pre-existing skipped suite/test. Test-inclusive typecheck, strict zero-warning
  changed-file lint, scoped formatting and diff pass. No hook/rule bypass.
- [Review, failed regressions and limits](evidence/D10-offline-import-review-20261002.md)
  and [source fingerprints](evidence/D10-source-sha256.json) are durable evidence.
  The earlier 188-test full SQL result is historical at `dfdc7f0`; only the affected
  SQL file was rerun because server code did not change.
- No running/uncertain operation. Synthetic SQL clusters cleaned up; retained
  native/D08 QA stayed off. Other projects/sessions/devices were not operated.
- Next: GPT-6.1 Sol / High for remaining D10.3 recovery/integration, then D10.4/D10.5
  both-client import/export/reimport and assigned-device verification. Model switch
  unavailable through current-thread controls; no automatic change claimed.
- No fresh quota observation. No push/PR/merge, production/cutover, deployment,
  publication, paid operation or new automation. D10 remains in progress.

## 2026-10-02 — D10 mobile self-contained document reimport checkpoint

- User confirmed GPT-6.1 Sol; High effort follows accepted routing. No automatic
  picker switch or independent agent. D10 active, D10.3-D10.5 unchecked; no D11.
- Implemented default-off clipboard JSON export and pasted-JSON selection/reimport
  into owned existing collections. Fresh personal IDs/default SRS, full private
  content/media and atomic durable import/content queues; duplicate skips preserve
  existing identities/collections/progress/queues. No new native dependency.
- Source commit `42c9bfd1813be0742d482f04c02e8de969bcb5cc`, AUTH-17/AUTH-18,
  `feature/shared-dictionary-schema`, local only; documentation checkpoint follows.
  Private `.playwright-cli/` and ignored reports/data remain uncommitted.
- Normal hooks mobile 149 suites / 1715 tests / 22 snapshots; web 75 suites /
  642 tests, one existing skipped suite/test. Focused 9 suites / 120 tests,
  test-inclusive typecheck, strict zero-warning scoped lint, format/diff pass.
  SQL/schema/generated contracts unchanged; no fresh SQL/native acceptance claim.
- [Evidence and repaired fixture/mock attempts](evidence/D10-document-reimport-20261002.md),
  [source hashes](evidence/D10-source-sha256.json) and
  [unavailable-target review draft/race matrix](evidence/D10-target-recovery-review-input.md)
  are durable. The draft is not an accepted/implemented recovery protocol.
- Scoped resource inventory required sandbox escalation, then confirmed exact
  iOS Shutdown, task AVD process absent and four task containers exited at 09:03 UTC.
  No resource restart/reset/removal; other sessions/devices untouched. All temporary
  file-backed test directories cleaned up; no running/uncertain operation remains.
- Next: Astra / High for unresolved unavailable-target settlement/lineage review;
  save the accepted contract, then Sol 6.1 / High implementation. Current-thread
  picker control is unavailable; request/record manual confirmation before claims.
- No new quota sample. No push/PR/merge, production/cutover, deployment,
  publication, paid operation or new automation. Existing one-time heartbeat paused.

## 2026-10-02 — D10.3 unavailable-target recovery architecture checkpoint

- User confirmed the requested model switch for Astra / High. No subagent or
  automatic picker change claimed; current-thread picker remains unavailable.
- Accepted [recovery contract](evidence/D10-target-recovery-contract-20261002.md):
  durable personal-ID origin, version/placement CAS, immutable receipts, cancellation
  fence and separate placement debt. Found metadata echo after stale acknowledgement
  in addition to nonce-based resurrection and late insertion after deletion.
- Review/test commit `b92eba930e53fda019762d199902fb4f36799b13`, local only under
  AUTH-17/AUTH-18. Application source remains `42c9bfd` / `5efd6ff`; no recovery
  migration/UI implementation yet. Documentation checkpoint follows.
- PostgreSQL historical baseline 3/3; abstract model 10/10 including 40,320 event
  permutations. Model assumes atomic serial transactions and does not prove actual
  SQL/SQLite/network integration. Strict scoped lint/format/diff pass. Initial two
  lint warnings fixed by extracting a diagnostic constant and test helper.
- Normal hooks: mobile 149 suites / 1715 tests / 22 snapshots; web 75 suites /
  642 tests, one existing skipped suite/test. No gate bypass. Fresh private Unix-socket
  PostgreSQL cluster cleaned up. Read-only assigned-resource inventory reverified
  iOS Shutdown, AVD absent, four task containers exited by 09:31 UTC. No QA restart,
  data removal, other-session device operation or running/uncertain job.
- Next GPT-6.1 Sol / High: accepted contract checkpoint 1, strict domain contracts
  and additive server registry/receipt/backfill preflight, then real concurrency
  tests before SQLite/sync/UI. D10.3-D10.5 remain open; D11 not started.
- One documentation commit attempt failed on an AudioContext Jest worker SIGSEGV
  after 148 passing suites; the isolated test passed 1/1. Application source was
  unchanged from green full hooks. Cause unverified; retry keeps normal hooks.
- Preserve `.playwright-cli/` and ignored QA data. No push/PR/merge, production,
  cutover, deployment, publication, paid call or new automation. No new quota sample.

## 2026-10-02 — D10.3 server/domain and SQLite v16 recovery implementation

- User confirmed GPT-6.1 Sol / High. Direct picker control remains unavailable;
  no automatic switch or subagent used. Existing AUTH-17/AUTH-18 scope.
- Source commits `1828f57` (server/domain checkpoints 1–2), `1748066` (SQLite
  checkpoint 3), local only. Exact behavior/limits and commands in
  [server evidence](evidence/D10-recovery-server-20261002.md) and
  [SQLite evidence](evidence/D10-recovery-sqlite-20261002.md).
- Complete PostgreSQL 213/213, strict parser tests 11/11, SQLite focus 4 suites /
  50 tests including 12 new recovery tests. Final source hooks mobile 151 suites /
  1740 tests / 22 snapshots, web 75 suites / 642 tests, existing skipped suite/test.
  Typechecks, strict scoped lint, target generate/check and format/diff passed.
- Repaired synthetic fixture keys/schema expectations/closed-handle inspection,
  static test annotations/literals and snapshot array-coercion parser bug. No
  application reset, lint suppression or hook bypass; all final checks pass.
- Synthetic SQL/codegen/SQLite resources cleaned up. At 10:20 UTC read-only
  exact task inventory: iOS Shutdown, task AVD process absent, four D08 containers
  exited. Native/D08 QA not started; other-session devices not operated on.
  Sandbox process/Docker reads retried with authorized read-only escalation.
- Branch unchanged `feature/shared-dictionary-schema`; sanitized documentation
  checkpoint follows. No running/uncertain job. Private `.playwright-cli/` and
  ignored QA data retained/uncommitted. One-time heartbeat remains PAUSED.
- Next Sol 6.1 / High, accepted contract checkpoint 4: foreground/background sync,
  typed errors/counts, lost replies, stale placement echo, cancellation before
  collection deletion. Entry points are not yet wired; UI/web, Astra/device
  acceptance and legacy direct-write coexistence remain gates. D10.3-D10.5 open;
  no D11, push/PR/merge, production/cutover, deployment, publication or paid call.
- No new quota sample. No new blocker; implementation continues from saved state.

## 2026-10-02 — D10.3 mobile recovery sync checkpoint

- User-confirmed GPT-6.1 Sol / High; AUTH-17/AUTH-18. Current-thread picker remains
  unavailable; no automatic model switch or subagent. Task-device QA permission
  reaffirmed; this checkpoint needed synthetic fixtures only.
- App source `abc0b86`: recovery/cancel coordinator, atomic explicit deletion,
  no metadata echo of delivered placement, owner-event/transaction guards and
  independent pending status. [Evidence](evidence/D10-recovery-sync-20261002.md).
- Focus 10 suites / 166 tests; source normal hooks 154 mobile suites / 1763 tests /
  22 snapshots, 75 web suites / 642 tests, one existing skipped suite/test. Final
  AppState resume hook suite 7/7, included in the following checkpoint. TypeScript,
  strict scoped lint, format/diff pass; SQL/contracts unchanged from 213/213.
- Initial fixture/mock/type/complexity fixes and one obsolete deletion expectation
  in full mobile were repaired; final hooks passed all suites. No gate bypass.
- Exact QA inventory 10:41 UTC: iOS Shutdown, task AVD process absent, four task
  containers exited. No device/backend restart or other-session operation. Synthetic
  SQLite files cleaned up; no pending job after final hooks. No OS-background-worker
  or device acceptance claim; existing AppState resume uses the same coordinator.
- Existing branch; local-only commits, no push/PR/merge. Private `.playwright-cli/`
  and ignored QA data retained. Default runtime gates off; no production/cutover,
  deployment, publication, paid provider or automation change. No new quota sample.
- Next Sol 6.1 / High checkpoint 5: UI/current-state retry, retained/semantic debt,
  themes/account changes, conservative pre-upgrade and applicable web integration.
  Then Astra implementation review and assigned-device/both-client acceptance.
  D10.3-D10.5 open; D11 not started. No new blocker.

## 2026-10-02 — D10.3 explicit recovery UI checkpoint 5

- Actual model/effort: user-confirmed GPT-6.1 Sol / High; no automatic picker change.
- Source `b7f207c` on existing `feature/shared-dictionary-schema`; local only,
  AUTH-17/AUTH-18. Checkpoints 1–5 implemented; 6 review/acceptance open.
- Existing-target/current-state UI, unchanged root/ID/SRS/queues, captured local
  revision/outbox guards, auth sign-out invalidation, visible semantic/unverified/
  missing-target imports, orphan reachability and blocked-move feedback implemented.
  Web's immediate content-copy failures and export privacy covered; no web/mobile
  root reconstruction. [Evidence](evidence/D10-recovery-ui-20261002.md).
- Focus mobile 6 suites / 82 tests, web 2 suites / 22 tests passed. Normal source
  hooks mobile 155 suites / 1785 tests / 22 snapshots, web 75 suites / 648 tests,
  one existing skipped suite/test. Test-inclusive typecheck, strict scoped lint and
  format/diff pass. SQL/contracts unchanged from historical 213/213/determinism.
- Intermediate component mock omitted Expo Color; corrected, then focused/full
  hooks passed. Sandbox inventory unavailable; authorized scoped read succeeded.
- Exact QA off at 10:57 UTC: assigned iOS Shutdown, task AVD absent, four containers
  exited. No device/backend start/reset, other-session operation or pending job.
  Synthetic files cleaned up. Private QA data/.playwright-cli retained.
- Next Astra / High checkpoint 6 implementation review, then assigned-device/
  both-client acceptance. Agent picker unavailable; user manual model confirmation
  needed. Native upgrade/OS lifecycle and legacy direct-write coexistence gates
  remain. D10.3–D10.5 unchecked; D11 not started. No push/PR/production/cutover/
  publication/deployment/paid operation or automation change. No new quota sample.

## 2026-10-02 — D10 checkpoint 6 implementation review

- User-confirmed Astra / High, source `b7f207c`, AUTH-17/AUTH-18; no picker operation
  or subagent. Review **requires changes**: R1/P1 unguarded ordinary imported moves
  overwrite newer recovery; R2/P2 cancellation ACK hides unsent normal deletion.
  [Evidence and exact repair contract](evidence/D10-recovery-implementation-review-20261002.md).
- Mobile file-backed counterexamples 2/2, real concurrent PostgreSQL baseline 1/1;
  test-inclusive TypeScript and strict scoped lint pass. Passing counterexamples
  demonstrate defects; no new acceptance claim. Application/server source unchanged.
- Synthetic SQL sandbox shared-memory denial resolved with scoped escalation;
  isolated cluster automatically cleaned up. Test-only recursive mock typing fixed.
  No assigned device/backend start/reset; private retained artifacts untouched.
- Existing branch, authorized local commits only; no push/PR/merge, production,
  cutover, publication, deployment, paid operation or automation change.
- Next Sol 6.1 / High repairs R1/R2 and converts mobile counterexamples to safety
  regressions; then Astra review before assigned-device/both-client acceptance.
  Manual model confirmation needed because picker control is unavailable.
  D10.3–D10.5 remain open, D11 not started. No new quota sample.

- Review checkpoint `4f7a6a6` normal hooks: 156 mobile suites / 1787 tests /
  22 snapshots; 75 web suites / 648 tests, one existing skipped suite/test.
  All 113 source fingerprints match. No pending job after hooks; next docs-only
  checkpoint records this result. Exact QA off verified at 11:26 UTC.

## 2026-10-02 — D10 checkpoint 6 R1/R2 repairs

- Actual model/effort: user-confirmed GPT-6.1 Sol / High; AUTH-17/AUTH-18, existing
  branch and source starting at `fa286e4`. No picker operation or subagent.
- Ordinary imported placement queues immutable existing recovery protocol; generic
  metadata rejects tracked debt, old unbound debt remains visible. Word/collection
  tombstones stay pending through cancellation ACK, failure and restart.
  [Evidence](evidence/D10-recovery-review-repairs-20261002.md).
- Focus mobile 8 suites / 139 tests; final regression/status 2 suites / 19 tests;
  real SQL recovery 17/17; test-inclusive TypeScript and strict scoped lint pass.
  Initial test async mock typing and duplicated literals repaired; no bypass.
  Source/server contracts unchanged outside mobile paths; full historical SQL not
  repeated. Ten safety tests replace two unsafe mobile baseline tests.
- Synthetic PostgreSQL automatically cleaned up; SQLite files removed by fixtures.
  Assigned devices/retained backend stayed off; no reset/reseed. Private artifacts
  untouched. Necessary local commits only; no push/PR/merge, production/cutover,
  deployment/publication, paid operation or automation change.
- Next Astra / High re-review, then task-only native/both-client acceptance if green.
  Manual model confirmation needed. D10.3–D10.5 open, D11 not started. No quota sample.

- Repair source `c3f9baf` normal hooks: 156 mobile suites / 1796 tests /
  22 snapshots, 75 web suites / 648 tests, one existing skipped suite/test.
  All 113 source fingerprints match. Exact assigned QA off reverified 11:42 UTC.
  No pending operation; only private `.playwright-cli/` remains untracked.

## 2026-10-02 — D10 scoped native acceptance after R1/R2 repair review

- User-confirmed Astra / High; source `c3f9baf`, starting HEAD `785d9f9`.
  Re-review passed without application changes. AUTH-17/AUTH-18 local only.
- Both retained native release upgrades preserve prior IDs/SRS/learning/queues;
  installed artifact hashes match builds. Four local migrations applied after
  private pg_dump, retained personal data unchanged. No reset/reseed or flag change.
- iOS offline/lost-reply/replay, guarded move with newer peer placement, stale receipt,
  cancel ACK/tombstone/restart/final delivery pass. Android offline durability,
  original-delivery/recovery race with typed conflict and explicit retry pass.
  Native JSON clipboard export/duplicate preview visually verified on iOS.
  [Evidence and exact limitations](evidence/D10-native-acceptance-20261002.md).
- Corrected QA selectors, keyboard assumptions, expected collection count and
  Android read-only SQL quoting. New-card interval follows server default 1 after
  local 0; pre-existing SRS/complete learning history retained. No implementation
  finding requiring a new Sol repair. 113 source hashes unchanged.
- Brief approval-review quota failure caused no execution; user continued and the
  same scoped command was accepted. No bypass. One-off automation remains paused.
- Exact assigned resources verified OFF at 12:23 UTC: iOS Shutdown, emulator absent,
  no task jobs, four containers exited, task ports closed; fault flags reset.
  Data/volumes/private artifacts preserved; other sessions/devices untouched.
- Next Astra / High: retained v14/v15 native upgrade evidence and remaining D10
  cross-owner/both-client/official/shared/bundled acceptance. D10.3–D10.5 open;
  D11 not started. Local checkpoint `4e9563f`; normal hooks: 156 mobile suites /
  1796 tests / 22 snapshots, 75 web suites / 648 tests, one existing skipped
  suite/test. 113 source hashes match after hooks. No push/PR or hosted operation.

## 2026-10-02 — D10 Android native historical upgrade and web integration gap

- Astra / High; AUTH-17/AUTH-18; application `c3f9baf`, repository start `559321a`.
- Actual historical v14/v15 initializer → current v16 native Expo SQLite/AsyncStorage
  PASS on assigned Android, three processes. Preserved 10/11 tables, exact v14
  origin, marker-only v15 unverified gate. No main-app DB/APK or application changes.
- Separate package without INTERNET permission/deep links, same assigned AVD;
  30 source copies verified, 113 application hashes unchanged. Native archived DB
  integrity and FK checks pass; harness lint/format/diff pass. Scope/limits in
  [native evidence](evidence/D10-native-upgrade-20261002.md).
- Found missing web production callers for JSON transfer helpers; next bounded
  implementation is recorded in [review](evidence/D10-web-transfer-integration-gap-20261002.md).
  D10.3–D10.5 remain open, D11 not started.
- Devices/backend/ports verified OFF at 12:43:07 UTC. No pending or uncertain
  operation. New harness private root ends `.d10upgrade20261002`, existing data
  retained. Early boot-read/lsof/template-lint attempts corrected; no native failure.
- Local preservation commit authorized, standard hooks required; log retained as
  private harness `commit.log`. No push/PR/hosted/paid operation. Automation paused.
- QA/evidence commit `70f9eb9` succeeded with normal hooks: mobile 156 suites /
  1796 tests / 22 snapshots; web 75 suites / 648 tests, one existing skip. Post-hook
  113 source hashes and installed harness templates match. Only private browser
  artifacts remain untracked; no pending operation.
- Next manual confirmation of GPT-6.1 Sol / High (picker unavailable), implement
  web UI/actions, then Astra review and remaining both-client acceptance.

## 2026-10-02 — D10 web transfer implementation review

- User-confirmed Astra / High; AUTH-17/AUTH-18. Application `ab8d603`, repository
  start `5d95165`. Prior implementation added default-off web JSON transfer UI;
  normal source hooks passed mobile 156/1796/22 and web 82/715 (one existing skip).
- Reviewed production UI/route/helper integration. R1/P1 valid browser origins
  fail after Next.js loopback/internal-host adaptation; R2/P2 lost-reply check link
  changes from attempted collection A to unsubmitted B. [Review](evidence/D10-web-transfer-review-20261002.md).
- Two new suites / five tests pass (four counterexamples and a valid control),
  using the installed NextRequestAdapter and actual UI/POST. Type-inclusive web
  checks, scoped lint/format/diff pass; original 133 source hashes unchanged.
- Corrected an initial reproducer assumption: Next.js normalizes 127.0.0.1 to
  localhost. No listener/backend/device/browser or private fixture operation.
- Application repair pending. Next Sol 6.1 / High (manual picker), repair both
  findings and convert counterexamples, then Astra re-review and integrated QA.
  D10.3–D10.5 stay open. Before native QA, obtain device availability handback.
- Local review/test checkpoint `46eb250` normal hooks pass: mobile 156 suites /
  1796 tests / 22 snapshots; web 84 suites / 720 tests, one existing skipped suite/
  test. 133 source and two review-test hashes match. No remote/release/paid operation,
  uncertain mutation or QA job; automation stays paused.

## 2026-10-02 — D10 web transfer R1/R2 repairs

- User-confirmed Sol 6.1 / High; starting `9150845`, application baseline `ab8d603`.
  AUTH-17/AUTH-18, existing feature branch. [Repair evidence](evidence/D10-web-transfer-repairs-20261002.md).
- R1 canonical Origin against raw Host; proxy/TLS override requires explicit existing
  site/deployment origin and consistent single forwarded headers. R2 stores attempted
  destination in uncertain feedback. No replays, schema/mobile/config/env changes.
- Review counterexamples converted to safety regressions. Focus 11 web suites /
  134 tests, TypeScript and scoped strict lint/format/diff pass. Current 137 hashes:
  129 unchanged baseline, four updated web paths and four added paths.
- No backend/browser/device operation. Explicit device availability handback remains
  required. Source commit `19d98eb` normal hooks: 156 mobile suites / 1796 tests /
  22 snapshots; 85 web suites / 769 tests, one existing skip. Post-formatter manifest
  137/137 matches. No pending mutation/build/QA job.
- Next Astra / High re-review, then remaining integrated acceptance. D10.3–D10.5 open;
  D11 not started. No remote/release/paid operations; automation paused.

## 2026-10-02 — D10 web re-review and scoped browser acceptance

- User confirmed requested Astra / High, starting `0d9e835`, source `19d98eb`.
  R1/R2 re-review PASS, 3 suites / 54 tests. All 137 source hashes unchanged.
- [Runtime evidence](evidence/D10-web-acceptance-20261002.md): actual export/copy,
  private cross-owner read_only import/re-export, global duplicates, one accepted
  lost reply with immutable check link/no retry, bundled Essentials fallback PASS.
- Five new isolated-recipient cards, all 12 prior words/nine content states/eight
  collections and review tables unchanged. Access restored, no publication.
- Browser/runner/four task containers OFF verified 13:59:14 UTC. Devices not
  inspected or used; explicit availability handback pending. No uncertain mutation.
- Private snapshots/dump/UI artifacts retained, `.playwright-cli/` untracked,
  root AGENTS excluded. No app/SQL/config changes, no hosted/paid/release operation.
- D10.3–D10.5 remain open: official/shared runtime fixtures absent, native cross-client
  and mobile-web acceptance pending. Same Astra / High, D11 not started.
- Preservation commit subject `docs: record dictionary web acceptance`; normal hook
  output retained in private acceptance root `commit.log`. Inspect git log for SHA.

## 2026-10-02 — D10 assigned native cross-client acceptance

- AUTH-19 grants assigned iOS/Android device handback; same Astra / High, starting
  `6d3d355`, application `19d98eb`, native `c3f9baf`. Installed hashes match.
- [Acceptance](evidence/D10-cross-client-acceptance-20261002.md): web recipient data
  visible on iOS; native cross-owner export/reimport creates two selected copies,
  IDs preserved through server/Android/web. Android duplicate previews 0/4 and 0/6.
- All 17 prior server words/14 states/eight collections and native prior word/SRS/
  learning/import acknowledgements unchanged. Both devices' queues empty. No app fix.
- QA corrections: secure iOS password uses direct input after two failed paste
  attempts; Android restores real auth before deep-link checks; transient toast
  replaced by actual clipboard/preview evidence. No uncertain/replayed mutation.
- All assigned resources OFF verified 14:24:04 UTC; primary restored on both devices.
  Private artifacts retained, no reset/reseed/release/schema/paid operation.
- 137 source fingerprints unchanged; scoped helper lint/format/diff verification.
  Commit subject `test: verify cross-client dictionary transfer`, normal hooks logged
  in private `d10-cross-client-20261002/commit.log`. No push/PR/merge.
- D10.3–D10.5 remain open: official/shared local fixture matrix and mobile-browser
  acceptance next on Astra / High. Do not repeat closed checks; D11 not started.

## Record template

Copy these fields into a dated entry at each session boundary:

- Stage / checkpoint completed / next checkpoint:
- Model / reasoning actually used (or unknown):
- Scope and outcomes:
- Decisions or approved operations consumed:
- Branch / code revision / dirty files / persistence level:
- Tests: command, date, revision, pass/fail/unverified, durable evidence path:
- Failed attempts and what not to repeat:
- Running or uncertain operations and how to inspect them:
- Blocker or pause reason:
- Quota before/after and reset IDs/times, if measured:
- Exact next action and recommended model/effort:

## 2026-10-02 — D10 catalog runtime checkpoint and R3 review

- Starting `6ca149f`, Astra / High, AUTH-17/18/19. No application changes;
  137 source fingerprints unchanged. [Evidence](evidence/D10-catalog-runtime-20261002.md).
- Fresh local synthetic pack/mappings/source only. Web official/shared, Android
  shared, iOS preview, exact cross-client IDs, private override, revocation and
  self-contained recipient export pass. All prior server/native/SRS rows retained.
- [R3](evidence/D10-session-revocation-review-20261002.md): native global logout
  leaves signed JWT accepted by web proxy but session rejected by page, causing
  actual login/collections redirect loop. Counterexample + valid control added;
  4 suites /38 focused tests, typecheck and strict scoped lint pass.
- Safari route/login observed, full flow unverified; Android isolated typing timed
  out before offline official import. Read_only row restored exactly, primary
  restored on both, queues empty. Remaining two runtime checks explicitly retained.
- All assigned resources OFF verified 15:15:36 UTC /17:15:36 Amsterdam. No pending
  write/build/device job. Private artifacts retained, no other sessions touched.
- Next Sol 6.1 / High R3 repair, then Astra review. D10.3–D10.5 open; no D11.
  Normal-hook local commit authorized; no push/PR/production/cutover/deployment.

## 2026-10-02 — D10 R3 revoked-session redirect repair

- User confirmed requested GPT-6.1 Sol / High switch; thread model picker not
  independently verifiable. Started at `ad89c5e` on existing feature branch.
  [Evidence](evidence/D10-session-revocation-repair-20261002.md).
- Converted the passing redirect-loop counterexample into safety assertions. Auth
  entry routes server-validate live users before redirecting; protected pages keep
  their server guard. SDK cookie propagation and conservative failure behavior
  remain covered. No mobile sign-out, schema, SQL, RPC, or deployment change.
- Pre-fix safety failure reproduced. Post-fix four web suites / 45 tests pass;
  test-inclusive TypeScript, scoped strict ESLint, Prettier and diff check pass.
  Prior 137 fingerprints preserved; three changed paths added (140 total).
- Source/evidence commit `976d1e7` normal hooks pass: 156 mobile suites / 1796
  tests / 22 snapshots; 86 web suites / 778 tests, one existing skipped suite/test.
  Post-hook all 140 hashes match. Private `d10-r3-repair-20261002/commit.log` retained.
- No backend/browser/device started. Assigned task QA remained off based on last
  exact verification in handoff. Existing private reports and `.playwright-cli/`
  preserved. No pending QA job or uncertain write.
- Next Astra / High R3 re-review, then only remaining D10 cached official
  read_only/offline and mobile Safari acceptance. D10.3–D10.5 unchecked, no D11.
  Local commits authorized by AUTH-18. No push/PR,
  production/cutover/publication/deployment or paid operation.

## 2026-10-02 — D10 R3 re-review, offline acceptance and R4 contrast finding

- User-confirmed Astra / High; starting `833835d`, source `976d1e7`, AUTH-17/18/19.
  [Runtime evidence](evidence/D10-final-runtime-20261002.md),
  [summary](evidence/D10-final-runtime-summary-20261002.json).
- R3 review and actual revoked-session HTTP PASS. Four focused suites /45 tests;
  application unchanged, all 140 fingerprints match.
- Cached official read_only/offline import, cold restart, same-ID delivery PASS
  using private-copy fallback when mappings are unavailable. One new card/state.
  Do not replay the completed import. Safari duplicate semantics PASS, but R4/P2
  action-label contrast fails real light-theme rendering; bounded repair contract saved.
- Three malformed synthetic source fixtures corrected, including precise hidden
  tombstone/cache restoration. All 24 unrelated original server words exact; all
  27 prepared words preserved. Original access/collections/review rows exact.
  Initial 13 Android and 19 iOS words/SRS/learning preserved, pending queues empty.
- Both primary native sessions restored; real Up to date on both. All assigned
  resources OFF verified 18:44:48 UTC /20:44:48 Amsterdam, clipboard clear, no faults,
  pending QA jobs or uncertain writes. No other devices/sessions touched.
- Next Sol 6.1 / High R4 repair, then Astra review and affected visual acceptance.
  D10.3–D10.5 open; no D11, deployment/cutover/publication/paid call or push/PR/merge.

- Runtime/evidence commit `55d533c` normal hooks PASS: mobile 156 suites /1796 tests /
  22 snapshots; web 86 suites /778 tests, one existing skip. Post-hook 140/140 source
  hashes match; only preexisting `.playwright-cli/` is untracked.

## 2026-10-02 — D10 R4 semantic action contrast repair

- User-confirmed Sol 6.1 / High, starting `b745243`, AUTH-17/18/19.
  [Evidence](evidence/D10-import-contrast-repair-20261002.md).
- Three D10 components use existing semantic action variants. Global reset/palette
  and action, selection, disabled and navigation logic unchanged.
- Pre-fix light primary labels 1:1; fixed source browser matrix 40 checks /16 states /
  two themes PASS. Enabled minimum 5.34:1, inactive 1.93:1 with existing theme opacity.
  Source DOM identical except classes; no import/sharing action executes in fixture.
- Focused 3 suites /13 tests, test-inclusive TypeScript, strict scoped ESLint and
  format/syntax/diff PASS. Incorrect initial test paths and npm forwarding corrected.
  All 140 prior hashes retained; three component paths added (143 total).
- Native/backend stayed off. Named browser and visual-only fixture stopped; all
  assigned resources OFF verified 19:00:50 UTC /21:00:50 Amsterdam. No pending job,
  uncertain write or other session/device changes. Private artifacts preserved.
- Next Astra / High independent review, then affected actual page/Safari visuals.
  D10.3–D10.5 open; no D11, import replay, production/cutover/publication/deployment,
  paid call or push/PR/merge. Local commits with normal hooks authorized.

- Source/evidence commit `da41085` normal hooks PASS: mobile 156 suites /1796 tests /
  22 snapshots; web 86 suites /778 tests, one existing skip. Post-hook 143/143 hashes
  match. Only preexisting `.playwright-cli/` untracked; no pending QA process.

## 2026-10-02 — D10 final review and closure

- User-confirmed Astra / High, starting `ee71f73`, source `da41085`, AUTH-17/18/19.
  [Final closure and limits](evidence/D10-final-closure-review-20261002.md).
- R4 independent review PASS; 3 focused suites /13 tests. Actual desktop and iOS
  Safari each pass four states in light/dark; eight Safari captures reviewed.
  No source change, import/publication replay or Android start. 143 hashes match.
- All eight server tables and captured iOS native projection exactly preserved.
  Failed Safari setup attempts archived privately; exact native Simulator paste
  completed login, password not saved, host clipboard restored/device cleared.
- All task QA resources OFF verified 19:28:27 UTC /21:28:27 Amsterdam. Original
  light appearance restored; no pending runtime job, uncertain write or auth fix.
- D10.1–D10.5 done. Next D11.1 on GPT-6.1 Sol / High, manual picker switch needed.
  No D11 work started. D01 partial items and D13/D14 gates remain open.
- Necessary local commit authorized; no push/PR/merge, production/cutover,
  publication/deployment or paid provider operation. Private artifacts retained.

Closure/evidence commit `7a79223` normal hooks PASS: mobile 156 suites /1796 tests /
22 snapshots; web 86 suites /778 tests, one existing skipped suite/test. All 143
source hashes match after hooks. Private `commit.log` retained. Local-only; no push.

## 2026-10-02 — D11.1 optional analysis CEFR contract

- User-confirmed GPT-6.1 Sol / High, starting `44de0f5`, AUTH-20 and retained
  AUTH-18 local commit scope. Existing feature branch; no subagent.
  [Evidence/limits](evidence/D11-analysis-contract-20261002.md).
- Default-off model-only estimate/cache persistence, server input hash/version,
  old cache/payload compatibility; pure domain parser and server crypto. Web
  round-trip/mobile optional types only. Shared assessments/words/SRS unchanged.
- 45 Edge, 24 SQL, two web suites /13 tests PASS; types, scoped lint and target
  generation/check PASS. Article-free refresh NULL bug fixed with regression test.
  140 unaffected D10 hashes preserved; 158-path D11 inventory saved.
- Retained QA resources OFF verified 19:47:41 UTC; never started this turn. Local
  isolated tests and generator cleaned up. No pending job/uncertain write.
- D11.1 implementation/local verification done; D11 remains in_progress. Next
  manual GPT-6 Astra / High review of provenance/input binding before D11.2
  calibration/worker design. Feature stays OFF; live sample is a separate gate.
- Necessary local commits with normal hooks authorized; no push/PR/merge, paid
  call, hosted migration, production/cutover, publication/deployment or schedule
  activation. Preexisting `.playwright-cli/` and private reports preserved.

Source/evidence commit `a756680` normal hooks PASS: mobile 156 suites /1796 tests /
22 snapshots; web 86 suites /780 tests, one existing skipped suite/test. Post-hook
158/158 source hashes match; only preexisting `.playwright-cli/` untracked.
Private `commit.log` retained. Documentation receipt checkpoint follows; no push.

## 2026-10-02 — D11.1 contract review and D11.2 implementation route

- User-confirmed GPT-6 Astra / High, starting `9caea2f`, reviewed source `a756680`,
  AUTH-20/18. No subagent. [Review](evidence/D11-analysis-contract-review-20261002.md)
  PASS with no blocking implementation finding; dormant contract only.
- Three added review tests cover actual persistence round-trips, disabled refresh
  and 16 material input changes. 48 Edge tests PASS with fake HTTP/no allow-net;
  scoped lint/format/diff PASS. Product/SQL unchanged. 156 hashes exact, two test
  hashes updated in the 158-path review inventory. No repeated SQL/runtime QA.
- [Engineering contract](evidence/D11-calibration-worker-contract-20261002.md)
  preserves separate analysis/meaning authority, reviewed fixture qualification,
  exact lease/head/provenance completion and atomic conservative budget limits.
- Next manual GPT-6.1 Sol / High for D11.2 offline fixture/report validation and
  fail-closed decision policy. Real reviewed quality/source/provider budget remain
  open gates; no synthetic calibration claim. D11 in_progress, D11.2–D11.7 open.
- Devices/retained backend not started; no data write, live/provider call, hosted
  migration, activation, production/cutover, publication/deployment or push/PR/merge.
  Necessary local test/docs commit with normal hooks authorized. Private artifacts
  and preexisting `.playwright-cli/` preserved. No pending runtime operation.

Assigned resources OFF verified 20:08:28 UTC /22:08:28 Amsterdam: exact iOS
Shutdown, Android absent, four retained task containers exited, ports 55331/55400
closed. No device/backend start or retained data mutation during this review.

Review/test commit **`bf68661`** normal hooks PASS: mobile 156 suites /1796 tests /
22 snapshots; web 86 suites /780 tests, one preexisting skipped suite/test.
Post-hook source inventory 158/158 matches. Only preexisting `.playwright-cli/`
untracked; private `commit.log` retained. Local-only, no push or pending QA job.

## 2026-10-02 — Explicit repository pause

- User requested `/repo pause`; no implementation or new QA was started.
- HEAD `02cd51d`, branch `feature/shared-dictionary-schema`, D11.1 source `a756680`
  and review `bf68661` retained. D11 status paused; D11.2–D11.7 remain open.
- Next explicit resume: GPT-6.1 Sol / High for D11.2 offline fixture validation,
  calibration reporting and fail-closed policy. Last confirmed model Astra / High;
  do not claim Sol was selected. Real quality/source/budget gates remain open.
- Assigned resources OFF reverified 20:14:35 UTC /22:14:35 Amsterdam: assigned iOS
  Shutdown, Android absent, four retained containers exited, ports 55331/55400
  closed. No pending runtime/test job, uncertain write or restoration. Automation
  `d09-06-00` configuration remains PAUSED; no new schedule.
- Only three pause documents changed. Preserve preexisting `.playwright-cli/`
  and ignored reports/data. Necessary local documentation commit with normal hooks
  remains authorized; no push, publication/deployment, hosted migration, paid call,
  production/cutover or activation. Resume requires explicit user continuation.

## 2026-10-03 — D11.2 offline mechanics

- Explicit resume and user-confirmed GPT-6.1 Sol / High; starting `2456246`, existing
  feature branch, AUTH-20/18. All 158 prior source hashes exact; no subagent.
- Implemented fixture/partition/input validation, response provenance/binding,
  reproducible calibration metrics, explicit policy and opaque in-process
  qualification; standalone offline CLI refuses output overwrite. All test data
  and review/approval references fictional. No actual quality qualification.
- New offline 46 tests PASS; prior analysis regressions 48 PASS, no network
  permission. Type/lint/format/diff and 22-item CLI/no-overwrite smoke PASS.
  [Evidence and limitations](evidence/D11-offline-calibration-20261003.md).
- D11 in_progress; D11.2 offline mechanics ready for Astra / High review before
  worker use. D11.2 real reviewed/live quality and D11.3–D11.7 stay open. Next
  review approval/digest binding, denominators, abstention and profile invalidation;
  then Sol / High queue/lease work. Current-thread picker cannot be changed here.
- No devices/backend started or operated; no private export, provider call,
  database write, schedule/flag activation, hosted migration, deployment,
  production/cutover or push/PR/merge. Prior resource OFF checks are historical.
  Preserve `.playwright-cli/` and private reports under
  `reports/shared-dictionary-cefr/d11-offline-calibration-20261003/`.
- Necessary local commit with normal hooks under AUTH-18; receipt follows.

Implementation commit `0cb494f` completed with normal hooks: mobile 156 suites /
1796 tests /22 snapshots; web 86 suites /780 tests with one existing skipped
suite/test. Post-commit audit adjusted only the permission-check test to deny its
own permissions explicitly, so the repository's broader Edge flags do not produce
a false failure. All 46 offline tests pass both with no runtime grants and with
caller-level `--allow-env --allow-net`; the audit itself is denied access in both.
No network operation was performed. Updated inventory retains 169 hashes and
changes only this test hash. Follow-up local test/receipt commit uses normal hooks.
No pending runtime job, external operation or restoration. Private commit logs
and all data retained; no push/PR/merge.

## 2026-10-03 — D11.2 local review and repairs

- Explicit user continuation after requested Astra review; current picker
  confirmation pending. No model attribution or subagent. Starting `cf1ffaa`.
- Two P2 defects reproduced/fixed: shared mutable coverage list and silently
  ignored policy inputs. Three regressions fail before repair; 50 tests pass after
  repair including supported-policy round-trip. Type/lint/format checks PASS.
- [Review](evidence/D11-offline-review-20261003.md); 171-path inventory retains
  168 hashes, changes two modules and adds one test. D11 remains in_progress;
  model provenance, real reviewed quality and worker checkpoints remain open.
- Next resolve pending model confirmation; then Sol / High worker work once the
  prescribed review gate is satisfied. No device/backend/provider/SQL or external
  operation. Preserve `.playwright-cli/` and private reports. AUTH-18 local commit
  with ordinary hooks; receipt follows. No push/PR/merge or activation.

Review/fix commit **`039223a`** completed with normal hooks: mobile 156 suites /
1796 tests /22 snapshots; web 86 suites /780 tests, one preexisting skipped
suite/test. Post-hook source inventory 171/171 matches. Only preexisting
`.playwright-cli/` is untracked before this receipt. Private `commit.log` retained.
No pending runtime operation or external write. Local-only, no push. Current-model
confirmation is still pending; do not infer Astra provenance from the commit.

## 2026-10-03 — D11 private queue and fake-provider evaluation foundation

- Continued locally from `9454552`, AUTH-20/AUTH-18, user-confirmed Sol / High.
  Preserved earlier review attribution limit and final Astra review gate.
- Added private immutable method registry, published-meaning queue, bounded leases/
  retries and atomic estimated-only completion. Added pure qualified evaluation
  with fake provider; no HTTP entrypoint, live transport, scheduler or budget yet.
- [Evidence](evidence/D11-queue-foundation-20261003.md): 18 queue SQL, 17 content/
  cache SQL, 57 offline/evaluator and 48 analysis tests PASS. Schema suite 19 PASS,
  nested upgrade blocked by macOS IPC; identical isolated upgrade body PASS.
  Initial sandbox IPC failure retained; no system settings or unrelated IPC touched.
- Official types regenerated/checked; scoped lint/types/format PASS. Inventory
  177 paths, retaining 168 old hashes. Own temporary clusters/containers cleaned;
  retained QA/devices/data untouched, `.playwright-cli/` and reports preserved.
- Next D11.6–D11.7 server authorization, run ledger and atomic conservative budget
  reservations on Sol / High; then Astra review. D11 remains in_progress. Real
  quality/source/spending/live gates remain open. No external operation/activation.
- Local scoped implementation/evidence commit with ordinary hooks under AUTH-18;
  receipt follows. No push/PR/merge, paid call, hosted migration or deployment.

Implementation/evidence commit **`aded98f`** completed with normal hooks: mobile
156 suites /1796 tests /22 snapshots; web 86 suites /780 tests, one preexisting
skipped suite/test. Post-hook inventory 177/177 exact; only preexisting
`.playwright-cli/` untracked before this receipt. First incomplete checkpoint stays
D11.6–D11.7 local authorization and budget work. No pending operation or restoration.
Documentation receipt uses normal hooks, local-only; no push or runtime activation.

## 2026-10-03 — D11.6–D11.7 local invocation and conservative budgets

- Continued from `eb38631`, AUTH-20/AUTH-18. User requested model announcements
  before each next checkpoint; Sol / High implementation recommendation retained.
  No inferred picker change or Astra review attribution; no subagent.
- Added immutable reviewed-budget registry, default-off global control, UTC-day
  caps, atomic claim/reserve, one-use permits, conservative unknown usage and
  once-only verified reconciliation, run metrics, credential-gated handler factory
  and generated-contract RPC store with bounded cancellation/timeouts.
- [Evidence](evidence/D11-budget-invocation-20261003.md): 27 budget SQL, 18 queue
  regressions, 72 Deno tests PASS; official generation/check and scoped lint/types/
  format PASS. Initial SQL fixture and Deno type/mock-alias errors corrected.
- Inventory 184 paths, 173 prior hashes unchanged. Disposable local resources only;
  retained QA/devices/backend/data untouched. `.playwright-cli/` and reports kept.
- Next GPT-6 Astra / High concurrency/provenance/budget review. D11 acceptance and
  real quality/source/pricing/bounds/spending gates stay open; all defaults OFF.
  No real transport/bootstrap, provider network, hosted migration, schedule,
  deployment, publication or push/PR/merge. Local commit with ordinary hooks;
  actual persistence receipt follows. No uncertain external operation/restoration.

Implementation/evidence commit **`2329f0b`** passed normal hooks: mobile 156 suites /
1796 tests /22 snapshots; web 86 suites /780 tests with one preexisting skip.
Post-hook inventory 184/184 exact; only preexisting `.playwright-cli/` untracked
before this receipt. Next checkpoint remains Astra / High review; it has been
announced to the user and is not performed yet. Local documentation receipt with
ordinary hooks, no push, no pending runtime operation or restoration.

## 2026-10-03 — D11 worker review and policy deadline repair

- Continued from `9a29b06` under AUTH-20/AUTH-18. Announced required Astra / High;
  picker attribution unverified, no subagent. Local technical review completed.
- One P2 reproduced in two lock-barrier tests: expired policy still published.
  Nested settlement rollback now removes assessment/head/journal, retains verified
  accounting and persists an idempotent obsolete outcome.
- [Review](evidence/D11-worker-review-20261003.md): 2 pre-fix failures, final 47 SQL
  PASS (29 budget +18 queue); target contracts unchanged/check PASS; lint/format/
  diff PASS. 184-path inventory retains 181 prior hashes; three paths repaired.
  Unchanged Deno sources retain previous 72-test evidence without replay.
- Disposable local SQL/generator resources only, harnesses finished/cleaned up.
  Retained backend/devices, private reports and `.playwright-cli/` preserved.
- Next GPT-6.1 Sol / High local real-calibration/sample proposal; identify real
  reviewed fixture/reviewer/provider inputs and concrete costs before requesting
  separate live approval. D11 remains in_progress; D12 not started, defaults OFF.
  No paid calls, hosted migration, publication/deployment/activation or push/PR.
- Necessary local repair/evidence commit uses normal hooks; receipt follows.

## Persistence receipt

Repair/review commit **`ab789e2`** passed normal hooks: mobile 156 suites /1796
tests /22 snapshots; web 86 suites /780 tests, one preexisting skipped suite/test.
Post-hook inventory **184/184 exact**; only preexisting `.playwright-cli/` untracked
before the documentation receipt. Private `commit.log` retains hook results.
The hook length/complexity checks found no matching TS/JS paths; changed MJS
files passed the separate scoped ESLint check. No push or pending operation. Next remains Sol / High local calibration/sample proposal,
with real evidence and separate live approvals still required.

## 2026-10-03 — D11 concrete calibration/sample proposal

- Continued from `abc2ea0` under AUTH-20/AUTH-18; Sol / High recommendation
  announced, no automatic picker change or subagent.
- [Proposal](evidence/D11-calibration-sample-proposal-20261003.md): 24 meaning
  candidates, human review worksheet, prompt/profile and exact bounds. Four bundled
  inputs/20 original unreviewed drafts; all label/reviewer/permission fields empty.
- Local audit PASS: 24 parsed canonical unique inputs, 12/12 proposed split,
  all 11 pooled slices, no family/lemma overlap, profile/digests and arithmetic;
  worklist rejected as a gold fixture. All previous 184 source hashes unchanged;
  six new prepared artifacts, 190-path inventory. No product/SQL/runtime edits.
- Proposed Gemini 3.5 Flash Standard probe: at most 48 generation attempts,
  conservative reserve $1.913472, proposed API-use ceiling $2; official pricing/
  token semantics checked through Context7/web. No secret/account/provider call.
- Reviewer/existing gold-set clarification pending. Next Astra / High proposal
  review, then local fake-transport collector before exact live approval. D11
  remains in_progress, D12 not started. No inferred reviewed labels or approval.
- Local proposal/checkpoint commit uses ordinary hooks; receipt follows. No
  device/backend/migration/activation, paid call, publication/deployment/push/PR.
  Preserve reports and `.playwright-cli/`; no pending restoration/external write.

Proposal/checkpoint commit **`2731caf`** passed normal hooks: mobile 156 suites /
1796 tests /22 snapshots; web 86 suites /780 tests, one preexisting skipped
suite/test. Post-hook inventory **190/190 exact**. Only preexisting `.playwright-cli/`
untracked before the documentation receipt. Next remains Astra / High proposal
review, with reviewer/source/spending decisions open. Ordinary local receipt hooks;
no provider call, external write, activation, push or pending restoration.

## 2026-10-03 — D11 autonomous proposal review

- Continued from `d51aac0`, AUTH-20/AUTH-18. User has no teacher and requested
  autonomous work; pending clarification resolved, no further teacher gate.
- Astra / High review recommendation announced; actual picker/model unverified.
  No subagent. Public lexical sources and pricing read; no provider account/key.
- [Review](evidence/D11-autonomous-proposal-review-20261003.md): corrected irregular
  metadata in two opstaan senses and lopen; 21 other canonical hashes unchanged.
  Prompt enum clarified and profile rebound. Completed all 24 input reviews and
  separate model reference with 19 provisional bands/five unknowns, no gold labels.
- Diagnostic comparison must use a new agreement report, not the existing gold
  report with forged review metadata. Source-backed meaning checks do not provide
  independent CEFR accuracy. No operational qualification changed.
- Local audit PASS: inputs, bindings, 12/12 splits, 11 pooled slices, no family/lemma
  overlap, budget arithmetic/profile, rejection as gold. All 184 implementation
  hashes retained. Initial worksheet generator omitted the Dutch column; corrected
  before final checks. Existing harmless Node module-type warning retained in log.
- Next GPT-6.1 Sol / High local collector/report with fake transport and durable
  reservations; no teacher required. Live source/account/spending request follows
  only when implementation is concrete. D11 in_progress, no D12 or activation.
- Necessary local commit uses ordinary hooks; receipt follows. No pending external
  write/restoration. Preexisting `.playwright-cli/` and private reports preserved.

Autonomous review commit **`8b65af9`** passed normal hooks: mobile 156 suites /
1796 tests /22 snapshots; web 86 suites /780 tests, one existing skipped suite/test.
Post-hook source inventory **192/192 exact**. Only preexisting `.playwright-cli/`
was untracked before this documentation receipt. No pending test/external operation.
Next remains GPT-6.1 Sol / High local diagnostic collector/report; teacher question
resolved. AUTH-18 ordinary local receipt hooks; no push or paid call.

## 2026-10-03 — D11 local fake diagnostic collector/report

- Continued from `268dcae`, AUTH-20/AUTH-18. GPT-6.1 Sol / High recommended and
  announced; actual picker/model attribution unverified. No subagent.
- [Evidence](evidence/D11-diagnostic-collector-20261003.md): exact artifact and
  canonical input binding, frozen worklist/reference, fake-only transport, private
  SQLite reservation/capture ledger, single active collector and same-day resume.
  Separate unqualified agreement report; no operational qualifier change.
- Node 24 focused 12/12 PASS; scoped TypeScript, strict ESLint, Prettier and diff
  checks PASS. Fake CLI completed 24 items, 24 reservations, no real cost. Logs
  and report retained under ignored private
  `reports/shared-dictionary-cefr/d11-diagnostic-collector-20261003/`.
- Previous 192 source hashes retained; 200-path inventory. No provider
  account/key/network, device/backend, hosted migration, activation or publication.
- Next GPT-6 Astra / High review of durable accounting and authority boundary;
  then Sol / High real adapter preparation and exact source/account/spending request.
  Teacher question resolved. D11 in_progress, D12 not started. Ordinary local
  commit under AUTH-18; receipt follows. Only preexisting `.playwright-cli/`
  untracked aside from new scoped files. No pending external operation.

Collector implementation commit **`59af814`** passed normal hooks: mobile 156 suites /
1796 tests /22 snapshots; web 86 suites /780 tests, one existing skipped suite/test.
Post-hook inventory **200/200 exact**. Only preexisting `.playwright-cli/`
untracked before documentation receipt. No pending tests, external write or
restoration. Next GPT-6 Astra / High technical collector review.

## 2026-10-03 — D11 diagnostic collector review and repairs

- Started from `6342502`, AUTH-20/AUTH-18; Astra / High announced, actual picker
  attribution unverified. No subagent. Baseline inventory 200/200 exact.
- [Review](evidence/D11-diagnostic-review-20261003.md): eight behavioral failures
  reproduced five P2 findings. Fixed mutable settings, UTC rollover, dropped receipt
  metadata, partial authorization stop and coverage validation. Also close SQLite
  on failed initialization/resume. Initial test draft syntax repaired before repro.
- 22/22 final Node tests PASS; scoped types/strict lint/format/diff PASS. No live
  transport, account/key, device/backend, publication/activation or external write.
- Next GPT-6.1 Sol / High real-adapter/control-request local preparation and exact
  source/account/spending proposal. Teacher question resolved; D11 in_progress,
  D12 not started. Private logs retained; ordinary local commit/receipt follows.

Repair/review commit **`d81b8e0`** passed normal hooks: mobile 156 suites /1796 tests /
22 snapshots; web 86 suites /780 tests, one existing skipped suite/test. Post-hook
inventory **202/202 exact**. Only preexisting `.playwright-cli/` untracked before
the ordinary AUTH-18 documentation receipt. No pending external operation or test.
Next GPT-6.1 Sol / High for local real-adapter preparation; no paid call or push.

Documentation receipt's first hook run failed when one Jest worker exited with
SIGSEGV before running `sharedDictionaryContract.test.ts`: 155 suites /1792 tests
passed, one suite failed to start. An isolated in-band rerun of that suite passed
4/4 tests. Logs `receipt-commit.log` and `jest-worker-recheck.log` preserve both
outcomes. No source change or hook bypass; retry the ordinary receipt commit.

## 2026-10-03 — D11 Gemini REST/control preparation

- Resumed from `88c58b7`, AUTH-20/AUTH-18; Sol 6.1 / High announced, actual picker
  unverified. No subagent. Baseline 202/202 exact; 200 retained, README/store changed.
- [Evidence](evidence/D11-gemini-adapter-preparation-20261003.md): full request token
  counting, stable identity, bounded injected test HTTP, model/tier/usage validation
  and durable one metadata/24 token controls. No live runner or provider/account/key
  call. Current generation reservation is not a verified total including controls.
- 47/47 Node tests PASS (23 new +22 existing); scoped types/strict lint/format/diff
  PASS. Initial authoring syntax/native-strip/lint issues repaired before final checks.
  Logs `reports/shared-dictionary-cefr/d11-gemini-adapter-20261003/`; 207-path inventory.
- [Unapproved draft](evidence/D11-gemini-live-request.proposed.json) binds all inputs;
  account/source/day/approval/control billing remain unset. No qualifier/worker/client
  or runtime change. No paid call, hosted migration, activation, publication,
  deployment or Git publication. Reports and `.playwright-cli/` preserved.
- Next GPT-6 Astra / High review; then Sol / High live integration and exact final
  request after reviewable local work. Teacher not required. D11 in_progress,
  D12 not started. Ordinary local commit and receipt under AUTH-18 follow.

Implementation **`cf27475`** passed ordinary hooks: mobile 156 suites /1796 tests /
22 snapshots; web 86 suites /780 tests, one existing skipped suite/test. Post-hook
inventory **207/207 exact**. Only preexisting `.playwright-cli/` untracked before
receipt. No pending tests, provider calls, external write or restoration. Next
GPT-6 Astra / High REST/control review. Local AUTH-18 documentation receipt with
ordinary hooks; no push.

## 2026-10-03 — D11 Gemini REST/control review and repairs

- Started from `177eb96`, AUTH-20/AUTH-18. GPT-6 Astra / High announced; a model-switch
  event was present, exact picker attribution unverified. No subagent. Baseline
  207/207 exact.
- [Review](evidence/D11-gemini-adapter-review-20261003.md): twelve pre-fix failures
  reproduced five P2 findings: response body lifecycle, envelope retry/MIME handling,
  compatibility validation order, lease before dispatch and sibling model prefixes.
  Repaired locally; 14 review +47 prior Node cases PASS (61/61), scoped types/strict
  lint/format/diff PASS. Removed one unused test import before final lint.
- 210-path inventory, 203 retained hashes. Wire request digest and frozen pilot
  artifacts unchanged. Unapproved live draft now links the review. No account/key,
  provider, native/backend, hosted migration, schedule, publication or deployment.
  Logs `reports/shared-dictionary-cefr/d11-gemini-review-20261003/`; reports and
  `.playwright-cli/` preserved.
- Next GPT-6.1 Sol / High local live-runner integration and exact account/source/
  pricing/approval binding with fake HTTP verification before final live request.
  Teacher not required; no paid authorization. D11 in_progress, D12 not started.
  Ordinary local repair/review commit and receipt under AUTH-18 follow. No pending
  external write or restoration.

Repair/review **`f09971f`** passed ordinary hooks: mobile 156 suites /1796 tests /
22 snapshots; web 86 suites /780 tests, one existing skipped suite/test. Post-hook
inventory **210/210 exact**. Only preexisting `.playwright-cli/` untracked before
receipt. No pending tests, provider calls, external write or restoration. Next
GPT-6.1 Sol / High local live-runner integration with fake HTTP. Ordinary AUTH-18
local documentation receipt; no push.

## 2026-10-03 — D11 dormant authorized runner integration

- Started `233e9bc`, AUTH-20/AUTH-18. GPT-6.1 Sol / High announced; actual picker
  attribution unverified. No subagent. Baseline 210/210 exact; nine changed paths,
  201 retained hashes, 216-path inventory. Frozen pilot artifacts unchanged.
- [Evidence](evidence/D11-gemini-runner-20261003.md): unified control/generation
  reservations/report, durable bounded retries and private exact runtime/draft/
  source/key/account/pricing/run/day approval. Dormant check/execute CLI; committed
  template and draft unapproved. No real registry/key loaded or provider call.
- 92/92 Node tests PASS (31 new +61 retained), scoped types/strict lint/format/diff
  PASS. Initial authoring test expectations and timeout provenance fixed locally;
  final earlier response-body cancellation tests retained. Logs under
  `reports/shared-dictionary-cefr/d11-gemini-runner-20261003/`.
- Next GPT-6 Astra / High technical review before any final live authorization.
  Complete live control cost/account evidence remains unknown; reference model
  origin and qualification false. No teacher required. D11 in_progress/D12 not
  started. No external mutation, runtime activation, paid call or Git publication.
  `.playwright-cli/` and private reports preserved. Ordinary local implementation
  commit/hooks and receipt under AUTH-18 follow; no external operation pending.

Implementation **`a661fe1`** passed ordinary hooks: mobile 156 suites /1796 tests /
22 snapshots; web 86 suites /780 tests, one existing skipped suite/test. Post-hook
inventory **216/216 exact**. Only preexisting `.playwright-cli/` untracked before
receipt. No pending tests, provider calls, external write or restoration. Next
GPT-6 Astra / High local runner technical review. Ordinary AUTH-18 local
documentation receipt; no push.

## 2026-10-03 — D11 Gemini runner technical review and repairs

- Started `00f6540`, AUTH-20/AUTH-18. GPT-6 Astra / High announced; model-switch
  event present, exact picker attribution unverified. No subagent. Baseline
  216/216 exact; eight updated paths, 208 retained, 221-path final inventory.
- [Review](evidence/D11-gemini-runner-review-20261003.md): three pre-fix failures
  reproduced two P2 findings: lost-journal allowance replay and duplicate-receipt
  rejection lost across resume. Added external immutable journal identity/nonce
  record and durable receipt-conflict rejection. Repaired locally; 102/102 final
  Node tests PASS, scoped types/strict lint/format/diff PASS. Ordinary hooks follow.
- Draft/template rebound to the reviewed 17-file runtime; frozen five pilot files
  and wire body unchanged. No real key/account access or provider call, paid
  execution, native/backend, deployment/publication, scheduler or Git publication.
  Logs `reports/shared-dictionary-cefr/d11-gemini-runner-review-20261003/`; private
  reports and `.playwright-cli/` preserved.
- Next GPT-6.1 Sol / High final live-pilot request preparation: verify public
  control billing/complete cost and identify missing exact personal account/key
  evidence before requesting necessary access/source/spending authority. Generic
  continuation cannot authorize real HTTP or populate an approved registry.
  No teacher required; qualification false, D11 in_progress/D12 not started.
  Ordinary AUTH-18 local review/repair commit and receipt follow. No external
  operation pending.

Review/repair **`0893a2e`** passed ordinary hooks: mobile 156 suites /1796 tests /
22 snapshots; web 86 suites /780 tests, one existing skipped suite/test. Post-hook
inventory **221/221 exact**. Only preexisting `.playwright-cli/` untracked before
receipt. No pending tests, provider calls, external write or restoration. Next
GPT-6.1 Sol / High final concrete live-pilot request preparation within local/public
scope. Ordinary AUTH-18 local documentation receipt; no push or live approval.

## 2026-10-03 — D11 public pricing and live authorization packet

- Started `58bb193`, AUTH-20/AUTH-18, GPT-6.1 Sol / High announced; exact picker
  attribution unverified. No subagent. Frozen pilot and reviewed runner unchanged.
- [Packet](evidence/D11-gemini-live-authorization-packet-20261003.md): official
  Standard generation rates rechecked. Published direct REST control billing is
  inconclusive; $1.913472 generation reservation leaves $0.086528 under proposed
  $2 combined API-use ceiling. Explicit personal account/key, verified finite
  control costs and exact 24-source/one-day spending approval still required.
- Documentation-only checkpoint; no key/account/provider access, paid operation,
  source transmission, worker activation or Git publication. D11 in_progress,
  D12 not started; diagnostic qualification false. Preexisting `.playwright-cli/`
  and private ignored reports preserved. No pending external operation.
- Next GPT-6.1 Sol / High gated read-only personal account/key-binding and control
  billing verification after exact user permission. Ordinary local receipt under
  AUTH-18 follows.

Packet **`2ebacdf`** passed ordinary hooks: mobile 156 suites /1796 tests /
22 snapshots; web 86 suites /780 tests, one existing skipped suite/test. Prettier
and `git diff --check` PASS. Only preexisting `.playwright-cli/` untracked after
commit. No provider/account/key calls or pending external operation. Local-only
documentation receipt follows under AUTH-18; no push.

## 2026-10-03 — D11 gated account-inspection attempt

- Started `94864d5`, GPT-6.1 Sol / High announced; generic continuation after a
  read-only account question was not accepted by automatic approval review for
  opening the signed-in AI Studio API-keys page. No workaround, key/account read,
  provider request or paid operation. Exact read-only permission question pending.
- Additional public Google key docs identify standard versus service-account
  authorization keys and restriction checks. The packet now requests those
  metadata. Official public docs still do not conclusively price both direct REST
  control methods; complete live maximum remains unknown.
- D11 in_progress, D12 pending, qualification false; disabled registry and frozen
  pilot unchanged. `.playwright-cli/` and ignored reports preserved. No pending
  external operation. Next GPT-6.1 Sol / High after exact permission, otherwise
  separately review a design/budget change. Documentation-only local commit under
  AUTH-18 follows; no push.

Checkpoint **`7db972f`** passed ordinary hooks: mobile 156 suites /1796 tests /
22 snapshots; web 86 suites /780 tests, one existing skipped suite/test. Prettier
and `git diff --check` PASS. Only preexisting `.playwright-cli/` untracked;
documentation receipt follows under AUTH-18, local-only and no push.

## 2026-10-03 — D11 authorized read-only personal AI Studio check

- Started `d671b7f`, GPT-6.1 Sol / High announced; user explicitly authorized the
  signed-in API-keys page. Read API-keys, Projects and Billing views only. Two
  imported projects displayed paid Tier 1 Postpay, masked keys and one billing
  account. UI also warned of a forthcoming billing-plan transition; recheck plan
  and credits before any run. Exact app key/project match, key type/restrictions
  and direct REST control prices remain unknown.
- No key value, account/project identifiers, private registry or source data
  copied into the repository. No credential reveal, settings/payment change,
  provider request, source transmission or paid run. The previous auto-review
  permission gate is resolved only for this exact read-only inspection.
- [Packet](evidence/D11-gemini-live-authorization-packet-20261003.md) updated
  with sanitized observations. An account-free
  [billing inquiry](evidence/D11-gemini-control-billing-inquiry.proposed.md)
  was drafted locally but not sent. D11 in_progress, D12 pending, qualification
  false; runner remains disabled. Next GPT-6.1 Sol / High for separately scoped
  key binding and authoritative control-cost evidence before any source/spending
  request. `.playwright-cli/` and ignored reports preserved. Local documentation
  commit/receipt under AUTH-18 follows; no push or pending external operation.

Documentation checkpoint **`fa907ac`** passed ordinary hooks: mobile 156 suites /
1796 tests /22 snapshots; web 86 suites /780 tests, one existing skipped
suite/test. Prettier and `git diff --check` PASS. Two exact permission questions
for Cloud Console metadata and sending the drafted support inquiry are pending.
Only preexisting `.playwright-cli/` remains untracked; no external operation is
in flight. Local receipt follows under AUTH-18 without push.

## 2026-10-03 — D11 restricted personal-console/support authorization

- Started `203ca83`, GPT-6.1 Sol / High announced. User authorized read-only
  Google Cloud Console Credentials inspection and one send of the prepared
  account-free billing inquiry, only while signed in as `oldrefery@gmail.com`.
  Check identity before both actions; no key value, settings/payment change,
  provider call or source transmission.
- Intended support operation: submit the exact account-free inquiry to Google
  Cloud Billing Support once. If completion is uncertain, inspect case history
  before retry. No support case or external action has yet been verified.
- D11 in_progress, D12 pending, qualification false; pilot disabled. Preserve
  `.playwright-cli/` and private reports. Update this checkpoint with results.

## 2026-10-03 — D11 personal Credentials inspection and billing scope gate

- Started `203ca83`, GPT-6.1 Sol / High announced; picker attribution unverified.
  Verified `oldrefery@gmail.com` in both personal Cloud Console projects. Read
  Credentials metadata only: available Gemini API-restricted keys, no bound
  service account shown, and one key without application restriction. Did not
  reveal/copy a value or prove the app's exact secret-to-project binding.
- User allowed small paid diagnostic use without another spending question and
  retained the personal-account restriction. The proposed $2 API-use ceiling is
  retained; control billing and executable registry remain unresolved. No paid
  call, source transmission, key change or worker activation occurred.
- Billing support assistant opened from the verified personal Console, but needs
  a billing-account selection. Automatic approval review rejected opening the
  private Cloud Billing product to establish the link, as outside the earlier
  Credentials/support scope. Did not bypass or submit the inquiry. Requested
  exact read-only Billing permission; awaiting answer. D11 in_progress, D12
  pending, qualification false; runner disabled. Documentation checkpoint
  `2b76805` passed ordinary hooks: mobile 156 suites /1796 tests /22 snapshots;
  web 86 suites /780 tests, one existing skip. Prettier and `git diff --check`
  passed. Only preexisting `.playwright-cli/` remains untracked; ignored reports
  preserved. Local receipt follows under AUTH-18; no push.

## 2026-10-03 — D11 personal Billing and limits read-only checkpoint

- Started `5c3f993`, GPT-6.1 Sol / High announced; picker attribution unverified.
  User allowed read-only personal Billing/limits inspection and canceled the
  previously authorized support inquiry. No message was sent.
- Verified `oldrefery@gmail.com` in the personal project Cloud Console and AI
  Studio. Project-linked paid billing account uses EUR. Active €10 monthly
  billing-account budget has 50/90/100% alerts and no spend cap; an expired €5
  project budget is not a current limit. Current month Cloud Billing cost was
  €0.14 at inspection. AI Studio showed Tier 1, no project monthly spend cap,
  Gemini 3.5 Flash 1,000 RPM / 2,000,000 input TPM / 10,000 RPD. Cost reporting
  may lag and Postpay transitions to Prepay after October 12. No payment details,
  key values or billing identifiers persisted.
- Exact app key/project binding and direct REST control billing unresolved. Pilot
  and worker disabled, qualification false; no provider call, source transmission,
  settings or payment action. No support case. A broad browser inventory and one
  stale-target click were rejected by automatic review; neither was bypassed.
  Next private credential-binding permission and no-support cost design. D11
  in_progress, D12 pending. Preserve `.playwright-cli/` and ignored reports;
  documentation checkpoint `9e20f55` passed ordinary hooks: mobile 156 suites /
  1796 tests /22 snapshots; web 86 suites /780 tests, one existing skip.
  Prettier and `git diff --check` passed. Local receipt follows under AUTH-18,
  no push.

## 2026-10-03 — D11 no-support control-cost review

- Started `6bb8b27`, GPT-6.1 Sol / High announced; picker attribution
  unverified. Context7 returned the official direct REST token guide, billing
  FAQ and pricing/model references. `GetTokens` naming and `models.get` price
  remain unresolved. Locally prepared all 24 frozen requests with a dummy run ID;
  body lengths were 2,266–2,480 bytes, 57,104 bytes total for one attempt each.
- [Review](evidence/D11-gemini-no-support-cost-review-20261003.md) records why
  removing the controls does not preserve the proposed hard $2 bound. No code,
  credential, provider, source transmission or external state changed. User's
  support-send cancellation remains in force; narrow personal-key and 24-input
  transmission permissions remain unanswered. D11 in_progress, D12 pending,
  qualification false, pilot/worker disabled. Preserve `.playwright-cli/` and
  ignored reports; local-only documentation checkpoint under AUTH-18.
- Documentation commit `8ecafde` passed ordinary commit hooks on 2026-10-03:
  mobile 156 suites / 1,796 tests / 22 snapshots; web 86 suites / 780 tests,
  one existing skip. Scoped Prettier and `git diff --check` passed. Only the
  preexisting `.playwright-cli/` remains untracked; no push or PR. A local
  documentation receipt follows.

## 2026-10-03 — D11 exact source/key permissions; cost-policy answer pending

- Started `d096478`, GPT-6.1 Sol / High announced; picker attribution unverified.
  User authorized transmission of all 24 frozen meaning inputs to Gemini
  Developer API and one-run use of an existing key under `oldrefery@gmail.com`.
  AI Studio confirmed the personal paid project. An owner-only private key file
  was created outside the repository; no value or private path is logged here.
- The AI Studio details card unexpectedly emitted the key value in the tool
  trace. The user was informed; do not reproduce it, and recommend owner
  rotation after one-run use. No provider call or source transmission yet.
  Direct REST control-price maxima remain unverified. A precise question on an
  estimated $2 ceiling with at most one generation per meaning is pending.
  D11 in_progress, D12 pending, qualification false, registry/worker disabled;
  support send canceled. Preserve `.playwright-cli/` and ignored reports; local
  documentation checkpoint under AUTH-18, no push or PR.
- Local validation found all 24 frozen draft IDs/hashes exact and `approved:
false`; private key mode was 0600. Both private temporary key and draft copies
  were removed while the cost-policy answer remains pending. Documentation
  commit `13a846c` passed ordinary hooks: mobile 156 suites / 1,796 tests / 22
  snapshots; web 86 suites / 780 tests, one existing skip. Scoped Prettier and
  `git diff --check` passed. A local receipt follows; no provider call, push or
  PR.

## 2026-10-03 — D11 alternate personal billing read-only checkpoint

- Started `956c18a`, GPT-6.1 Sol / High announced; picker attribution unverified.
  User authorized read-only billing inspection under `curysef@gmail.com`. AI
  Studio confirmed that identity. Its two imported Gemini API projects each
  showed one masked key and Free tier; the visible billing account had zero
  linked projects and required prepay setup. No key value, settings change or
  provider request occurred. Exact deployed-app key ownership remains unknown.
- Previous one-run key permission remains scoped to `oldrefery`; the cost-policy
  answer on an estimated rather than guaranteed $2 ceiling is still pending.
  D11 in_progress, D12 pending, qualification false, runner/worker disabled.
  Support inquiry canceled. Preserve `.playwright-cli/`; no push, PR or
  deployment. Documentation commit `fce0ad9` passed ordinary hooks: mobile 156
  suites / 1,796 tests / 22 snapshots; web 86 suites / 780 tests, one existing
  skip. Scoped Prettier and `git diff --check` passed. A local receipt follows
  under AUTH-18.

## 2026-10-03 — D11 partial key identifier read-only comparison

- Started `dc1c0fe`, GPT-6.1 Sol / High announced; picker attribution
  unverified. User supplied a partial key identifier. AI Studio confirmed
  `oldrefery@gmail.com`; the last four characters matched its masked
  `Generative Language API Key` in the paid `Gemini API` project. The two
  visible `curysef` key suffixes differed. The UI did not show the fifth
  supplied suffix character. No deployed Supabase secret comparison, full
  key reveal/copy, provider request or billing change occurred.
- Exact app binding remains unverified. The one-run `oldrefery` key scope and
  pending estimated-versus-hard $2 decision remain unchanged. D11
  in_progress, D12 pending, qualification false, runner/worker disabled.
  Support inquiry canceled. Preserve `.playwright-cli/`; no push, PR or
  deployment. Local documentation checkpoint under AUTH-18.

## 2026-10-03 — D11 estimated one-run cost policy accepted

- Started `290285b`, GPT-6.1 Sol / High announced; picker attribution
  unverified. User accepted an estimated, not guaranteed, $2 ceiling for one
  run with at most one generation per each of the 24 approved inputs, 24
  token controls and one metadata control. Published generation reservation
  is $0.956736; control charges remain unknown. No support inquiry or extra
  run authorization. First implement and fake-test the bounded execution
  mode, then perform exact private readiness validation before dispatch.
  D11 in_progress, D12 pending, worker disabled and qualification false.
  Only preexisting `.playwright-cli/` untracked; no provider call yet.
- [Estimated-mode evidence](evidence/D11-gemini-estimated-mode-20261003.md):
  one-attempt execution and explicit unknown-control cost reporting implemented
  locally. Node 24 diagnostic tests 103/103 PASS; scoped TypeScript, ESLint
  zero-warning, Prettier and diff check PASS. Next bind private files and run
  no-HTTP `--check`, then dispatch the single authorized run if ready.
- Implementation commit `cf44395` passed ordinary hooks: mobile 156 suites /
  1,796 tests / 22 snapshots; web 86 suites / 780 tests, one existing skip.
  The owner-only private draft, registry and key were bound outside the repo;
  key identity matched the user-supplied five-character suffix without output.
  `--check` returned ready with zero external calls; run directory and
  consumption record remain absent. Next one `--execute` against this exact
  registry, then inspect its durable journal/report. If interrupted, inspect
  state before any retry; no second run is authorized. Local pre-dispatch
  receipt follows, with no push or PR.

## 2026-10-03 — D11 first live attempt stopped at metadata control

- Started from `c679bc7` after private `--check` returned ready with zero
  external calls. One `--execute` exited 1. Read-only private journal
  inspection found one model metadata control reserved with no receipt, zero
  token counts, zero generations and zero captures. The control outcome and
  charge are unknown. No frozen meaning input was transmitted.
- A private unqualified report was written; its SHA-256 and aggregate counts
  are in [sanitized evidence](evidence/D11-gemini-first-live-attempt-20261003.md).
  The private journal, consumption record and report remain together outside
  the repo; the temporary credential and transfer script were deleted.
  Keyless public Google-doc connectivity returned HTTP 200, while AI Studio
  Usage and Cloud Console's Gemini API detail page failed to load. The Cloud
  dashboard's two aggregate requests cannot be attributed to this attempt.
  Neither resolves the control failure. No replay,
  support inquiry, production worker activation, push, PR or deployment.
  One-run approval consumed; next local fake-only error-classification work
  before any new provider proposal. D11 in_progress, D12 pending,
  qualification false.
- Local post-attempt repair stores only sanitized control failure class and
  numeric HTTP status while preserving unknown receipt/no-replay semantics.
  A fake HTTP 403 metadata test verifies no response body is persisted.
  Node diagnostic tests 104/104 PASS; scoped types, zero-warning lint, format
  and diff check PASS. No provider call or alteration of the first private
  journal/report. New implementation digest is in the attempt evidence.
  Code/evidence commit `b81a8ab` passed ordinary hooks: mobile 156 suites /
  1,796 tests / 22 snapshots and web 86 suites / 780 tests, one existing
  skip. Only preexisting `.playwright-cli/` remains untracked. Next action:
  obtain fresh one-run authority before any replacement dispatch; the first
  registry and its private unqualified report remain preserved.

## 2026-10-03 — D11 second live run ready for dispatch

- The user gave a new one-run authorization for the same 24 frozen
  meanings, personal `oldrefery@gmail.com` key, one generation each and
  estimated $2 without a hard total bound. Signed-in AI Studio identity,
  paid Tier 1 project and selected key suffix were checked.
- A new owner-only private registry, key and run binding were made apart
  from the preserved first run. Node 24 `--check` returned ready with
  zero external calls; no new run directory or consumption record exists.
  [Preflight evidence](evidence/D11-gemini-second-live-preflight-20261003.md)
  records the root/digests and exact next command scope.
- Next: exactly one provider `--execute`, then inspect private durable
  state before any further action. D11 in_progress, D12 pending,
  qualification false, worker disabled; no support message, push, PR or
  deployment.

## 2026-10-03 — D11 second live attempt stopped at metadata validation

- Starting from pre-dispatch checkpoint `ee16806`, exactly one
  `--execute` exited with the sanitized CLI error. Read-only private
  inspection found one model metadata reservation with no receipt and
  `validation` failure class, zero token controls, zero generations and
  zero captures. No frozen meaning input was transmitted.
- A private unqualified report was written in the second owner-only
  root; the temporary key and local transfer script were deleted.
  [Sanitized evidence](evidence/D11-gemini-second-live-attempt-20261003.md)
  records both report hashes and the parser-path inference. No replay,
  support message, worker activation, push, PR or deployment.
- The second one-run approval is consumed. Exact rejected metadata
  field and possible control charge remain unknown. Next: prepare a
  narrow metadata-only probe proposal; any provider call requires
  fresh user authority. D11 in_progress, D12 pending, qualification
  false.
  Evidence commit `5b60654` passed ordinary hooks: mobile 156 suites /
  1,796 tests / 22 snapshots and web 86 suites / 780 tests, one
  existing skip. Only preexisting `.playwright-cli/` remains untracked.

## 2026-10-03 — D11 metadata-only probe preflight

- New user grant: no more than five further personal `oldrefery` provider
  attempts, approximately $10 across them, without a guaranteed hard cap.
  Zero of five has been dispatched at this checkpoint.
- Official model resource documentation and read-only AI Studio/Cloud logs
  review did not reveal the exact rejected field. Prepared an owner-only
  one-shot metadata `GET` probe with allowlisted summary only, no meaning
  input, no generation and no retry. The personal project/key binding was
  reconfirmed privately; self-test and `--check` passed with zero external
  calls. See [preflight](evidence/D11-gemini-metadata-probe-preflight-20261003.md).
- Next: execute this probe exactly once, inspect durable private state,
  remove the temporary key and record remaining attempts. D11 in_progress,
  D12 pending, worker disabled, qualification false. No support message,
  push, PR or deployment.

## 2026-10-03 — D11 metadata probe result and local parser repair

- Exactly one metadata-only personal-key `GET` returned HTTP 200. Its bounded
  summary showed the intended model, generation/count methods, thinking flag
  and sufficient limits; `baseModelId` was absent. No frozen input, token
  control or generation was sent. The temporary key and transfer script were
  removed; private consumed/result evidence remains outside the repository.
  Attempt 1 of 5 is consumed; four remain. See [sanitized result](evidence/D11-gemini-metadata-probe-result-20261003.md).
- Local parser now accepts an absent `baseModelId`, still rejects a present
  wrong ID, and preserves absence in the normalized receipt. A fake control
  sequence with the observed shape completes 25 controls. Node 24 diagnostic
  tests 105/105, scoped strict TypeScript, zero-warning ESLint, Prettier and
  `git diff --check` passed. The initial Node 20 test invocation could not
  load `.ts` files; the correct Node 24 run passed. An initial TypeScript
  command referenced a nonexistent scoped tsconfig; the explicit scoped
  command passed.
- A subsequent static audit against Google's GenerateContent and countTokens
  references extended the exact Flash model-version pin to allow a dated
  `MM-YYYY` revision while rejecting siblings and later changes. The full
  Node 24 diagnostic suite then passed 106/106 with scoped type/lint/format.
  No generation was sent as part of this audit.
- A further pre-dispatch timing audit identified a five-second HTTP deadline
  with a ten-second journal lease. Both were raised in step to 30 and 45
  seconds. A fake check ensures the full deadline fits within the lease;
  diagnostic tests 107/107, scoped type/lint/format/diff passed. The already
  prepared private draft/registry was invalidated by the implementation
  change before any provider dispatch and must be rebound.
- Next: audit remaining live response assumptions before a distinct full
  registry. D11 in_progress, D12 pending, worker disabled, qualification false.
  No support message, push, PR or deployment.
