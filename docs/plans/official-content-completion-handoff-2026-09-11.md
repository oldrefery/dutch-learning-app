# Official vocabulary packs: detailed completion and handoff plan

Updated: 2026-09-11. Verified implementation baseline: `ee06c37` plus completed A1 changes.
Working branch: `feature/vocabulary-organization`.
Status: client/catalog implementation and draft export exist; production release
and personal collection reorganization have NOT happened.

## 1. How to use this plan

Read this file first when continuing in another session or with another model.
Execute the numbered work packages in order. Each package names the relevant
files, expected result, meaningful verification, and suggested commit message.
Do not restart the completed vocabulary classification or rebuild the catalog
architecture. Inspect the current branch before assuming the baseline is unchanged.

Keep the checklist in section 12 current. At each stopping point, record the last
completed package, exact checks, artifact paths/hashes, and the next concrete step.
Report to the user in Russian; code, documentation, commands, and commits stay English.

This is a work plan, not permission to publish, deploy, push, or modify the personal
profile. Continue all authorized local work before requesting the remaining release
authorization. Never claim an editorial review or end-to-end check was performed
when only schema validation or mocked tests ran.

## 2. Accepted product decisions and authority

- Deliver the official catalog in BOTH web and mobile. A user selects a pack,
  previews its words, and imports into a new or existing owned collection.
- Store new packs centrally. Fetch one selected version on demand. Updating the
  catalog/content must not require another application release after clients ship.
- Keep Dutch A1 Essentials as the existing bundled offline fallback. Do not remove
  or silently replace it. The new A1 pack is a separate set.
- Mobile caches verified downloads for offline reuse. Web currently fetches through
  its server; persistent offline web import is not implemented or promised.
- Imported cards are user-owned copies. A catalog update must not silently rewrite
  existing cards or reset their learning progress.
- Public catalog reads may be anonymous; importing requires the application's
  existing authenticated access rules. Do not broaden read-only account permissions.
- The personal grouping proposal has 21 unshared targets, ordered first by CEFR,
  then frequency within each level, with approximately 100 cards per group.
- Preserve all cards in `Spreekwoorden en uitdrukkingen` and expressions elsewhere.
- Exclude exactly these six words from the prepared sets: `rukken`, `piemel`,
  `klit`, `mongool`, `swaffelen`, `hottentot`. Other reviewed sensitive candidates
  were explicitly allowed. Preserve excluded personal cards in their original locations.
- Read-only inspection of the `oldrefery` app profile is authorized for this task.
  Testing against that account is prohibited. Use synthetic/local data or an
  explicitly allowed test account such as `curysef@gmail.com`.
- Commits are authorized in `feature/vocabulary-organization`. Stay in this branch.
  Push, PR, deployment, and production catalog/profile writes require separate
  explicit permission unless the user grants it later.
- The Expo project owner and active identity must both be `oldrefery` before remote
  EAS operations. This is separate from the prohibition on testing the personal
  application account. Never use the work Expo account `guardia`.
- Do not commit private snapshots, complete vocabulary exports, per-card decisions,
  credentials, or backups. `reports/` is intentionally ignored.

## 3. Startup and verified implementation

Run from the repository root:

```bash
git status --short --branch
git log -7 --oneline
cat .nvmrc
```

Use the version in `.nvmrc` (baseline `24.20.0`) for the shell and all child
processes. With the current local installation:

```bash
export PATH=/Users/devrush/.nvm/versions/node/v24.20.0/bin:$PATH
node --version
npm --version
```

Calling the absolute npm executable alone does not ensure npm scripts use that
Node version. Avoid Jest watch mode for verification. Read applicable `AGENTS.md`
and `.claude/CLAUDE.md` (read-only). Fetch current library/service documentation via
Context7 when changing their APIs, as required by repository instructions.

Completed commits:

| Commit    | Delivered                                                                 |
| --------- | ------------------------------------------------------------------------- |
| `bbf345f` | Remote catalog schema, immutable versions, RLS, initial local DB tests    |
| `d375982` | Shared official manifest validation                                       |
| `3841fbb` | SHA-256 verification, web repository, mobile cache/service                |
| `138898e` | Mobile catalog screen and remote pack navigation/import loading           |
| `ee06c37` | Draft generation, approval/publication tooling, entry counts, trusted RPC |
| `16eac17` | Consistent pack version promotion, rollback, and immutable state changes  |
| `010e5d5` | Web pack navigation reset and recoverable catalog/pack errors             |
| `5ea1072` | Mobile requested identity, cache integrity, and route lifecycle handling  |

Key files:

- Contract: `packages/content/src/manifest.ts`, `packages/content/src/remote.ts`.
- Database: `supabase/migrations/20260911120000_add_official_content_catalog.sql`.
- Temporary type overlay: `packages/supabase-contracts/src/database.ts`.
- Web: `apps/web/src/app/app/starter-pack/page.tsx` and
  `apps/web/src/features/starter-pack/{StarterPackImport.tsx,actions.ts,official-content-repository.ts,starter-pack-domain.ts}`.
- Mobile: `apps/mobile/src/components/OfficialContentCatalogScreen.tsx`,
  `apps/mobile/src/services/officialContentCatalogService.ts`,
  `apps/mobile/src/services/starterPackService.ts`,
  `apps/mobile/src/hooks/useStarterPackImport.ts`,
  `apps/mobile/src/types/StarterPackTypes.ts`, and the `/official-content` and
  `/starter-pack` routes.
- Tooling: `scripts/official-content/{build,approve,publish}-vocabulary-packs.mjs`.
- DB tests: `scripts/postgres-tests/official-content-catalog.test.mjs`.

Baseline verification: mobile 131 suites / 1529 tests; web 55 suites / 533 tests;
exporter 4 tests; catalog DB 8 tests. Full DB suite passed 109 tests before the last
RPC addition; the updated catalog file passed separately afterward. Typechecks,
ESLint, and web production build passed. These results do NOT establish native UI
or production import correctness, and the findings below require additional tests.

## 4. Private inputs and exact counts

All paths in this section are relative to `reports/vocabulary-organization/`.
These files exist only in the current checkout; a fresh clone will not contain them.
If an input is unavailable, report precisely which one is missing. Do not substitute
an old proposal or silently rebuild decisions from incomplete evidence.

| Input                                           | SHA-256                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------ |
| `snapshot-2026-09-07.csv`                       | `11296b11ec1c6b3b932d137f884c0315c072fb7fce409c6c086eeac717ba0583` |
| `classification-proposal-final-2026-09-07.json` | `917352b3cf30dabc9818e6607727569102b8293988830749ec4eeaaf1c3eb42f` |
| `collection-plan-proposal-003-2026-09-11.json`  | `1f1b5a14735aecd3d63ca7da293dddeebf86259accc632977d3863c76f895123` |
| `public-pack-content-decisions-2026-09-11.json` | `46de39a0b1a957fcafa54d684ab27c0b4851ad7a57dc4192873f6e01f9c40c98` |

The snapshot is one CSV column named `snapshot`, whose single quoted cell contains
JSON. It is an ANALYSIS snapshot, not a recovery backup: SRS, review history,
media, and some linguistic fields are absent.

