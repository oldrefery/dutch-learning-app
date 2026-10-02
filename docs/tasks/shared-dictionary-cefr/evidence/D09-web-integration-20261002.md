# D09 web integration — 2026-10-02

Status: D09 complete at 07:11 Europe/Amsterdam. Local-stack browser acceptance,
unit gates and expanded performance investigation passed. Next stage D10 is not started.
Branch `feature/shared-dictionary-schema`, HEAD `c5dfb14d49b9a53521b53e13bdd19991999ede5d`.
All changes remain local/uncommitted alongside preserved D03-D08 work.

## Scope and implementation

- Default-off server flag `DICTIONARY_CONTENT_ENABLED`; enabled only in isolated
  web/build fixtures, no environment or deployed schema changes.
- Bulk effective-content hydration for owned collection/search/detail/review-detail
  and import duplicate contexts. Strict complete card sets, owner identity from
  personal rows, no partial or legacy downgrade on dictionary transport failures.
- Review reads a single consistent `get_web_review_snapshot_v2`, preserving all
  personal learning fields, IDs and event handling. Disabled flag retains v1.
- CEFR unknown/estimated/reviewed badges use existing theme tokens. Collection
  badge belongs inside the translation cell, preserving the six-column layout.
- Private reanalysis detaches through a versioned command; image changes merge
  existing overrides. Stale page intent rejected before provider invocation, CAS
  also protects changes during analysis. No automatic command retries or direct
  legacy write fallback. Lost acknowledgement instructs reload/check before retry.
- Explicit adoption checks the displayed head is still current, retains overrides,
  and invalidates app routes. Focus refresh does not replace active review content.
- At review boundaries, a router transition gates restart until fresh props arrive;
  start applies the latest available snapshot synchronously. Active questions stay
  frozen. This fixes an actual rapid exit/start race found during QA.
- Collection/detail/review/import error components now use installed Next 16.3.3 `retry`,
  which refreshes server data as well as resetting the error boundary. The old
  reset-only handler could not recover from a server-content failure.
- New/ambiguous AI analyses remain private. Official/shared reference propagation,
  recipient visibility and self-contained exports remain the explicit D10 scope.
  Foreign shared previews are not passed to the owner-only effective-content RPC.

## Automated gates

Node 24.20.0 (`/Users/devrush/.nvm/versions/node/v24.20.0/bin`).

- Full web Jest: 71 suites, 617 tests PASS; one pre-existing skipped suite/test.
  `reports/shared-dictionary-cefr/D09-final-full-web.log`.
- Web typecheck (Next typegen + tsc), strict ESLint, scoped Prettier and
  `git diff --check` PASS. `D09-final-typecheck.log`, `D09-final-lint.log`,
  `D09-final-format.log` under the same report directory.
- Four performance fixture tests PASS. Harness/helper strict ESLint PASS.
  `D09-performance-fixture-tests.log`, `D09-harness-lint.log`.
- Regression coverage includes incomplete/malformed reads, nullable private fields,
  identity protection, stale/private command writes, adoption/receipt validation,
  account remount isolation, frozen sessions, pending boundary refresh and all
  five server-error retry boundaries. CEFR tests use the actual data-theme hook.
- Full runner: root Jest with `--config apps/web/jest.config.mjs --ci --runInBand
--watchman=false --modulePathIgnorePatterns '<rootDir>/reports/'
'<rootDir>/.stryker-tmp/'`. Reports exclusions avoid retained native QA copies.

## Actual isolated-stack browser acceptance

Only named browser `d08-content-qa`, two tabs, loopback web 55400 and proxy 55331,
upstream 55321. Only db/auth/rest/kong for `woordenaar-d08-qa.ZFsE50` were started.
No mobile device, other session, hosted service or paid provider was used.
Proxy stubs every `/functions/v1/*` request; exactly one mock reanalysis request
and two successful web content commands (reanalysis, adoption) were observed.
Peer edits and the synthetic revision fixture stayed in that same local database.

Passed:

1. Existing four owned words render unknown, A2 estimated and B1 reviewed states.
   Initial snapshot `reports/shared-dictionary-cefr/D09-collection.yml`.
2. Open zolder v12, peer changes to v13, submit stale form: reload message, no
   provider invocation or content command. Reload and mock reanalysis succeeds v14,
   new private translation rendered. `D09-stale-form.yml`.
3. A synthetic newer fiets revision is offered explicitly; prior content remains
   pinned before click. Adoption changes v3 to v4 and renders the new translation,
   removes the offer, retains image override v3. New assessment hash has no CEFR,
   so old A2 is correctly replaced by unknown. No learning reset.
4. Active huis question/answer and B1 badge stay unchanged after a server peer edit
   and focus refresh. Rapid exit/start initially exposed a stale snapshot race.
   After the fix, a second peer edit leaves the running answer unchanged and the
   immediate next session sees the new translation. No assessment was submitted.
   `D09-review-before.yml`, `D09-review-boundary-retry.yml` and regression test.
5. Injected dictionary 503 displays the collection error boundary instead of old
   content. Restoring transport plus Try again now fetches and renders the collection.
   Initial reset-only retry failed. After replacement, dev HTTP cache still served
   the old handler; inspecting its function and reloading this QA tab with cache
   disabled confirmed the final handler and successful recovery.
   `D09-content-error.yml`, `D09-proxy-events.json`.
