# D10 web acceptance — 2026-10-02

Result: scoped web acceptance PASS. D10.3–D10.5 remain open for the remaining
matrix. Source `19d98eb`, starting HEAD `0d9e835`, user-confirmed Astra / High.
[Repair re-review](D10-web-transfer-rereview-20261002.md) passes 54 tests in three
suites; [sanitized runtime summary](D10-web-acceptance-summary-20261002.json).
All 137 source fingerprints match; no application, SQL, flag or dependency edit.

## Runtime and preservation

Only retained `woordenaar-d08-qa.ZFsE50` db/auth/rest/kong containers were resumed.
Existing D09 runner copied current web source into a fresh isolated directory,
served 127.0.0.1:55400, and started task proxy 55331 → 55321. Its environment keeps
Sentry/telemetry off and dictionary reads enabled only in this existing QA setup.
The proxy stubs all provider functions; no hosted environment or provider was used.
No reset, reseed, migration, publication or shared-collection toggle occurred.

Dedicated headed Chromium session `d10-transfer-qa`; no other browser session or
native device was inspected or used. A full pre-write pg_dump and JSON snapshots
were saved before imports. Only the retained synthetic isolated owner's access was
temporarily changed full_access → read_only, then restored and verified. Its access
row timestamp advanced as expected. No other account access changed.

## Observed acceptance

1. Primary collection Prepare JSON export calls the real route successfully on
   loopback IP, despite Next request URL normalization. Schema-v1 output includes
   all four effective content documents, including private copies and the image
   override, with no personal IDs, owner, SRS or private revision dependency.
   Separate Copy JSON reports success. Source-owner preview disables all four
   duplicates and the submit button.
2. Sign out/sign in as the isolated read_only recipient; preview offers all four
   entries and only existing owned target collections. Select `fiets` alone.
3. One exact route interception uses real `route.fetch({ maxRetries: 0 })`, records
   HTTP 200/savedCount=1, then aborts that response. UI reports uncertainty and
   disables resubmission. Change the future target to My Words: the check link
   remains on the attempted Isolated Owner collection. Follow it; the saved word
   is visible. Database snapshot confirms exactly one new card, no replay.
4. Fresh preview detects that word in its original collection. Import the remaining
   three into My Words. UI reports three selected words saved. The earlier card
   remains in Isolated Owner; no duplicate is moved or adopted.
5. The four new content-state fallback documents exactly equal the export, all
   overrides are empty because their values were materialized into the copy, and
   dictionary entry/revision IDs are null. Recipient re-export of the three My
   Words cards matches all three documents exactly. Final original-document
   preview reports 0 available / 4 already added / 0 selected across both targets.
6. Bundled A1 Essentials v0.2.0 loads with an empty local official catalog. Read_only
   UI exposes only existing targets, detects two semantic duplicates, and imports
   exactly one selected `boek` through the private-copy fallback. UI reports one
   new word. No manifest or publication record was modified.
7. Full-row comparison: all 12 pre-existing words, nine content states and eight
   collections remain exactly equal to baseline. All four review/history tables
   also match (empty fixture tables; no nonempty-history claim). The five new cards
   have new personal IDs, interval=1, repetition=0, ease=2.5, no last review and no
   dictionary reference. Total words 12→17, content states 9→14, collections 8→8.

A screenshot of the recipient collection was opened and visually inspected: all
three translations match and the export controls render. Scope is desktop/light
Chromium, not mobile-web or theme acceptance. Browser warnings are dev asset
preload diagnostics; the one network error is the deliberate dropped response.

## Evidence, failed harness attempts and cleanup

Private root: `reports/shared-dictionary-cefr/d10-web-acceptance-20261002/`.
Contains `before.dump`, `baseline.json`, `after-lost-reply.json`, `after-imports.json`,
`after-bundled.json`, `final.json`, both exported JSON files, runner log, screenshot,
CLI helpers, selected snapshots and shutdown record. Additional snapshots remain
under the pre-existing untracked `.playwright-cli/`; do not commit private data.
Runner metadata remains in `reports/shared-dictionary-cefr/D09-local-runner.json`;
the preserved copy is `/var/folders/n_/jv_c0yvs743c84760xwjpvjw0000gn/T/woordenaar-d09-web-fEMSbl`.

First route-injection CLI call failed parsing because run-code requires an async
function; then a stale button ref required a fresh snapshot. Neither sent a write.
Initial snapshot helper guessed two nonexistent optional table names; baseline was
corrected to actual word_content_state and four review tables before any import.
Sandbox denied initial Docker inspection; authorized scoped escalation succeeded.
No unresolved error or uncertain mutation remains.

At **13:59:14 UTC**, named browser closed, runner exited 0, verified PIDs
10609/10626/10627 absent, ports 55331/55400 closed, four task containers exited.
Volumes and imported fixture data retained. Access levels restored. Devices were
not inspected; prior OFF evidence is not a current availability claim.

## Next checkpoint

Continue D10 on Astra / High. Do not repeat these web checks or completed native
upgrade/recovery checks. Native cross-client/cross-owner/mobile-web acceptance
requires the user to hand device availability back explicitly. The retained stack
has zero official packs/mappings/shared collections, so that runtime matrix still
needs a bounded local synthetic fixture strategy consistent with the publication
ban. Do not use production or publish existing user data to fill this gap. Existing
unit/SQL evidence remains valid but is not substituted for runtime acceptance.

Retain recipient's four document copies plus `boek`; primary mobile fixture is
unchanged. Before any later write, inspect current state rather than rerunning this
flow. D11 not started. Automation stays paused. AUTH-17/AUTH-18 permit local commits
only; no push/PR/merge, cutover, deployment or paid operation.
