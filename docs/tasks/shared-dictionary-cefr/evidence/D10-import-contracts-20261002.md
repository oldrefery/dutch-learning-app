# D10 local import contracts — checkpoints

Date: 2026-10-02. Branch `feature/shared-dictionary-schema`, HEAD `c5dfb14`.
This records the initial local checkpoint before Astra review. AUTH-18 later
authorized local commits: implementation is now `a59acad`, including the repairs
in [D10 Astra review](D10-astra-review-20261002.md). D03-D09 work is preserved.
No push, PR, release or hosted schema operation is authorized.

## D10.1 / D10.2

- `@woordenaar/content/dictionary` adds a separate strict mapping receipt.
  Published schema-v1 manifests and bundled Essentials JSON are untouched.
- Receipts bind exact pack/version/manifest hash, pack entry identity, pinned
  entry/revision, revision content and CEFR input hashes, and source provenance.
  Revision metadata permits reconstructing and caching the complete dependency
  from the immutable manifest. Pack CEFR is never used as a meaning assessment.
- `20261002090000_add_official_dictionary_mappings.sql` adds administrator-only
  append-only receipts. Insertion checks the actual canonical JSON hashes, exact
  normalized entry content, published revision, approved first-party/licensed
  source and matching locator. No spelling-based resolution or publication.
- Mapping retrieval requires authenticated identity and enabled reads. Draft,
  retired or unpublished inputs cannot create mappings. Partial/unavailable
  mappings retain explicit private-copy behavior for new imports.
- New import RPC tests independently verify fresh personal IDs, exact pins,
  default SRS, unchanged duplicate IDs/content/progress/collection and no adoption
  of existing private duplicates.

## D10.3 / D10.4 / D10.5 implementation checkpoint

- Dormant server official imports resolve references from administrator receipts,
  never client-supplied personal IDs, SRS or dictionary IDs. Both clients retain
  the legacy flag-off path; unavailable bundled Essentials uses complete private
  copies, while unavailable hosted packs fail closed.
- Mobile verifies and caches complete pinned dependencies before the atomic
  SQLite create-private/link queue transaction. Missing or inconsistent content
  rolls back the batch. This proves storage behavior, not end-to-end offline
  import reconciliation across devices.
- Shared imports use an active share token and selected source word IDs; server
  locks source collection/cards and checks the final selection count. Published
  pins carry permitted private overrides into fresh recipient cards; private
  copies carry authorized text. Preview returns only an explicit content
  projection, without source owner/SRS/revision metadata. Both clients reject
  malformed responses rather than downgrading to an unverified legacy read.
- Shared duplicate responses retain their existing collection. Mobile preserves
  unsynced SQLite changes and existing in-memory progress/private edits. Foreign
  returned owner identities and account switches are rejected.
- Schema-v1 exports are complete content copies, without IDs/SRS/reference
  dependencies. Server owner-only export/reimport succeeds after deleting the
  original personal row. Mobile offline export requires complete materialized
  dependencies, retains private media overrides, isolates accounts, and leaves
  learning state/queues unchanged. Transfer helpers exist; no new public export
  UI or offline document-import queue is claimed.
- Target types generated and deterministic check passed through
  `20261002100000_add_dictionary_import_protocol.sql`. Deployed generated
  contracts and runtime feature defaults are unchanged.

## Verification

Node 24.20.0 is used. Commands are executed from repository root unless noted.

```bash
node node_modules/jest/bin/jest.js --config apps/web/jest.config.mjs --ci --runInBand --watchman=false --runTestsByPath apps/web/src/features/starter-pack/official-dictionary-mapping.test.ts apps/web/src/features/starter-pack/official-content-manifest.test.ts apps/web/src/features/starter-pack/official-content-remote.test.ts --modulePathIgnorePatterns '<rootDir>/reports/' '<rootDir>/.stryker-tmp/'
WOORDENAAR_PG_BIN=/opt/homebrew/opt/postgresql@15/bin node --test --test-concurrency=1 --test-timeout=120000 scripts/postgres-tests/official-dictionary-mapping.test.mjs scripts/postgres-tests/official-content-import.test.mjs scripts/postgres-tests/official-content-catalog.test.mjs
npm run web:typecheck
npm run mobile:typecheck
```

Initial v1 compatibility: 3 web suites / 19 tests passed; expanded mapping,
catalog and legacy import run: 22 SQL tests passed. Subsequent full web run:
74 suites / 640 tests passed, one pre-existing skipped suite/test. Final new
web contracts/projection run: 4 suites / 25 tests passed. Final targeted mobile
run: 10 suites / 124 tests passed. Final D10 SQL run: 8 tests passed, including
explicit read-only access and ownership checks. Web/mobile build, mobile test
and Supabase contract typechecks pass. Strict scoped mobile/scripts, package
and web lint, scoped formatting and `git diff --check` pass. These are local
checkpoint gates, not D10 exit acceptance.

Final commands include:

