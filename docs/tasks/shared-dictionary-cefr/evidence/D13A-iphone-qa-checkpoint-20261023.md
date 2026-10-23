# D13A.7.6 iPhone QA checkpoint and open findings — 2026-10-23

Status: acceptance remains open. D13A.7 is 5/6 complete; D13A.7.6 is the one remaining
step. Eight broad milestones remain. Do not proceed to D13A.8 or treat this packet as
release approval. All work is local; no paid calls, publication, hosted migration,
commit or push. Main iPhone application/account was not operated.

## Confirmed retained changes

- IOR-1: learning on a downloaded v2 word no longer fabricates a legacy private-content
  command. Physical offline/restart/reconnect evidence delivers the new assessment once,
  preserves original content, follows the later head, and passes A/B/A owner return.
- NPR-1 partial repair: unfinished same-owner initialization shares word/collection reads;
  root refresh performs one word load. Physical cold/warm load IDs are now1/2 instead of3/5.
  Settled requests do not become a cache; owner transitions and late promises are fenced.

The final retained source passes244 tests across7 suites, mobile TypeScript and scoped
zero-warning lint. Six later performance experiments are reverted byte-for-byte, including
their tests. They are not retained fixes. Repository source is preserved with598 worktree
status lines at this checkpoint; full list is final-worktree-status.txt.

## Open NPR-1 performance finding

With the retained fix, two opposite-order physical5000-word/5000-event/full-selection
pairs pass data parity and no-assessment checks, but warm candidate totals remain
3964ms versus2991ms (+32.5%) and3896ms versus3124ms (+24.7%). These totals sum measured
SQLite/store loading and review-start-to-native-layout segments; they are not continuous
icon-to-question latency. Diagnostic warmups are not the planned10-pair median/p95 matrix.

Synchronized Time Profiler traces cover the cold question, pre-refresh and warm question
captures for exact QA PIDs5053/5061. JS sampled CPU is7674ms candidate versus6862ms baseline;
OldGen search leaf samples1506ms versus1025ms. In the warm UI window those leaf samples
are1252ms versus971ms. This establishes material GC activity in both variants, not a
proven leak or attribution of all elapsed delay to one parser function. Inclusive stack
frames overlap and must not be summed. The first non-overlapping trace is excluded.

Rejected experiments, all sources/results retained under native-performance:

| Experiment                         | Decision                                                            |
| ---------------------------------- | ------------------------------------------------------------------- |
| Decimal sequence comparison        | No physical total-latency benefit; reverted                         |
| Reduced full Word copies           | No adequate physical total-latency benefit; reverted                |
| Batched cache parser               | Parse segment improved but total latency worsened; reverted         |
| Precomputed parser shapes/paths    | Warm candidate4219ms versus baseline2994ms; reverted                |
| 100-row cache reads                | Candidate3933ms remained near prior3896/3964ms; reverted            |
| Compact normalized distractor pool | Candidate2771/4117ms cold/warm versus1829/3347ms baseline; reverted |

The last three experiments passed their focused contracts (72,57,24 tests respectively),
but test success was not mistaken for native performance improvement. Initial test-command,
query-count and lint issues are retained alongside corrected successful checks. No full
acceptance matrix samples were collected while the material regression remained open.

## Exact original85 / repair OTA remains unqualified

The archived original IPA was inspected read-only. It contains the production bundle,
backend and enabled OTA behavior. A safe isolated execution of that exact artifact and
repair OTA has not been established under the main-account protection constraint. The
separate re-signed/rebuilt QA package is not evidence of exact original runtime behavior.
No original app replacement, main-account session operation or security bypass occurred.

## Restored device and independent verification

Installed isolated QA is the normal IOR-1+NPR-1 package, without performance instrumentation:
JS SHA2565685ea8742adbf4f7ca38dfe4733e1ebf3cb708e4e1cd5f70b032676268a341d.
All113 archived file hashes and the signature were verified before installation. Only QA
Documents/SQLite was restored with merge/remove-existing-content=false and empty WAL/SHM.
The synthetic authentication session was preserved; auth-only refresh succeeded at16:17:57Z,
after which the owned relay was stopped. No benchmark REST writes were permitted.

Final physical offline XCTest passed1/1 with exit0. Screenshot confirms D13A Following QA,
fietspomp and the second shared-head text. Independent copied SQLite is intact; words,
collections, review events, cached cards, heads and card content match the saved functional
backup exactly. It has26 words (24 active),7 collections and7 review events; the local server
also remains at7 events. No benchmark tables or content commands remain. QA is stopped;
port55341 is closed. Local QA containers/proxy remain available; no unrelated process changed.

## Next checkpoint

1. Review retained IOR-1/NPR-1 fixes and the CPU/paired evidence; design a bounded follow-up
   for the remaining materialization/GC delay. Do not repeat rejected experiments unchanged.
2. Establish a safe exact-original85/repair-OTA execution path within the user's account
   constraint. Keep this gate open if no such path is available; never substitute rebuilt QA.
3. Once the delay is addressed, run the existing full same-device acceptance matrix with
   both warmups and all10 alternating pairs per case, preserving every outcome. Re-run
   functional QA only as justified by changes; stop after genuine D13A.7 completion.

Evidence root: reports/shared-dictionary-cefr/d13a7-native-resume-20261023/native-performance.
Key receipts: npr1-recheck-summary.json, npr1-cpu-comparison.json,
npr1-final-revert-verification.json, final-functional-restore-result.json,
final-owned-process-state.json, final-retained-regression.log,
final-retained-types.log, final-retained-lint.log. Earlier offline proof is
../iphone-fixed-offline-result.json. Final UI bundle is
../iphone-xctest/final-functional-offline-restore.xcresult.
