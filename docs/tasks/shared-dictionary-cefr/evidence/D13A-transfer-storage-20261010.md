# D13A.5 — Durable transfer2 storage and explicit client workflow

Checkpoint complete locally; D13A.5 remains in_progress. GPT-6.1 Sol / High,
owner-confirmed. Branch feature/shared-dictionary-schema, HEAD f97a733407a4d2b37e8f9ca030ad9574de85a794.
All changes are uncommitted and local. Exact hashes, commands and logs are in the
[packet](D13A-transfer-storage-20261010.json); reports are under
reports/shared-dictionary-cefr/d13a5-transfer-storage-20261010/.

## Implemented behavior

- A strict owner/session journal keeps the complete schema2 document, target and
  selected indexes before any dependency query. It preserves unselected entries,
  private examples/media and unresolved references. Originals are protected drafts,
  not authoritative per-user linguistic overrides.
- Only authenticated public dictionary_revisions reads with RLS, explicit columns,
  selected immutable revision IDs and published filtering feed the planner. The
  common reader rejects malformed, duplicate, foreign or nonpublished replies.
  Transport/SDK errors retain an unplanned draft. Successfully missing public rows
  become unresolved review cases; spelling or a portable hash never proves identity.
- An atomic immutable decision keeps published dependency snapshots and exact
  index-to-word/operation nonce mapping. Parsing recomputes exact content/references
  and review classification; tampering and cross-session ID reuse fail closed.
  Competing decisions cannot overwrite the first mapping. Retry reads an existing
  plan without allocating new IDs.
- Native additive schema21 sessions have no personal-word foreign key. Exclusive
  transactions roll back failed writes/owner changes. Browser sessions use a separate
  owner key and exclusive Web Locks; quota errors retain originals. Neither platform
  offers deletion, eviction or an unlocked fallback.
- Explicit queueEntry reserves the saved root in existing protocol2 import journals.
  Explicit deliverEntry requires that root and delegates server capability, source,
  permission and receipt checks. A lost reply replays the same input; a finished
  receipt does not repeat remote creation even after local gates withdraw.
  This API does not automatically dispatch or retry paid analysis.
- Native local operations fence the application-store owner and synchronous Auth
  changes without getUser/RPC. Browser local operations use a cached session, with
  online getUser/Auth lifetime checks for resolution/delivery. A-to-B-to-A changes
  reject the action and retain the document.

## Validation

Final mobile:176 suites /2180 tests /22 snapshots with configured coverage. Final
web:100 suites /899 tests with the opt-in benchmark and30000ms test timeout. Neither
run skipped or marked tests todo. Focused mobile4/53 and web2/12 pass.

Mobile production/test-inclusive, web route/test-inclusive, domain and contracts
TypeScript checks pass. Root/native and web lint pass with zero warnings; the changed
domain modules/index pass using the established web ESLint config. A broader scan of
all domain sources fails on the pre-existing unchanged app-config.ts:171 explicit
any. It was not introduced or fixed by this delta; this is not a passing all-domain
lint gate. Scoped Prettier and git diff checks pass.

Tests cover file reopen after draft/plan/root reservation and lost import replies,
whole-document preservation, immutable targets/selections/decisions, corrupt mappings,
duplicate IDs, two owners, storage count/size/quota limits, cross-tab races, native
transaction rollback, source/read failures, owner ABA and gate withdrawal. Migration
fault/retry from v20 preserves unresolved v2/v1 roots, words and learning commands;
the existing broader migration/preservation matrix also passes through schema21.

Earlier failed checks are retained: Web Locks Promise generic, a read-only randomUUID
Jest mock and one import-order warning were repaired. The final format check found
trivia changes in two SDK tests; formatting was repaired and exact non-trivia TypeScript
token equality recorded. Final full tests used the same executable tokens; no redundant
full run was started for those formatting-only changes. The broad domain lint issue
above remains outside the delta.

Loaded-host Node benchmark:2500 cards718.250–1358.944ms;5000 cards796.699–2383.213ms;
all10 measurements are long tasks. Concurrent tests/type/lint were running. This does
not establish browser/device/native review latency acceptance. Backend/generated target
were unchanged; Edge76/PostgreSQL95/target checks are carried prior evidence only.

## Preservation and limits

Entry298 source/task/report/artifact paths verified.19 source/test paths in this delta:
191 of196 prior sources unchanged,5 declared extensions and14 additions,210 union.
All37 historical test mirrors and47 sealed artifacts remain unchanged; the rest of the
dirty task/release/QA bundle is preserved. No reset/clean/switch/rebase/commit/push/PR.

Transfer storage is bounded to10 retained sessions per owner,100 selected entries per
session and1000000 UTF-16 serialized code units per owner, including whole documents
and dependency snapshots. Existing operation journals keep their100-operation/256000
code-unit limits. A full or oversized store fails closed and never removes originals;
future retention policy requires separate reviewed work. Browser cached-session access
can fail offline if an expired session needs refresh. Real-device restart/storage/Auth
behavior remains an acceptance gate.

No interface is connected to these new workflow APIs yet. Existing mobile/web forms,
official/shared/new-word paths, legacy export/import and v1 recovery remain their prior
protocol. There is no personal-word fabrication from a receipt, automatic queue pump,
receipt-driven personal pull/shared hydration, web refresh/recovery UI or cross-device
history import. Full transfer/adoption support and D13A.5 completion are not claimed.

All new flags remain OFF; shared_analysis FALSE, role/policy seeds unchanged, CEFR OFF.
AUTH27–29 remain consumed. No provider/paid call, hosted migration, live conversion,
publication, EAS/release/device operation or automation was started. All runners exited;
no pending operation/resource. D13 observation remains open and D14 pending.

## Next checkpoint

D13A.5, recommended GPT-6.1 Sol / High: connect explicit mobile/web transfer2 selection
and retained-document/review/status controls to the new services. Integrate finished
import/recovery receipts with owner-fenced personal pull, complete shared hydration
and web refresh. Preserve newer placement, local learning and tombstones; never
resurrect deleted personal rows or downgrade missing dependencies to private content.
Verify restart/offline/two owners, source/capability/flag withdrawal and failed hydration
alongside unchanged v1 queues. High is recommended for coupled UI/Auth/document/nonce/
personal-row/cache boundaries. Official/shared/new-word selection and broader private/
mode/server-history/review-performance work remain in the stage; D7/8 semantic/device/
release gates remain separate.
