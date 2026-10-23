# D13A.5 — Explicit imported-card hydration

Date: 2026-10-10. Local checkpoint complete; D13A.5 remains in progress.
Recommended model/effort: GPT-6.1 Sol / High. No picker switch claimed.
Branch: feature/shared-dictionary-schema. HEAD: f97a733407a4d2b37e8f9ca030ad9574de85a794.
Persistence: local-only/uncommitted. No external operation was started.

## Behavior

Mobile and web retained-document panels now offer **Load saved import**. The action
selects the latest durable confirmed `inserted` or `applied` result for the original
intent, then checks authenticated current state. It never creates a personal row from
receipt metadata, retries an import POST, changes a nonce or advances a broad sync cursor.
An unresolved recovery/cancellation or identity-conflict receipt remains for explicit
resolution. Mount/reload still reads local metadata only.

Native loading reads the exact owned personal ID through the existing remote word parser.
Required SRS/timestamps must be present before its legacy defaults can run. The repository
commits that personal read and its shared hydration debt in one owner-fenced SQLite
transaction. It rejects a deleted/foreign exact ID, a semantic identity collision and a
missing/deleted/foreign collection. Pending learning/content/import queues, unsynced rows
and newer synchronized rows remain unchanged. No collection or personal learning state is
synthesized. Missing collections require ordinary collection synchronization before retry.

Shared hydration uses the existing complete affected-entry/sibling path and generation
fences. The imported row must follow the requested meaning; an original inserted receipt
also bounds its publication sequence/revision. A failed shared read leaves personal data,
hydration debt, journals and original IDs available after restart. Late account ABA,
unmount, local flag withdrawal, changed recovery journal or card deletion prevents a
successful completion. Current creation gates may be off while an already-confirmed card
is read, but the following read gate and server capability must remain available.

Web loading verifies current personal ownership and deletion state plus the complete v2
shared dependency batch before requesting `router.refresh()`. This is a current-route
refresh request, not proof that the new server-rendered payload was delivered. The import
page uses authenticated cookie-bound Supabase reads without a server data-cache wrapper;
no shared/private content is persisted into a browser personal cache by this action.
Native loading makes the card available in SQLite; normal collection reads project the
current cache. Active review questions are not rewritten by this action.

## Verification

Runtime: Node 24.20.0 via `/Users/devrush/.nvm/versions/node/v24.20.0/bin`.
Logs and hashes: [machine evidence](D13A-import-hydration-20261010.json).

| Check                                                | Result                                                                |
| ---------------------------------------------------- | --------------------------------------------------------------------- |
| Full mobile suite with configured coverage           | 179 suites, 2227 tests, 22 snapshots; no skipped/todo                 |
| Full web suite with benchmark enabled                | 102 suites, 917 tests; no skipped/todo                                |
| Final post-extraction native hydration + syncManager | 2 suites, 110 tests                                                   |
| New native real-SQLite hydration cases               | 28 cases, included above and in full mobile                           |
| Web hydration and transfer panel                     | 2 suites, 18 tests; included in full web                              |
| Common controller + native light/dark UI wiring      | Included in full mobile                                               |
| Mobile production/test, web, domain, contracts types | Pass; final mobile test-inclusive typecheck repeated after extraction |
| Root/web/changed-domain lint                         | Pass, zero warnings                                                   |
| Scoped format and `git diff --check`                 | Pass                                                                  |

The full mobile run preceded two small syncManager validation-helper extractions prompted
by cognitive-complexity warnings (18, then 16; limit 15). Only that source changed after
the full run. Its final source passed the 110 affected tests, test-inclusive typecheck
and root lint. Pre-extraction hashes are retained; an exact-post-extraction full mobile
rerun is not claimed. Web source did not change after its full passing run.

Regression cases cover server personal SRS, exact IDs, two owners, actual queued learning,
newer placement/learning, missing/foreign/deleted collections and cards, semantic identity
collisions, offline/restart, current receipt recovery, pending cancellation during a read,
Auth ABA before personal commit and during shared read, gate/capability withdrawal,
missing dependencies, same-meaning sibling completion, stale head rejection, local
transaction rollback and deletion during hydration. UI tests check explicit button wiring
and no automatic loading/re-dispatch on reconstruction.

Initial failures were retained and repaired: the login shell selected Node20 without
`node:sqlite`; native Auth/getMockImplementation fixture gaps; web RPC/JSON type scope;
incorrect assumption that local collections have `deleted_at`; cognitive complexity.
No tests were removed or skipped. Lint rules were not suppressed.

## Preservation and limits

All 419 pause-manifest paths matched at entry. The 16 source/test paths comprise 11
extensions and 5 additions, producing a 228-file source union. All 37 historical mirrors
and 47 sealed artifacts are unchanged. Existing dirty/untracked files, private reports,
backups, QA state and `.playwright-cli` are preserved. Exact dirty paths and final hashes
are in the machine evidence/report directory. No Git reset, clean, switch or commit.

Backend SQL, generated target schema and Edge code did not change; their prior test
results are carried, not rerun. The typed browser contract only exposes the already
implemented effective-content read. No hosted migration, provider/paid call, live card
conversion, publication, push/PR, EAS/release, device operation or automation occurred.
New gates stay OFF, shared_analysis FALSE, roles/policies unseeded, CEFR OFF. AUTH27–29
remain consumed. All task runners exited; no uncertain external operation is pending.

The Node benchmark still reports long tasks on this loaded host; this does not qualify
native/browser performance. The pre-existing broad-domain `app-config.ts:171` any remains
outside this delta; only changed-domain lint is claimed. Existing-card conflict resolution,
collection synchronization, source adoption, private/mode/server-history reconciliation,
review parity/performance and device/release acceptance remain separate work.

## Next checkpoint

Continue D13A.5 with explicit recovery/cancellation controls on mobile and web, recommended
**GPT-6.1 Sol / High** for coupled placement CAS, durable intent IDs, ownership and deletion.
Read the existing recovery contracts/client journals, transfer action and panels. Obtain
fresh server placement/recovery version for an explicit destination choice; persist exact
recovery/cancel operations before dispatch; preserve unknown results and original nonces;
show conflict/current-state outcomes. Invoke this hydrator only after confirmed applied
recovery. Test restart/offline, two owners/Auth ABA, CAS races, disabled creation gates,
concurrent deletion and unchanged SRS. D13 observation stays open; D14 is pending.

Documentation checked: [Supabase owner filtering](https://github.com/supabase/supabase/blob/master/apps/docs/content/troubleshooting/rls-performance-and-best-practices-Z5Jjwv.mdx),
[Next.js refresh semantics](https://github.com/vercel/next.js/blob/canary/docs/01-app/03-api-reference/04-functions/use-router.mdx),
and installed `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-router.md`.
