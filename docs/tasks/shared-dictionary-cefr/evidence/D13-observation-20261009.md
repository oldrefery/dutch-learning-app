# D13 observation and private-content compatibility repair — October 9, 2026

D13 remains **in_progress**. The production health gate failed for native 2.4.0
(85). A client compatibility repair is validated locally but has **not been
released**. No database migration, runtime toggle, deployment, EAS operation,
provider call, primary-device operation, commit or push occurred.

## Production evidence

Read-only Sentry API checks used `environment=production`, `time-range=14d`,
queries `is:unresolved` and `dist:85`, plus three events per relevant issue.

- [DUTCH-LEARNING-APP-4C](https://oldrefery.sentry.io/issues/7737950888/): the
  installed iOS release `com.oldrefery.dutch-learning-app@2.4.0+85` rejects effective
  content missing `conjugation.simple_past_plural`. Latest inspected event:
  October 9 at 21:26:07 UTC / 23:26:07 Amsterdam. Filtered 14-day bucket sum: 11;
  issue lifetime count: 13. These are different scopes, not installation counts.
- [DUTCH-LEARNING-APP-49](https://oldrefery.sentry.io/issues/7715295374/): three
  build-85 stalled-sync warnings. Latest inspected warning has seven failed
  attempts and zero queued reviews/resets at that moment. This does not prove
  data loss or a successful offline return. The dictionary error is deferred
  until later in the sync pass; learning operations can still complete.
- DUTCH-LEARNING-APP-4D (maximum update depth) last appeared September 25 in the
  initial unresolved query and was absent from the build-85 query. It is not
  established as a new build-85 regression.
- The owner confirms build 85 is installed and the visible sync error matches
  4C. Successful offline return and Android adoption remain unverified.
- Vercel identity `oldrefery`, exact production target
  `dpl_74ZRdMpdPQpbjQADbdRpFxniUKdr`, source `44141e0`, READY, site HTTP 200 and
  Edge OPTIONS 200 rechecked. This is availability evidence, not full functional
  web or database-health verification. No provider request was made.

## Root cause and selected repair

Private cards created before dictionary activation do not always satisfy the
canonical authoring schema. Besides omitted conjugation and example fields, they
contain blank optional strings and incomplete separable-verb metadata. The client
used the strict canonical parser for these historical private read models.

`parsePrivateDictionaryContent` now normalizes the representational omissions at
private read boundaries only. It retains separability and missing prefix/root
metadata rather than inventing linguistic values. Canonical revisions, linked
content, new commands and imports still use strict validation. Unknown fields,
invalid types and missing required lexical content remain errors.

The repair covers effective unlinked API cards, private server state, SQLite
save/read, local legacy mapping and private conflict comparison. It does not
rewrite personal IDs, original word rows, SRS, history, references or queues.
Pending-command and owner-isolation behavior remains covered by the SQLite suite.
Incomplete legacy metadata can be read; this does not grant permission to author
new invalid canonical content or silently rewrite a pending command.

Two tempting alternatives were rejected:

1. Adding only `simple_past_plural: null` on the server reproduced/fixed the first
   validation failure but left 36 P1 and all 570 P2 cards invalid in the saved
   snapshot. That partial migration and experimental test were removed from the
   migration/test directories and retained only in ignored diagnostic reports.
2. Turning off dictionary reads is not a working rollback for the enabled native
   client. Capability advertises operations, while disabled reads reject the
   subsequent RPC; disabling operations makes SyncManager reject the unavailable
   protocol. No runtime flag was changed.

## Snapshot rehearsal

Used the already retained October 4 activation backup, mounted read-only into a
new no-network PostgreSQL 17 container. This is historical evidence, not a fresh
production inventory. Private contents were parsed in memory; only aggregates
appear here. The final rehearsal applied no migration and changed no table data.

| Cohort                     | Active cards | Old strict parser valid | New private reader valid |
| -------------------------- | -----------: | ----------------------: | -----------------------: |
| P1                         |        2,343 |                   2,227 |                    2,343 |
| P2                         |          570 |                       0 |                      570 |
| All accounts, including QA |        5,858 |                   3,527 |                    5,858 |

All 79 original table hashes matched the saved snapshot after the rehearsal.
Every new rehearsal container was removed; original backups and existing QA
services remain. No new production backup was taken.

## Validation and reproducibility

Base: `feature/shared-dictionary-schema`, HEAD
`f97a733407a4d2b37e8f9ca030ad9574de85a794`, plus the local source/test diff.
Exact source hashes are in [the JSON evidence](D13-observation-20261009.json).
Node 24.20.0 was used. Logs and private receipts are under
`reports/shared-dictionary-cefr/d13-observation-20261009/` (ignored).

- Focused domain/sync/SQLite: **3 suites / 42 tests passed**.
- Mobile: **156 suites / 1,802 tests / 22 snapshots passed across the full run
  and the isolated configuration retry**. The first invocation ran from the
  root, so `appConfig.test.ts` could not find `apps/mobile/app.base.json`;
  155 suites/1,801 tests passed then. Running that one suite from `apps/mobile`
  passed its remaining test. SQLite's 16 tests passed again after a test-only
  duplicated-string cleanup.
- Web: **86 suites / 780 tests passed, one existing skipped test**.
- `npm run mobile:typecheck`, `npm run mobile:typecheck:test`,
  `npm run typecheck --workspace @woordenaar/domain`, `npm run web:typecheck`,
  and `npm run lint:ci`: passed.
- Changed source and new evidence formatting, plus `git diff --check`: passed.

Representative commands (run from the repository root unless noted):

```bash
node_modules/.bin/jest --config apps/mobile/jest.config.js --ci --maxWorkers=2 --watchman=false
npm run web:test -- --runInBand --watchman=false
npm run mobile:typecheck
npm run mobile:typecheck:test
npm run typecheck --workspace @woordenaar/domain
npm run web:typecheck
npm run lint:ci
python3 reports/shared-dictionary-cefr/d13-observation-20261009/rehearse-snapshot.py
```

For the configuration-only retry, from `apps/mobile`:

```bash
../../node_modules/.bin/jest --ci --runInBand --watchman=false --runTestsByPath src/__tests__/appConfig.test.ts
```

Setup diagnostics: sandbox DNS was resolved with an approved read-only network
call. Host PostgreSQL first failed sandbox shared-memory access, then macOS IPC
capacity; no unrelated process or IPC segment was removed. Synthetic tests used
the retained no-network PostgreSQL 16 image. The initial snapshot container did
not start because the requested image architecture differed; the explicit ARM64
retry used the prior verified image. An experimental SQL fixture also incorrectly
used JSON null where the legacy constraint requires SQL null. These experimental
SQL checks are not the final client-fix acceptance gate.

## Next checkpoint and authority

Prepare the exact native delivery packet for this client-only repair: review the
source diff, preserve a release candidate, verify personal Expo identity/owner
before any remote EAS command, and determine binary versus runtime-qualified OTA
compatibility. Native configuration, dependencies and SQLite schema did not change,
but OTA compatibility and release configuration have **not** been certified here.
Do not publish an update with default dictionary flags or assume the old release
permission authorizes delivery. AUTH-27 was consumed. New production/beta delivery
needs scoped authority for the exact artifact, destination and operation.

After authorized delivery, verify installed source/version, successful sync,
retained cards/reviews, actual native offline return and fresh Sentry health. Keep
D13 open; D14 cannot start before the seven-day observation/adoption gate (earliest
original time boundary October 12, time alone insufficient). The observation
window must include the repaired release's behavior; no automatic acceptance on
October 12. CEFR remains OFF under the accepted reduced release scope; its future
qualification/activation is separate.

Persistence is local-only: seven changed source/test files plus task documents and
evidence. Pre-existing task changes and unrelated `.playwright-cli/` were retained.
No uncertain external mutation, running test, submission or new automation remains.
Recommended continuation model: GPT-6 Astra / High; current picker not verified.
