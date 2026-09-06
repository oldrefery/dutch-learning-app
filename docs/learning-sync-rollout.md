# Learning Protocol 2: Rollout And Recovery

Status: the **approved hosted/backend and web cutover completed on 2026-09-06**;
native 2.2.1 (82) was submitted to internal store destinations. See the
[release evidence](protocol2-release-2026-09-06.md). This checklist is not standing
authorization for another deployment or a public store release. See the
[contract](learning-sync-protocol.md), [diagnostics](sync-observability.md) and
[release guide](EAS_BUILD_GUIDE.md).

## Compatibility Gate

| Client               | Older backend                                         | Protocol 2 backend                                                                                     |
| -------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| New native client    | Sync fails closed; pending changes stay on device     | Atomic review/reset commands and canonical progress                                                    |
| Legacy native client | Legacy behavior, including snapshot/event ambiguity   | Stale SRS snapshots ignored; legacy resets not fully supported; ambiguous pre-cutover reviews rejected |
| Current web branch   | Do not assume compatibility with missing command RPCs | Coordinated review/reset RPC contract                                                                  |

There is no implemented global minimum-client-version enforcement in this change.
Publishing a binary does not mean installed clients have upgraded. Before rollout,
the owner must choose how to handle legacy clients: explicit acceptance of their
documented limitations with upgrade/support communication, or a separately
implemented and tested compatibility/access gate. Do not label this a transparent
zero-downtime migration.

## Prerequisites

1. Identify the exact approved commit and release artifacts. Finish branch gates
   and resolve unrelated working-tree changes before the clean-release check.
2. Inspect the target's migration history read-only under separate authorization.
   Confirm a backup and a practical restore/reconciliation procedure; do not merely
   assume a backup exists. The release evidence records the approved target's
   inspection and verified private backup; repeat this gate for a new rollout.
3. Preserve pending device databases, event IDs, local sequence and reset receipts
   where investigation is required. Never ask users to reinstall/clear app data as
   a sync fix. Diagnostic aggregates are not a backup or reconciliation ledger.
4. Record the legacy-client decision above and the unverified risks below. Stage
   rehearsal is recommended, but has not been performed against a hosted target.

## Ordered Deployment Checklist — Requires Separate Approval

- Inspect all unapplied migrations, not only the following three. Apply the
  branch's learning/schema changes in repository order:
  1. `20260905180000_align_review_rpc_srs_rounding.sql`
  2. `20260905200000_server_authoritative_review_events.sql`
  3. `20260905210000_restore_words_analysis_notes.sql`
- Backend protocol 2 must be available before promoting the new native client.
  Coordinate web deployment with the new RPC contract. This ordering does not
  remove the legacy-client limitations during the transition.
- Regenerate Supabase contracts from the approved target and remove the temporary
  RPC type overlay, then rerun typechecks and contract tests. Do not hand-edit the
  generated deployed-schema file or publish an untested regenerated contract.
- Build and distribute the approved native commit using the current cloud-first
  release guide and its personal-account guard. Native changes require a binary;
  an OTA is only an option after explicit runtime/fingerprint compatibility checks.
  No store submission, OTA, push or migration is authorized by this checklist.
- On a permitted test account, verify command acknowledgements, canonical SRS,
  history and review/reset retry identity. Inspect the new health signals and
  existing Auth/database errors by release. Never use the prohibited application
  account for QA. Missing events alone do not prove successful rollout.

## Ambiguous Legacy Queues

Known event retries are idempotent. An unknown pre-cutover review might already
be represented in a legacy snapshot: replaying it could count twice, acknowledging
it without applying could lose a review. The backend deliberately rejects it and
the new client preserves its queue entry. Legacy resets before SQLite v9 may lack
a durable command ID and cannot be reconstructed safely from a word snapshot.

Reconciliation therefore requires inspection of preserved local data and server
history for the affected account, an explicit decision and an auditable correction.
Do not batch-acknowledge, delete, rewrite timestamps or assign fresh IDs to bypass
the cutover guard. There is no automatic reconciliation tool in this release.

## Recovery

If rollout fails, stop further promotion using the approved release mechanism and
preserve the current databases, queues, event IDs, reset receipts and cutover
markers before deciding on recovery. Diagnose protocol, session and rejected
commands separately. Prefer a tested forward fix retaining protocol 2 and command
idempotency.

Do not blindly reverse the SQL or republish a legacy native binary: accepted
commands and canonical history now have different semantics, and old reset writes
remain incompatible. A backend backup restore can discard commands accepted since
the backup; it requires a separate approved recovery/reconciliation plan. No script
in this change clears remote data or resets user progress.

## Evidence And Accepted Gaps

Local PostgreSQL covers RLS, atomicity, concurrent commands, idempotency, rollback,
cutover protection and canonical SRS. SQLite fixtures cover interrupted v8-to-v9
migration/reopen and queue ordering. Existing local native/HTTP QA covers the
two-client regression; it is not evidence about a hosted migration or store build.

The user declined additional manual checks for physical-device network behavior,
upgrading an actual installed old build and real-provider web session expiry.
These remain **unverified risks**, not successful checks. Real multi-day soak and
hosted rollout are also unverified. Observing future incidents may expose problems
but cannot retroactively validate these scenarios or recover unpreserved data.
