# Review navigation execution log

## Current state

- Plan: `web-review-navigation-follow-up-2026-09-12.md`.
- Model preference: Astra / High. Notify the user before recommending a switch; consider XHigh for N05/N06 if needed. No switch is currently needed.
- Startup mode: handoff from the navigation plan. Guidance: root/web AGENTS.md, read-only .claude/CLAUDE.md and the navigation plan.
- Branch: `feature/web-review-navigation`, created from updated main at `3cfdebbd2ca5da91313b8926db7f466a47391002`.
- Existing untracked navigation plan was preserved. N01 changed no application code. N02's page-only scheduling candidate was tested and removed after a cold-entry regression; application source is unchanged.
- Runtime: Node v24.9.0, npm 11.6.0.
- N00 activation completed after user authorization. Both hosted migrations are applied and authenticated Review loads successfully.
- N01 laboratory work is complete: isolated production browser harness, 160 desktop samples, 60 CPU-throttled samples, and disposable SQL plans. See `web-review-navigation-n01-results-2026-09-12.md` for exact results and limitations. No quantitative production improvement is claimed.
- The current RPC path meets the provisional lab targets, but the user subsequently reported production tab navigation still exceeds two seconds while Start is fast. N02 was evaluated and rejected in its page-only form. N03 has no justified new index; live traces now justify testing function/database placement before N04–N07. See the N02 and production reports.
- Dedicated-account credentials are now configured. Under the user's earlier authorization, normal Starter Pack imports populated 2,105 words in 22 collections, with zero review events. Keep this dataset for repeat measurements. Fifteen live measurements reproduced slow setup and fast Start on production `3cfdebb`; exact Sentry traces confirm the snapshot path without new permissions.
- N03 candidate: `apps/web/vercel.json` pins this web project's next deployment to `fra1`. It is not a production deployment; preview verification and separate release authorization remain required. No application source, auth policy, database schema or organization setting changes are included.

## N00 evidence

### Served application

- GitHub PR #120 was merged at 2026-09-12 13:23:18 UTC.
- Production deployment 6410110691 reports success for merge commit `3cfdebbd2ca5da91313b8926db7f466a47391002`.
- A separate read-only browser tab on `https://woordenaar.app/app/settings` displayed environment `production`, branch `main`, build commit `3cfdebb` and Next.js 16.3.3.
- Its displayed host was `woordenaar-l4finaqri-rustems-projects.vercel.app`.
- The user's active Review session was not navigated away from or modified.

### Database and fallback

- Repository linkage and the release runbook agree on project `josxavjbcjbcjgulwcyy` (Dutch Learning App).
- `supabase migration list --linked` showed matching local/remote migration history through `20260911120000`; both performance migrations have empty remote entries.
- A read-only POST to `/rest/v1/rpc/get_web_review_snapshot_v1` with the configured public key, without a user session, returned HTTP 404 and code `PGRST202`. No user rows or credentials were printed. This checks RPC availability, not authenticated timing or data parity.
- The shipped repository handles `PGRST202` by calling `getLegacyReviewWorkspaceData`, which performs capability discovery and paged reads. The optimized RPC is not available on the checked backend; actual authenticated server request counts remain to be captured in N01.
- `supabase db push --linked --dry-run` identified exactly these pending files:
  1. `20260912100000_add_web_collection_overviews_rpc.sql`
  2. `20260912110000_add_web_review_snapshot_rpc.sql`
- No hosted migration was applied. The three-second delay has not yet been attributed quantitatively; missing RPC availability establishes a rollout gap, not a before/after latency result.

## Local migration validation

Command:

```sh
PATH=/opt/homebrew/opt/node@24/bin:/opt/homebrew/opt/postgresql@17/bin:$PATH node --test --test-concurrency=1 scripts/postgres-tests/web-collection-overviews.test.mjs scripts/postgres-tests/web-review-snapshot.test.mjs
```

Result: 4/4 tests passed against disposable local PostgreSQL clusters. Covers collection aggregates/empty collections, active-word snapshot mapping, effective corrected assessment, owner separation, invoker security and anonymous denial.

The initial sandbox run failed at `initdb` because shared memory creation was denied. The same command passed with escalation for local PostgreSQL. This was an environment failure, not a migration failure. Temporary test clusters were cleaned up by the harness.

These focused tests are not a substitute for N01's large-fixture browser/SQL measurements or all boundary/parity cases in the full plan.