- Original cards: 2287.
- Mapped personal cards: 2059.
- Retained exclusions: 228 = 69 protected + 153 other expressions + 6 owner exclusions.
- Current immutable drafts: `official-content-drafts-v3-2026-09-11/index.json`
  and 21 manifests. Aggregate SHA-256:
  `964bc2aa394509c729fabadc1a6d91f11cd5fbbcacb3a7f8d1a3eb7c9e1725f2`.
  Earlier v1/v2 directories are superseded pending drafts and are not release inputs.
- A1: 1 × 122; A2: 5 × 100; B1: 4 × 99 + 5 × 98;
  B2: 4 × 101 + 1 × 100; C1: 1 × 47; no C2.
- Frequency evidence for mapped cards: 1850 observed, 45 ordering proxies,
  164 missing. Missing stays explicit. Frequency does not determine CEFR.

Classification reviewed meanings and grouping. It did not approve every original
example and analysis note for public distribution. Some cards have multiple senses
or spelling concerns. Public semantic deduplication may reduce the 2059 public
entry count; it must not remove or merge personal cards. Reconcile any changed
public counts explicitly rather than forcing the private mapping's count.

## 5. Work package A: fix catalog/client correctness before release

### A1. Publishing a version with a different size

Code inspection finding: `publish_official_content_pack` updates `entry_count`
during the catalog upsert while `current_version` still points at the old version.
The count-validation trigger compares the new count with the old manifest, so a
size-changing upgrade will fail. Existing tests cover same-size publication only.

1. Add a failing local DB regression: publish v1 with one entry, then v2 with two.
2. Lock/serialize per-pack publication; create the manifest version before changing
   its pointer and count together. Preserve integrity and immutable version checks.
3. Ensure a same-version retry does not rewrite published timestamps or mutable
   metadata unnecessarily. A different payload for an existing version must fail
   and roll back all catalog changes.
4. Test concurrent competing publication, interruption/retry, and rollback from
   v2/two entries to v1/one entry. Rollback must update count and visible metadata
   consistently with the selected manifest.
5. Check `p_reviewed_at` matches the manifest review timestamp and publication
   rejects null/malformed approval metadata. Document that the trusted publisher
   verifies canonical SHA; the current SQL function does not compute that hash.
6. Check the immutability trigger cannot demote published/retired content to draft
   and then permit mutation. Add a transition regression and constrain the states.

Done when all transitions above pass against isolated PostgreSQL and client-role
write/execute rejection still passes. Suggested commit:
`fix(content): make pack version promotion consistent`.

### A2. Web pack selection and request errors

Code inspection finding: `StarterPackImport` initializes selected IDs and action
state only on mount. The page does not key it by pack/version, so client navigation
between packs can preserve state from the previous pack.

1. Add a regression that switches packs after changing selections and after import
   success. Use a route/component integration test that exercises state preservation.
2. Reset the import form by pack ID/version, usually with a React key at the page
   boundary. Preserve ordinary selection behavior within one pack.
3. Handle unknown `?pack=` explicitly: currently it silently shows bundled A1.
   Show an unavailable state with a catalog/back link.
4. An unavailable remote catalog must leave Essentials usable. The repository only
   falls back for missing-table errors today; add a recoverable page-level state for
   ordinary catalog network failures without hiding unrelated auth/database failures.
5. Check narrow screens with all 21 catalog entries. Avoid repeated labels such as
   `A2 · Dutch A2 ...`; use existing web design tokens.

Done when users cannot submit stale IDs for a newly selected pack, and unavailable
content has a recovery path. Suggested commit:
`fix(web): reset official pack selection on navigation`.

### A3. Mobile identity, state, and cache

Code inspection finding: `getPack(requestedId, requestedVersion)` validates the
returned row against its own manifest, but does not compare the row to the requested
ID/version before caching it under that request's key.

1. Test a valid, correctly hashed pack B returned for a pack A request; reject it.
   Perform the same requested-identity check for cache reads and the web repository.
2. Exercise rapid A → B route changes, incomplete route parameters, a failed
   download, leaving the screen mid-request, and opening another pack after success.
   Verify loading, selected words, success state, and target collection belong to
   the current pack; cancel/ignore stale requests.
3. Add a usable retry after a download error. Keep bundled Essentials accessible
   with no network and no cache.
4. Test catalog/pack cache corruption, quota/write failures, and offline reopening.
   Failed verification must never overwrite good cached content.
5. Verify the new required catalog `entry_count` field handles old cached metadata
   intentionally (invalidate/bump cache version or reject and refresh safely).

Done when request identity is enforced and navigation/error states behave correctly.
Suggested commit: `fix(mobile): validate requested official pack identity`.

## 6. Work package B: make release artifacts trustworthy and repeatable

Relevant files: all `scripts/official-content/*.mjs`, shared validator, and their tests.

1. Verify snapshot bytes against the locked snapshot hash, not just the plan hash.
   Check owner identity locally, unique source IDs, per-card evidence hashes, complete
   mappings, target keys, exclusions, and exact counts before writing artifacts.
2. Keep a field allowlist for export. The shared validator currently rejects selected
   forbidden entry keys but returns the original object and permits unknown fields.
   Validate/strip unknown fields at every relevant nesting level so ownership,
   arbitrary notes, media URLs, or progress cannot leak through an added property.
3. Replace the generic `derivePrefix` fallback based on free-text notes with validated
   lexical data or reviewed overrides. Known record `toerekennen` has root `rekenen`
   and examples using `toerekenen`; adding `toe` alone preserves the spelling issue.
   Correct the public copy through an explicit override after review. Keep the
   original personal card untouched.
4. Inspect source-field completeness: the analysis export omits irregularity,
   conjugations, plural, and other fields. Do not silently describe irregular verbs
   as regular because import defaults absent flags to false. Retrieve authorized
   read-only linguistic data or record reviewed public values where necessary.
5. Decide preservation of the nine non-null `usage_notes` objects. Public copies
   need explicit review and a supported shared contract/import path before inclusion.
   Log omitted fields; do not accidentally present omission as complete copying.
6. Use an actual semantic uniqueness calculation for provenance. The current
   `source_unique_semantic_count` is simply the mapping count. Reconcile with
   `packages/domain/src/semantic-word.ts` and DB import uniqueness rules.
7. Ensure stable public entry IDs survive translation/example corrections. Current
   IDs hash translations, so an edit changes identity. Persist a private source-to-
   public-ID ledger, or another reviewed stable scheme without exposing source UUIDs.
8. Make draft rebuilds deterministic and non-destructive to existing reviewed work.
   Prepare/validate the entire output before final writes; never overwrite an approved
   release. Reject malformed args, duplicated/missing index entries and file paths
   escaping the release directory.
9. Approval currently validates schema but not recorded draft file/content hashes.
   Verify them before approval and bind approval to the exact aggregate release hash.
   Approval must consume a completed review ledger; a reviewer string alone is not
   evidence of reviewing every card.
10. Validate all files before creating an approved output directory or use a temporary
    sibling and final rename; failed approval must not leave a half-approved release.
