# D13A.5 creation adoption checkpoint — October11

Checkpoint complete locally; D13A.5 remains in_progress. Recommended next model:
**GPT-6.1 Sol / High**. Exact manifests, logs and runner outcomes are in the
[JSON evidence](D13A-creation-adoption-20261011.json).

## D13A.5 progress ledger (stable original checklist)

D13A.5 has **8 original client checklist items: 5 complete, 3 open**. The ten
remaining numbered milestones belong to the larger roadmap; they are not ten
implementation actions or an estimate of remaining sessions. Count a checklist item
as complete only when its entire stated scope is verified. A completed local
checkpoint advances a named part; it does not silently replace an open item.

| Original item                                                                   | Status           | Verified scope / remaining work                                                                                                                                           |
| ------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Web hydration and review snapshot                                            | Complete locally | Bounded protocol2 reads, dependency and session boundaries                                                                                                                |
| 2. Legacy/private read projection preservation                                  | Complete locally | Raw compatibility reads remain separate from strict published revisions                                                                                                   |
| 3. Native following storage                                                     | Complete locally | Atomic schema/cache/head/reference/debt storage and restart/fault checks                                                                                                  |
| 4. Native following runtime                                                     | Complete locally | Owner/offline sync, materialization, debt/status and review integration                                                                                                   |
| 5. Shared action transport and owner journals                                   | Complete locally | Durable one-shot metadata and read-only status foundation                                                                                                                 |
| 6. Shared Analyze again and publication refresh parity                          | Open, partial    | Journals, actor/SDK/status UI exist; finish and qualify publication refresh on all clients                                                                                |
| 7. New-word/import/transfer2 adoption and preserved private/mode reconciliation | Open, partial    | Source lookup, imports and transfer2 are implemented; no-match creation adoption/hydration is now complete locally; preserved private-payload/mode reconciliation remains |
| 8. Web offline/account-return and review-start performance/parity               | Open             | Complete remaining recovery scenarios and representative performance/parity checks                                                                                        |

Fixed work inventory inside original item7: **4 named areas, 3 complete locally,
1 open**. This is a scope breakdown, not a promised number of turns:

- [x] Published-meaning new-word lookup and explicit owned destination.
- [x] Official/shared imports and transfer2 selection, delivery, recovery and hydration.
- [x] No-match creation/status forms followed by distinct personal adoption and verified hydration.
- [ ] Preserved legacy private payload and explicit mode reconciliation without automatic old-card conversion.

Next local checkpoint is the last area of item7. Do not add new requirements to
these counts without recording the scope change. User-facing updates must name the
area advanced and show both **5/8 original items** and **3/4 areas of item7** until
one of those counts actually changes. D13A.6-9 and D13/D14 gates remain separate.

**2026-10-11 local — Published creation adoption/import/cache hydration complete locally; D13A.5 in_progress.**

See [report](D13A-creation-adoption-20261011.md) and [exact hashes/results](D13A-creation-adoption-20261011.json).
The completed checkpoint closes area3 of original client item7: explicit creation
publication/existing-resolution reference to owned personal import, distinct immutable
nonce/target, saved receipt and separately loaded personal/shared content. Creation
journal is saved before the following-import journal and its single fresh claim.
An interrupted bridge reuses saved IDs. A submitted import never automatically
redelivers; status is read-only, and explicit confirmation reuses the exact saved
non-provider import. Confirmed prior insertion can recover its receipt with new-work
flags OFF; unconfirmed insertion stays gated. Cancel/move/recovery metadata or stale
owner/context prevents completion. No generator is called by adoption or loading.

Native/web creation panels expose separate Add, Check, Confirm and Load controls.
Construction/mount never performs adoption or cache loading. Existing personal/shared
loaders retain their owner, availability, dependency, placement and conflict checks;
placement and journals are checked again after loading. Cache failure retains receipt
and permits Load only. Existing-card conflicts load the receipt's existing ID through
the separate path and never complete a newly imported batch item. Runtime loaded status
is not persisted as a receipt. Native batch completion additionally checks current app/
queue owner, original query/item, original owned destination, actual following card
and shared head/reference before its sole queue-status write. It never synthesizes SRS.

Fresh checks: native195 suites/2582 tests/22 snapshots, web118 suites/1222 tests (Node harness enabled),
Edge108; focused native4/64 and web3/44. Domain/native production+test/web types and
scoped zero-warning lint/format/diff PASS. Native SQL journals use real file-backed
Node SQLite with restart handles; browser lock/storage and mounted UI/Auth tests are
synthetic. Adapter tests verify AbortSignal on the actual RPC builder boundary.
Existing cache/personal/SRS preservation suites remain passing. This is not actual
browser/device/provider or representative review-start performance acceptance.

1250 prior references verified at entry. Source boundaries190 native/135 web/76 Edge;
18 current source paths, 350-source union; historical37 mirrors/47 sealed artifacts
preserved. PostgreSQL547/worker35 carried only with unchanged relative-import closures,
not rerun or combined with current tests. SQL/backend/target generated contracts and
all new flags remain unchanged/OFF, shared_analysis FALSE/CEFR OFF. Local-only dirty
feature/shared-dictionary-schema HEADf97a733; exact paths saved in report. All runners
exited, no pending external operation, provider/paid/hosted/Git/EAS/device/release action.
AUTH27-29 remain consumed.

Next **D13A.5 — GPT-6.1 Sol / High recommended**: preserved private-payload/mode
reconciliation, area4 of item7. Original item6 publication-refresh parity and item8
web recovery/review-start performance remain open. No extra permission is inherited.

## Verification limits and repaired diagnostics

Initial focused commands used repository-prefixed paths from workspace commands and
therefore ran no tests; repaired commands use workspace-relative paths. The panel
mock's self-referencing confirm method needed an explicit return type. The conflict
fixture incorrectly supplied a non-null reference; it now uses the strict conflict
receipt. Adapter journal mocks now normalize with the production parser, matching
real journal behavior and key order. Duplicate imports/literals and unused test
parameters were repaired without suppressing lint or weakening parsers. Failed logs
remain retained; final focused/full checks use final frozen source bytes.

Current journal/SDK tests do not fabricate remote personal rows or qualify real SDK
network cancellation: injected auth/RPC and loaders are synthetic. The existing
real cache/personal-pull regression suites are included in the fresh full runs.
Post-load late placement changes reject UI/batch completion even if cache reads
already occurred. HTTP abort cannot undo a committed non-provider import; the
submitted journal remains the recovery authority.

Final native batch review: existing loaders commit SQLite without refreshing the
application word list. Batch completion now awaits direct owner-bound personal/card
cache reads, validates the receipt-bound shared head using the existing domain guard,
then rereads current queue/application ownership and placement. The action awaits this
callback before exposing loaded status. Regressions cover an empty application word
list and a failing asynchronous batch completion check. Repeated final verification
uses these repaired bytes; previous passing logs are retained with before-batch-authority
names, not counted as final evidence.
