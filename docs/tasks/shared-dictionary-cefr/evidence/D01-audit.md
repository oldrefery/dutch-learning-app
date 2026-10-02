# D01 audit evidence

Started: 2026-09-12 17:38:40 UTC. Status: paused with evidence gaps.
Code: `e9628704d0b35c548b8fac324ac5f49510c4334f` on
`feature/web-review-navigation`. Locally known main: `c5dfb14`.

Scope: read-only source/environment inspection and local evidence documents.
No application implementation, migrations, backfills, publication or paid calls.
Existing untracked task documents preserved. No branch switch, commit or push.

## Checkpoints

- D01.1: complete; change-surface map below.
- D01.2: backend contracts and recent builds verified; installed population unknown.
- D01.3: scoped live census complete; global/provenance gaps remain.
- D01.4: complete; web plus 40 isolated native small/large online/offline samples.
- D01.5: session start/end recorded; whole-stage measurement incomplete.

## Quota observations

| Timestamp UTC       | Main weekly used | Window minutes | Reset epoch | Notes                                         |
| ------------------- | ---------------- | -------------- | ----------- | --------------------------------------------- |
| 2026-09-12 17:38:40 | 66%              | 10080          | 1789817169  | Account-wide; other tasks may also consume it |

End observation: **72% used**, 2026-09-12 17:52:22 UTC, window 10080 minutes,
reset epoch 1789817168 (one-second drift from the start observation).
Observed account-wide delta: **6 percentage points**. Concurrent account usage
cannot be excluded; values are rounded. This is not a calibrated full-stage or
full-project cost. No reset or purchase was requested. Keep D01.5 open until the
stage finishes and append subsequent observations.

## Resume intent

Resume at D01.2 without repeating the completed source inventory or web runs.
Close installed-client evidence and owner aggregate report gaps. Native D01.4
closed under AUTH-09; [native results/method](D01-native.md) and
[samples](D01-native-samples.json) supersede the original preparation gap below.

## Change-surface map (D01.1)

Paths below are repository-relative. This is a dependency inventory, not approval
of a particular normalized schema or an implementation review.

| Surface                                | Current owners / entry points                                                                                                                                           | Migration invariant                                                                                                                                                                      |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Analysis and reusable cache            | `supabase/functions/gemini-handler/{index,cacheUtils}.ts`, `supabase/functions/_shared/geminiPrompts.ts`                                                                | Auth/access gate and cache/provider fallback remain; cache is not a reviewed public dictionary. No `save-word` edge function exists in the current function inventory.                   |
| Mobile personal save/import/reanalysis | `apps/mobile/src/stores/actions/wordActions.ts`, `apps/mobile/src/db/wordRepository.ts`, `apps/mobile/src/lib/supabase.ts`                                              | New analysis becomes a personal content copy; preserve card identity, private content and SRS on reanalysis.                                                                             |
| Web save and batch capture             | `apps/web/src/features/analysis/{persistence-repository,word-persistence}.ts`, `features/batch-capture/actions.ts`                                                      | Direct owner-scoped `words` insert; both paths must adopt the same dictionary/private-overlay contract.                                                                                  |
| Personal mutations                     | Mobile word actions/repository; `apps/web/src/features/words/actions.ts`                                                                                                | Move, tombstone, image replacement and forced reanalysis must not mutate shared canonical content.                                                                                       |
| Word and collection readers            | Web `features/{words,collections,search,insights}/repository.ts`; mobile word repository/store                                                                          | Counts and search remain owner-scoped; avoid per-card remote dictionary reads.                                                                                                           |
| Review reads                           | Web `features/review/{repository,details-repository}.ts`, `20260912110000_add_web_review_snapshot_rpc.sql`; mobile local review selectors/store                         | Keep bulk snapshot and offline local reads; do not reintroduce navigation waterfalls.                                                                                                    |
| Reviews, reset, correction and history | `docs/learning-sync-protocol.md`, mobile `services/{syncManager,reviewCorrectionSync,reviewCorrectionResolution}.ts`, web history/review repositories and reset actions | Server-authoritative SRS; existing personal `word_id` remains the identity for events, resets and correction checkpoints.                                                                |
| Background synchronization             | `apps/mobile/src/services/syncManager.ts`, SQLite `initDB.ts`/`schema.ts`, metadata payload builders                                                                    | Preserve protocol-2 order, idempotency, durable pending commands, tombstones and owner isolation. Dictionary revision refresh needs a cursor independent of personal `words.updated_at`. |
| Official packs                         | `packages/content/src/manifest.ts`, mobile starter-pack/catalog services, web `features/starter-pack/`, official content SQL                                            | Pack CEFR exists; individual entries have no CEFR field. Immutable reviewed pack manifests must not expose private content.                                                              |
| Shared collection import               | Mobile `services/collectionSharingService.ts`, web `features/sharing/repository.ts`, `20260830101000_include_usage_notes_in_shared_import.sql`                          | Sharing is explicit collection authorization; import deduplicates personal semantic keys and preserves existing progress. It is not permission to publish all imported text globally.    |
| Collection/account deletion            | Mobile collection service; web collection actions; `supabase/functions/delete-account/handler.ts`                                                                       | Keep current tombstones/cascades; future shared dictionary must not be deleted with a personal account. Collection-delete compensation is not a general restore feature.                 |
| Export/restore/manual text editing     | Scoped filename and business-symbol searches of both clients found no general file backup/export/restore or full personal text editor                                   | Shared-link import, image change and reanalysis do exist. Do not silently add a new export/editor product in D10; confirm scope in D02.                                                  |