11. Publisher dry-run must check all IDs, hashes, counts, review records, version
    consistency and exclusions. Require HTTPS for the explicit Supabase target,
    set a finite request timeout and report completed/failed pack IDs for resumption.
    Preserve per-pack atomicity; do not claim the entire 21-pack release is atomic.
12. Add meaningful synthetic CLI tests: stale snapshot, tampered draft, pending review,
    incomplete/duplicate index, bad paths, wrong target, partial failure/resume, and
    two builds producing identical bytes. Include this suite in an existing suitable
    CI quality job; inspect the workflow first.

Suggested commits, split by coherent changes:
`fix(content): bind pack releases to verified inputs` and
`test(content): cover release validation and retries`.

## 7. Work package C: complete the public editorial review

Do not reclassify all personal words from scratch. Use the saved classification,
quality notes, and meaning-aware review artifacts in the existing handoff.

1. Produce a PRIVATE review inventory per draft entry: pack, stable public ID,
   source hash, lemma/POS/article, translations, every example, grammatical fields,
   notes, CEFR, known concerns, and exact import semantic key.
2. Group by pack (47–122 entries), then review in batches of about 20–30 full cards.
   Save each completed batch immediately in ignored reports. Large output truncation
   means content was not reviewed; request/read the omitted records before marking done.
3. Per card inspect spelling, grammatical gender, verb properties, translations in
   each supplied language, all examples, register, inappropriate content, and whether
   examples/notes introduce meanings inconsistent with the selected sense/level.
4. Classify review decisions as `approved`, `override`, or `needs-review`. Record
   content hash and explanation for every override. Prioritize the previously held
   88 cards, known spelling cases, multiple-sense duplicates, and 1400 analysis notes.
5. Use authoritative Dutch references when uncertain; do not infer an answer solely
   from frequency. Do not upload the full private library to another service.
6. Find collisions using the ACTUAL import key (lemma/POS/article), within and across
   packs and against Essentials. Two different translation arrays are not proof that
   both will import as separate cards. Preserve senses in reviewed public entries or
   document the chosen resolution. Do not merge or delete personal records.
7. Scan all public fields for the six excluded lemmas, including examples and notes.
   Avoid substring false positives; review flagged occurrences. Preserve the user's
   permission for other reviewed sensitive vocabulary.
8. Preserve corpus/source attribution in release provenance. Existing source notes
   record CC BY-NC-SA 4.0 restrictions. Do not assume omission of corpus files alone
   establishes redistribution rights for derived data or apply a contradictory new
   license. Identify what is actually distributed and resolve concrete uncertainty
   before public release; do not invent licensing conclusions.
9. Rebuild with approved overrides, preserving ordering intent. Report final public
   counts and differences from the 2059 personal mapping. The first release may
   contain fewer semantic entries; never hide that by retaining unimportable duplicates.
10. Reconcile every public entry against the review ledger: no missing, duplicated,
    stale-hash, or unresolved decisions. Only then run the approval command with real
    review metadata. Save aggregate release hash and per-file canonical SHA-256.

Done when the approved release is fully reviewable, reproducible, and the approval
claims are supported by saved records. Keep all per-card artifacts ignored. Commit
only generic tooling and aggregate documentation:
`docs(content): record reviewed official pack release`.

## 8. Work package D: prove imports on both clients

Use isolated database fixtures and disposable test accounts only. Unit tests alone
are insufficient for this delivery. If remote fixture setup needs new deployment
authorization, complete local equivalents and clearly mark the remote check pending.

| Scenario                        | Required result                                                             |
| ------------------------------- | --------------------------------------------------------------------------- |
| Fresh full-access account       | Catalog visible; selected pack creates one owned collection and fresh cards |
| Existing owned collection       | Selected words added there; other collections untouched                     |
| Existing word/progress          | Duplicate skipped; existing content, ID and SRS unchanged                   |
| Two entries with one import key | No silent sense loss, duplicate error or incorrect success count            |
| Essentials overlap              | Preview and actual import agree on skipped entries                          |
| Empty selection/all duplicates  | No empty collection created                                                 |
| Double submit/retry             | No duplicate cards or extra empty collections                               |
| Import error/partial completion | Honest result; retry safe; no deletion of successful unrelated data         |
| Pack update after preview       | Import uses the previewed immutable version, or asks to reload              |
| Missing/retired/tampered pack   | Clear unavailable state; no incorrect import                                |
| Mobile offline cached pack      | Preview/import succeeds locally and synchronizes when online                |
| Mobile offline uncached pack    | Clear error; Essentials usable                                              |
| Account switch                  | Personal import state resets; cached public content may remain              |
| Read-only account               | Existing app access restrictions preserved in UI and backend                |
| Light/dark, small screen        | Catalog, loading/error and preview are readable and usable                  |

Inspect existing import RPC/SQLite duplicate and transaction semantics before adding
another import implementation. Web currently cleans up a newly created collection
after RPC failure; verify this cannot erase successful data after an ambiguous network
response. Mobile creates a collection before import; verify retries and partial writes.

Use the smallest representative packs for UI flows plus one full-size 122-entry pack.
Verify the public manifests are not bundled in either platform's output. Record what
was run on a real browser, simulator, isolated DB or mocks. Clean up only test data
created for this task. Suggested commit: `test(content): verify cross-platform pack imports`.

## 9. Work package E: stage the concrete production release

Complete A–D before presenting a release approval request.

1. Run scoped checks from section 11, then required repository checks.
2. Update docs with final counts, release hash, review completion, client commits,
   migration name and rollback commands verified locally. State remaining limitations.
3. Determine whether the migration has ever been applied remotely using read-only
   checks. Baseline says it has not. If already applied, create a forward migration
   instead of rewriting historical SQL.
4. Prepare the exact deployment order: schema/RPC first, verified catalog payloads,
   web deployment, mobile-compatible OTA or native release as indicated by actual
   runtime compatibility. Existing clients keep Essentials while new clients gain
   the catalog. Do not run store submissions unless separately authorized.
5. Produce a concrete permission request only for outstanding external actions:
   push/PR if needed, apply named migration, publish exact approved release, deploy
   clients. Explain that the requirement comes from the user's existing explicit
   permission boundary. Do not ask again if the user already authorized those actions.
6. After authorization, check target identities, apply, publish, and verify catalog
   visibility as anon and authenticated and payload hashes from the remote endpoint.
   Run a disposable test-account import on both released clients.
7. Regenerate database types using the repository procedure; remove only the now-
   redundant official-table/RPC overlay. Preserve unrelated nullable review-RPC fixes.
8. For an interrupted publication, inspect which exact immutable versions exist,
   verify their hashes, and resume. For rollback, restore each prior pointer, count,
   and version-specific metadata. Do not delete published versions or imported cards.

Done when the same released official packs are discoverable/importable in web and
mobile, with exact publication and test evidence recorded.

## 10. Original personal reorganization remains a separate deliverable

The public catalog does not reorganize `oldrefery`'s library or persist personal
CEFR metadata. Track this original objective; do not call it complete after shipping
public packs. Follow `docs/plans/vocabulary-organization-2026-09-07.md`.

After the public-release work, prepare local/synthetic implementation of:

