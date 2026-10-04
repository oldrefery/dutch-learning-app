# D13 primary iPhone preservation — October 4, 2026

**PASS: stable private SQLite capture, integrity, complete SQLite queue inventory.**
Primary learning iPhone, user-designated P1; native version 2.3.1 (84), TestFlight
Beta Distribution. No app launch/stop, sync, installation, logout, storage clear,
learning action or device-file write. Recommended GPT-6 Astra / High.

## Authorization and method

The initial export was rejected before execution by automatic approval review:
metadata access did not authorize the private database payload/destination. No
capture was created by that rejected command. The owner subsequently explicitly
authorized the entire private SQLite export to this Mac (AUTH-23).

Apple's app metadata command initially crashed on a missing Mercury framework.
Existing Expo USB installation_proxy Lookup independently returned 2.3.1 (84).
After the owner installed the missing library, devicectl app metadata succeeded
and confirmed the same installed version. Neither method launches the app.

Existing paired USB house_arrest VendContainer exposed this app container. Only
/Documents/SQLite/dutch_learning.db and its three known SQLite companion paths
were inspected. Two read-only AFC captures completed 18:54:21–18:54:23 UTC:

- Main database: 10,579,968 bytes; regular file, stable size/mtime before/after.
- WAL, SHM and rollback journal: explicitly absent (OBJECT_NOT_FOUND) on both passes.
- Both independent captures have SHA-256
  `f8ed5582b6fc57cb2e2c69e67b1427eabf96baca07285077f0d4656f584693b8`.
- Direct FILE_OPEN used RDONLY=1, followed only by FILE_READ and FILE_CLOSE.
  Expo's convenience openFile uses write mode and was deliberately not called.

Private destination: `builds/d13-primary-ios-snapshot.ghp8wb`, directory0700 and
files0600, ignored by Git. Raw capture-1/capture-2 retained; analysis/ is a local
working copy. Receipt/helpers/aggregate results are protected under
`reports/shared-dictionary-cefr/d13-primary-ios-20261004`. No private row content,
device identifier, email or credential is in this evidence. No external upload.

## Local verification

Read only the working copy with SQLite mode=ro, immutable=1, query_only=ON.
Integrity check: ok; foreign-key violations: zero. Original raw hashes rechecked
unchanged afterward. Nine tables inventoried, including all learning queues.
One owner across all owner-bearing records; that ID exists in the authorized
server backup's Auth snapshot. No other owner's rows in the device database.

| Data or queue                                                | Observed state                                        |
| ------------------------------------------------------------ | ----------------------------------------------------- |
| Words                                                        | 2,344 total: 2,342 active, two tombstones; all synced |
| Collections                                                  | 12, all synced                                        |
| Review events                                                | 1,650, all synced                                     |
| Review corrections                                           | One, synced                                           |
| Legacy user progress                                         | Zero                                                  |
| Ordered learning commands, including review/reset/correction | Zero                                                  |
| Correction recovery                                          | Zero                                                  |
| Unsynced/error/conflict/deletion statuses                    | Zero across inventoried sync tables                   |

PRAGMA user_version is zero; this app stores its migration version in AsyncStorage.
Do not mislabel that value as schema version zero. The observed SQLite structure
includes correction recovery and no dictionary tables; AsyncStorage and exact OTA
identity were not exported. Queue evidence is for this captured instant only.

## Comparison with existing server backup

Used the already completed AUTH-21 snapshot locally; verified its original SHA-256.
No new server request or backup was made. All owner-scoped IDs match exactly:
2,344 words, 12 collections, 1,650 events, one correction, zero legacy progress.
All shared collection/event/correction fields match after explicit timestamp,
boolean, numeric, PostgreSQL-array and JSON representation normalization.

All SRS fields of the 2,342 active words match. Eighteen word rows have differences
in other original shared fields, including one deleted card with old SRS drift:

- 17 local dutch_original values are null while the server has a value.
- One local analysis_notes is null while the server has a value.
- One tombstoned word has local repetition_count=1 versus server=0, a local
  last_reviewed_at versus server null, and a later local next_review_date.
  It has no stored review events or reset rows, and one server legacy cutover row.
- The affected rows have equal updated_at timestamps across the two snapshots.
  Empty queues therefore do not prove every local field equals the server.

The legacy cutover is context, not a proven root cause. No reconciliation or
repair was attempted. Both original states remain preserved. Comparison covers
original shared fields; it does not prove whole-app/server identity or fresh live
convergence. Do not restore either snapshot over later reviews.

## Checkpoint and limits

AUTH-23 capture/analysis is complete; inspect its completed receipt, do not replay.
This is an app-database snapshot, not a whole-phone backup: no credentials,
AsyncStorage, media files, updater data or in-memory state. No phone restore tested.
Preserve this directory from builds cleanup. Local permissions are not encryption.

P1 native-build and SQLite pending-queue gaps are now resolved at this instant.
D01.2 still needs P2's actual Android and relevant web/OTA evidence. The disposable
Huawei is not P2. D13 release remains blocked on these remaining gates and exact
release approvals; no migration, publication, deployment, push or PR authorized.
The stored field differences must be accounted for in the eventual preservation
baseline/delta, not silently normalized by overwriting the phone. CEFR stays off.
