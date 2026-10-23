# D13A.3 — Import/cache/legacy contracts and final local verification

Completed October 10, 2026, GPT-6.1 Sol / High (owner-confirmed).
D13A.3 is **done locally**; the D13A extension remains in_progress.
Next: **D13A.4 — GPT-6.1 Sol / High**, semantic evaluator/provider orchestration,
diff/history and administrator rollback workflow. No provider or hosted operation
is authorized by this checkpoint.

## Prepared behavior

- Default-off protocol2 verified shared-reference imports, official immutable
  manifest mappings and explicitly shared follow sources. Receipt binds original
  adoption, applied current head and decimal event sequence. Fresh SRS inserted
  once; identity conflicts, private/unresolved input and foreign targets fail safely.
- Shared v1/v2 root/nonce ledgers, immutable replay, placement CAS, cancellation,
  late-original fences and Auth cleanup. Existing recovery moves only placement,
  even after disablement/retirement; missing-row creation stays gated. Hard/soft
  deletion never resurrects an imported ID. Concurrent choices/moves preserve
  the winner and all learning.
- Bounded portable/shared exports with optional verified public references and
  no learning or private provenance. Private/retired content remains portable with
  no usable reference. Legacy v1 wire shapes and queued contracts remain unchanged;
  follow sources use current content while v1 imports still create legacy snapshots.
- Service-only cache resolution requires explicit mapping, freshness and full
  payload equality, deduplicates current published dependencies, and performs no
  inference/publication. Unresolved statuses carry no usable reference. Version1
  media-only mapping is preserved; version2 rejects full content/media mismatch.
- Strict domain import/recovery/transfer/cache parsers and locally generated
  public target types through 20261010120000. Private helpers deny clients/service;
  import/recovery/export is authenticated-only, cache resolution service-only.

## Verification

| Gate                       | Final result                                                                                                                                 |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Isolated PostgreSQL16.13   | 158 unique passing tests: import/cache/legacy 19, recovery 11, publication 22, operations 19, following 16, other unchanged compatibility 71 |
| Mobile with coverage gates | 161 suites / 1891 tests / 22 snapshots PASS                                                                                                  |
| Focused domain contracts   | 5 suites / 90 tests PASS                                                                                                                     |
| Web units                  | 86 suites / 780 tests PASS, one pre-existing skipped; earlier this checkpoint before recovery-only additions                                 |
| Types                      | Domain, contracts, mobile build/test and final web PASS                                                                                      |
| Lint                       | Zero errors/warnings                                                                                                                         |
| Formatting                 | All new/extended source files with configured parser PASS; SQL formatter not configured                                                      |
| Generated target schema    | Exact --check PASS                                                                                                                           |
| Integrity/diff             | Prior 25 source hashes, four sealed hashes, four legacy domain modules and ten mirrored SQL test bodies verified; git diff --check PASS      |

Final 30 new tests and 128 unchanged compatibility tests use the final migration;
intermediate successful runs are not added to the count. Some existing fixtures
intentionally apply earlier migration stages. The unchanged pinned Docker adapter
uses network none, Unix sockets and tmpfs without app env, host ports or credentials.
Host PostgreSQL 15 IPC issue remains untouched. Read-only final cleanup verified zero
task test/type containers and type networks; no pending tool/external operation.

The initial raw Node/domain import failure ran no SQL; parsers moved to Jest.
An over-eager media cache invalidation broke the existing v1 contract (124/128,
three dependent fixture failures); removed it and verified full final128 passes.
Final-run setup retries corrected mirror cwd/platform.sql, Watchman and redundant
Jest worker options. Duplicate literals became constants without suppression.
Failed and intermediate logs are retained in
`reports/shared-dictionary-cefr/d13a3-import-cache-20261010`.
Exact final commands, results, source/test/log hashes, cleanup timestamp, preceding
failures and dirty inventory are in [the JSON evidence](D13A-import-cache-20261010.json).

## Persistence and limits

Same branch `feature/shared-dictionary-schema`, HEAD
`f97a733407a4d2b37e8f9ca030ad9574de85a794`. Ten source/type/test files plus task
notes/evidence remain local-only and uncommitted. Legacy queued import/transfer/
recovery modules and prior source/sealed artifacts remain intact. Unrelated
`.playwright-cli`, backups and QA exports preserved.

All new flags default OFF; real validator policies/grants are unseeded, capability2
shared analysis unavailable and CEFR OFF. No hosted migration/linking/publication,
paid/provider call, commit/push/PR/merge, release/device operation or automation.
D13 observation stays open, D14 pending, AUTH-27/28/29 consumed.

Semantic evaluator/provider workflow, diff/history/admin rollback, client/offline
integration, reviewed corpus mapping, dedicated review and live release/observation
remain D13A.4–9. All 26 declarative acceptance fixtures and exact embedded/build85
end-to-end/device acceptance are not claimed executed. Root ESLint excludes domain
as before; strict typechecks and parser tests cover it. Target types are local schema
contracts and do not describe the hosted schema. Full web units were run before
recovery-only exports/two mobile tests; final web typecheck covers the final bundle.
