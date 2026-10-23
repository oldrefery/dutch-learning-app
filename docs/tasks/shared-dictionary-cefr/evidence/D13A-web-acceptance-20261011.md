# D13A.5 item8 — web recovery complete; performance gate open

October 11, 2026. Partial local checkpoint, D13A.5 in_progress. Local/uncommitted;
feature/shared-dictionary-schema, HEAD f97a733407a4d2b37e8f9ca030ad9574de85a794.
Next recommended model: **GPT-6 Astra / High** for performance profiling and
architecture review under AUTH-16. No picker switch is claimed.

The original checklist remains **7/8**; only item8 is open. Item8 has two existing
acceptance areas: recovery/account-return complete locally, representative review
performance/parity open. Item7 remains4/4 areas and its area4 remains2/2 checkpoints.
Ten broader milestones remain: D13.6, D13A.5-9 and D14.1-4. These are not counts of
implementation actions or sessions. No additional original checklist items were added.

## Changes and preserved boundaries

The following review page sends an indexed table of exact dictionary descriptors,
then restores independent metadata per personal word before controllers read it.
Personal IDs, placement, lexical content, SRS/events, decimal counters, distinct
revision/adoption/private/CEFR descriptors and active question boundaries remain.
Snapshot1/2 bypass indexing. At5000 all-due, decoded cold page bytes fell from the
earlier pre-index diagnostic about5.59MB to3.98MB (about28.8%); reduced bytes do not
establish acceptable latency. This comparison concerns payload size only.

A reproduced initial-settings race overwrote the first deliberate mode selection.
Setup and manual controls now remain disabled until owner preferences are applied
once. Regression tests cover initial disabled controls and the retained first choice.
The browser probe waits for actual enabled controls, clicks each transition once,
and includes readiness in its timing. No fixed sleep, private hydration hook, timeout
increase, application timing instrumentation or gate weakening was added.

Synthetic protocol3 fixtures prepare hashes/payloads before measured requests and
use four personal references per meaning, with exact large decimal counter strings.
Baseline and following use identical lexical/SRS/event inputs and the same current
application source; baseline is snapshot1, not a historical build or pinned protocol2.
The runner isolates source/env/auth, allows fixture origins/read RPCs only and cleans
up its own contexts, servers and private directory. No learning assessment is sent.

## Recovery qualification

Five checks pass in each actual light/dark theme (10 total): shipped snapshot Retry;
loaded question/reveal survives offline while detail retry reads a later shared head;
collection/detail freshness with next-session-only head adoption; same-context A-B-A
owner return restores settings and drops another owner's session; isolated read-only
request allowlist. This proves synthetic browser behavior, not production identity,
database RLS or device behavior. Cold offline navigation still requires connectivity
and explicit retry; no full cold-offline support is claimed.

## Representative browser result

Two final matrices on unchanged source: desktop1x160 and CPU4x160 valid samples,
four datasets, cold/client navigation, ten alternating pairs per case. Two warmups
per matrix apply only to the first500-word cold case and are excluded. Browser
149.0.7827.55, Node24.20.0, darwin-arm64 Apple M1 Pro, synthetic upstream40ms.
Fresh browser contexts; server process warm after build/start; HTTP cache disabled,
router cache retained; unrelated and Review prefetch blocked for these cases.
Following start asserts one snapshot3 read, zero effective-card reads, selected
queue count and reviewed A1 metadata. All320 functional samples pass.

Observed p95 below is the maximum of10 samples, **not a reliable production p95**.
The material regression keeps the performance area open. A10% investigation
threshold is used for this local comparison; it is not a production SLA. Smaller
Start-to-card timings do not cancel cold navigation/setup regression. Request/resource
timings alone cannot attribute cost to SSR/RSC, compression, mapping or hydration.