### Identity and compatibility findings

- `packages/domain/src/semantic-word.ts` uses normalized lemma/POS/article, not a
  sense identifier. Personal cloud/SQLite uniqueness follows this semantic key.
- Normalization is not identical everywhere: the JS helper trims and lowercases
  all fields, whereas current SQL uniqueness lowercases lemma and coalesces
  POS/article without the same trim/lower transformation. The owner SQL report
  intentionally labels SQL-key counts separately from the JS-key test census.
- `wordRepository.ts` can select an existing semantic match and update its
  `word_id` from incoming data; `syncManager.ts` also reconciles/skips semantic
  duplicates. This is a migration hotspot, not proof of an existing user bug.
  Multiple meanings require an explicit compatibility decision before changing
  uniqueness or linking personal cards.
- SQLite is schema version 12. Learning protocol 2 keeps immutable command IDs and
  durable sequence order; auxiliary `user_progress` is not the SRS source of truth.
- Pull collections/words/progress/events/corrections, push metadata/learning
  commands, then reconcile canonical state: preserve pending local learning through
  every dictionary refresh. Never acknowledge or discard old queues to simplify
  the migration.
- Current analysis prompts/types do not request or persist per-word CEFR.
  Existing analysis confidence is not CEFR confidence. New CEFR needs provenance,
  version, uncertainty and a way to refresh clients when only shared data changes.

## Native/backend matrix (D01.2, partial)

Read-only EAS inspection on 2026-09-12, after verifying identity and project owner
both equal `oldrefery`. Project: `d968536e-1e9b-4224-9ed7-a1e9c6d821c8`.

| Evidence                               | Verified state                                                                                                                  | Not established                                                      |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Latest iOS and Android EAS builds      | Both FINISHED, production profile/channel, STORE distribution, 2.3.1 (84), source `16b7015`, created 2026-09-11                 | Store availability, installed adoption and minimum supported version |
| Previous builds in six-row result      | Both platforms 2.3.0 (83), `48409d0`; 2.2.1 (82), `4f0bec9`                                                                     | Whether these or older builds still have pending offline queues      |
| Local app configuration                | 2.3.1 (84), owner `oldrefery`, fingerprint runtime                                                                              | Configuration alone cannot establish release state                   |
| Authenticated production protocol RPCs | `learning_sync_protocol = 2`, `review_correction_protocol = 1`, both HTTP 200                                                   | Whole installed-client population compatibility                      |
| Legacy protocol documentation          | Pre-cutover review handling and legacy snapshot-reset limitations documented; no global minimum-version enforcement established | Safe retirement of legacy clients                                    |

User was asked for installed version/build and other users on older versions.
No answer at this checkpoint. Keep legacy support conservative until confirmed.
No EAS build, submission, update, account switch or credential change was made.
Follow-up Sentry sample on 2026-09-12 observed production release/build identifiers
2.3.0 (83) and 2.2.1 (82) in three events from September 6; see
[observed-client evidence](D01-observed-clients.md). This is not installed
population coverage or a minimum-version decision. D01.2 remains partial.

Read-only simulator package inspection found iOS **1.13.0 (78)**, not current
2.3.1 (84). The Android package lookup returned no version fields (exit 1 after
filtering); this is not enough evidence to assert installation or its absence.
Neither app was launched or modified. A current isolated QA release environment
is needed before credible native startup baselines; do not overwrite these apps.

Public App Store / Play listing reads could not be verified: the web tool rejected
both URLs as non-retryable. No alternate route was used. Build inventory remains
the verified evidence; store publication is unknown.

