# D10.3 durable offline import checkpoint

Date: 2026-10-02. Existing branch `feature/shared-dictionary-schema`, starting
revision `039f2ff` / implementation `a59acad`. Local AUTH-17 implementation and
AUTH-18 commits only. Implementation revision: `dfdc7f00f2ddb30dd5f2a55c255e8a9ff47f1bd3`
(`feat: persist and deliver offline dictionary imports`). This implements the preceding D10 review contract; D10
remains in progress. No independent agent, native QA, hosted call or release.

## Implemented behavior

- Strict protocol-one immutable import input separates the proposed personal UUID,
  operation UUID, owned collection and original official/private source from all
  mutable word projections and learning snapshots. Receipts distinguish an inserted
  identity from a different existing identity; client/server reject extra SRS fields.
- SQLite v14 adds an owner-checked import queue and a separate durable personal-row
  refresh queue. Creation, private fallback, create-private/link commands and import
  intent commit atomically. Upgrades from v13 retain words, tombstones, dictionary
  dependencies and all learning/content queues; interrupted migration retries safely.
- Enabled starter imports queue explicit reviewed pack source/manifest/reference
  data for mapped entries and complete private-copy input for bundled/unmapped
  content. Entry order matches the immutable manifest selection. Dormant behavior
  is unchanged; ordinary analyzed-word creation is not silently classified as import.
- `20261002110000_add_dictionary_import_intents.sql` adds a default-off authenticated
  insert-only RPC. It locks the owned target, rejects occupied proposed UUIDs,
  validates exact published manifest/content/mapping references, and initializes
  personal SRS on the server without accepting client SRS. Initial content version
  is zero, so existing create-private zero / link one delivery remains ordered.
- Owner/operation advisory locking and an immutable private receipt ledger make
  lost responses and concurrent retries safe. Receipts bind a canonical input SHA256
  instead of retaining private card text. Replay returns the original result without
  republishing content or recreating a subsequently deleted card. Account deletion
  removes its ledger; ordinary receipt mutation is blocked.
- A semantic duplicate returns a durable identity conflict without changing the
  existing card's ID, collection, private content, SRS or queues. The local original
  and every queued command stay on their original ID. A deliberate retry rotates
  only the import operation after the server key becomes vacant; source and personal
  identity remain intact. A racing new duplicate is rejected again by the RPC.
- A conflict is visible in word details with an explicit retry control. There is no
  automatic adoption, ID remapping, SRS consolidation or deletion. Controls disappear
  after account change/card deletion. Both themes and failed retry are tested.
- Sync sends collections, import intents, ordinary metadata, dictionary commands,
  then the existing learning streams. An import error/conflict stops the pass before
  dependent commands are sent. This can delay other queued work on that device;
  it never skips or acknowledges undelivered learning work.
- Dictionary metadata delivery checks existing owned personal IDs in batches before
  bootstrap INSERT. Existing rows use UPDATE only, so read-only accounts can import
  and later edit/move without a denied INSERT. It does not trust `synced_at`, which
  existing image/content edits can clear. Missing ordinary private cards remain
  subject to existing INSERT permission.
- Content acknowledgement/resolution records a durable obligation to re-read the
  affected personal row. Once newer content/import/learning/correction work clears,
  sync fetches by personal IDs, independently of the advanced word cursor. Failed or
  incomplete hydration keeps the obligation; a newly queued edit prevents its removal.
  Import conflicts, pending imports and this debt all count toward pending sync status.
- An explicitly tombstoned offline import is not delivered. Its durable intent is
  retained alongside the tombstone, but does not manufacture a remote card or appear
  as active import debt. Existing tombstone delivery remains authoritative.

## Verification

- Focused mobile: 9 suites / 181 tests passed, including real file-backed SQLite,
  v13 upgrade/interruption, loss of reply, owner change, conflict preservation/retry,
  dictionary-only SRS hydration after cursor advancement, starter mapping alignment,
  store visibility and both-theme conflict controls.
- Full local PostgreSQL: 188/188 passed; focused D10 SQL 14/14. Tests include actual
  lock barriers for identical receipt replay and concurrent semantic imports,
  read-only ordinary INSERT rejection, metadata UPDATE, immutable receipt mutation,
  target/UUID/owner/anonymous boundaries, strict official source, source retirement,
  create-private/link version order and replay after personal hard-delete.
- Mobile build/test typecheck and strict changed-file ESLint with zero warnings passed.
  Scoped Prettier and staged `git diff --check` passed.
- Target generator and deterministic `--check` passed through the new migration.
  Deployed contracts are unchanged. Generator containers/networks and Unix-socket
  PostgreSQL clusters were newly created by each task invocation and cleaned up.
- Normal local commit hooks passed without bypass at implementation revision
  `dfdc7f0`: mobile 147 suites / 1682 tests / 22 snapshots; web 75 suites /
  642 tests, with one pre-existing skipped suite/test. No pending hook or test job.
- Context7: official Supabase documentation for JSONB RPC arguments, SECURITY DEFINER
  with empty search_path and exact authenticated EXECUTE grants. No hosted command.

Reproducible gates (Node 24.20.0 on PATH): `npm run test:db` with
`WOORDENAAR_PG_BIN=/opt/homebrew/opt/postgresql@15/bin`;
`CI=true npm test -- --watch=false --runInBand --watchman=false` in `apps/mobile`;
normal root commit hooks for the full mobile/web suites. Source fingerprint
inventory: [D10-source-sha256.json](D10-source-sha256.json). The temporary logs
are diagnostic copies; these aggregate results and source hashes are durable.

Failed attempts: official SQL fixture initially passed the canonical-analysis
receipt's extra fields as a reference; narrowed to explicit entry/revision IDs.
A concurrency fixture initially held an already committed replay rather than a
new INSERT; corrected to overlap two new requests on a fresh owner. Mobile store
shape test caught an unnecessary false conflict property; dormant/unaffected rows
retain their previous shape. Test literal widening was corrected with the receipt's
explicit discriminated union. No rule suppression, hook bypass or timeout increase.

## Remaining gates and exact next action

D10.3 is not closed. Request GPT-6 Astra / High review of this insert/receipt/retry,
metadata permission and deferred SRS path before declaring the contract complete.
The available current-thread controls cannot change the picker directly.

Review must check receipt/UUID/concurrent deletion semantics, failed delivery and
account transitions, zero-version create/link ordering, the explicit conflict
retry and its limitation while both semantic-key cards remain active, and personal
hydration debt when newer operations arrive during a request. Extend tests/fix
findings rather than repeat D08/D09 acceptance.

Existing v13 pending cards have no durable import-origin record. The upgrade
preserves them and does not guess that a private analysis was an authorized import.
A safely evidenced recovery for any such pre-upgrade import remains a release
integration case, alongside target deletion/retargeting and background retry.

D10.4/D10.5 still need both-client import/export/reimport integration coverage and
native verification of the new import/retry path. The current mobile document
reimport flow is not complete. Do not advance to D11 or mark D10 done from these
local gates. Continue only on the assigned task resources if native QA is needed.

Retained iOS/Android/D08 Docker QA stayed off throughout this checkpoint. Other
sessions/devices were not operated. Synthetic test/codegen resources are cleaned
up. `.playwright-cli` and ignored reports/source copies remain private/uncommitted.
Production flags, schema cutover, deployment, publication and paid calls are unchanged.