6. Collection search finds the new effective translation (one of four words).
   Final light/dark screenshots were opened and inspected: aligned columns and
   visible badge/translation/actions. `D09-collection-light.png`,
   `D09-collection-dark.png`, `D09-final-collection.yml`. Dark theme selected via
   Settings; media emulation alone is not a saved theme preference.
7. Original primary learning fields match the pre-edit snapshot. All six personal
   rows across both synthetic owners retain word/owner/collection identity,
   tombstone, interval, repetition, ease and review dates. The adoption preserves
   the exact override object. No learning responses, reset or correction issued.
   `D09-before-adoption.json`, `D09-after-adoption.json`, `D09-final-state.json`.

Limits: this is local synthetic acceptance, not production, P2 native baseline or
cross-platform D12. Actual account switch was not repeated; existing account
remount tests passed. Image CAS/override and read-only restrictions have unit
coverage; provider-backed image search was not called. Final screenshots show
unknown after intentionally changing fixture meanings; initial UI snapshot and
badge tests establish estimated/reviewed display. No mobile queue was opened.

## Performance

Initial paired production-build benchmark passed 80 measured samples, 10 per cell,
500/2500 words, 501 events, cold/client navigation. Same source build, default-off
v1 versus enabled v2, randomized pairs, fresh Chromium contexts and loopback
fixtures. Median/p95 setup and Start regressions stayed below 10%; request counts
remain 5 cold / 4 client, exactly one v2 snapshot and no per-card dictionary call.
Initial output: `apps/web/output/performance/navigation/1790915054073-1x-dictionary/summary.json`.
Final-code 10/cell rerun retained medians but had isolated p95 outliers;
expanded 30/cell investigation passed. Review source is unchanged in
that expansion. The same retry fix was also applied to the two import-context
error routes (not loaded by the benchmark). A short final test/typecheck run
overlapped the first 500-word cold block; measurements retain all samples.
Final-code measurements are recorded below. Ten-sample p95 is coarse; these
measure client/navigation overhead and synthetic transport, not production SQL.
D01 outstanding device/queue and quota-evidence limitations are not waived.

## Cleanup and resumption

At 06:59 Europe/Amsterdam the named browser closed, verified runner 29856 and its
children exited, ports 55331/55400 closed, four exact containers exited. iOS
DDEDCE4E-153B-48A4-A47C-B4ED0F499F1F remains Shutdown; no process for Android AVD
woordenaar_d08_qa_20260921. Evidence: `reports/shared-dictionary-cefr/D09-resource-shutdown.json`.
Volumes, local fixture and source copy retained. The expanded benchmark finished with exit 0 and closed its own temporary servers,
fixture backend and browser in finally. No pending QA/build/test process remains.

Retained QA fixture has deliberately advanced: zolder v14 private, huis v3 private,
fiets v4 pinned to the synthetic D09 revision with image override v3. Native
cursors/queues were not advanced; next native use must reconcile server content,
not assume the D08 final snapshot is still the server head. Do not reset/reseed.

Automation `d09-06-00` was paused at the beginning of this one-time run. No further
wake-up scheduled. Model recommendation GPT-6.1 Sol / High; supported control for
changing this thread's own model/effort was unavailable, so no switch is claimed.
Weekly account-wide usage observed 31% at startup and 40% before closure, same reset
1791051321; concurrent work prevents attributing this delta solely to D09.

## Final performance decision

Expanded run: 240 measured samples, 30/cell, same review implementation,
`WEB_PERF_RUNS=30 node scripts/web-performance/run.mjs --dictionary`, exit 0.
Log: `reports/shared-dictionary-cefr/D09-expanded-browser-performance.log`.
Raw output: `apps/web/output/performance/navigation/1790917421349-1x-dictionary`.
Durable [summary](D09-performance-summary.json); [source hashes](D09-source-sha256.json).
No samples removed; warmups excluded by the harness before measurement.

| Words / navigation | Setup median v1/v2 ms | Setup p95 v1/v2 ms | Start median v1/v2 ms | Start p95 v1/v2 ms |
| ------------------ | --------------------- | ------------------ | --------------------- | ------------------ |
| 500 cold           | 552.3 / 558.0         | 578.3 / 580.4      | 29.5 / 29.4           | 31.3 / 32.1        |
| 500 client         | 403.6 / 403.9         | 412.6 / 411.2      | 27.0 / 27.6           | 30.8 / 30.5        |
| 2500 cold          | 544.4 / 545.0         | 577.0 / 580.2      | 64.4 / 62.4           | 71.7 / 71.0        |
| 2500 client        | 403.7 / 402.9         | 413.3 / 413.8      | 66.9 / 67.0           | 75.8 / 71.2        |

Every setup/Start/navigation-to-card median and p95 regression is below 10%;
maximum increase 2.6%. Request counts remain 5 cold / 4 client. The final-code
10/cell outliers did not sustain in the larger paired sample. D09.3 accepted
for local client integration; production/native/release gates remain separate.

All D09 checkpoints checked. Next explicit resume: D10.1, GPT-6.1 Sol / High.
Do not commit/push/PR or restart devices from this evidence alone. Runtime rollback
is to leave the default-off web flag disabled; no schema or data rollback performed.