## Live aggregate census (D01.3, partial)

Captured 2026-09-12T17:41:57Z. Scope: dedicated test account and its
authenticated-readable cache/catalog, not a global personal-card census. Read
requests used the normal account with no service-role/database-admin credential.
Credential preflight rejected primary-account aliases. Output contained no word
text, personal IDs, emails, tokens or private response bodies.

| Measure                                                    |             Value |
| ---------------------------------------------------------- | ----------------: |
| Active test words / unique current semantic keys           |     2,105 / 2,105 |
| Test collections / review events / auxiliary progress rows |       22 / 14 / 0 |
| Test expressions                                           |               396 |
| Readable cache rows / unique current semantic keys         |     2,846 / 2,846 |
| Cache version 1 / version 2                                |        2,814 / 32 |
| Cache rows eligible under current version/age rules        |                32 |
| Test words matching any cache semantic key                 |             1,924 |
| Test words matching an eligible cache key                  |                13 |
| Test words matching cache translations exactly             |             1,256 |
| Test words with multiple cache rows for the same key       |                 0 |
| Test words without any cache key                           |               181 |
| Published packs                                            |                21 |
| Pack levels A1 / A2 / B1 / B2 / C1                         | 1 / 5 / 9 / 5 / 1 |

Interpretation: matching keys or translations do not prove equal meanings or
public provenance. Zero duplicate cache keys does not prove zero polysemy; current
uniqueness can hide it. Cache age/version eligibility is operational freshness,
not a quality label. Version-1 content must not be silently reclassified as
version-2 validated content.

`cefr_level` column probes on `words` and `word_analysis_cache` returned HTTP 400;
the client provided no error code. Source schema/type inspection also finds no
per-word CEFR column, but the HTTP status alone is not authoritative schema proof.
Pack-level CEFR cannot be counted as verified individual-word CEFR coverage.

Outstanding census needs: privileged aggregate schema/count report across owners,
candidate conflicts, and provenance categories. No service-role/DB password was
configured in the inspected local environment files. Do not request organization
access or export personal vocabulary to work around RLS. An owner-run aggregate
SQL report is an acceptable next route; ambiguous/private provenance still needs
an explicit D02 classification rule, not guessing from lexical similarity.

Prepared [owner aggregate SQL](D01-owner-census.sql), SELECT-only in a read-only
transaction with statement/lock timeouts. It has not run against production and
does not provide missing counts yet. No database connector is available in the
current tool inventory. Run using existing access to this project only; return
aggregate outputs, not credentials or private rows.

Local validation passed on 2026-09-12:
`node docs/tasks/shared-dictionary-cefr/evidence/D01-owner-census.test.mjs`,
Node 24.9.0, disposable PostgreSQL migration harness. Twelve assertions cover
two synthetic owners, three cards, a missing cache match, translation disagreement,
unknown provenance/CEFR, unchanged card count and no identifiers in output. The
exact report ran against current local migrations; production execution remains
**not performed**. The disposable cluster was closed and cleaned up by its harness.

## Risk register

| Risk                                                 | Severity | Required gate                                                                 |
| ---------------------------------------------------- | -------- | ----------------------------------------------------------------------------- |
| Collapse different senses under lemma/POS/article    | Critical | D02 sense/identity policy; conservative unresolved/private fallback           |
| Replace personal IDs or lose pending learning        | Critical | D03–D08 preserved-ID, offline queue, reset/correction and retry tests         |
| Publish personal examples/media through shared cache | Critical | Provenance policy, private overlays, RLS and explicit publication gate        |
| Break older installed native clients                 | High     | Supported-build evidence and additive compatibility window; D14 adoption gate |
| Treat stale cache as approved dictionary/CEFR        | High     | Source/version/confidence fields; backfill dry run, no blind merges           |
| Miss shared-only updates on mobile                   | High     | Independent dictionary revision cursor and offline fallback                   |
| Regress Review navigation with joins/N+1             | High     | Bulk APIs, small/large web and native before/after baselines                  |
| Add unsupported export/editor scope accidentally     | Medium   | D02 scope confirmation; preserve existing workflows only                      |

## Performance measurement status (D01.4)

Fresh production large-account run completed with the existing guarded browser
probe, in a fresh dedicated-account context, no assessments or seed/import.
Target build is asserted as `c5dfb14` and Frankfurt application responses checked.
Raw temporary output: `/private/tmp/dictionary-audit-YaH1Pm/web-large-results.json`.
Captured 2026-09-12T17:44:28Z, Chromium 149.0.7827.55, desktop 1440x1000,
unthrottled network/CPU. 2,105 total words, 2,094 selected due words. Five samples
per scenario, 15 total; zero page errors, zero long tasks, zero attempted learning
writes. All application responses passed the Frankfurt assertion.