1. A classification metadata contract independent of SRS knowledge levels, with
   source hashes, method/version, confidence, overrides, observed/proxy/missing
   frequency, and user ownership. Confirm whether an additive side table can avoid
   changes to existing word synchronization. Do not alter SRS algorithms.
2. A concrete apply plan keyed by existing word IDs, original membership, stable
   target IDs and an operation ID. No deletion, merge, word recreation or sharing
   changes. Target collections are unshared. Retain old collection IDs/links.
3. A complete recovery export including words, content/media, collections, learning
   progress, histories and related records. The analysis CSV cannot serve this purpose.
4. Stale-plan validation for identity, complete ID set, membership, protected content
   and relevant card hashes. Resume analysis only for changed/new records; do not
   discard saved approved decisions. Capture current SRS separately for verification.
5. Idempotent apply plus targeted rollback tested on fixtures. Rollback restores only
   this operation's assignments/metadata and must not overwrite later user changes
   or learning progress.
6. Show the exact move/classification proposal and aggregate invariants before asking
   for the still-required production-profile write authorization.
7. After approval, refresh/validate backup, apply, and prove identical card IDs/count,
   content/media/SRS/history, protected membership and sharing flags except for the
   explicitly approved collection assignments/metadata.
8. Document a future incremental command: classify new/changed words and fill suitable
   groups without shuffling the existing library. Full rebalance requires a new request.

## 11. Verification commands

Run with Node from `.nvmrc`. Use targeted tests while implementing; run wider checks
once the relevant package is stable. Do not repeat expensive suites without a change
or unresolved concern that justifies it.

```bash
npm run official-content:test
npm run official-content:build
npm run mobile:test -- --no-watch --watchman=false --runInBand src/services/__tests__/officialContentCatalogService.test.ts src/services/__tests__/starterPackService.test.ts src/hooks/__tests__/useStarterPackImport.test.ts
npm run web:test -- --runInBand src/features/starter-pack
npm run mobile:typecheck
npm run web:typecheck
npm run lint -- --max-warnings=0
npm run web:lint
git diff --check
```

Isolated PostgreSQL on this Mac:

```bash
export WOORDENAAR_PG_BIN=/opt/homebrew/opt/postgresql@15/bin
node --test --test-concurrency=1 --test-timeout=120000 scripts/postgres-tests/official-content-catalog.test.mjs
```

The PostgreSQL harness may need sandbox escalation for local shared memory; this is
not permission to connect to production. Run the full `npm run test:db` after schema
work is stable. `npm run web:build` checks the web production bundle. Existing Git
hooks run full mobile and web unit suites; allow them to finish and report failures.

Release tooling after review, with concrete paths and real reviewer metadata:

```bash
npm run official-content:approve -- --input PATH_TO_DRAFTS --out NEW_RELEASE_DIRECTORY --review-ledger PATH_TO_REVIEW_LEDGER --reviewed-by REVIEWER --reviewed-at ISO_TIMESTAMP
npm run official-content:publish -- --release RELEASE_DIRECTORY
```

The second command is a dry run. Do not append `--apply` while merely validating
this plan. Harden tooling in B before treating current approval commands as final.

## 12. Progress ledger and stopping rules

- [x] Baseline architecture, clients, shared validator and draft export implemented.
- [x] 21 draft packs / 2059 entries generated locally; excluded words absent as lemmas.
- [x] A1: version promotion/rollback/count/state-transition regressions resolved.
- [x] A2: web navigation state and unavailable catalog/pack recovery verified.
- [x] A3: requested identity and mobile loading/cache/route lifecycle verified.
- [x] B: source-bound, atomic artifact preparation and release CLI tests complete.
- [ ] C: full public editorial review ledger complete; stable approved release exists.
  - [x] C1: private v3 review inventory and needs-review ledger skeleton generated.
  - [x] C2a: current read-only editorial fields reconciled with the locked baseline.
  - [ ] C2: 81/83 balanced review batches inspected and saved incrementally.
    - [x] Dutch A1: 5/5 batches and 122/122 entries inspected.
    - [x] Dutch A2: 20/20 batches and 500/500 entries inspected.
      - [x] `dutch-a2-01`: 4/4 batches and 100/100 entries inspected.
      - [x] `dutch-a2-02`: 4/4 batches and 100/100 entries inspected.
      - [x] `dutch-a2-03`: 4/4 batches and 100/100 entries inspected.
      - [x] `dutch-a2-04`: 4/4 batches and 100/100 entries inspected.
      - [x] `dutch-a2-05`: 4/4 batches and 100/100 entries inspected.
    - [x] Dutch B1: 36/36 batches and 886/886 entries inspected.
      - [x] `dutch-b1-01`: 4/4 batches and 99/99 entries inspected.
      - [x] `dutch-b1-02`: 4/4 batches and 99/99 entries inspected.
      - [x] `dutch-b1-03`: 4/4 batches and 99/99 entries inspected.
      - [x] `dutch-b1-04`: 4/4 batches and 99/99 entries inspected.
      - [x] `dutch-b1-05`: 4/4 batches and 98/98 entries inspected.
      - [x] `dutch-b1-06`: 4/4 batches and 98/98 entries inspected.
      - [x] `dutch-b1-07`: 4/4 batches and 98/98 entries inspected.
      - [x] `dutch-b1-08`: 4/4 batches and 98/98 entries inspected.
      - [x] `dutch-b1-09`: 4/4 batches and 98/98 entries inspected.
    - [x] Dutch B2: 20/20 batches and 504/504 entries inspected.
      - [x] `dutch-b2-01`: 4/4 batches and 101/101 entries inspected.
      - [x] `dutch-b2-02`: 4/4 batches and 101/101 entries inspected.
      - [x] `dutch-b2-03`: 4/4 batches and 101/101 entries inspected.
      - [x] `dutch-b2-04`: 4/4 batches and 101/101 entries inspected.
      - [x] `dutch-b2-05`: 4/4 batches and 100/100 entries inspected.
    - [ ] Dutch C1: 0/2 batches and 0/47 entries inspected.
      - [ ] `dutch-c1-01`: 0/2 batches and 0/47 entries inspected.
  - [ ] C3–C8: language, sense, exclusions, Essentials overlap, and license findings resolved.
  - [ ] C9: final reviewed manifests rebuilt with reconciled public counts.
  - [ ] C10: exact complete ledger approved into an immutable release.
- [ ] D: cross-platform import scenarios verified with disposable data.
- [ ] E: concrete production release prepared and outstanding authorization obtained.
- [ ] E: server/catalog and both clients released and verified.
- [ ] Personal classification/apply/rollback tooling prepared and tested.
- [ ] Personal write proposal authorized, applied, and invariants verified.

Latest verification: catalog DB 14/14 and full DB 116/116 passed after A1. A2 web
passed 57 suites / 542 tests plus production build. After A3, mobile passed 132
suites / 1541 tests and web passed 58 suites / 544 tests; mobile build/test
typechecks, web typecheck, ESLint, and `git diff --check` passed. Requested pack
identity is enforced for network, cache, and web repository rows. Mobile cache v2
intentionally invalidates legacy metadata, retains verified content after failed
downloads/writes, supports offline reopening, and rejects corrupt entries. A keyed
route boundary plus stale-request cleanup keeps selection, collection target,
success, loading, and errors scoped to the current pack; remote failures are
retryable and bundled Essentials remains available offline.