## Concrete activation handoff

Target: existing personal Supabase project `josxavjbcjbcjgulwcyy` only. Application build already deployed: `3cfdebb`.

The two migrations add read-only SQL functions and adjust their EXECUTE grants. They are `STABLE`, `SECURITY INVOKER`, derive ownership from `auth.uid()` and retain RLS. They do not update vocabulary, learning progress, review events, auth settings or assessment triggers. Applying them is nevertheless a hosted schema change and needs the user's release authorization.

Reviewed SHA-256 values:

| File                                                  | SHA-256                                                            |
| ----------------------------------------------------- | ------------------------------------------------------------------ |
| `20260912100000_add_web_collection_overviews_rpc.sql` | `d086c1079a8d7fa6287e98bd510cd0c0da5405cebf00a10ba9c64a5740f8dd64` |
| `20260912110000_add_web_review_snapshot_rpc.sql`      | `ef9d7cdc140379ac8acd2e90d0f9e3ffcb4ce854054ebab4aae100f421267fb6` |

After authorization:

1. Verify linked project identity, file hashes, migration history and dry-run again. Stop if the target, reviewed files or pending set differ; do not apply unrelated migrations.
2. Apply exactly the verified pending set in the order above using `supabase db push --linked`.
3. Recheck migration history. Verify both RPCs resolve for an authenticated dedicated test account, remain denied anonymously, and return expected protocol/owned data. Do not benchmark by submitting learning results.
4. Verify fresh Collections and Review requests use the new path. Existing cached router content may need fresh navigation for validation. Do not interrupt the user's active review session.
5. Capture before/after read-only navigation measurements with equivalent conditions; run N01 for reproducible phase and request-count attribution. Report loader, usable setup and first-card timings independently.

Rollback: retain the additive read-only functions. If the new read path has a defect, prepare a reviewed code rollback/fix rather than dropping functions or rewriting migration history. The earlier web build does not depend on these functions; restoring it is a separate deployment action. Do not automatically roll back unrelated performance changes.

## Next action

PR #121 is open; CI for `2390b67` passed, including mutation tests. N02's 120-run experiment found faster client navigation but slower large-workspace direct entry, so the candidate stays removed. Keep Astra / High; no model switch is needed. Validate the N03 project-region candidate on the branch preview, then obtain release authorization before merging/promoting it. If preview protection blocks measurement, do not weaken protection or request organization access. Do not reapply migrations or repeat test-account imports.

## Live baseline and N03 candidate

- Production build remained `3cfdebb`, served by `woordenaar-l4finaqri-rustems-projects.vercel.app`. Dedicated-account measurements: five direct, five first-client and five repeat navigations. No assessments were submitted.
- Usable setup medians: 1,738 / 1,604 / 1,563 ms; Start-to-card: 74 / 82 / 65 ms. All 15 queues retained 2,105 words, with zero observed browser errors or long tasks. HTTP cache was disabled by the safety route guard; framework prefetch/cache remained enabled. These are not the user's working-account timings or a production p95.
- Correlated web trace `1b0f1e95749f40f0ae987620b24d4698`: server Review 937 ms, verified user 123 ms, access 119 ms, snapshot RPC 642 ms in sequential order. Exact trace/span lookups worked under existing permissions, superseding earlier generic-search limitations.
- All measured Review response headers indicated `fra1::iad1::`; linked project pooler is `aws-1-eu-central-1.pooler.supabase.com`. Direct authenticated RPC from this machine had median 305 ms across five reads. Different execution environments do not provide a causal region A/B or an exact promised saving.
- Added single-region `fra1` configuration at the documented Vercel project root, `apps/web`. No new index, SQL change, Start deferral, account-role change or organization mutation is justified or included.
- Full methodology, ranges, payloads, trace links, limitations, verification gates and rollback: `web-review-navigation-production-2026-09-12.md`.

## Production feedback after N01

