# D10 Astra / High review and repair checkpoint

Date: 2026-10-02. User explicitly confirmed the model/effort and authorized local
commits (AUTH-18). Existing branch `feature/shared-dictionary-schema`; review
starts from the local D10 checkpoint on base `c5dfb14`. No independent agents.

## Reproduced findings and repairs

1. Shared duplicate with `collection_id: null` was assigned the requested target
   by nullish normalization. Preserve explicit null; only missing legacy fields
   use the target. A failing store regression now passes.
2. SQLite could preserve an offline semantic duplicate while the store added the
   server's other personal ID anyway. Only publish imported IDs actually present
   in owned SQLite rows after persistence. Retain current private/SRS state.
   The phantom-row regression failed before the repair and now passes.
3. A personal row acknowledged before its dictionary command was delivered lost
   pending projection content during pull: `preserveUnsynced` considered learning
   commands but not dictionary commands. Include pending dictionary commands in
   the preservation check. Real SQLite regression now retains the exact row and
   command inventory. Do not acknowledge dictionary intent with word-row status.
4. Generic semantic merging attempted changing a dictionary-backed personal ID
   and failed with an opaque foreign-key error. Reject the identity conflict
   explicitly before SQL updates; keep the original card, dictionary state and
   queues. Sync's duplicate skip must not mark these undelivered IDs as synced
   when dictionary protocol is active. Legacy dormant behavior is unchanged.
   This is a preservation guard, not a complete duplicate-resolution workflow.
5. A source word owned by a different account could point at the shared collection
   through the existing non-composite FK. The SECURITY DEFINER preview/import
   trusted collection membership alone. A synthetic regression returned three
   preview words instead of two, exposing the foreign-owned content. Require
   source word owner to equal the sharing collection owner in preview, selection
   validation and locked import. Export already requires both owner predicates.
6. Server duplicate selection had no row lock and could return a null composite
   if a conflicting row disappeared between INSERT and SELECT. Lock the returned
   duplicate FOR SHARE; if it vanished, abort with retryable SQLSTATE 40001.
   Real lock-barrier tests cover concurrent identical imports (one personal ID,
   one content state) and a delete waiting until the duplicate import commits.

## D10.3 architecture decision and remaining implementation

Do not repair read-only offline imports by granting ordinary INSERT, by upserting
client SRS snapshots, or by calling the current server import then changing local
personal IDs. Do not remap pending dictionary/learning IDs to a semantic match.

Implement a dedicated durable import intent, separate from dictionary commands:

- Persist the personal ID, owner, target collection, immutable import source and
  operation ID in the same SQLite transaction as offline card creation. Keep
  complete private fallback/dependencies for offline reads. A schema upgrade must
  preserve all current v13 cards, tombstones and learning/dictionary queues.
- Add a default-off, authenticated, insert-only import RPC with an immutable
  owner/operation receipt. Accept the proposed personal UUID only for an owned
  target, reject foreign UUID collisions, validate authoritative official source
  references, and permit explicit full private-copy imports under the existing
  read-only import policy. Never infer a shared reference from client spelling.
- Deliver collection creation first, import intents second, dictionary commands
  third, then existing ordered learning streams. The initial server personal row
  must have content version zero so queued create-private/link versioning remains
  valid, or the receipt must explicitly reconcile those exact operations. Never
  leave a version-one import row under a local expected-version-zero command.
- Replay the same intent after a lost response/restart. A receipt must bind its
  immutable intent, not the mutable current projection/SRS. Acknowledgement must
  atomically clear only that intent; account switching must not publish its result
  into the new account. Pending import intents must contribute to sync status.
- A different existing personal ID is a typed durable identity conflict. Keep
  both owners' existing server/private content unchanged and retain every local
  ID, fallback, review/reset/correction/content command. Do not claim success or
  attach the private duplicate to the official dictionary. Conflict visibility
  and a non-destructive recovery path must be verified before D10 closure. Any
  future consolidation of learning streams needs an explicit separately reviewed
  policy; the current unique semantic index is not evidence of equivalent meaning.
- Validate offline read-only import into an existing collection, new collection
  restriction, restart/lost reply, cross-device duplicate, concurrent duplicate,
  pending learning/private edits, revoked/retired source, target deletion and
  account switch. Use only retained task QA resources if device QA is needed.
- Verify deferred canonical SRS hydration explicitly: protecting an entire row
  while a dictionary command remains pending can defer an incoming server SRS
  update. After the last command is acknowledged, re-read the affected personal
  row even if its ordinary word cursor already advanced. Do not rely solely on
  a new learning event arriving to refresh that state. This integration case is
  still required before D10 closes; the preservation guard alone is insufficient.

D10.4/D10.5 review confirms the intended recipient projection and self-contained
content contract. They remain unchecked until the ownership repair passes, both
client import/reimport coverage is complete and D10.3's new delivery path is closed.
No published manifest, production flag, hosted schema or provider state changed.

## Verification and commit boundary

Initial regression run: four new mobile tests failed as expected (50 existing
passed). After repair: three focused mobile suites / 80 tests passed, then sync
suite / 72 tests passed. Ownership SQL regression failed as expected, then the
full PostgreSQL gate passed 183/183 (including D10 9/9). Full mobile pre-commit:
144 suites / 1658 tests / 22 snapshots passed. Full web pre-commit:
75 suites / 642 tests passed, one pre-existing skipped suite/test. Mobile
test typecheck, strict changed-file lint, deterministic target check and staged
diff checks pass. Standard hooks ran without bypass; file-length notices remain
advisory. The existing large sync/repository files were not broadly refactored.

The web Jest config now excludes generated `reports/` from its module map so
retained QA source copies cannot collide with workspace package names. This was
verified by the ordinary hook command without ad-hoc CLI ignore overrides.
Context7 reference: Jest 29.7 `modulePathIgnorePatterns` with `<rootDir>`.

Implementation commit: `a59acad1ea1681162befeb77b2d554e9e10fc463`
(`feat: add dormant shared dictionary integration`), 142 task source/config/test
files. No credentials were detected by the scoped candidate scan. Private QA
artifacts and browser dumps were excluded. Current fingerprints are recorded in
`D10-source-sha256.json`; the earlier D10 dirty inventory is historical.

Local commits preserve this dormant implementation checkpoint.
They do not mark D10 complete or authorize push/PR/merge/deployment. Exclude
`.playwright-cli`, ignored QA copies/reports, credentials and excluded AGENTS.md.

The first documentation commit attempt stopped at normal lint: archived Maestro
timing scripts lacked their injected `output` global declaration. Added explicit
environment declarations (no rule suppression) and normalized Markdown hard
breaks so staged whitespace checks pass. No device/script execution was needed.

A documentation amendment hit the existing 15-second subprocess timeout in two
ESLint configuration tests during the full mobile hook. The unchanged focused
suite then passed all four tests in 3.9 seconds. No timeout or hook was disabled;
the amendment was retried with the normal checks.

Next implementation model: GPT-6.1 Sol / High. Current-thread picker control is
unavailable; request the switch after this Astra review/repair checkpoint is saved.