Work package B now binds the exporter to exact source, owner, plan, per-card evidence,
counts, targets, and exclusions. The validator uses strict nested allowlists; public
IDs are stable across content edits; semantic uniqueness uses the import key; all
public fields are scanned for excluded whole words; build/approval writes are atomic
and immutable; approval requires a complete hash-bound private review ledger; and
publication validates the release and exact HTTPS target before bounded requests.
The current source audit records 709/709 verbs without irregularity/conjugation,
984/984 nouns without plural, 2059 entries without snapshot synonyms/antonyms, and
9 omitted usage-note objects. These omissions are explicit blockers for approval,
not silently defaulted values. The v3 draft has 2059 unique semantic keys and zero
collisions. Official-content tooling passes 24/24 synthetic regressions and the real
build produces 21 packs / 2059 entries / zero production writes. Mobile build/test
typechecks, web typecheck, ESLint, web ESLint, and `git diff --check` passed during B.
The final wider gate passed mobile 132 suites / 1541 tests, web 58 suites / 544
tests, and a Next.js production build.

C1 produced the ignored directory
`official-content-review-v3-002-2026-09-11/` with `inventory.json`,
`review-ledger.json`, and an integrity index. The inventory SHA-256 is
`7bde9b7ad34de66d755afb7fc7593e5aea46e879b0e85ddf7d4773aba0bf9c92`; the initial
needs-review ledger SHA-256 is
`10e6ebf75eb936ed53e740a5ed60f116ab0fba7c15d0300c33c16658ccf2c7af`.
It contains 83 balanced batches of 23–26 entries, all
2059 decisions remain `needs-review`, and priority counts include 1693 entries with
unresolved linguistic fields, 1400 analysis notes, 115 low-confidence CEFR records,
85 mapped quality concerns, 9 omitted usage notes, 8 Essentials overlaps, and one
spelling override. The generator and its evidence mismatch/balancing constraints
pass as part of 28/28 official-content tests. No profile or production writes occurred.

C2a used a read-only SQL transaction to produce the ignored editorial snapshot
`reports/snapshot-editorial-2026-09-11.csv`, SHA-256
`4a6321b366b2ccd58da4d3b811b9a66d60f4502db2e2a3eacb8013bfe523270a`.
It matches the locked owner and retains all 2287 baseline cards; four newer cards
are outside the existing plan. Five baseline cards have changed public source
fields, four of them mapped, and are flagged for explicit review. The enriched
ignored inventory is
`official-content-review-v3-003-2026-09-11/`: inventory SHA-256
`041a349098e3c2c8b4fe336dcf1cad8123311e6f476e70ed761d06a3a017d1b3`,
initial ledger SHA-256
`c15a667724d925c2e25d0ec880b1dff534005bc9b8bc38ebf1207c60c8d331d5`.
Verified source values resolve the mechanical irregularity, conjugation, and plural
omissions for all 2059 mapped cards; review decisions remain unresolved. The tooling
rejects owner/timestamp mismatches, missing baseline cards, incomplete fields, and
records current content for changed cards. Official-content tests pass 33/33 and
ESLint plus `git diff --check` pass. No profile or production writes occurred.

C2 now persists immutable per-batch records and deterministically rebuilds the
aggregate private ledger. All five Dutch A1 batches are complete: all 122 entries
were inspected, 61 were approved unchanged, 58 received explicit corrections, and
three remain unresolved for C3–C8 (`de haar`, the polysemous `meter`, and the A1
placement of `portretteren`). The reviewed batch SHA-256 values, in order, are
`95e9d9b2324fd17c09d6e7f501bf1b9af9d689a194de0520d2588a719aab57df`,
`8d20006abae861708445fd1b5f6f2981fef2f71f7ad5c39798dabc38d185dc22`,
`00e8c2a3ee064c10cdd6ea8d918911807bb05f484fafb524074a6cb7e3d239d7`,
`a617321fc5d4f2f6214a71a6493b1892df57ef9889cbd7c92910a700eea8410d`,
and `23f52382fc238e57c8786556007d1a85f9d73135791b06bb88c7b075e1efbc21`.
The rebuilt ledger SHA-256 is
`0e6f672fcd69a32ca3e354a3b2d475b9f674f604bd429736f7f7a194a3f9272f`.
Corrections cover spelling, grammar, translations, malformed examples, register,
false lexical relations, unsupported senses, and misleading plural forms. ANW was
consulted for specialist senses including river `mond` and vessel `stuur`.
Official-content tests pass 36/36, repository ESLint passes with `--quiet`, and
`git diff --check` passes. No profile or production writes occurred.

The four `dutch-a2-01` batches are also complete: all 100 entries were inspected,
eight were approved unchanged and 92 received explicit corrections. No additional
entry was left unresolved. The reviewed batch SHA-256 values, in order, are
`6173ad8d30ea9ec38013aa3bcf15ceadcd01550e103f09e676cc44b9b72e6aa9`,
`6b341491e1a616b9204d358c5699db7b2680fb01e2f1c0299beceaecd6041ea6`,
`df76ee6b460be806809d34da3e36a64ca401f0a650a48ce751d2c8d79ebaf123`,
and `25b8f717ea401a8331d3aa83acde3bcf06f8a801459f95c05cc16816efcc3a0d`.
The rebuilt ledger now contains 69 approved, 150 overridden, and 1840 unresolved
decisions; its SHA-256 is
`8e352eb95944d89384b62b669ae880bc8a087e4ad6abb6200594b7294bb146e2`.
Corrections include homonym and part-of-speech separation, A2 sense focusing,
invalid plurals, false lexical relations, translated-English constructions, and
examples that did not contain the reviewed lemma. No profile or production writes
occurred.

The four `dutch-a2-02` batches are complete: all 100 entries were inspected,
12 were approved unchanged and 88 received explicit corrections. No additional
entry was left unresolved. The reviewed batch SHA-256 values, in order, are
`a1d5b04fbe275b34c19a3cbdc5302b419d8cb8cb74ba48cb92cd8d53b4e72a5e`,
`f29656f87736d955505d819370eda24677c3829cf17614dd496a6f32a2c5226f`,
`df8343a73a39855f2f91fcea28f552188e401fe46c5f064c10e909ccb481b08d`,
and `42a87f9309bc32a3907b348e7f671441e5c0856d4b4168ca700d96a2c605cb03`.
The rebuilt ledger now contains 81 approved, 238 overridden, and 1740 unresolved
decisions; its SHA-256 is
`d98f5ba5f59ada57c0918007b2df6432c0825ee5a0b8c38e0ce60253dcf340e6`.
Corrections include separable and irregular conjugations, invalid plurals,
homonym and level focusing, public-safe sense selection, false lexical relations,
and malformed Dutch, English, and Russian examples. No profile or production
writes occurred.

