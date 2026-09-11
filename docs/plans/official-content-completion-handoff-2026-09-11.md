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
  - [ ] C2: all 83 balanced review batches inspected and saved incrementally.
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

Next action: C2, review and persist all 83 complete batches, starting with
`dutch-a1-01-batch-01` and retaining pack order. Do not approve the release until
all 2059 decisions and every grammatical value have been reviewed.

Stop only the dependent action when authority, a missing private input, or an
unresolved editorial decision truly blocks it. Complete independent local work.
Do not convert uncertainty into an `approved` record or claim a task is done just
because tests pass. Each report should state completed work, meaningful evidence,
remaining concrete work, and a short English Conventional Commit message.
