# D13A.7.5 — CRR-1 one-use creation authority repair

**2026-10-11 — D13A.7.5 CRR-1 locally repaired; Astra/High re-review pending.**

One-use authority now has a deterministic allocation identity in the shared budget
ledger. An exclusive synced allocation consumes permission and reserves USD13.44
under the budget lock before run creation, credentials or dispatch. Exact receipt
bytes/hash, packet, authority/allocation ID, unique run ID and absolute run directory
are bound in allocation/run/settlement and checked during replay/accounting.
Settlement frees verified dollars only; it cannot renew permission. Existing,
copied/reformatted, next-day or interrupted claims cannot automatically redispatch.
Partial claims fail closed; a claim without a run retains the entire reservation.

Final cached/typechecked Deno51/51 passes(34 runner+3 packet+14 adapter cases),
including13 new authority/reuse/interruption/concurrency/binding regressions.
Scoped ESLint0 warnings,source formatting,diff and CLI prepare/verify pass.
Two earlier51-case runs passed; two lint attempts required literal constants and a
small directory-reading helper before the final clean result. No suppressed rules.
All provider calls mocked; no network/env permission, key access or paid dispatch.
Earlier full/client/SQL/device suites are retained evidence, not fresh verification.

New immutable execution packet `ea2bad9acbe04f376bc9ab3287a3be13a0cd99480a230b2223daa13aca9ee3d7` binds36 sources and195
unchanged historical provider files. Profile,42-case corpus,requests,guards,thresholds,
limits and accepted readiness packet remain identical. Old packets/reports retained.
Qualified FALSE; approved_for_execution FALSE; no live creation authority/allocation.

Next **GPT-6 Astra / High**: review CRR-1 repair, interruption/reservation semantics,
receipt/allocation/run/settlement bindings,13 regressions and this exact packet.
No paid call needed. Stop at this model/review boundary. Reconcile explicit creation/
distinct-judge authority only after accepted review and before any later paid dispatch.
AUTH-32 remains direct-analysis-only through2026-10-11T22:00:00Z; no renewal or scope
extension. Historical day commitmentUSD0.8142535/remainingUSD14.1857465 unchanged;
invoice not verified. No new payment question for this local repair.

Creation2/4 complete,2 remain; D13A.7 fixed4/6 complete,2 remain;8 broad milestones.
Accepted direct-analysis pilot remains complete,0 remaining substeps. Stage in_progress.
All682 entry dirty paths preserved;684 total,local-only/uncommitted. Six pilot script
files changed; application/runtime/migrations/corpus and195 provider files unchanged.
Flags OFF outside QA,shared_analysis FALSE,CEFR OFF;real2914,eligible/approved/applied0.
No pending operation,commit,push,hosted,EAS,device,release or automation action.

## Implementation and conservative recovery

Changed scripts: creation-pilot-runner.ts,journal.ts,budget.ts,replay.ts,packet.ts
and creation-pilot_test.ts. Allocation file is keyed by validated authority ID,
independent of output directory and day. It is exclusively created and synced before
run files or transport. Its raw receipt/hash,packet and run identity must agree with
the run and settlement; offline replay verifies receipt contents and absolute location.
No extra authority claim file or second crash-sensitive allocation write is required.
An existing even empty/partial allocation blocks reuse before budget accounting or
factory construction. Interrupted preparation can have no termination.json or run
directory: the allocation is authoritative and remains reserved. Do not delete,refund
or redispatch it automatically; inspect it in a separate manual review. A missing run
directory supplies no dispatch times; errors reading existing receipts still propagate.
Arbitrary privileged ledger deletion and unrelated project spend remain outside the
runner's cooperative fixed-ledger guarantee, as in the accepted prior review.

## Evidence

Reports: `reports/shared-dictionary-cefr/d13a7-creation-authority-repair-20261011`. Final packet: `reports/shared-dictionary-cefr/d13a7-creation-authority-repair-20261011/candidate-packet-final.json`.

- `deno.log`: cached/typechecked Deno test with allow-read/write only; final51/51.
- `eslint.log`: scoped ESLint with max-warnings=0; exit0,no warnings.
- `format-check-source.log`, `diff.log`: formatting and diff checks pass.
- `prepare-final-packet.log`, `verify-final-packet.log`: exact final CLI packet checks.
- `entry-integrity.json`, `git-status-entry.z`, `git-status-final.z`: entry/final bindings.
- Earlier test/lint logs and provisional packet are retained, superseded by final bytes.

Deno command: `/Users/devrush/.deno/bin/deno test --cached-only --unstable-detect-cjs
--config supabase/functions/deno.json --allow-read --allow-write
scripts/shared-dictionary/creation-pilot_test.ts scripts/shared-dictionary/creation-qualification_test.ts
supabase/functions/dictionary-creation/geminiTransport_test.ts`.

13 new regressions: settled reuse with same/copied/reformatted/next-day receipt(4),
distinct new authority(1), interruption before run/credentials plus claim-only/partial
claim(4), concurrent launch(1), run receipt/allocation run/settlement tampering(3).
Original six failure/unknown/version cases additionally reject new-output reuse;
known completed reuse remains48 calls/one factory. A genuinely new authority permits
96 mocked calls/two factories; each authority contributes exactly its own48 calls.
All fixture directories removed. Final manifest records exact source and evidence hashes.

## Review boundary

CRR-1 implementation complete locally; closure remains pending prescribed Astra/High
review. No automatic model switch claimed. No paid request or credential access needed
for the next review. Provider measurement and final result review remain open.
