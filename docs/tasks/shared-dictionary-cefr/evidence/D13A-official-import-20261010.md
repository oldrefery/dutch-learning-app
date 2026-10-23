# D13A.5 — Official starter-pack following adoption

Date: 2026-10-10. Checkpoint complete locally; D13A.5 remains in_progress.
Recommended model/effort: GPT-6.1 Sol / High. No picker switch claimed.
Branch: feature/shared-dictionary-schema. HEAD: f97a733407a4d2b37e8f9ca030ad9574de85a794.
Persistence: local-only/uncommitted. No external project operation was started.

## Behavior and authority

Native and web starter-pack routes now use the retained shared-import panel when the
existing following/import opt-ins are enabled. The complete approved raw manifest becomes
a normalized schema2 original; spelling duplicates do not silently discard a pack meaning.
Selection indexes bind to the manifest's stable entry IDs. New mode requires an existing
owned destination; ordinary collection creation is a separate action. Web pack views are
keyed by owner as well as pack/version. Signed-out/missing-manifest paths fail closed.
With the following gates OFF, the existing legacy preview/import behavior is retained.

Explicit Save selected document fetches and verifies a mapping against exact pack/version,
manifest digest, entry membership, full normalized content digest and CEFR input digest.
The complete original and optional official_pack provenance (including every entry ID)
are saved in the existing owner-scoped native SQLite/browser journal. Older generic
transfer sessions round-trip without the optional field. No personal row or import root is
created by preparation; no schema migration or generated backend contract changed.
Native can reuse the existing verified mapping cache after a network failure; web uses a
current read-only mapping RPC. A null mapping yields a retained unresolved original.
Mapping preparation uses fresh authenticated-owner checks, so initial preparation requires
working Auth. Already-saved drafts/decisions and queued roots remain reconstructible offline.
An expired/withdrawn cached mapping is a hint, never authority to publish or insert a card.

Verify selected references is separate from preparation and reads exact immutable published
revisions. Only an exact full-content match yields a kind=official-pack v2 intent carrying
pack/version/entry/manifest plus reference/content digest. Unmapped, unavailable or differing
entries remain for review in the original; no spelling resolution, private-copy fallback,
automatic conversion or paid analysis occurs. Intent-to-index and operation/word nonces are
immutable and survive restart. Queue, delivery, receipt/status, conflict resolution,
recovery/cancellation and personal/shared hydration reuse the existing explicit actions.
Server capability, current source publication/mapping and target ownership checks remain
mandatory at delivery. Withdrawal/lost delivery keeps the same reserved request and original;
there is no automatic replay or fresh nonce. Learning/SRS and placement are not copied from
pack data or inferred from receipts. Hydration retains its existing preservation guarantees.

Mounted lifetime, Auth A-to-B-to-A, fresh owner verification and gate changes fence preparation
before journal save. Full source contents cannot change beneath a selection. A stale native
legacy handler and web legacy action/lower import helper reject in following mode before
legacy mutation or collection creation. Native collections are fetched for preview normally;
new-mode preparation does not create a collection or invoke the legacy addWords path.
All gates remain OFF in the working configuration; this is dormant local integration.

## Verification

Runtime: Node 24.20.0 via /Users/devrush/.nvm/versions/node/v24.20.0/bin.
Supabase current RPC/getUser documentation consulted via Context7 (/supabase/supabase),
and installed Next.js use-router documentation read.
Exact source/test/log hashes: [machine evidence](D13A-official-import-20261010.json).

| Check                                               | Result                                                               |
| --------------------------------------------------- | -------------------------------------------------------------------- |
| Full mobile suite, configured coverage              | 181 suites, 2304 tests, 22 snapshots; zero skipped/todo              |
| Full web suite, benchmark enabled                   | 104 suites, 967 tests; zero skipped/todo                             |
| Focused native source/hook/UI/controller/SQLite     | 5 suites, 89 tests; before final fixture constant cleanup            |
| Native pack route                                   | 1 suite, 3 tests; included in full                                   |
| Focused web source/legacy guards/UI/browser journal | 7 suites, 58 tests; included in full                                 |
| Web pack page after loader fixture update           | 1 suite, 9 tests; owner-remount regression added before passing full |
| Mobile production/test, web and domain types        | Pass                                                                 |
| Root/web/changed domain-content lint                | Pass, zero warnings                                                  |
| Scoped format and git diff check                    | Pass                                                                 |

Final mobile/package sources match the source manifest captured before the passing native
full run. Web route/fixture updates occurred afterward; a second full web run passed with
its final source manifest. No production/test source changed after its relevant passing
full suite. Native31 and web28 new regressions cover raw pack routing, exact source identities,
null/forged/mismatched/withdrawn mappings, immutable provenance and selection/nonces, owner/
Auth ABA/unmount/gate/target fences, restart/SQLite/browser owner isolation, lost delivery,
explicit UI and legacy flags OFF. Native panel is verified in light and dark themes.

Failed attempts were repaired and their logs retained: target validation initially affected
generic transfer fixtures, then was scoped to official preparation; a mutable-target fixture
was corrected to modify the captured list; native Auth subscription typing/import ordering
and repeated test literals were fixed; native route mocks needed lazy Text and Expo Color;
web page mocks needed the raw-manifest loader. The failing first full web log is retained;
its repaired page and new owner-reset regression are covered by the passing second full.
No skip/todo, new any or lint suppression was introduced.

562 entry hashes verified; 29 current source/test paths extend11 existing bundle paths and
add18 first-audited paths (six new files and twelve existing files), giving246 audited paths.
The37 historical test mirrors and47 sealed artifacts are unchanged. Backend/Edge/SQL/
generated target checks are carried from prior checkpoints only. Exact dirty paths are in
reports/shared-dictionary-cefr/d13a5-official-import-20261010/git-status.txt. All runners exited;
no pending resource or uncertain external operation remains. The Node benchmark still has
long tasks; native/browser/device/review performance is not qualified. Broad-domain
app-config.ts:171 any remains outside the delta; only changed-domain lint is claimed.

## Next checkpoint and permissions

D13A.5 remains in_progress; D13 observation open, D14 pending. Next: **explicit shared-
collection following source adoption**, **GPT-6.1 Sol / High**. Read mobile useImportSelection,
collectionSharingService, ImportByTokenModal/ImportCollectionSheet and their import route;
web SharedCollectionImport/actions/repository and the current v2 shared reader/transfer path.
Bind explicit share token and stable source word IDs to the complete retained original,
verify current published references/content before durable source-aware intents, and reuse
receipt/conflict/hydration/recovery actions. Preserve unresolved/different originals and
existing target/learning state. Verify withdrawn shares, wrong owner/token/source IDs,
offline/restart/Auth/gates, ambiguous identity and no v1/private-copy downgrade. High is
recommended for token provenance, durable identities, ownership and learning boundaries.
Broader new-word source adoption, private/mode/server-history reconciliation, representative
review performance and D13A.7/8 qualification remain open.

Always announce the next recommended model and reasoning effort; the owner reaffirmed
this preference on October10. No automatic model/effort change is claimed.
All new client/server gates OFF, shared_analysis FALSE, roles/policies unseeded, CEFR OFF.
AUTH27–29 consumed. No commit/push/PR, hosted migration, conversion, provider/paid call,
publication, Expo/EAS/release, device operation or automation was authorized or performed.