- The user reports little or no noticeable improvement in navigation to the Review tab (still over two seconds), but opening the actual review session is now fast. These are separate boundaries; Start must not become the new waiting point.
- Whether repeated navigation has the same delay is not yet established. Do not treat the report as a cold-only or warm-only measurement.
- Read-only Sentry diagnostics did not produce a reliable live timing baseline. Initially, sourcing the web env file overwrote the populated root token with an empty value. Retrying with only root env files and an explicit web-project target succeeded: project `4512005023596544`, one unresolved production issue (`DUTCH-LEARNING-APP-WEB-8`, seven missing-Server-Action events, last seen 2026-09-12 01:16:17 UTC, before the current deployment). No link to the present navigation delay was established. The connected service's span search was scoped to a different project and its issue search rejected the web filter; empty span results are not evidence of missing web telemetry. No permission or organization configuration was changed.
- N02 tested the code-visible `identity -> access -> snapshot` dependency at a synthetic 200 ms/request delay. It saved approximately 201–208 ms on client navigation, but regressed large-workspace cold setup by approximately 64–88 ms and also regressed combined navigation-to-card. The candidate passed 26 focused tests, lint and typecheck, but was removed because it did not meet the performance gate. The source hashes, full ranges and attribution limits are in the N02 report.

## N00 activation result

The user replied "continue" to the concrete request to apply these two hosted migrations and recheck Review. This authorized the named migration application to the confirmed project.

- Revalidated project reference and both file SHA-256 values. They matched the reviewed values above.
- Repeated `supabase db push --linked --dry-run`: exactly the same two files, no unrelated pending migrations.
- `supabase db push --linked` applied both migrations successfully in order.
- `supabase migration list --linked` now lists both versions in the Remote column; local and remote histories match.
- Public-key requests without a user session now resolve both RPCs and return HTTP 401 / PostgreSQL `42501` (anonymous execution denied), replacing the previous missing-RPC `PGRST202` result for the snapshot.
- Fresh authenticated navigation on `woordenaar.app/app/review` rendered Review setup, modes/scopes, 832 due words and an enabled Start button. No assessment was submitted. Counts reflect current live state; they are not a fixed benchmark fixture.
- The deployed repository plus available RPC and successful fresh page render are consistent with the snapshot path being active. N01 must still capture server request counts explicitly.
- The browser connector's read-only evaluation scope did not expose the Performance API. Its automation-call duration and delayed accessibility snapshots were not used as page latency. Native browser inspection was also unsuitable for an isolated timing measurement. No exact before/after navigation result was produced.
- No application deployment, organization setting, learning-data mutation or account switch was performed. No rollback was needed.

## N01 implementation and findings

- Added `scripts/web-performance/` with an isolated Next production build, loopback-only fixture upstream, browser-clock readiness probe, per-run server request counts and a separate disposable PostgreSQL runner.
- No app source or auth/cache semantics changed. Build staging omits env files and credentials; only Sentry upload/build telemetry is disabled in the temporary config. Test-owned browser contexts never reuse production sessions.
- Fixture parity/guard tests passed 3/3 and are wired into the existing Quality web-fixtures job. Existing SQL RPC regressions passed 4/4. Web typecheck and new-script lint passed.
- Desktop full matrix passed 160/160. CPU ×4 core matrix passed 60/60, including same-document client transitions and complete selected session counts.
- For 5,000 words/5,000 events, desktop client setup median was 805 ms with legacy paging versus 397 ms with snapshot RPC, at a synthetic 40 ms upstream delay. Requests fell from 27 to 4. This is not a production before/after claim.
- At CPU ×4, snapshot client setup was 433 ms and Start-to-card 479 ms for 5,000 selected words. For 2,500 words, Start-to-card was 297 ms.
- Disposable PostgreSQL 15.14 snapshot execution median was 65.82 ms for 5,000 words/5,001 seeded events, with 500 corrections and a same-size second owner. Newest-5,000 cutoff/tie ordering and owner counts passed. Existing indexes served the scans; no migration was added.
- A read-only live timing trace is still unavailable. The user was asked asynchronously whether fresh production navigation remains slow; lab work continued without waiting for an answer.
- Initial harness-only problems were corrected: missing Jest setup in the staged copy, unfinished background prefetch between runs, exiting focus mode before repeat navigation, and batching synthetic SQL seed writes below the existing timeout. Those failed samples are excluded.
- Generated performance artifacts are ignored by Git and Prettier; sanitized findings are preserved in the N01 report. Full-source changes and release work remain separate decisions.
- Final local checks: mobile Jest 134 suites / 1,556 tests / 22 snapshots passed; web Jest 62 suites / 566 tests passed (opt-in CPU microbenchmark skipped); existing offline Playwright fixtures 3/3 passed; root/web lint, web typecheck, formatting and diff whitespace checks passed. Both completed browser runs used successful production builds.