| Navigation               | Setup median [min, max] ms | Start-to-card median [min, max] ms |
| ------------------------ | -------------------------- | ---------------------------------- |
| Fresh direct entry       | 735.2 [624.1, 1122.3]      | 72.7 [67.7, 76.4]                  |
| First client navigation  | 687.7 [554.0, 896.3]       | 72.7 [70.2, 76.2]                  |
| Repeat client navigation | 496.8 [437.3, 547.2]       | 64.2 [56.2, 66.9]                  |

These are before-dictionary-change baselines, not an optimization delivered in
D01. Initial preparation is excluded; direct entry is not a hosting cold-start
test. HTTP interception disables HTTP cache; router prefetch/cache stay enabled.
Readiness verification includes interaction frames. Five samples do not establish
production p95. No raw cookie storage, trace, HAR, screenshots or account content
was saved. The durable table is sufficient for resume without temporary files.
Sanitized per-run samples: [D01-web-production.json](D01-web-production.json).

### Fresh synthetic web baseline

Command: `node scripts/web-performance/run.mjs` (Node 24.9.0).
Completed successfully on 2026-09-12 at `e962870`. Four datasets, four navigation
modes, five alternating legacy/snapshot pairs = **160 samples**, plus excluded
warmups. Zero page/backend errors and no non-fixture browser origins, enforced by
the harness. Isolated real production build; no application env or credentials.
Fixture upstream delay 40 ms per request, CPU 1x, Apple M1 Pro, macOS arm64,
Chromium 149.0.7827.55. No CPU-heavy SQL/build checks overlapped browser timings;
lightweight documentation operations did occur.

| Words / events / selected | Snapshot client setup median ms | Start-to-card median ms |
| ------------------------- | ------------------------------: | ----------------------: |
| 500 / 0 / 500             |                           396.4 |                    26.9 |
| 2,500 / 501 / 2,500       |                           396.7 |                    65.6 |
| 5,000 / 5,000 / 5,000     |                           396.8 |                   109.8 |
| 5,000 / 5,000 / 20        |                           396.9 |                    20.7 |

Full medians/ranges, legacy comparisons and measurement caveats:
[D01-web-synthetic.json](D01-web-synthetic.json). Synthetic loopback is not
production network/auth/SQL latency. The larger fixture is a scale stressor, not
evidence of production growth. Do not compare these absolute times directly with
the live-account measurements.

Ignored raw logs/samples: `apps/web/output/performance/navigation/1789235156324-1x/`.
The harness closed its browser/backend/server and removed its disposable source.
Durable evidence is sufficient to resume without ignored/temp files.

Native device inventory found a booted iPhone 16 Pro (iOS 26.5) and Android
emulator. No application was launched, reset, reinstalled or measured. Existing
simulators are not assumed to be disposable test accounts. No reusable native
small/large startup performance harness was located in the scoped script search.
This was an open baseline gap in the first session. It was subsequently closed
using newly created QA devices under AUTH-09; existing devices stayed untouched.

### Original native measurement work (subsequently completed under AUTH-09)

1. Confirm the user's installed version/build and known old-client users. Pending
   offline queues must stay protected regardless of observed build popularity.
2. Approve/use separate disposable iOS and Android QA devices. Current QA config
   disables OTA and Sentry but retains the production bundle/package IDs, so do
   not install over an existing app. Inspect `apps/mobile/app.config.js` again
   before any build; do not reuse a production profile with QA enabled.
3. Prepare isolated synthetic fixtures (500 and 2,500 words), same schema/content
   shape and deterministic due dates, no real account data or paid analysis. Add
   an offline-capable test harness if needed, confined to the QA environment.
4. Measure process-cold launch to usable collection/review and already-synced
   offline launch, five samples per device/scenario after excluded preparation.
   Record device/OS, build/runtime, word/event counts, timing boundary, raw
   samples, errors and pending-queue preservation. Never equate development Metro
   timings or an old installed binary with a current release baseline.
5. Existing `apps/mobile/.maestro/` flows are functional tests, not a reusable
   small/large startup baseline. `scripts/run-mobile-e2e.sh` loads account env and
   some flows create/delete learning data; it was inspected but not executed.

The existing user app was not launched, reset, upgraded, logged out or synced.
