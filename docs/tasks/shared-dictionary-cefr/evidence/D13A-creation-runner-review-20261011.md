# D13A.7.5 — Creation runner execution review

Date:2026-10-11. Review complete; execution readiness rejected with one P1(CRR-1).
No source repair, paid call, API-key access or live authority/allocation in this review.

## P1 — Consume authority independently of output directory

Location:`scripts/shared-dictionary/creation-pilot-runner.ts:75-86`.
The runner exclusively creates an output directory and assigns a random allocation ID,
but never checks whether the authority ID/receipt has already funded another run.
A completed run settles its13.44 reservation to reported usage. With sufficient budget,
calling the runner with the same receipt,packet and budget directory and a different
output directory creates a second allocation and starts the transport again. The
48-call counter is local to each invocation; settlement does not consume the authority.

Independent offline reproduction uses the unchanged production runner and the existing
synthetic fixture. First run completes48 results; second run also completes48 results.
Both use AUTH-CREATION-TEST with maximum_calls48. Observed:96 transport calls,two factories,
two complete reports,combined reported synthetic charge43200000 nanodollars(USD0.0432).
The second full reservation fits the day ceiling,so the dollar guard cannot enforce the
one-pilot permission. A real repeated CLI launch with another new output path has the
same behavior. No tampering,source change,network or environment permission is needed.

Reproduction:`reports/shared-dictionary-cefr/d13a7-creation-runner-review-20261011/review-probes_test.ts`.
Log:`reports/shared-dictionary-cefr/d13a7-creation-runner-review-20261011/review-probes.log`.
A passing reproduction asserts the defect; it is not a passing authorization regression.

Required fix: durably claim a one-use authority identity under the shared budget lock
before credentials or dispatch. Bind it to the exact receipt,packet,allocation and run.
Reject reuse after completion,settlement,failure or interruption,including a copied
receipt or new output directory. Releasing unused dollar reservation must not replenish
request permission. Define conservative interrupted-claim recovery without automatic
redispatch. A genuinely new explicit authority must remain distinct,with its own review,
expiry and aggregate-budget checks. Add regression assertions that a repeated authority
fails before the transport factory and total calls remain48; cover copied receipt and
failure/interruption paths. New sources require a new immutable execution packet and
Astra/High re-review. Preserve the reviewed old packet and this reproduction evidence.

## Other review boundaries

Inspected all eight new creation-pilot files and existing preparation/grant/transport
interfaces. Exact verification rebuilds packet
`dba036688086857d23dd8b705e4610faab2151c5cf788ab5987c745b4991ec02` unchanged,including36 source
bindings and195 historical provider files. The42-case corpus,40 fixed judges,four actual
generation/contingent-judge pairs and two structural guards retain the accepted scope.
Proposed generator3.8/judge3.6 pins remain unmeasured. No corpus relabeling or scope expansion.

Reviewed full reservation before credentials,exclusive shared lock,prior95-attempt day
accounting,per-row exclusive dispatch/raw-result storage,version/usage rejection,
no automatic retries,expiry/receipt checks,rate waits,actual generated-response judge
binding,strict48-result completeness,generated-pair thresholds,seals and rederived
settlement cost. Existing tests cover incomplete/unknown/failure reservation retention,
expiry during rate wait,wrong versions and lexical identity,raw-response/seal tampering,
and settlement-charge tampering. No other actionable P1/P2 found in these paths.
This is not a proof against arbitrary privileged ledger deletion or unrelated project
spend; the fixed ledger coordinates this runner and its bound historical receipts.

Fresh tests:38/38 existing packet/adapter/runner cases and1/1 independent reproduction,
all cached,typechecked,with read/write permission only. No network/env permission.
Temporary mock directories removed. CLI verify passes with cached dependencies and
read permission only. Source/runtime/migration/provider files are unchanged. Prior
170 other Deno cases and15 PostgreSQL cases remain historical source-bound evidence;
no fresh full-suite,SQL,device,performance or invoice-verification claim.

Commands and logs:

- `/Users/devrush/.deno/bin/deno test --cached-only --unstable-detect-cjs --config supabase/functions/deno.json --allow-read --allow-write scripts/shared-dictionary/creation-pilot_test.ts scripts/shared-dictionary/creation-qualification_test.ts supabase/functions/dictionary-creation/geminiTransport_test.ts` → `deno.log`.
- Same test command with only the independent reproduction file → `review-probes.log`.
- `/Users/devrush/.deno/bin/deno run --cached-only --check --unstable-detect-cjs --config supabase/functions/deno.json --allow-read scripts/shared-dictionary/creation-pilot-cli.ts verify reports/shared-dictionary-cefr/d13a7-creation-runner-20261011/candidate-packet.json` → `verify-packet.log`.

All current-review logs are under `reports/shared-dictionary-cefr/d13a7-creation-runner-review-20261011/`.

## Checkpoint and next action

Next GPT-6.1 Sol / High: implement CRR-1 and regressions,verify locally and prepare a new
source-bound packet. Then GPT-6 Astra / High reviews the fix before any payment.
No payment approval is needed for this repair. AUTH-32 retains its recorded direct-analysis
scope only until2026-10-11T22:00:00Z; no new creation/distinct-judge permission is inferred.
Existing reported commitmentUSD0.8142535 and remainingUSD14.1857465 are unchanged.

Creation fixed deliverables:2/4 complete; measurement and final result review remain.
The runner review is now complete with one open repair within measurement. This does
not add another numbered milestone. D13A.7:4/6 complete,2 remain(semantic qualification;
device/old-client/offline/performance checks). Broad plan:8 remaining milestones.
Direct-analysis pilot complete,0 remaining. No qualified/approved-for-execution claim.

Integrity:4292 baseline references and678 entry dirty paths verified;426 sources,
142 web/449 browser source bindings and94+3+98 provider files unchanged. Only five task
notes and this evidence pair change;680 dirty paths total,local-only. Reports are local
ignored evidence. Flags OFF outside QA,shared_analysis FALSE,CEFR OFF;real2914,
eligible/approved/applied0. Pending operations:none.
