# D13A.5 — Explicit transfer2 selection and retained-document UI

Checkpoint complete locally on October10,2026; D13A.5 remains in_progress,
D13 observation open and D14 pending. GPT-6.1 Sol / High is owner-confirmed;
no picker switch is claimed. Branch feature/shared-dictionary-schema,
HEAD f97a733407a4d2b37e8f9ca030ad9574de85a794; local-only/uncommitted.

## Result

Mobile and web JSON import forms route strict schema2 documents into explicit shared
selection; schema1 keeps its existing private-copy path. Schema2 never uses the legacy
spelling duplicate heuristic or request endpoint. A document is saved in full before
reference verification, with its owned destination and up to100 selected indexes.
Exact published reference/hash/full-content decisions are retained by the existing
transfer journals; differing private content and missing references remain review cases.

Saved documents can be reopened explicitly. The original, including unselected entries,
examples and media, can be inspected; mobile can copy the complete saved document and
web can display its readonly JSON. Native entries use FlatList; web pages50 entries.
The form offers explicit verification, offline reservation, import and same-ID status
checks. Mount/reload only read local journals and do not verify, dispatch or read server
state. A lost response retains the existing document/index-to-word/operation mapping.
Rapid clicks do not create parallel imports. Status controls remain when creation flags
withdraw. Nothing consumes a paid analysis slot.

A common action controller binds each awaited chain to its mounted lifetime and owner.
Unmount, Effect cleanup/setup, owner/Auth A-to-B-to-A or flag withdrawal after reservation
stop subsequent delivery; the saved draft/request remains intact. Services independently
retain their existing Auth/server/source/capability checks. A recovery/cancellation root
or an explicitly read cancelled/unavailable state prevents original delivery from this
form. The form checks existing state but does not yet offer placement recovery/cancel.

A finished server import is described as confirmed with local dictionary loading still
required. Receipt metadata is not used to construct a personal word, SRS or shared cache.
This checkpoint does not wire targeted personal pull, complete shared hydration, web
cache refresh or official/shared/new-word adoption.

## Verification

- Full mobile:178 suites,2198 tests,22 snapshots, configured coverage; zero skipped/todo.
- Full web:101 suites,905 tests, benchmark included; zero skipped/todo.
- Focused mobile:3 suites/30 tests; focused web:4 suites/20 tests.
- Production/test mobile, route/test-inclusive web, domain and contracts types PASS.
- Root/web lint zero warnings; changed-domain controller/index lint PASS.
- Scoped format and git diff --check PASS. A second formatting pass changed only trivia
  in one native UI test; exact TypeScript non-trivia token equality is recorded.

New tests cover full-original retention before verification, exact-meaning-only actions,
private/unselected review, failed verification/retry, metadata-only restore, unknown
outcomes/same-ID state checks, rapid clicks, flags OFF, unmount/reservation, Effect epoch,
Auth ABA, server flag withdrawal and schema2 routing. Native UI runs in light/dark themes.
Existing SQLite/browser journal, server/SDK/import and schema1 tests run in the full suites.
UI tests use mocked network edges; no device/browser E2E or hosted qualification is claimed.

Initial failures were repaired: raw fixture property order did not match normalized
immutable journal rows; native TouchableOpacity exposes accessibilityState.disabled;
a schema2-is-future assertion now uses schema3; test fixture literal types needed exact
protocol/outcome annotations; React refs must not be assigned during render; duplicated
test labels were extracted. Logs remain in the fresh report directory. No lint suppression,
threshold change or weakened schema validation was added.

Coverage totals:statements73.75%,branches60.82%,functions74.23%,lines74.96%.
Node benchmark measurements on the concurrently loaded host are383.303–674.644ms and
all10 are long tasks. This is retained evidence, not browser/native performance acceptance.
The pre-existing broad all-domain lint issue app-config.ts:171 any is carried unresolved;
this checkpoint runs changed-domain lint and does not claim a passing broad package scan.

## Integrity and scope

Entry verified353 baseline paths.14 current source/test paths,209 of210 prior source
paths preserved,1 prior source extension and13 additions to the evidence source union,
223 source paths total. These additions include previously tracked form/hook files;
8 files are newly created and6 existing files are extended by this checkpoint.
37 historical test mirrors and47 sealed artifacts remain unchanged. Backend SQL/Edge and
generated target are untouched; Edge76/selected PostgreSQL95/target checks are carried only.
Exact source/note/log hashes and protected baseline paths are in the adjacent JSON packet.
Reports:reports/shared-dictionary-cefr/d13a5-transfer-ui-20261010/.

No commit/push/PR, provider/paid/hosted migration, conversion/publication, EAS/release,
device operation or automation. All new client/server gates remain OFF, shared_analysis
FALSE, roles/policies unseeded, CEFR OFF; AUTH27–29 consumed. Dirty bundle preserved.
All runners exited; no external operation or resource pending. Originals are protected
owner-bound transfer drafts, not per-user linguistic authority. Existing journal limits
and no-eviction behavior are unchanged.

## Next checkpoint

**D13A.5 — recommended GPT-6.1 Sol / High.** Connect finished import/recovery results to
an explicit, owner-fenced targeted personal pull, then complete shared hydration and web
refresh. Read syncManager targeted pull, wordRepository merge/tombstone semantics,
dictionaryFollowingSync generation fences and web cache/read boundaries before wiring.
Do not substitute a broad sync/push or build rows from receipt metadata. Preserve newer
placement, unsynced learning and tombstones; never resurrect deleted rows or downgrade to
private content. Persist/recover failed hydration without new import nonces. Test restart,
offline/two owners, source/capability/flag withdrawal and failure after each boundary.
High is recommended for the coupled Auth/personal-row/SRS/tombstone/shared-cache boundaries.

Broader placement recovery/cancel UI, official/shared/new-word adoption, private/mode/
server-history reconciliation, review performance/parity and D13A.7/8 model/device/release
acceptance remain separate work within the stage.
