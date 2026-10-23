# D13A.5 item8 — performance investigation and compact review transport

October11,2026. Local/uncommitted on feature/shared-dictionary-schema,
HEAD f97a733407a4d2b37e8f9ca030ad9574de85a794. D13A.5 complete locally: original8/8, item8 existing areas2/2 complete.
Nine broader milestones remain: D13.6, D13A.6-9 and D14.1-4.
Next D13A.6, GPT-6.1 Sol / High recommended; no picker switch claimed.

## Demonstrated work and repair

Three local changes reduce repeated work without changing the public contracts:

- Project each validated shared revision once per batch, retaining separate personal projection roots and separate legacy content validation. The complete dependency/card/head/publication/private/version checks remain.
- Map ReviewWord lexical fields directly from the effective card while taking identity, placement and SRS from the personal snapshot row. Eliminate the intermediate full-row copy and repeated dictionary extraction. Exact requested-card coverage and malformed personal-data rejection remain.
- Send the existing indexed following review workspace through the private same-build server/client boundary as one JSON string. Inside it, use a named15-slot word tuple to avoid repeating property names5000 times. Restore all fields and independent dictionary/reference/CEFR/available-revision metadata before the controller reads the workspace. Preserve events, collections, nulls, Unicode/RSC-like strings and decimal counters. Snapshot1/2 are unchanged. This is not a public API, database, persisted queue or content-protocol change.

Regression tests cover request-local projection identity, heterogeneous private/shared
snapshot mapping, all tuple fields, absent dictionary metadata, malformed tuple/index,
JSON text and full round-trip/controller question boundaries. No global content cache,
request authorization relaxation, smaller fixture, filtered vocabulary, artificial
readiness wait, timeout increase or changed acceptance statistic was introduced.

## Profiling evidence and limits

A separate opt-in --profile mode captures owned loopback Node/Chromium CPU samples
and browser timeline events through first card; exact build symbols are
retained. Ordinary measurement controls are unchanged. Three diagnostics contain24
samples each (prior source, projection-only, JSON transport); a fourth timeline
contains16. All88 profile timings are diagnostic, never acceptance.

Old stacks show repeated revision validation/projection, full-row copies and recursive
RSC field traversal. For5000/20 client, selected RSC subtree medians are approximately
26.3ms server/49.3ms browser before, versus1.5ms/no browser samples observed after
JSON transport. This is sampled subtree evidence, not literal zero CPU or complete
wall-time attribution. JSON-only unprofiled CPU4 client20 median improves from the
previous checkpoint's+27.2% to-0.5%, while cold remains+10.6%/+26.8%. That candidate
is superseded by compact tuples and retained under browser-cpu4.

The timeline shows later review module requests, extra inline script processing and
React scheduler work during a slow cold following sample. Nested event durations
cannot be summed as wall time. The whole cold delay is not attributed to one function;
claims about production SQL/auth, network bandwidth or device latency are not made.

## Final representative matrices

Same frozen9 source paths and449 browser/build inputs. Desktop160 and CPU4x160,
four datasets, cold/client navigation, ten alternating pairs per case; two initial
warmups excluded per full matrix. Real shipped enabled controls/one-click readiness,
40ms upstream request delay, fresh contexts, no HTTP cache or unrelated prefetch.
Baseline snapshot1 and following snapshot3 use identical lexical/SRS/event fixtures
and the same application build. Following starts assert one bulk snapshot3, zero
individual content RPCs, exact selected count and dictionary metadata. All320 pass.

Each observed p95 here is the maximum of10 observations, not a production percentile.
The existing10% investigation threshold is a local comparison, not an SLA. All final
full-matrix navigation medians fall within that threshold, but slow cold maxima remain;
therefore repeatability is checked separately rather than inferring acceptance from
favorable medians alone. CPU4 cold20 paired-difference median35.2ms is diagnostic and
does not replace the existing marginal-upper-median statistic.

| CPU | Words/events/selected/navigation | Navigation median baseline/following (ms) | Change | Observed maximum baseline/following (ms) | Start median baseline/following (ms) |
| --- | -------------------------------- | ----------------------------------------- | ------ | ---------------------------------------- | ------------------------------------ |
| 4x  | 500/0/500/cold                   | 849.4 / 890.6                             | +4.9%  | 1021.6 / 1039.2                          | 98.4 / 112.9                         |
| 4x  | 500/0/500/client                 | 575.0 / 576.3                             | +0.2%  | 659.6 / 624.5                            | 107.3 / 105.5                        |
| 4x  | 2500/501/2500/cold               | 1137.1 / 1055.7                           | -7.2%  | 1344.1 / 1407.2                          | 302.0 / 312.9                        |
| 4x  | 2500/501/2500/client             | 773.0 / 769.4                             | -0.5%  | 850.6 / 882.8                            | 285.4 / 305.6                        |
| 4x  | 5000/5000/5000/cold              | 1521.0 / 1399.3                           | -8.0%  | 1642.9 / 1834.5                          | 559.4 / 543.5                        |
| 4x  | 5000/5000/5000/client            | 1073.5 / 1105.3                           | +3.0%  | 1311.2 / 1295.8                          | 548.5 / 540.0                        |
| 4x  | 5000/5000/20/cold                | 1023.1 / 1116.9                           | +9.2%  | 1206.6 / 1460.8                          | 83.2 / 90.0                          |
| 4x  | 5000/5000/20/client              | 586.0 / 625.9                             | +6.8%  | 1048.2 / 714.4                           | 84.3 / 86.8                          |
| 1x  | 500/0/500/cold                   | 595.0 / 578.6                             | -2.8%  | 634.1 / 618.2                            | 22.4 / 22.5                          |
| 1x  | 500/0/500/client                 | 433.8 / 430.9                             | -0.7%  | 677.1 / 457.7                            | 22.2 / 24.7                          |
| 1x  | 2500/501/2500/cold               | 625.3 / 614.0                             | -1.8%  | 723.9 / 649.1                            | 58.3 / 59.0                          |
| 1x  | 2500/501/2500/client             | 473.9 / 464.0                             | -2.1%  | 613.3 / 472.1                            | 60.1 / 61.0                          |
| 1x  | 5000/5000/5000/cold              | 679.2 / 683.8                             | +0.7%  | 976.5 / 1330.7                           | 103.2 / 103.6                        |
| 1x  | 5000/5000/5000/client            | 519.4 / 518.4                             | -0.2%  | 562.1 / 660.3                            | 111.4 / 108.1                        |
| 1x  | 5000/5000/20/cold                | 580.7 / 564.0                             | -2.9%  | 935.5 / 1150.3                           | 16.4 / 17.5                          |
| 1x  | 5000/5000/20/client              | 422.0 / 461.0                             | +9.2%  | 434.9 / 523.7                            | 18.9 / 19.7                          |