The four `dutch-a2-03` batches are complete: all 100 entries were inspected,
21 were approved unchanged and 79 received explicit corrections. No additional
entry was left unresolved. The reviewed batch SHA-256 values, in order, are
`db4a49dbfad88736bbc1f20e39d3a9706a65b42fdd7599317df9662c7a22b7d8`,
`73ed60618f7dd69d2b924d42ecb93c22a8282a321444768164ecc417f16ffd02`,
`0a80deafb3f694218e16996f7a672de5776cd06181224ce9241a6f273a53f140`,
and `eb5ab5cbe657c1834fad6e634d1514d20828da22f6e00adbfad7684081a67cc5`.
The rebuilt ledger now contains 102 approved, 317 overridden, and 1640 unresolved
decisions; its SHA-256 is
`972863909bfa6bb2d355ed2f564f8660d0f26fe97b7c211e25ecfaa5a9587479`.
Corrections include invalid mass-noun plurals, separable and strong conjugations,
homonym and level focusing, false lexical relations, malformed constructions,
and Dutch, English, and Russian example repairs. No profile or production writes
occurred.

The four `dutch-a2-04` batches are complete: all 100 entries were inspected,
26 were approved unchanged and 74 received explicit corrections. No additional
entry was left unresolved. The reviewed batch SHA-256 values, in order, are
`43b9c92b457b4a913484c4902b8c6a308609345a61b939a432708ea96e529dbf`,
`7094dc0f8901cec048db49c3211052e1a9f3bd92f9d3e88540451e99357f0167`,
`bd44412f8a130a6dd0e9a758ccaa39a74cafb097675ac49b0fe41faf8e6a6cb6`,
and `65524407892550bf95950f2a5b4bab0c7011fdd9941f826410aa83d2500b7cf3`.
The rebuilt ledger now contains 128 approved, 391 overridden, and 1540 unresolved
decisions; its SHA-256 is
`1cad0c3c9c983b093288f21e45e13c4d4ded2868dde7bab68035ba8717cac8e7`.
Corrections include missing Russian examples, mass-noun plurals, reflexive and
separable conjugations, register and sense focusing, false lexical relations,
unsafe hygiene advice, and malformed Dutch, English, and Russian examples. No
profile or production writes occurred.

The four `dutch-a2-05` batches complete the Dutch A2 review: all 100 entries in
this pack were inspected, 21 were approved unchanged and 79 received explicit
corrections. No additional entry was left unresolved. The reviewed batch SHA-256
values, in order, are
`fd144871a6dd6536ee665e05dacdec1394ac4aa3bdf07ac1b3552b067e928f89`,
`5f46df0b26bd3b18d79dd6b84c03222a157f7084375a11723ecd29b5cf907f3a`,
`7b523d66b8782c9f003602c9c0b8d75e5a52e30ca9eac701f84f0043fad47eb2`,
and `90f11cfc60355e818cdaa2ff6fad4b3bd9959a021e0479158f4b4498c031e899`.
The rebuilt ledger now contains 149 approved, 470 overridden, and 1440 unresolved
decisions; its SHA-256 is
`ce554a456a95161785d2f37a62868e19d8fd1865bbe16416d9ceaceaee05c380`.
Corrections include inaccurate cultural and scientific claims, impossible or
ungrammatical examples, irregular and separable morphology, formal and regional
register, false lexical relations, and idiomatic English and Russian repairs. All
500 Dutch A2 entries are now inspected. No profile or production writes occurred.

The four `dutch-b1-01` batches begin the Dutch B1 review: all 99 entries in this
pack were inspected, 18 were approved unchanged, 79 received explicit corrections,
and two remain unresolved for C3–C8: the duplicated `waardoor` card and the
participle `verslagen`, which duplicates the preceding `verslaan` card. The reviewed
batch SHA-256 values, in order, are
`e99de4820eb4105cd445f8d6291dfa221aef261e3df475e1963c01f3dcd22bff`,
`d4e10446591adcb0a9f9e6467b9fc986e077fb8784405dc65be1e971b7679831`,
`7bcff9120f71dbbc04598e3d7f756ea4dd65da1bbc69a388b6681ba362b73811`,
and `e672292b2a32930081233f24ebf684dab3807803669e8a1de2193029e22a6ca9`.
The rebuilt ledger now contains 167 approved, 549 overridden, and 1343 unresolved
decisions; its SHA-256 is
`d37ff43ddfa52cbc5b0514eeeb7b04192574a8329e3c520d4a50208e13947c37`.
Corrections include nominalized and separable verb classification, missing strong
and weak conjugations, invalid mass-noun plurals, duplicate semantic candidates,
false lexical relations, and malformed Dutch, English, and Russian examples. No
profile or production writes occurred.

The four `dutch-b1-02` batches are complete: all 99 entries were inspected, 22
were approved unchanged, 76 received explicit corrections, and one remains
unresolved for C3–C8 because `hol` combines adjective and noun senses that require
an explicit split-or-focus decision. The reviewed batch SHA-256 values, in order,
are
`ce90a3e0b26a9ae4bed23204b44a1466234199687e96dcfb749a26077df66200`,
`bd96b4157c4942e528431daf14bb7cbbb166d1721946fde6b7dbc8f871531e58`,
`77ac0cc487d5d66f8c48ab9da01bbae796362cf516e88e7734bee96a19c7f3a6`,
and `61dcfda2b188325d7730fc46c10beaf77b15264286b4e445a36bd3e8c0befb66`.
The rebuilt ledger now contains 189 approved, 625 overridden, and 1245 unresolved
decisions; its SHA-256 is
`8c4442ba73f790b626a43d5951305114332410f7c636520fac35f6b2616d9706`.
Corrections include damaged reflexive paradigms, mixed verb and adjective senses,
false or regional meanings, invalid plurals, missing Russian examples, Markdown
leaking into learning text, and malformed Dutch, English, and Russian examples. No
profile or production writes occurred.

The four `dutch-b1-03` batches are complete: all 99 entries were inspected, 20
were approved unchanged, 77 received explicit corrections, and two remain
unresolved for C3–C8. The native noun `fee` and English loanword `fee` require a
homograph split with distinct plurals; `winden` combines winding, reflexive
coiling, and flatulence with incompatible paradigms. The reviewed batch SHA-256
values, in order, are
`710a781ab6314eb8b00377fbce9ac652ce9afd11a34424f17a5f7b0daff49832`,
`3fd4bb73454fee90602c4c28e5a454b1e28fc7f2a5313e7ffff2aea38a250a3c`,
`9cd24d257f42bbf36e9b9878cd73567008d1eb4933dadf4ef391de4c30391fe7`,
and `a2c3327f58b596986883310cea9d61f466b6f91ab67e2420c9d351bf5a599bb8`.
The rebuilt ledger now contains 209 approved, 702 overridden, and 1148 unresolved
decisions; its SHA-256 is
`378065a2bb4498159922c9b3a16baf1687c95ba2cee7752d666ffa378d50d04c`.
Corrections include homograph and part-of-speech focusing, reflexive and irregular
paradigms, register, invalid plurals, false lexical relations, parenthetical
annotations, contradictory kinship examples, and malformed Dutch, English, and
Russian examples. No profile or production writes occurred.

