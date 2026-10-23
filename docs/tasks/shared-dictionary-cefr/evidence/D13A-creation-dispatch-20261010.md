# D13A.5 — Durable creation generation journal

Status: local generation-journal checkpoint complete; final regression passed. D13A.5 remains
in_progress; D13 observation is open and D14 pending. No external authority expanded.

Migration1900 adds a durable creation run and a single immutable generation attempt,
separate from cascading owner requests/commands/accepted operations. Dispatch requires
fresh authority and exact reviewed identity/neutral anchor/source/profile/fence. It
returns provider input only once, records intent before any future provider call, and
reuses the original generation quota reservation. Input excludes private query/hint.
Concurrent workers and lost replies cannot dispatch or charge again.

Raw bounded result/hash/provider response ID survives deletion of the owner's Auth
account. Late/unknown outcomes remain quarantined; explicit reconciliation binds the
exact result and separate audit evidence under fresh authority. Deleted-owner runs are
redacted, inaccessible to a recreated Auth UUID, and unresolved leases are retained.
Known unsent/returned deletion can release its lease while preserving the ledger.
Known failure recovery is intentionally pending; there is no automatic expiry/takeover.

Original command receipts stay immutable, with owner get/accept replay deriving live
status from the run. Busy/existing-meaning receipts retain their zero-charge meaning.
New private tables have RLS and no direct ordinary/service grants. Five new RPCs are
service-only; owner receipt APIs retain their authenticated boundary and strict parser.
Dispatch/result/reconciliation writes no public head/revision/event or personal/SRS row.

`validating` records an unvalidated generation result awaiting independent checks. No
judge transport, accepted creation validation/provenance, first-publication wrapper,
worker/provider HTTP adapter, platform storage or no-match form is wired by this step.
All gates default OFF; no profile, policy, role or live provider operation is seeded.

## Verification boundary

Final PostgreSQL40 files/475 tests and focused77 tests (32 creation dispatch/result,
35 prior acceptance and10 RLS) PASS, zero failed/cancelled/skipped/todo. Final173-path
DB source manifest matches. Target generation/check, contract/native production+test/web
types, changed-fixture zero-warning lint, scoped formatting and diff check PASS.
[Exact hashes/results](D13A-creation-dispatch-20261010.json) retain the evidence boundary.

Initial new fixtures had two wrong canonical-hash imports; both were repaired. The first
combined focus passed all32 new and10 RLS fixtures but failed one old acceptance test
which expected the dispatch function to be absent. That assertion now checks its
inaccessible ordinary RPC boundary and default OFF gate. Final complete/focused runs
passed after this repair. Diagnostic failed attempts and initial lint warnings remain
retained; no guard/limit relaxed.

Local target types were generated; the old public contract can be reconstructed exactly
by removing only five new service RPC declarations and restoring the migration comment.
Contracts, native production/test and web typechecks pass. Prior full native187/2426/
22 snapshots with coverage and web112/1091 benchmark checks are carried, not rerun;
their runtime sources are unchanged. Only generated type declarations/target manifest
changed. The exact reconstruction proof and fresh typechecks cover that boundary.

Entry integrity verified923 referenced hashes with zero mismatches. Existing dirty
bundle and HEADf97a733 remain local-only/uncommitted. Historical37 mirrors/47 sealed
artifacts remain unchanged. Six source paths (3 extensions/3 additions),304 source union;
all runners exited and own temporary Docker containers cleaned. Synthetic PostgreSQL uses cached pinned Docker images,
network none, tmpfs and no ports/hosted credentials. No live provider, paid call, hosted
migration, content publication, commit/push/PR, EAS/release/device or automation action.

## Next checkpoint

**GPT-6.1 Sol / High recommended.** Implement separately charged independent judgement,
strict schema/media/identity/six-dimension semantic checks, immutable creation validation
and provenance, and atomic revision_no1 plus one global head/event. Preserve durable
run IDs and exact receipts under redaction/revocation. The positive global head cursor
may exceed1 and JavaScript safe integer range. Do not overload cascading owner-operation
FKs or human-review fields. Adding source columns must explicitly preserve existing
source approval hashes, which currently cover the registered source row.

Then implement known-failure/review recovery, SQLite/browser durable creation storage,
fresh-owner transport and no-match forms with authoritative publication/adoption.
Broader private/mode/history/account-return/review/performance and D13A.7/8 qualification
remain.10 numbered checkpoints remain including current D13A.5; not a session count.