| CPU | Words/events/selected/navigation | Navigation median baseline/following (ms) | Observed p95 baseline/following (ms) | Median change | Start median baseline/following (ms) |
| --- | -------------------------------- | ----------------------------------------- | ------------------------------------ | ------------- | ------------------------------------ |
| 1x  | 500/0/500/cold                   | 574.8 / 576.5                             | 601.0 / 853.4                        | +0.3%         | 23.3 / 21.8                          |
| 1x  | 500/0/500/client                 | 438.7 / 427.0                             | 453.0 / 453.2                        | -2.7%         | 23.7 / 22.3                          |
| 1x  | 2500/501/2500/cold               | 625.2 / 623.0                             | 800.6 / 800.1                        | -0.4%         | 59.1 / 57.9                          |
| 1x  | 2500/501/2500/client             | 473.4 / 474.4                             | 492.3 / 774.9                        | +0.2%         | 61.7 / 61.8                          |
| 1x  | 5000/5000/5000/cold              | 704.4 / 899.6                             | 956.0 / 1462.4                       | +27.7%        | 102.4 / 101.4                        |
| 1x  | 5000/5000/5000/client            | 511.3 / 523.1                             | 536.1 / 724.1                        | +2.3%         | 106.2 / 103.6                        |
| 1x  | 5000/5000/20/cold                | 557.1 / 566.0                             | 620.0 / 895.1                        | +1.6%         | 17.5 / 16.3                          |
| 1x  | 5000/5000/20/client              | 424.5 / 427.2                             | 442.2 / 540.1                        | +0.6%         | 19.4 / 18.5                          |
| 4x  | 500/0/500/cold                   | 799.3 / 805.2                             | 839.9 / 843.7                        | +0.7%         | 93.4 / 93.9                          |
| 4x  | 500/0/500/client                 | 551.5 / 543.2                             | 612.8 / 576.1                        | -1.5%         | 89.6 / 86.2                          |
| 4x  | 2500/501/2500/cold               | 1087.4 / 1104.2                           | 1303.2 / 1212.1                      | +1.5%         | 301.0 / 297.0                        |
| 4x  | 2500/501/2500/client             | 795.6 / 844.2                             | 900.0 / 1167.2                       | +6.1%         | 297.3 / 311.2                        |
| 4x  | 5000/5000/5000/cold              | 1497.3 / 1654.7                           | 1825.9 / 1788.1                      | +10.5%        | 542.8 / 545.1                        |
| 4x  | 5000/5000/5000/client            | 1038.5 / 1133.8                           | 1254.8 / 1302.6                      | +9.2%         | 552.3 / 563.4                        |
| 4x  | 5000/5000/20/cold                | 1005.9 / 1169.1                           | 1402.8 / 1507.9                      | +16.2%        | 86.4 / 84.7                          |
| 4x  | 5000/5000/20/client              | 576.3 / 733.0                             | 643.6 / 813.1                        | +27.2%        | 86.9 / 87.4                          |

## Validation and integrity

Fresh final checks: web119 suites/1249 tests with the unchanged existing opt-in Node
benchmark and5000ms timeout, focused4/40, web types, scoped zero-warning web/harness
lint and backend/probe7. Scoped formatting and diff checks are recorded in the machine
report. Native196/2670/22, Edge108 and PG547/worker35 are **carried, not rerun**;
their prior declared runtime/source boundaries and historical artifacts remain exact.

Final13 changed/new source paths and449 browser build/app inputs are unchanged from
their final freezes. Source evidence union370, task web boundary142 (previous136
plus six newly audited web paths). The generic review page/workspace were outside
the old task boundary; this report does not retroactively claim prior coverage.
All484 prior direct SHA references matched at entry;479 remain exact after the five
intentional task-note changes. The prior evidence MD/JSON, source357,37 mirrors,
47 artifacts and previous report files remain immutable. New artifacts/logs and exact
notes/source hashes are enumerated in the companion JSON.

Earlier browser runs are diagnostic only: fixture/isolation/selector repairs,
request-time hashing, repeated-click probe, pre-index/indexed old probe, and the
partial one-click run exposing the preference race. Earlier full web119/1248 is
superseded by119/1249. Probe regression against the former implementation fails as
expected. These failures are preserved and do not count as acceptance.

## Next checkpoint and permissions

Continue item8 performance area with GPT-6 Astra / High: reproduce the5000 all-due
cold case, capture actual server and browser CPU/network profiles, separate request,
SSR/RSC encoding/compression, stream completion and hydration work before choosing a
fix. Keep paired fixture inputs, enabled-control probe, owner/session/learning fences
and readiness timing unchanged. Qualify a demonstrated fix on the same representative
desktop/CPU4 boundaries and rerun affected recovery checks. Do not infer a bottleneck
or close D13A.5 from byte savings, unit tests, favorable medians or functional parity.

All owned runners have exited; no pending operation. Flags remain OFF outside isolated
QA, shared_analysis FALSE/CEFR OFF; AUTH27-29 consumed. No provider/paid/hosted migration,
Git publication, EAS/device/release or automation action. No permission is broadened.
See [machine report](D13A-web-acceptance-20261011.json) for exact results and hashes.