The four `dutch-b1-04` batches are complete: all 99 entries were inspected, 13
were approved unchanged, 85 received explicit corrections, and one remains
unresolved for C3–C8 because `bont` combines adjective, mass-noun, and fixed
expression senses that require an explicit split. The reviewed batch SHA-256
values, in order, are
`191a61f8ad8b38315372ea27a75ffc4b7419f419a13acc57baae24ba1573838e`,
`482a0a9c53880282b2c45c9b94929a8c553b05d811f9ff02b76916631e4a6d31`,
`3daca9df44033142d3d833ddce3130dde4d0fb41a992f4c26536f124641d3ae6`,
and `a6c53102a8b379d6964e6c0d4def8ac6888481519d21f0f6906c9ee6397be7a8`.
The rebuilt ledger now contains 222 approved, 787 overridden, and 1050 unresolved
decisions; its SHA-256 is
`bd1353e9993c2e738fadfbc78564af33a90d6cfb99e4012322f336dc9c266d64`.
Corrections include false factual claims, homograph and part-of-speech focusing,
separable and reflexive paradigms, register, invalid examples and plurals, false
lexical relations, editorial annotations, and malformed Dutch, English, and
Russian learning text. No profile or production writes occurred.

The four `dutch-b1-05` batches are complete: all 98 entries were inspected, 34
were approved unchanged, 59 received explicit corrections, and five remain
unresolved for C3–C8. `loods` and `beslag` combine unrelated senses that require
explicit splits; two `rek` cards duplicate one another while mixing nouns with
different gender and meaning; and `piet` treats several fixed expressions as
standalone senses. The reviewed batch SHA-256 values, in order, are
`1e35a81d69e28b6b9501c71817c5e5f6255375502bbac63aade2c38203c37f2a`,
`96eef6ba7d1622b4c2450aab335b814fa2b6bb9739a6c8947bb3bbb6f062e0d1`,
`fe47658f5730f9390afb2983a499bc4c9fe957944deaad71298aad8c8e3ada5c`,
and `e37e7091e429056428908636015c27b832066dabea987424d38ea906f2cf5bcd`.
The rebuilt ledger now contains 256 approved, 846 overridden, and 957 unresolved
decisions; its SHA-256 is
`fddac143bb1f9846a81dee41e8eb388be46645f283bd0ad5d258fd3fd52c09b1`.
Corrections include homograph and semantic-duplicate identification, dictionary
lemmas, separable and reflexive paradigms, register, invalid plurals, false lexical
relations, editorial annotations, and malformed Dutch, English, and Russian
learning text. No profile or production writes occurred.

The four `dutch-b1-06` batches are complete: all 98 entries were inspected, 38
were approved unchanged, 56 received explicit corrections, and four remain
unresolved for C3–C8. `kwal` combines an animal noun with an informal insult;
`kwast` combines several unrelated noun senses; `onwijs` mixes literal, informal,
and adverbial uses; and `brander` combines a tool, an obsolete person noun, and a
computer drive. The reviewed batch SHA-256 values, in order, are
`bb41c01cc3c33813b0288b1e73551b5ba333d8deb5e149c7db621a4679d63a00`,
`0b426042b8e7f1fd71f81e94c6eda4140c6362a9b359afe16c01a60d2ebaebd0`,
`e053c9be50abc1727eb1f92a99d160c12fd717cf38048caea56d5692798a72f4`,
and `648349f377a9ce90e2db4110c89564cedb1b08affd5f7372a2c3e02322c77357`.
The rebuilt ledger now contains 294 approved, 902 overridden, and 863 unresolved
decisions; its SHA-256 is
`f358a088edb0d92ff5307f410de5dc8d24e2dd5b7a39439af4610f1900dde73c`.
Corrections include source spelling, nominalized verbs, mass nouns, reflexive and
separable paradigms, register, unsupported or time-sensitive claims, missing
Russian examples, false lexical relations, and malformed Dutch, English, and
Russian learning text. No profile or production writes occurred.

The four `dutch-b1-07` batches are complete: all 98 entries were inspected, 62
were approved unchanged, 31 received explicit corrections, and five remain
unresolved for C3–C8. `beleggen`, `kraam`, and `pens` combine unrelated senses;
`ritselen` needs separate literal and informal treatment; and `toverwoord` merges
four non-interchangeable figurative uses. The reviewed batch SHA-256 values, in
order, are
`657dfe35bd5095b372358f7a18fb02bdd4bba03febd5a029624f5bf658491ce1`,
`80ef102d641667b95ff3d8fa5ef947602ea4517b75d91b23f616dcd4e341ec28`,
`e3a16d7e3bb02aeeea217a29c4ef62c5424202e4e0b2d100d60b7965c83bf411`,
and `e207402fff7b7b1fec77ed951cda8eb74ea21371c8e26d52941c3dc97e82733f`.
The rebuilt ledger now contains 356 approved, 933 overridden, and 770 unresolved
decisions; its SHA-256 is
`b6dfc4ecddcd4a4d170ca558052228bd4b04ac639bd8944bfa24675570048e63`.
Corrections include homograph and part-of-speech identification, reflexive and
separable paradigms, register, invalid mass-noun plurals, false lexical relations,
editorial annotations, and malformed Dutch, English, and Russian learning text.
No profile or production writes occurred.

The four `dutch-b1-08` batches are complete: all 98 entries were inspected, 60
were approved unchanged, 34 received explicit corrections, and four remain
unresolved for C3–C8. `schol`, `deksels`, and `pendelen` need explicit sense or
part-of-speech splits, while `overboeken` combines money transfer and booking
capacity. The reviewed batch SHA-256 values, in order, are
`06e5bfc0e62c7007ad6c352b80c6eb5bb7d584d5d9041428a28199b98e22bf30`,
`3ffd450f20ce73d137e736a18665bced696940b02ac23141a75971d97bbcf953`,
`1f758d9798692180a1d0f1c1f36544cc84b05b624ecd66f6f2f56a6263fa54c5`,
and `4c749da9effbc5c21f7170df408bb99c4ba42acab6f7a556853d0f65bd8263ff`.
The rebuilt ledger now contains 416 approved, 967 overridden, and 676 unresolved
decisions; its SHA-256 is
`a1e115bee546ac12c7926d3db5c53d6462bdefc935057d53c0df5a192b3c9afd`.
Corrections include corrupt morphology, missing part-of-speech metadata, register,
false-friend translations, invalid plurals, false lexical relations, editorial
annotations, and malformed Dutch, English, and Russian learning text. No profile
or production writes occurred.

The four `dutch-b1-09` batches complete the Dutch B1 review: all 98 entries were
inspected, 35 were approved unchanged, 55 received explicit corrections, and
eight remain unresolved for C3–C8. `ophebben`, `inrennen`, `bloemig`, and
`toeschieten` combine incompatible senses or constructions; the two `vaste
lasten` cards duplicate one another; `zich houden` combines several fixed
constructions; and `reddingsgordel` conflates throwable and wearable rescue
equipment. The reviewed batch SHA-256 values, in order, are
`49aed82322b94238e8e766da39256f5538f749c077798d17b9289754982ae15e`,
`63b4e7a1b29597c2cf9e374f122d81ba3a28adf748ab193c0ced3cf644745ea7`,
`eecda0aa4dde46ac377acac1cb08a6ef727450c7abe69d55362b398e1523ae01`,
and `e47dea4181cbd666b2be06588c08da6a6fa1d2265824bc6c53063685af652a8f`.
The rebuilt ledger now contains 451 approved, 1022 overridden, and 586 unresolved
decisions; its SHA-256 is
`a98186c500ce581c2883c9bc41d02c78d4578c971d368057b0615a2d25cbb573`.
Corrections include standard Dutch lemmas, mass-noun plurals, separable
conjugations, register, missing Russian examples, false lexical relations,
unsupported claims, editorial annotations, and malformed Dutch, English, and
Russian learning text. No profile or production writes occurred. The earlier
progress denominator of 884 Dutch B1 entries was corrected to the inventory-backed
total of 886.

