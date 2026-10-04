# D13 proposed dormant production preparation

**Approved as AUTH-24 and completed.** October 4, 2026. Recommended GPT-6 Astra /
High. This is the next concrete operation after
[successful snapshot rehearsal](D13-dormant-snapshot-rehearsal-20261004.md).

See [completed execution and verification](D13-dormant-production-completion-20261004.md).
Do not replay; the scope below is the historical approved operation.

## Approved scope

Only Dutch Learning App production, project josxavjbcjbcjgulwcyy, oldrefery's
personal project. Apply exactly the nine ordered migrations and hashes in
[D13-release-candidate-20261004.json](D13-release-candidate-20261004.json), candidate
source13b97b0. Install additive tables, nullable columns, indexes, functions,
triggers and grants while all new paths remain disabled. Record each applied
migration in the deployment ledger, bound to the reviewed file contents.

This scope also requests a fresh private local logical backup and isolated restore
check immediately before writes, using the same protection/exclusions as AUTH-21.
The earlier successful backup remains untouched. Use only an existing authorized
DB credential for this project, held privately for the operation, never logged or
placed in command-line arguments. No credential reset, login-role creation,
permission widening, account switch or plan purchase is included.

## Execution and stop conditions

1. Recompute all candidate hashes, verify project/database identity, role/ownership,
   effective permissions and current ledger. Explicit connection only; do not use
   a CLI path that silently creates login roles. Inspect fresh schema/function
   definitions against the retained baseline. Stop on unexplained drift, missing
   privileges, unexpected migrations or ambiguous identity; do not repair grants.
2. Capture a fresh consistent logical backup to a new protected Git-ignored
   builds/d13-preparation-backup.<unique> directory; verify local restore in an
   isolated database with no network/ports and original files mounted read-only.
   Capture current owner-scoped counts/identities/learning baseline privately.
   This preserves server state; it does not capture unavailable P2 local queues.
3. Apply the reviewed migration sequence with error-stop and bounded lock/statement
   waits. Each file and its migration-ledger record must commit atomically. Do not
   run unrestricted db push, deploy any functions, install unrelated admin tooling,
   or alter migration contents to get past an error. DDL may briefly wait for or
   block database writes; stop on lock timeout, then inspect actual committed state
   before any retry. Preserve a receipt for each committed version.
4. Verify runtime operations/reads/legacy guard are false, worker false/policy null,
   no scheduler, zero linked words/cache and no published dictionary entries.
   Recheck old learning RPC definitions, grants and compatibility invariants.
   Compare original data, retaining legitimate learning writes accepted during
   preparation; never assume all changes are migration damage or overwrite them.
   Save only sanitized aggregates/hashes in repository evidence.
5. Keep client flags off and existing production apps authoritative. Remove only
   operation-created local verification containers and temporary credential files;
   retain backups and receipts. Report completed versions and any unresolved drift.

On failure, stop with new paths off. A failed transaction rolls back that file;
previous additive versions may remain safely dormant, recorded in the receipt.
Do not restore the old full backup or drop schema over subsequently accepted reviews.
Any compensating production change needs a concrete reviewed scope.

## Explicit exclusions

No source push/PR/merge, official dictionary publication, personal-card mapping,
P1/P2 cutover, phone installation/update/reset, OTA/store build or submission,
web/Edge deployment, provider request, support message, paid plan or CEFR activation.
P2's unavailable-device exception permits preparation to continue; it does not
prove empty local queues or authorize discarding late offline writes. New native
binaries and the final DEC-09 release approval remain later gates.
