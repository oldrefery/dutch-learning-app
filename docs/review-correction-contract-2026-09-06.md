# Review correction contract

## Status and scope

The server contract is implemented and tested in isolated local PostgreSQL.
Migration `20260906160000_add_review_corrections.sql` is **not deployed**.
No application account or hosted database was used during implementation.
Web/mobile integration, durable mobile correction sync, and fast review UI remain
the next implementation stages. The feature is not yet available in the app.

This is the persistence foundation for
[fast recognition with review history](brainstorms/2026-09-06-fast-recognition-history-brainstorm.md).

## Capability and command

Authenticated clients can query `review_correction_protocol()`; version 1 exposes
the following contract. `learning_sync_protocol()` stays at 2. A missing or
unsupported correction capability must disable correction writes, not downgrade
them to ordinary assessments. Capability detection alone is not a rollout gate:
clients must also implement effective history and conflict handling.

```sql
SELECT * FROM public.correct_review_assessment(
  p_word_id := :word_id,
  p_event_id := :original_review_event_id,
  p_correction_id := :stable_operation_id,
  p_expected_revision := :last_known_revision,
  p_assessment := :replacement_assessment
);
```

- Revisions start at 0 for the original answer. Every accepted correction adds
  one revision, including an explicitly submitted unchanged rating.
- The operation ID belongs to one immutable payload. Reuse it for an uncertain
  outcome/retry; create a new ID only for a new edit after resolving the prior one.
- No user ID, SRS values, or replacement review timestamps are accepted from the
  client. Identity comes from `auth.uid()` and progress is calculated server-side.
- The original answer correctness and response duration remain factual evidence.
  Correcting an assessment from Again to Good does not change a false recognition
  outcome into a true one.

## Response and retry semantics

The single returned row contains:

| Fields                                                                                                    | Meaning                                             |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `correction_id`, `event_id`, `accepted_revision`                                                          | Receipt for the requested operation                 |
| `effective_revision`, `effective_assessment`                                                              | Latest accepted correction for that original event  |
| `word_id`, `interval_days`, `repetition_count`, `easiness_factor`, `next_review_date`, `last_reviewed_at` | Current canonical word progress under the word lock |

An old acknowledged operation can be retried after another edit, review, or reset.
It returns its receipt without reapplying anything. `accepted_revision` may then
be smaller than `effective_revision`. Word progress may reflect a later review or
reset, not just the event whose correction receipt is being acknowledged. Do not
replace effective state with an old receipt or recompute a word from that receipt.

| SQLSTATE                                  | Meaning / client action                                                                                         |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `42501`                                   | Missing identity or inaccessible/missing/deleted word/event; stop the write                                     |
| `22023`                                   | Invalid payload, conflicting operation-ID reuse, or unavailable checkpoint; do not retry blindly                |
| `40001` with `Review correction conflict` | Stale revision, newer review/reset, or out-of-ledger progress change; fetch canonical state and show a conflict |
| `23505`                                   | Concurrent operation-ID collision; retry the identical payload to reconcile, never silently allocate another ID |

Transport errors have an unknown commit outcome: retain the exact command until
its receipt is obtained. A failed edit must not be counted as successful.

## Storage and eligibility

- `review_events` stays unchanged. Existing event retries and immutable identity
  validation continue to work, even after a correction has been accepted.
- `review_progress_checkpoints` captures the actual pre-review interval,
  repetition count, and easiness, plus the canonical scheduling anchor and last
  review timestamp. Capture happens in the existing apply trigger so multi-row
  native uploads checkpoint each preceding applied result correctly.
- `review_progress_heads` identifies the latest applied review for each word.
  This uses server application order, not potentially stale offline timestamps.
- A new reset invalidates the head; an identical reset retry does not. A newer
  same-word review replaces the head. Other-word reviews and metadata edits do not.
- `review_assessment_corrections` is an append-only ledger with unique operation
  IDs and per-event revisions. Authenticated clients have SELECT only and must
  use the ownership-checked command for writes.
- Before changing progress, the command verifies that current word progress
  matches the expected effective result. Administrative progress changes therefore
  fail closed rather than being overwritten with an old checkpoint.
- All mutating commands serialize on the same owned word row. An accepted
  correction plus its SRS update either commit together or roll back together.
- Existing word/account deletion behavior is preserved: deleting review events
  cascades to their checkpoints, head, and correction receipts.

No legacy checkpoint is backfilled and no historical SRS is replayed by this
migration. Existing events remain visible but cannot be corrected without a
trustworthy checkpoint. The next actual review of an existing word captures one
without resetting its prior progress.

The RPC enforces eligibility, not session membership: session history navigation
is a client-side UX boundary. It does not grant access to another user's words.

## Effective history and mobile integration requirements

`effective_review_events` is a `security_invoker` view respecting underlying RLS.
It preserves one row per review, original timestamps/outcome, and adds
`original_assessment` and `revision`. The displayed assessment and next SRS values
come from the latest correction when present.

Consumers of adaptive decisions, insights, and session summaries must use this
effective result. Old clients continue to read the original assessment; they are
write-compatible, **not correction-aware**. Do not claim complete cross-version
behavioral parity or enable corrections until the new readers are ready.

Mobile must persist correction commands separately from the original pending
review, process them in durable order with review/reset commands, and maintain a
local effective projection. Never rewrite a pending review payload after its first
possible upload: the server may already have committed it without an acknowledgement.

The ledger has its own `(user_id, created_at, correction_id)` index. Original
event `created_at` does not change, so the existing event cursor cannot discover
corrections. A correction pull/reconciliation strategy still needs implementation
and tests for pagination and late transaction commits; the index alone does not
make a timestamp cursor safe against out-of-order commits.

Local correction optimism, rollback on conflicts, process restart, account changes,
and session history restoration must be tested before enabling the UI. No fallback
may send an extra ordinary review to simulate a correction.

## Verification

Run `npm run test:db` with the repository's Node version. The runner starts private
temporary PostgreSQL clusters over Unix sockets, ignores ambient database
credentials, disables TCP listeners, and removes only its own temporary directories.

Coverage includes:

- Good/Again replacement, all target assessments, original answer preservation;
- 64 correction combinations compared with shared SRS, including EF bounds,
  rounding, repetition stages, knowledge levels, and review dates;
- uncertain acknowledgement retries, repeated corrections, stale revisions;
- actual overlapping correction/review/reset transactions and ID collisions;
- RLS, anonymous access, forged word/event binding, forbidden direct writes;
- caller rollback, tombstones, legacy multi-row retries, and late offline dates;
- applying the migration over existing data without changing its contents.

HTTP/Auth integration and native/web runtime checks for this feature are not yet
performed. Remote migration and rollout require separate explicit authorization.
