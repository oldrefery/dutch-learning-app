# D10.3 — SQLite v16 recovery checkpoint

Status: accepted-contract checkpoint 3 implemented locally in `1748066`, following
server/domain source `1828f57`. User confirmed GPT-6.1 Sol / High; AUTH-17/AUTH-18.
No remote Git publication, hosted migration or native QA operation.

## Durable behavior

- Schema v16 adds exact original-intent storage, recovery/cancellation outbox and
  independent local/acknowledged placement revisions. Pending v14 intents retain
  their exact payload and nonce. A v15-only acknowledgement remains unknown origin,
  server generation and placement delivery; no provenance is reconstructed.
- Preparing recovery atomically persists the complete parsed request and new local
  placement revision while moving only the existing personal card's collection.
  Proposal replacement requires the exact previous operation; same-nonce payload
  mutation, origin replacement after acknowledgement and regressing watermarks
  are rejected. The existing explicit original semantic-conflict retry remains
  supported only before recovery claims that root.
- Recovery acknowledgements bind the current operation, origin, active owner,
  placement and captured local revision. Applied replies retire only the exact
  original/recovery outboxes; conflicts retain debt. Late original/recovery replies
  and stale errors cannot settle a replacement proposal or cancellation.
- Cancellation preparation persists its barrier and local tombstone in one exclusive
  transaction, including atomic batches. A confirmed cancellation records a sticky
  terminal flag and generation, then retires only its exact import outboxes. Normal
  tombstone delivery and all learning/content commands remain pending.
- Owner guards run before and after each new write transaction. Every statement uses
  the exclusive transaction connection. Receipt persistence failure rolls back
  acknowledgement/retirement; owner changes roll back placement/provenance changes.
  Existing IDs, SRS, later private edits and learning commands remain intact.

## Verification

File-backed SQLite focus: **4 suites / 50 tests passed**, including **12 new
recovery tests**. The actual initializer is tested through interrupted/retried
v15-to-v16 migration, including rollback of new tables and preservation of all old
rows/queues. Restart uses a fresh connection to the same temporary SQLite file.
Mobile test-inclusive TypeScript and strict scoped ESLint (`--max-warnings 0`)
pass. Format/diff checks pass. Normal source commit hooks: **151 mobile suites /
1740 tests / 22 snapshots**; **75 web suites / 642 tests**, one existing skipped
suite/test. Advisory file-length notices do not block these hooks; no bypass or
lint suppression. Server SQL was unchanged from its complete **213/213** pass.

Initial focused failures were test-fixture defects: duplicate synthetic word keys,
old schema-v15/count expectations, and inspecting a handle correctly closed by the
initializer after failure. The rollback inspection now opens a separate handle.
A test helper's union result annotation was narrowed to its receipt type, and
repeated fixture strings were extracted to constants. Final checks pass.

The installed Expo SQLite ~57.0.3 implementation confirms separate-connection
BEGIN/COMMIT/ROLLBACK semantics for exclusive transactions. Context7 Expo docs
were consulted, then checked against installed SDK 57 source; no dependency change.
Synthetic file fixtures close/remove only their own temporary directories.

## Explicit remaining work

This checkpoint supplies persistence APIs, not an end-to-end recovery flow. New
RPCs are not yet dispatched by foreground/background sync. Existing application
move/delete entrypoints are not yet connected to the new persistence APIs. Generic
metadata sync does not yet consult placement debt; pending counts/status, typed
errors, lost replies and cancellation-before-collection-deletion ordering are
checkpoint 4. Existing-target recovery UI/current-state retry and safe pre-upgrade
behavior/applicable web integration are checkpoint 5. Astra implementation review
and assigned-device/both-client acceptance are checkpoint 6. D10.3-D10.5 stay open;
legacy direct-write coexistence remains a release gate. Do not infer delivered
placement from a v15 marker or enable runtime flags outside task QA.

At **10:20 UTC**, read-only inventory confirmed task iOS
`DDEDCE4E-153B-48A4-A47C-B4ED0F499F1F` Shutdown; no process for task Android AVD
`woordenaar_d08_qa_20260921`; all four `woordenaar-d08-qa.ZFsE50` containers exited.
No task device/backend was started and no other-session device was operated on.
Initial sandbox process/Docker reads required authorized read-only escalation;
those reads subsequently passed. No uncertain operation remains.

## Reproduction commands

Node 24.20.0 on PATH, no hosted credentials:

```sh
CI=true npm test -- --no-watch --no-coverage --watchman=false --runInBand --silent --runTestsByPath src/db/__tests__/dictionaryImportRecovery.sqlite.test.ts src/db/__tests__/dictionaryImportRepository.sqlite.test.ts src/db/__tests__/initDB.migration.sqlite.test.ts src/db/__tests__/initDB.test.ts
npm run typecheck:test
```

Strict scoped ESLint covers the eleven source/test paths in `1748066`. Source
fingerprints are recorded in `D10-source-sha256.json`. Leave private
`.playwright-cli/` and ignored QA copies/reports untouched and uncommitted.
