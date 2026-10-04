# D13 dormant preparation on the preserved server snapshot

**PASS**, October 4, 2026, 19:07:29–19:07:41 UTC. Source application candidate
remains 13b97b0; starting documentation HEAD295806a. No source changes, new server
backup, hosted connection, provider call, device action or deployment occurred.

The owner directs continuation without P2's unavailable primary Android. Its build
and local queues stay unknown; this is an accepted device-access evidence gap,
not authority to delete data or activate new paths. Existing legacy compatibility
and final release approval remain mandatory.

## Method

Reuse the original AUTH-21 private snapshot, verified SHA-256
`76b1d5add57d6e2b82604dc0743cf697aa8c498bfac20f3b065ef461a4ecd0b0`.
All nine migration hashes and nine control/source-file hashes still match the
[release manifest](D13-release-candidate-20261004.json). No source artifact changed.

A fresh task-only PostgreSQL17.6 container used the already installed image digest
`sha256:82a04ba6c05f60950a74ae46be3726abb18d06ee44da936276fd782e72e36855`:
network none, no published ports, original backup mounted read-only, tmpfs database,
no app/Auth service, no healthcheck or external connection. Restored the existing
local role derivative plus original schema/data with error-stop. Applied the nine
exact migration files in order as postgres, with public,extensions search_path.

Local environment adaptation: initdb creates a database owned by the rehearsal
administrator, whereas the migration executor needs ownership-derived CREATE
rights in public. The local database owner was changed to postgres only in this
new container. No hosted ownership/ACL was changed or claimed verified.

## Verified results

- All 56 original COPY blocks / 24,242 rows match exact sorted original-column
  hashes both before and after all nine migrations. New columns are excluded from
  the old-column hash and separately checked. All owners are covered, including P2.
- All 14 existing public functions whose names contain review/learning/progress
  retain identical definitions, ACLs and owners. New get_web_review_snapshot_v2()
  is recorded separately, not mistaken for an existing-function change.
- operations_enabled=false, reads_enabled=false, legacy_guard_enabled=false.
- CEFR worker enabled=false, policy_id=null; no cron schema.
- Zero dictionary entries, zero linked personal words, zero linked cache rows.
- Temporary container removed after verification. Original backups remain intact.

Private final receipt:
`reports/shared-dictionary-cefr/d13-dormant-rehearsal-20261004/attempt-4/receipt.json`.
Its phase is verified and container_removed=true. Helpers, diagnostics, original
row hashes and function comparisons are private and Git-ignored.

Earlier local attempts are retained for audit: the first lacked database CREATE;
the second exposed the associated public-schema ownership mismatch; both stopped
before applying the first migration. The third applied all nine and preserved all
rows, but its validator compared the whole function list and falsely rejected the
new v2 function. The corrected final run compares every original function by its
signature. No migration source fix or external retry was necessary.

## Limits and next action

This adds real-snapshot preservation evidence to D12's synthetic old-client/offline
coverage. It cannot prove the state of the unavailable Android or its future sync,
exact hosted permissions, current schema drift, deployment latency, or all API
behavior. No live mapping, old-client block or functional release is authorized.
Keep P2 device-only data explicitly outside backup coverage.

Next: obtain scoped approval for the concrete
[dormant production preparation operation](D13-dormant-production-operation-20261004.md),
then perform its read-only preflight and fresh recovery baseline before any write.
Final release, source publication, store/web/Edge deployment and CEFR activation
remain separate decisions. Do not repeat this successful local rehearsal unchanged.
