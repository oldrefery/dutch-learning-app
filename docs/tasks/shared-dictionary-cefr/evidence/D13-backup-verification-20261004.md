# D13 private backup and isolated restore — 2026-10-04

**PASS for logical backup/restore**, source branch `feature/shared-dictionary-schema`,
starting HEAD `872b2b7`; no application source change. AUTH-21 granted the private
copy and local restore; the owner then supplied an existing DB password. No new
login role or password reset was needed. Recommended GPT-6 Astra / High.

## Capture

Target only Dutch Learning App production `josxavjbcjbcjgulwcyy`, PostgreSQL 17.4.
One successful pg_dump 17.6 plain schema-and-data dump with original owners/ACLs,
`--serializable-deferrable`, quoted identifiers and a bounded lock wait completed
around 18:14:46 UTC. Roles were captured separately without passwords at 18:14:48.
No live DDL, role creation, network unban, data mutation, migration or provider call.

The existing session pooler endpoint was used with explicit password authentication.
Pooler startup options did not enforce read-only on the initial SELECT inventory;
an explicit BEGIN READ ONLY confirmed the boundary, and pg_dump created its own
read-only serializable snapshot. Never reuse default CLI implicit role creation.
First Docker launch failed before connecting because of host amd64 default versus
installed arm64 image. Explicit arm64 succeeded; no successful snapshot was repeated.

Private mode-0700 destination: `builds/d13-preflight-backup.cbabcezm`.
All files mode 0600, ignored by Git and root build upload exclusions. Original
`database-v2.sql` is 26,961,696 bytes, SHA-256
`76b1d5add57d6e2b82604dc0743cf697aa8c498bfac20f3b065ef461a4ecd0b0`.
`roles.sql`, checksums, table manifest, private logs and README retained there.
No row contents or credential are in committed evidence. Temporary password file
outside the repository was deleted after capture; it was not added to argv or logs.

## Restore and exact comparison

A new isolated PostgreSQL 17.6 container used existing Supabase image digest
`sha256:82a04ba6c05f60950a74ae46be3726abb18d06ee44da936276fd782e72e36855`.
Network none, no published ports, original backup mounted read-only, tmpfs database,
no application/Auth services. psql ON_ERROR_STOP and a single transaction were used.
First restore rolled back entirely because original role-membership grantor identity
could not grant memberships created by the local administrator. A local derivative
omitted 19 GRANTED BY clauses; memberships/attributes were retained, originals intact.
Second restore succeeded without SQL errors.

- 57 catalog tables restored; 56 COPY blocks contain 24,242 rows.
- Every block matches sorted SHA-256 of COPY output using its original column list.
- The remaining table, realtime.messages, is an empty partitioned parent.
- Both sequence last_value/is_called pairs match the snapshot.
- All 43 migration records restored.
- Pre-capture Storage object and Vault secret counts were zero.
- Temporary restore container removed after success; original backup retained.

Private receipts: `restore-verification.json`, `verification-container.json`, and
`reports/shared-dictionary-cefr/d13-preparation-20261004/backup-operation.json`.
Final phase: complete_backup_and_isolated_restore_verified. No operation pending.

## Scope limits and next action

This verifies logical loading and exact stored row preservation, not complete hosted
recovery or application login. Role passwords, provider configuration, external media
contents and device-only queues are outside this backup. Local role grantor provenance
was adapted; source 17.4 restored on same-major 17.6, not an exact hosted image.
Roles are a separate snapshot and sequences are not MVCC-snapshot guarantees. This
single local copy provides no off-device redundancy. Preserve it from build cleanup.

AUTH-21's requested capture/restore is complete; do not repeat it on resume. Before
any approved production write, obtain a current baseline/delta and protect later
accepted reviews. D13.1's release authorization remains open, as do D01 installed
build/full-queue evidence and the other readiness-packet gates. No migration, push,
PR, publication, device operation or deployment permission follows. CEFR stays off.

Official documentation consulted via Context7 and the
[Supabase connection guide](https://supabase.com/docs/guides/database/connecting-to-postgres)
for session pooling, plus [PostgreSQL restore guidance](https://www.postgresql.org/docs/17/backup-dump.html)
for transaction/error-stop behavior. Source snapshot and private comparison evidence
are authoritative for this run. Normal scoped commit hooks provide repository checks.
