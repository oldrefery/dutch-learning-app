# D10 — self-contained mobile document reimport checkpoint

Date: 2026-10-02. Source: `42c9bfd1813be0742d482f04c02e8de969bcb5cc`.
Branch: `feature/shared-dictionary-schema`, local only. User confirmed GPT-6.1 Sol;
High effort follows accepted task routing. No automatic picker change is claimed.
AUTH-17 local work and AUTH-18 local commits apply. D10 remains in progress.

## Implemented behavior

- Default-off collection detail action copies a strictly validated, full JSON
  content export to the clipboard. It does not create a share token, publish a
  collection or make a server write. Incomplete pinned content still blocks export.
- Default-off import sheet opens `/dictionary-import`. A pasted schema-v1 document
  is validated before showing word selection and existing owned target collections.
  No private source rows or dictionary reference IDs are needed by the recipient.
- Preview IDs are document indexes. Selected entries receive fresh personal UUIDs,
  SRS defaults (interval/repetitions 0, factor 2.5, local review date) and complete
  private text/media. Neither exported progress nor source personal IDs are accepted.
- One exclusive SQLite transaction checks target ownership/active state, skips
  existing semantic keys across all owned collections and within the batch, and
  creates each card, full private fallback, content command and immutable import
  intent. Existing cards are never moved or edited. A persistence failure or an
  owner change detected before commit rolls back the whole batch.
- Existing target collection metadata is untouched, including for read-only
  accounts. Server authorization remains the previously reviewed import protocol;
  this checkpoint does not add a server privilege or claim new native server QA.
- Reopened SQLite retains the same private-copy intents and content commands.
  Delivery uses the existing reviewed dependency ordering and immutable receipts.
- Account changes remount/clear the document screen and suppress stale async
  preview/results. Export checks the initiating account again before clipboard
  dispatch. Submission is guarded against repeated taps; target selection is locked
  during persistence. A later cache reload failure retains the saved success state.
- The document preview virtualizes its word rows with FlatList. Existing shared and
  official screens retain their prior default rendering. The transfer contract still
  caps documents at 10,000 entries; paste/copy also enforces 10,000,000 UTF-16 code
  units. Unknown expression types are rejected explicitly rather than discarded.

Current clipboard transport is deliberate: no file picker, native dependency or
package update was added. Direct file open/share handling is not claimed.

## Verification

At the source commit, ordinary hooks passed without bypass or timeout changes:

- Mobile: **149 suites / 1715 tests / 22 snapshots**.
- Web: **75 suites / 642 tests**, one pre-existing skipped suite/test.
- Focused mobile: **9 suites / 120 tests**, including 14 new file-backed document
  cases and 12 UI cases. The final hook run includes the singular-word text fix.
- Test-inclusive mobile TypeScript, strict scoped zero-warning ESLint, scoped
  Prettier and `git diff --check` pass. Hooks may format files normally.

File-backed regressions cover full-content export/reimport for another owner,
source deletion, restart, fresh IDs/default SRS, all private fields and media,
selected entries, active/intra-document duplicates, retained tombstones, foreign or
deleted targets, read-only local target preservation, mid-batch failure rollback,
owner-change rollback, invalid selections, future schemas, reference-dependent or
SRS-bearing documents, size limits and dormant/signed-out rejection.

UI tests cover both themes, selection, duplicate filtering, double submission,
saved success after cache failure, account changes and stale requests, invalid or
targetless preview, a virtualized 1,000-entry document retaining every selected ID,
clipboard content/failure and dormant entrypoints. Native clipboard delivery and
device rendering remain assigned-device acceptance gates.

Commands (Node 24.20.0):

```bash
CI=true npm test -- --no-watch --no-coverage --watchman=false --runInBand --runTestsByPath src/services/__tests__/dictionaryDocumentImport.sqlite.test.ts src/services/__tests__/dictionaryTransferService.sqlite.test.ts src/components/__tests__/DictionaryTransfer.test.tsx src/db/__tests__/dictionaryImportRepository.sqlite.test.ts src/db/__tests__/officialPackImport.sqlite.test.ts src/hooks/__tests__/useStarterPackImport.test.ts src/hooks/__tests__/useImportSelection.test.ts src/services/__tests__/dictionaryImportSync.test.ts src/stores/__tests__/wordActions.test.ts
npm run mobile:typecheck:test
git diff --check
```

Exact ephemeral logs: `/private/tmp/woordenaar-d10-document-focused.log`,
`/private/tmp/woordenaar-d10-document-types-3.log`,
`/private/tmp/woordenaar-d10-document-lint-3.log`,
`/private/tmp/woordenaar-d10-document-commit.log`.
Durable source fingerprints: [D10-source-sha256.json](D10-source-sha256.json).
SQL and generated contracts did not change; their preceding results remain
historical evidence, not a fresh SQL run for this commit.

## Failed attempts and repairs

- An array-shaped Jest.each fixture passed separate columns instead of the intended
  selected-ID array and interpreted an empty case as a done callback. It now uses
  named `{ ids }` cases. No production fix or increased timeout was needed.
- The route UI mock initially omitted Expo Router Color, so the theme module failed
  before rendering. It now supplies the same minimal Color shape as adjacent route
  tests. Duplicate test literals/imports were fixed for strict lint; no suppression.
- Sandboxed read-only device/container/process inventory was denied by OS access.
  The same scoped inventory ran with approved escalation; no resource was started.

## Resource and remaining-stage boundary

At 09:03 UTC / 11:03 Amsterdam, exact task iOS
`DDEDCE4E-153B-48A4-A47C-B4ED0F499F1F` was **Shutdown**; no process matched task
AVD `woordenaar_d08_qa_20260921`. Docker containers `supabase_rest`, `supabase_auth`,
`supabase_kong`, `supabase_db` with suffix `_woordenaar-d08-qa.ZFsE50` were **exited**.
No QA resource was restarted, reset or deleted; other sessions/devices untouched.
File-backed test directories cleaned up automatically. No running operation remains.

D10.3 is still open: missing-target recovery needs a protocol that settles unknown
delivery before redirecting an immutable intent; safely evidenced pre-upgrade import
recovery and background/both-client integration remain. D10.4/D10.5 final integrated
and assigned-device acceptance remain unchecked. D11 was not started.
Next architectural review input:
[D10 target recovery draft](D10-target-recovery-review-input.md).
No production, cutover, deployment, publication, paid calls, push, PR or merge.