The four `dutch-b2-01` batches are complete: all 101 entries were inspected, 51
were approved unchanged, 30 received explicit corrections, and 20 remain
unresolved for C3–C8. The unresolved group consists of genuine homographs,
incompatible senses, duplicate constructions, and part-of-speech ambiguity rather
than unchecked entries. The reviewed batch SHA-256 values, in order, are
`bf9fd0f07ea0ea33a2ed950440dbbedf9fb6a2c5ad3f536879493cebebaa9867`,
`b653378d16cd0c9e5ac8af28277f4a8048b4b827662911cbc3a198ee66e6f8a0`,
`0087377f7240208eeaf9e15376a26728a00a3693a50b5b259954433bafcdc8df`,
and `00fcaeb609334de57df572838781f0ed2819cd644187b2c79f55b67860a5719a`.
The rebuilt ledger now contains 502 approved, 1052 overridden, and 505 unresolved
decisions; its SHA-256 is
`047998291041d33218c3b29e4aa10cfb0bf457bb6a7ae3a5d3dd2aca6bbd733f`.
Corrections include missing strong and separable forms, invalid abstract-noun
plurals, register, false lexical relations, corrupted Dutch tokens, ambiguous
translations, and inaccurate grammatical metadata. No profile or production
writes occurred.

The four `dutch-b2-02` batches are complete: all 101 entries were inspected, 69
were approved unchanged, 14 received explicit corrections, and 18 remain
unresolved for C3–C8 because they combine homographs, incompatible senses,
duplicate lemmas, or part-of-speech variants. The reviewed batch SHA-256 values,
in order, are
`fa5cc9fe4a9c7cf111a4e91777ff9a1be67108f988af76c1ee82dc4e4528fb8f`,
`d72e47099625de7c81a779b1f6e360e095f50c1e96bf97d6ee63c4cec573348a`,
`42fd1366e79baff0d8a4f00e34dc4d4e0ec308078601347138af6e697c7e5932`,
and `233effa8447d571bd724f6b847fd374745065978bf0480aac1b3798e53c6af67`.
The rebuilt ledger now contains 571 approved, 1066 overridden, and 422 unresolved
decisions; its SHA-256 is
`71d63f4aaed12f35e8837f4050aae92c95f6ea7bef7500a114b7c8aa23db4f7b`.
Corrections include invalid mass-noun plurals, incomplete conjugations, register,
singular/plural translation agreement, corrupted metadata, and false lexical
relations. No profile or production writes occurred.

The four `dutch-b2-03` batches are complete: all 101 entries were inspected, 49
were approved unchanged, 38 received explicit corrections, and 14 remain
unresolved for C3–C8 because they combine homographs, unrelated senses, different
usage frames, or adjective/adverb variants. The reviewed batch SHA-256 values, in
order, are
`3b517bc5e66d6c98fd7281ad96a8fa72fd4a25a5428d3aff05a1dc2d13017ac9`,
`180601399161deb004a6aec88441012af65808a9ac2017df7ace8ebcfc59d396`,
`5f8056573b3d6c89594deadef06634cb3db1715770a70d5b5683d43260404294`,
and `5daad67efe1cad1d39b7cd345012c9e6f64b9f7066adbf9e2dde7ccc2e0a982d`.
The rebuilt ledger now contains 620 approved, 1104 overridden, and 335 unresolved
decisions; its SHA-256 is
`0b0baed61073e3a1712afae7f22230e6366038b17d654e3515ace783d6b65f9e`.
Corrections include misspelled morphology, separable and reflexive conjugations,
invalid abstract-noun plurals, register, false translations and lexical relations,
and duplicated glosses. No profile or production writes occurred.

The four `dutch-b2-04` batches are complete: all 101 entries were inspected, 72
were approved unchanged, 18 received explicit corrections, and 11 remain
unresolved for C3–C8 because they combine homographs, technical and general
meanings, or incompatible usage frames. The reviewed batch SHA-256 values, in
order, are
`2bf669f3fcdb17102610d1a334a2862f4d889051c67459f731f18ad6f8e7a409`,
`1606204e54139ca6f66413d6ad827a7e376ba86c49e60d7d9daa9b40d232b50d`,
`9fff95c1ab9a922b670ddd0cde3bd2d61928234ce7beb96e0dff3ead7567dab9`,
and `f1f5e7a8203b9a5818d7371d94b67f59c1284a73c5e9ec3c53c7c8fdbb57971e`.
The rebuilt ledger now contains 692 approved, 1122 overridden, and 245 unresolved
decisions; its SHA-256 is
`9cbf5b53c8fed5d398985307798664ea40ad8448ee86add8849072601b6b5b7f`.
Corrections include diagnosis focusing, compound and separable conjugations,
invalid mass-noun plurals, register, false translations, and editorial annotations.
No profile or production writes occurred.

The four `dutch-b2-05` batches complete the Dutch B2 review: all 100 entries were
inspected, 58 were approved unchanged, 26 received explicit corrections, and 16
remain unresolved for C3–C8 because they combine homographs, incompatible senses,
or uncertain specialist and regional terms. The reviewed batch SHA-256 values, in
order, are
`7a7bfc0803dcfb12c0e721bba18730e2f667963baa3d4f4e24404861272d9db3`,
`bfbe43b26e6ab0ce6d5acf7d14b11c383b21b49c9af3ff45df9690af75c769b5`,
`c42056faea28930e4da79915f1943446f105249d4a5a0d16d5d6a9f31e9de9ea`,
and `5bf1dd755f8ca5d7871d39f05acf4d2f39f56092e7c1de66299b4728fe2de925`.
The rebuilt ledger now contains 750 approved, 1148 overridden, and 161 unresolved
decisions; its SHA-256 is
`caeaf42bac1adba5dbea50f9ceaa5ae1fdb70c116cb35d336ebb710dd7601e40`.
Corrections include misspelled lemmas, reflexive and compound conjugations, invalid
mass-noun plurals, register, false translations, malformed examples, and incorrect
parts of speech. All 504 Dutch B2 entries are now inspected. No profile or
production writes occurred.

Next action: C2, inspect and persist `dutch-c1-01-batch-01`, retaining pack order.
Do not approve the release until all 2059 decisions and every grammatical value
have been reviewed.

Stop only the dependent action when authority, a missing private input, or an
unresolved editorial decision truly blocks it. Complete independent local work.
Do not convert uncertainty into an `approved` record or claim a task is done just
because tests pass. Each report should state completed work, meaningful evidence,
remaining concrete work, and a short English Conventional Commit message.
