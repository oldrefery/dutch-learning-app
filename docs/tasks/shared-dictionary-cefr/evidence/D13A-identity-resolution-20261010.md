# D13A.5 — Explicit existing-card identity-conflict resolution

Date: 2026-10-10. Local checkpoint complete; D13A.5 remains in progress.
Recommended model/effort: GPT-6.1 Sol / High. No picker switch claimed.
Branch: feature/shared-dictionary-schema. HEAD: f97a733407a4d2b37e8f9ca030ad9574de85a794.
Persistence: local-only/uncommitted. No external project operation was started.

## Behavior

Retained-import panels on mobile/web now offer **Load existing card** only for the latest
confirmed identity-conflict result. This explicit path obtains the existing personal ID
from the immutable original-import or recovery receipt. Regular imported-card loading
still requires inserted/applied results. Neither path chooses a card by spelling, rewrites
receipts or original nonces, delivers an import, changes placement or merges learning.
Mount/reload reads local metadata only; loading after failure/restart requires a click.

The conflict path validates the root remains uncreated, not inserted or cancelled, with
the expected recovery version (zero for original conflict, receipt version for recovery).
It checks that state again after shared loading. Local pending/newer recovery/cancellation
fences loading at journal checks around network boundaries; account A-to-B-to-A, mounted
request epoch and following-read gate withdrawal prevent a successful completion. Creation
flags can remain OFF for reading an already-existing card. Server capability/permissions
and ownership remain authoritative; this does not create or convert a personal card.

Native targeted personal pull now optionally requires raw follow-mode metadata with the
requested shared entry before SQLite writes. Missing/deleted/foreign/wrong IDs, absent
deletion status, wrong meanings, legacy modes and invalid personal learning data fail
closed. Exact same-ID refresh reuses the existing owner-fenced transaction, preserving
newer rows, pending learning/placement, learning commands and tombstones; semantic local
collisions reject rather than merge. A missing local owned collection still requires
ordinary collection sync. No broad push, cursor advancement or receipt-derived SRS occurs.

Complete shared dependency/sibling hydration selects the receipt's existing ID and
requires follow mode and the same shared entry. A failed shared read leaves valid personal
state and hydration debt available for explicit retry. A mode/meaning change during shared
fetch never commits an incompatible shared cache. If remote root cancellation is detected
after valid cache hydration, the action fails without readiness; already-valid same-ID
personal/cache data is not rolled back. Server reads and local writes are not one remote
transaction. Later remote changes are handled by ordinary synchronization.

Web checks exact personal ownership/ID and explicit null deletion status, then validates
the complete effective v2 batch for that ID/meaning/mode. Journal stability is checked
after network reads and before requesting router.refresh(). No personal or private browser
cache is persisted, and refresh is a request rather than a delivered-payload acknowledgement.
UI explains that the current existing card/collection, its learning and saved original
are kept. Existing legacy/private or different-meaning cards remain unresolved and fail
closed; this checkpoint does not convert or detach them.

## Verification

Runtime: Node 24.20.0 via /Users/devrush/.nvm/versions/node/v24.20.0/bin.
Supabase documentation consulted with Context7 (/supabase/supabase); installed Next.js
use-router guide reviewed. No remote project state or credentials were accessed.
Exact sources/logs and final fixture repair: [machine evidence](D13A-identity-resolution-20261010.json).

| Check                                             | Result                                                                  |
| ------------------------------------------------- | ----------------------------------------------------------------------- |
| Full mobile suite, configured coverage            | 179 suites, 2273 tests, 22 snapshots; zero skipped/todo                 |
| Full web suite, benchmark enabled                 | 102 suites, 939 tests; zero skipped/todo                                |
| Focused native hydration/controller/light-dark UI | 3 suites, 87 tests before final unknown-deletion case; full includes it |
| Focused web hydration/UI                          | 2 suites, 35 tests before final unknown-deletion case; full includes it |
| Final web hydration after fixture type fix        | 1 suite, 28 tests                                                       |
| Mobile production/test, web, domain types         | Pass                                                                    |
| Root/web/changed-domain lint                      | Pass, zero warnings                                                     |
| Scoped format and git diff check                  | Pass                                                                    |

All production and mobile test sources match their full-suite source hashes. After full
web, one web test fixture changed: an unreachable comparison against unknown-deletion was
removed from the prior branch narrowed to deleted or wrong-owner. Its runtime behavior is
unchanged; the new existing-card unknown-deletion case remains tested. Final affected28
web tests and web typecheck pass. No exact-final-byte full web rerun is claimed; before/after
hashes and repair text are retained. No production source changed after full runs.

New native28/web17 cases cover original/recovery conflicts, exact existing IDs, no original
replay, immutable journals, learning/queue preservation, two owners/Auth ABA, local/remote
deletions, unknown deletion status, wrong meanings/modes, semantic collisions, cancelled/
changed recovery states, offline restart, pending operations and explicit light/dark UI.
Initial cognitive-complexity/duplicate-string lint and native RPC mock-wrapper failures
were repaired; final unreachable web fixture comparison was corrected. Failed logs retained.
No test skip, any addition or lint suppression was introduced.

519 entry hashes verified. All13 source/test paths extend the existing228-source bundle;
no source additions. The37 historical test mirrors and47 sealed artifacts are unchanged.
Backend/SQL/generated target remain unchanged; prior backend/Edge/PostgreSQL checks are
carried only. Exact dirty paths are recorded in the report directory's git-status.txt.
All runners exited; no pending resource or uncertain external operation remains.
Node benchmark still has long tasks, so native/browser/device/review performance is not
qualified. Pre-existing broad-domain app-config.ts:171 any remains outside this delta;
only changed-domain lint is claimed.

## Next checkpoint and permissions

D13A.5 in_progress; D13 observation open, D14 pending. Next: **official starter-pack
following import adoption**, GPT-6.1 Sol / High. Start with mobile useStarterPackImport,
starterPackService/officialContentCatalogService and web starter-pack dictionary-import,
actions/repository plus content mapping contracts. Bind selected entries to verified
pack/version/manifest/entry and shared references before preparing owner-scoped v2 intents;
preserve unmapped/different originals for review, stable selection IDs and offline recovery.
Connect current receipt/conflict/targeted-hydration paths. No private fallback, original
replay, paid analysis, automatic old-card conversion, gate activation or publication.
Verify missing/withdrawn mappings, offline/restart/Auth/placement/SRS and legacy flags OFF.
Broader new-word/shared source adoption, private/mode/server-history reconciliation,
representative review performance and D13A.7/8 qualification remain open.

All new client/server gates OFF, shared_analysis FALSE, roles/policies unseeded, CEFR OFF.
AUTH27–29 consumed. No commit/push/PR, hosted migration, conversion, provider/paid call,
publication, Expo/EAS/release, device operation or automation was authorized or performed.