```bash
# From apps/mobile; Node 24.20.0 is first in PATH.
node ../../node_modules/jest/bin/jest.js --config jest.config.js --ci --runInBand --watchman=false --runTestsByPath src/services/__tests__/starterPackService.test.ts src/services/__tests__/officialContentCatalogService.test.ts src/services/__tests__/collectionSharingService.test.ts src/services/__tests__/dictionarySharingService.test.ts src/services/__tests__/dictionaryTransferService.sqlite.test.ts src/hooks/__tests__/useStarterPackImport.test.ts src/hooks/__tests__/useImportSelection.test.ts src/lib/__tests__/supabase.test.ts src/db/__tests__/officialPackImport.sqlite.test.ts src/stores/__tests__/wordActions.test.ts
# From repository root.
node node_modules/jest/bin/jest.js --config apps/web/jest.config.mjs --ci --runInBand --watchman=false --modulePathIgnorePatterns '<rootDir>/reports/' '<rootDir>/.stryker-tmp/' --runTestsByPath apps/web/src/features/starter-pack/official-dictionary-mapping.test.ts apps/web/src/features/starter-pack/dictionary-import.test.ts apps/web/src/features/sharing/dictionary-transfer.test.ts apps/web/src/features/sharing/dictionary-repository.test.ts
WOORDENAAR_PG_BIN=/opt/homebrew/opt/postgresql@15/bin node --test --test-concurrency=1 --test-timeout=120000 scripts/postgres-tests/official-dictionary-mapping.test.mjs
npm run mobile:typecheck:test
npm run typecheck --workspace @woordenaar/supabase-contracts
node scripts/generate-supabase-target-types.mjs
node scripts/generate-supabase-target-types.mjs --check
```

Exact D10 sources: [code paths](D10-code-paths.txt),
[SHA-256 fingerprints](D10-source-sha256.json). Full dirty checkout inventory:
[dirty paths](D10-dirty-paths.txt). Some files already contained D03-D09 work;
fingerprints describe the current combined contents, not an isolated D10 diff.

The SQL harness creates a new synthetic Unix-socket-only PostgreSQL cluster,
does not load `.env` or use an existing database, and stops/removes only its own
temporary directory. Scoped escalation was needed for PostgreSQL shared memory.
No native device, retained Docker QA stack, production or paid provider was
started. Target generation/check used only new random task-owned PostgreSQL/
Postgres Meta containers on internal networks with tmpfs and no host ports.
Both commands exited 0 after removing their own containers/networks.

## Corrections during implementation

- Sandbox initdb shared memory failure: rerun the isolated harness with scoped
  escalation; the failed private temporary directory was cleaned up.
- Fixture review date mismatch: corrected the fixture publication timestamp.
- Fixture attempted changing referenced provenance: replaced it with a separate
  provider fixture; retained the source immutability guard.
- SQLite rejects reference plus fallback in one state: retain the v13 invariant,
  cache the verified complete revision before inserting pinned cards, then queue
  create-private and link in one transaction. Test method name was corrected.
- Old shared-import expectation forced duplicates into the requested collection;
  corrected the expectation and retained the server's existing collection.
- New sharing fixture used an import preview where a full personal word type was
  expected; use the pure official content converter rather than inventing SRS.
- Read-only regression initially called the access-level function without its
  required UUID; corrected the fixture to pass `auth.uid()`.
- Strict lint found repeated fixture literals and complexity in shared import;
  extracted persistence/request helpers and constants, without disabling rules.

## Current boundary

D10.1 and D10.2 complete. First incomplete checkpoint remains D10.3. D10.4 and
D10.5 code/tests are local but their ordered completion and exit review remain.
No actual native QA, integrated cross-device acceptance or release-readiness
claim is made. Exact next review inputs:

1. Mobile official offline imports currently use local personal creation followed
   by ordinary sync. Read-only accounts cannot insert ordinary word rows through
   RLS. Review an import-specific persistence path that permits authorized pack
   imports into existing owned collections without broadening creation/edit rights.
2. A semantic duplicate created on another device can be discovered by normal
   sync after an offline personal ID was allocated. The inherited duplicate path
   marks the local row synced while its dictionary create/link queue retains that
   ID; subsequent personal-ID reconciliation must preserve SRS/history, pending
   reviews/resets, private edits and command foreign keys. Do not silently attach
   an existing private card, move it or discard queued learning.
3. Audit server duplicate locking/selection consistency alongside the proposed
   import protocol, then add meaningful concurrent regressions and run only the
   affected gates. If SQL changes, regenerate/check target types again.
4. Complete recipient visibility/private-copy/export review and both-client
   import/export/reimport coverage before closing D10. Do not start D11.

The user subsequently confirmed GPT-6 Astra / High; review and bounded repairs
are complete and supersede the affected observations above. Continue D10.3
implementation on GPT-6.1 Sol / High using the linked review contract. Direct
current-thread picker control remains unavailable.

Task-resource read-only verification at this checkpoint: exact D08 iOS UDID is
Shutdown, task Android AVD process absent, all four named D08 Docker containers
exited. No running/uncertain test, generator or QA operation remains. Other
sessions/devices untouched; no production/cutover/deploy/paid/Git publication.