## Recovery and checks

Final compact source passes10 synthetic recovery checks, five each in light/dark:
shipped Retry, loaded question/reveal offline with detail retry, collection/detail
freshness versus frozen active question and next-session adoption, owner A-B-A return
and read-only request allowlist. No assessment or provider request is submitted.
Cold offline navigation still requires connectivity and retry; production/device
recovery remains outside these synthetic checks.

Fresh full web119/1253 with the unchanged opt-in benchmark and5000ms timeout;
focused serialization1/9, final types, scoped zero-warning app/harness lint and
backend/probe7. The final test-only edit is an explicit helper return type; executable
app/test logic is unchanged and the final focused/type checks pass. Native196/2670/22,
Edge108, PG547/worker35 are carried, not rerun; exact declared boundaries are verified.

One profile build failed during public next/font loading and passed an identical-source
retry. Initial type/lint failures, the narrow test-helper inference failure and earlier
candidates remain in logs; repaired before final browser qualification. No test or
performance gate was weakened.

## Integrity and continuation

Prior evidence MD/JSON and its reports remain immutable. All1206 prior referenced
hashes matched at entry;1193 remain exact, with eight intentional existing source
changes and five current task-note updates. New helper raises the source union to371;
task web boundary142 and browser inputs449. Source9 freeze includes the six app/test
files and three harness files. Exact raw diagnostics, matrices, notes and new report
hashes are listed in the companion JSON. All owned processes exited; no pending runtime operation remains.

Flags remain OFF outside isolated QA, shared_analysis FALSE and CEFR OFF. AUTH27-29
are consumed. No provider, paid, hosted migration, Git publication, EAS, device,
release or automation action. D13A.6 corpus mapping and D13A.7 dedicated acceptance
remain separate; this checkpoint grants no external permission.

## Unchanged-source repeat and local decision

The additional CPU4 --following --core run completes120 measured samples on three
large datasets with ten alternating pairs per cold/client case, plus two excluded
2500-word cold warmups. All120 functional assertions pass. Both full matrices and
the repeat retain all samples; no candidate rerun is selected to replace a failure.

| Large CPU4 case       | Repeat median baseline/following (ms) | Change | Pooled20-per-mode median baseline/following (ms) | Pooled change |
| --------------------- | ------------------------------------- | ------ | ------------------------------------------------ | ------------- |
| 2500/501/2500/client  | 763.7 / 756.8                         | -0.9%  | 764.5 / 758.2                                    | -0.8%         |
| 2500/501/2500/cold    | 1108.8 / 1061.8                       | -4.2%  | 1114.2 / 1055.7                                  | -5.3%         |
| 5000/5000/20/client   | 562.2 / 590.5                         | +5.0%  | 564.3 / 603.6                                    | +7.0%         |
| 5000/5000/20/cold     | 999.9 / 987.0                         | -1.3%  | 999.9 / 987.0                                    | -1.3%         |
| 5000/5000/5000/client | 1042.2 / 1061.0                       | +1.8%  | 1042.2 / 1073.9                                  | +3.0%         |
| 5000/5000/5000/cold   | 1448.0 / 1466.9                       | +1.3%  | 1470.0 / 1443.5                                  | -1.8%         |

All16 full-matrix navigation medians and all six independent repeat medians stay
within the existing10% investigation threshold. Pooled20-per-mode medians use the
same upper-median definition and include both CPU4 runs; they are supplemental.
The all-due cold repeat maximum shifts to2083.6ms control versus1617.8ms following,
showing cold-tail variation also in the control. The20-due repeat maximum remains
1262.6/1409.5ms; rare following delays are not claimed eliminated. Neither10 nor20
samples establishes a production percentile or statistical equivalence guarantee.

D13A.5's local gate is complete based on demonstrated redundant-work removal,
unchanged-source representative/repeat medians, all440 functional browser samples,
recovery10 and regression checks together. It is not based on bytes or one favorable
median alone. D13A.7 already owns dedicated broader acceptance/device/production-like
performance validation and must review these tails; that gate is not waived or new.
The original checklist is8/8; item8 areas2/2. Nine broader milestones remain.
Next D13A.6, GPT-6.1 Sol / High: reviewed corpus mapping and local snapshot/apply/
rollback rehearsal. No live conversion or broader authorization is implied.

The compact5000/20 cold page decodes to about2.76MB, versus3.96MB JSON-only candidate
and3.29MB snapshot control; encoded transfer remains about107KB versus101KB control.
This is payload evidence, separate from the measured latency decision.

See [machine evidence](D13A-web-performance-20261011.json) for exact artifacts/hashes.
