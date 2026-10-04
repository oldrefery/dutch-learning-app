# D10.3 — recovery server implementation checkpoint

Status: server/domain implementation complete and committed locally as `1828f57`. SQLite v16, client sync/UI and integrated acceptance remain
pending. Branch `feature/shared-dictionary-schema`, base `0eb3fbd`; user confirmed
GPT-6.1 Sol / High for this continuation. AUTH-17/AUTH-18, local only.

## Implemented behavior

Additive migration `20261002120000_add_dictionary_import_recovery.sql` implements
checkpoints 1–2 of the [accepted contract](D10-target-recovery-contract-20261002.md):

- Private personal-ID origin registry survives word hard deletion. Exact original
  operation/hash is immutable; inserted/cancelled flags and recovery version cannot
  regress. Unambiguous historical successful receipts backfill live or deleted IDs;
  ambiguity across roots/owners aborts the complete migration before partial state.
- Existing import RPC retains its response shape and immutable replay. Unseen
  originals consult the durable fence. Successful insertion, origin and receipt
  commit atomically. Existing semantic-conflict retry remains compatible before
  recovery claims its root; no duplicate identity is adopted.
- Authenticated `read_dictionary_import_recovery_v1`,
  `recover_dictionary_import_v1` and `cancel_dictionary_import_v1` implement owned
  snapshot, version/nullable-placement CAS, immutable receipts and terminal cancel.
  Exact replays are historical no-ops even after later moves/deletion/cancellation.
- Global personal-UUID lock precedes owner/original operation and recovery/cancel
  nonce locks. Proven imports move only collection metadata; undelivered imports
  use original content/pin validation, server SRS defaults and content version zero.
  Retired sources cannot create fresh imports but do not prohibit a proven move.
- Runtime gates remain default-off. Read-only accounts use existing owned targets;
  no collection creation or upsert. Private tables/helpers are revoked; public
  RPCs use security-definer/empty-search-path boundaries and generic unavailable
  errors for foreign/unproven IDs. Account cascade removes its private ledgers.
- Strict shared domain parsers distinguish accepted receipts from nonmutating
  state/placement conflicts, bind original/personal/target/operation identities,
  reject extra/missing/SRS input and invalid bounded versions. Target Supabase
  contracts are generated through the new migration from disposable local SQL.

## Verification and current limits

Focused new server suite initially **15/15**, backfill **3/3**, original import
compatibility **16/16**, domain parser tests **11/11**. Added real overlapping
ordinary move/target deletion and retired-source cases to the complete SQL run.
Complete SQL **213/213** passed. Normal commit hooks: mobile **150 suites /
1726 tests / 22 snapshots**; web **75 suites / 642 tests**, one existing skipped
suite/test. Source commit `1828f57`; no test/build job remains from this checkpoint.

Checks already passed: domain and Supabase contract typechecks, mobile test-inclusive
TypeScript, strict scoped ESLint including domain files via `--no-ignore`, and
local target generation plus deterministic check. Each generator cleans up only
its fresh internal containers/network. Every PostgreSQL harness uses a private
Unix socket and cleans up its own cluster; no application environment/credentials.

Initial fixture/static-check repairs: cancellation fixture's protocol literal
needed `as const`; repeated outcome literals were extracted to constants. A manual
parser check found array coercion in snapshot state; changed it to require a string
and added rejection coverage. No lint suppression, hook bypass or application reset.

New server behavior is not wired to either client's recovery/deletion flow yet.
In particular, cancellation must precede collection/tombstone delivery and stale
receipt acceptance must not echo an old target through generic metadata sync.
SQLite v16 placement debt/outboxes, upgrade evidence, foreground/background sync,
recovery UI, applicable web integration, Astra implementation review and assigned
native acceptance remain open. Legacy direct word INSERT coexistence remains an
explicit D10/release gate; this registry fences participating RPCs, not arbitrary
legacy direct writes. No production or cutover readiness is claimed.

PostgreSQL 15 locking semantics were checked with Context7 against official
[transaction isolation](https://www.postgresql.org/docs/15/transaction-iso.html) and
[explicit locking](https://www.postgresql.org/docs/15/explicit-locking.html) docs.
Actual SQL overlap tests hold one transaction until the waiting lock is visible,
then release it; abstract-model assumptions are not used as database evidence.

## Commands

Node 24.20.0 on PATH; no hosted calls:

```sh
WOORDENAAR_PG_BIN=/opt/homebrew/opt/postgresql@15/bin npm run test:db
CI=true npm test -- --no-watch --no-coverage --watchman=false --runInBand --runTestsByPath src/utils/__tests__/dictionaryImportRecoveryContract.test.ts
npm run typecheck:test
npm run typecheck --workspace @woordenaar/domain
npm run typecheck --workspace @woordenaar/supabase-contracts
npm run supabase-contracts:target:generate
npm run supabase-contracts:target:check
```
