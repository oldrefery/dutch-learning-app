# Learning Synchronization Protocol 2

Status: implemented on the quality branch; **not deployed**. This replaces the
whole-word progress upload responsible for the [native QA failure](native-sync-qa-2026-09-05.md).

## Contract

- The server owns SRS progress. Client word inserts start with initial SRS;
  word upserts/metadata updates cannot replace existing learning fields.
- A unique review event is a command. PostgreSQL locks its owned live word,
  calculates from the current server state and commits progress plus canonical
  before/after history in the same transaction. Known event IDs are idempotent;
  changed intent under an existing ID is rejected. Provisional client SRS values
  are not trusted. Both direct native event upserts and the web review RPC use
  this path, including multiple events for one word in a single batch.
- Commands are applied in **server acceptance order**, not by replaying history
  in client-clock order. A delayed assessment counts once against current SRS.
  Last-review time is the maximum of existing and incoming review times; scheduling
  uses the latest of the incoming local review date, the existing UTC review
  date and the last accepted reset's local date. Canonical event statistics
  describe application order.
- Example: online Good followed by an older offline Easy produces two repetitions,
  interval 10 days and EF 2.50. The newer last-review timestamp is retained.
  This intentionally differs from chronological Easy → Good (interval 6 days).
- Reset is a separate `reset_word_learning_progress` command with its own ID,
  original timestamp and local date. It resets SRS and schedules tomorrow while
  preserving review history. Retrying a reset after another review does not reset
  again. A previously unknown offline review arriving after a reset is a new
  accepted assessment, not silently discarded based on its client timestamp.

## Client Durability And Reconciliation

SQLite migration v9 adds a persistent sequence shared by review and reset
commands. The word update and command enqueue are transactional. Sequence, rather
than timestamps, preserves review → reset → review even within one millisecond.
Existing pending review events are enqueued in their legacy timestamp/ID order.
Acknowledgements remove only the identified command; tombstones remove commands
for the deleted word. A failed reset upload leaves its original ID/date intact.

The native synchronizer checks `learning_sync_protocol() = 2` before transferring
data. An unsupported backend leaves changes queued; there is no legacy snapshot
fallback. Metadata uploads omit SRS. Review batches stop at the next reset in the
local sequence. After successful writes, the client fetches canonical word/event
values before reporting completion. Unacknowledged learning commands protect
provisional local SRS from pulls even after metadata acknowledgement. Canonical
history can replace provisional before/after statistics, but not event identity.

Web reset requests retain the same ID/timestamps through an in-form retry and
renew them after success. This is not a durable web offline queue across reloads.
The otherwise unused direct mobile service helpers also call command RPCs instead
of issuing SRS field updates; their session retries retain command IDs.

## Migration And Old-Client Boundaries

The migration runs transactionally while locking words and review events. It
preserves existing progress/history and records a private-to-each-user cutover
timestamp for every existing word. No old history is replayed or repaired.

Old snapshot and event uploads were separate transactions. An unknown event
dated at/before its existing word's cutover could already be included in that
word's progress snapshot. Automatically accepting it risks double counting;
automatically acknowledging it risks losing an unuploaded assessment. Therefore:

- Known event retries are accepted without reapplication, including old events
  without a persisted local review date.
- Unknown pre-cutover events are rejected with `Legacy review requires
reconciliation before upload; keep the local event`. They stay queued on the
  device. Resolving these requires an explicit reconciliation decision; no
  speculative timestamp/counter merge or destructive queue cleanup is included.
- New events on existing words after cutover, and reviews of new protocol words,
  follow the atomic command path. Existing stale SRS snapshots cannot overwrite it.
- Legacy direct reset updates fail with an upgrade error. Legacy resets encoded
  as whole-word upserts cannot be distinguished from stale initial snapshots;
  their SRS values are ignored. **Old mobile versions are not fully compatible.**
- Pending resets made before SQLite v9 have no durable command ID; they cannot
  be reconstructed reliably from a word snapshot. Preserve the device database
  and explicitly reissue/reconcile such resets after upgrading.

These boundaries make this a coordinated protocol release, not a migration to
apply casually while claiming every old offline queue is compatible.

## Authorization And Rollout

Word/event RLS remains active. The review RPC and preparation trigger run as
invoker. The narrowly scoped event-application trigger writes canonical SRS as
the table owner. Reset's definer RPC explicitly checks authenticated ownership,
live-word status and the optional collection before writing. Reset receipts have
no client table permissions. Clients can read only their own cutover markers,
and cannot modify them. No client-controlled flag grants privileged SRS writes.

Before an explicitly approved rollout:

1. Back up the database and preserve any pending native queues. Plan how to
   identify/reconcile pre-cutover reviews and legacy resets; do not clear app data.
2. Validate the migration and current web/native clients in a disposable staging
   environment, including the two-device scenario and upgraded-device queues.
3. Coordinate minimum native version/update messaging and web deployment. New
   native clients fail closed against the old backend; old clients have the reset
   limitations above. The earlier SRS rounding migration must also be applied.
4. Apply the schema only with explicit approval, regenerate Supabase contracts
   and remove the temporary RPC type overlay. Do not edit the deployed generated
   contract file by hand.
5. Repeat native offline/restart/two-client QA, then watch sync errors and command
   acknowledgements. Never test with the forbidden application account.

Local PostgreSQL tests cover atomicity, RLS, concurrent reviews, canonical native
batches, stale snapshots, idempotency, reset retries, rollback and cutover safety.
SQLite tests execute the real repositories and command triggers. Hook/service and
web tests cover orchestration and retry payloads. These do **not** constitute a
new native-device or hosted-backend verification of protocol 2.
