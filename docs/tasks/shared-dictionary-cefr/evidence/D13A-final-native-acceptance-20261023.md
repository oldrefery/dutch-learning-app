# D13A.7 final native acceptance — October 23, 2026

Status: **complete for the local qualification scope**. D13A.7.6 is accepted and all
six fixed D13A.7 checkpoints are complete. Work stops at the owner's requested boundary;
D13A.8 has not started. Seven broad milestones remain: D13.6, D13A.8, D13A.9 and D14.1–4.
This closes the remaining device/performance checkpoint; it does not repeat or broaden
the already accepted semantic/provider pilots or authorize any production operation.

## Retained fixes and review

IOR-1 preserves pending legacy content through the correct owner-scoped SQLite guard.
NPR-1 deduplicates only unfinished same-owner initialization and removes the second
refresh load; owner changes invalidate the in-flight operation and no settled cache is
introduced. NPR-2 narrows store subscriptions, memoizes sorted collection data, preserves
search-header identity and limits the virtualized render window without dropping words.
Bounded SQLite JSON transport and equivalent strict parser work reduce transfer/allocation.
NPR-3 projects validated display words inside the existing 400-row cache transaction,
releasing raw revisions between chunks instead of holding another complete cache graph.

Owner joins, deleted-word filters, strict revision/card/identity validation, pending and
required conflict rules, following-flag withdrawal, independent nested content and SRS
fields remain intact. The original raw materialization API remains available; duplicate
inputs preserve their individual learning fields. Corruption rejects before partial store
publication. No persistent validation bypass, queue deletion or per-card network fetch.
See native-performance/npr3-source-review.md and the frozen product/source manifests.
This is the primary agent's review; no independent reviewer or subagent is claimed.

## Complete physical iPhone matrix

One signed timing package, one physical iPhone 16 Pro, equivalent lexical/SRS/history
fixtures. Four sizes/selections, two excluded warmup pairs and ten alternating measured
pairs each: **48 pairs, 96 successful XCTest runs, 160 measured observations plus 32
excluded warmup observations**. All 680 root/QA sources, five instrumentation paths and
113 archived package files were verified before editing. No measurement was discarded
or repeated. After pair7 of the last case, CoreDevice failed to export the completed
SQLite measurement. The same stored samples were copied read-only; the original failed
receipt, log and progress remain preserved. Only the two unrun pairs were then executed.

Values below are personal baseline / following medians. The sum combines load and review
segments, excluding navigation/host gaps. Native onLayout is not a pixel-presentation
measurement. Observed p95 in the JSON is the maximum of ten observations, not population p95.

| Words / selected | Lifecycle | Load, ms  | Review, ms  | Sum, ms     |
| ---------------- | --------- | --------- | ----------- | ----------- |
| 500 / 500        | cold      | 104 / 129 | 192 / 198   | 300 / 327   |
| 500 / 500        | warm      | 156 / 176 | 202 / 201   | 358 / 386   |
| 2500 / 2500      | cold      | 183 / 309 | 616 / 632   | 798 / 939   |
| 2500 / 2500      | warm      | 252 / 413 | 597 / 613   | 844 / 1024  |
| 5000 / 5000      | cold      | 287 / 576 | 1190 / 1223 | 1478 / 1798 |
| 5000 / 5000      | warm      | 372 / 653 | 1198 / 1221 | 1571 / 1876 |
| 5000 / 20        | cold      | 291 / 574 | 167 / 170   | 458 / 743   |
| 5000 / 20        | warm      | 346 / 830 | 216 / 188   | 559 / 1023  |

Full 5000-word warm sum improved from the previous complete NPR-2 matrix's 2439 ms to
1876 ms (23.1%); the 5000/20 warm sum improved from 1503 ms to 1023 ms (32.0%). The 2500
warm sum is 3.7% slower than NPR-2; this cell is retained, not hidden by the larger gains.
Earlier one-off allocation diagnostics are not presented as comparable matrix medians.

### Performance decision and limits

The sustained review-preparation regression is resolved: the largest median increase
against the same-package personal baseline is 3.3%. Seven of eight observed review
maxima increase by less than 10%. The remaining 5000/20 warm maximum is **308 ms versus
245 ms (+25.7%)**. Nine following observations are at most 200 ms and the median is
188 ms versus 216 ms. The outlier had nominal thermal state and Low Power Mode disabled;
its precise cause is unassigned. It is included in every summary and was not remeasured.

Combined load+review is **not within a universal 10% bound**. Following adds approximately
125–161 ms of load at 2500 words and 280–484 ms at 5000 words. Short-selection warm total
is 1023 ms versus 559 ms (+83%). The additional owner-scoped cache reads, JSON decoding,
strict dependency/identity validation and display projection remain real work. It is
reported separately instead of being hidden behind review-only numbers. The earlier
repeatable multi-second stall no longer reproduces; the slowest following full-5000 sum
is 1917 ms and the short-selection maximum is 1166 ms.

The existing 10% rule triggers investigation, not an absolute SLA. Local qualification
is accepted after that investigation based on stable review preparation, bounded measured
cache cost, preserved data and removal of the observed stall. This does not claim equal
total startup performance, a production latency SLA or Android timing/FPS qualification.
All cells and the decision are in npr3-performance-acceptance-review.json.

## Devices, compatibility and preservation

- Physical Android: same-signer QA upgrade, 5000-word list, twelve scrolls with consecutive
  nonempty settled viewports, last-word search, return to the original synthetic owner and
  offline process restart pass. Seven server events remain exactly unchanged. QA process
  and its USB route were stopped. No Android FPS claim. See
  [Android list regression](D13A-android-list-regression-20261023.md) and the earlier
  [two-owner/offline delivery test](D13A-physical-android-20261023.md).
- Archived build85 and AUTH28/AUTH29 repair clients: six physical online/offline tests
  pass. The ten native binaries' instruction/data sections and archived parser/SQLite
  instructions are preserved; only the declared backend literal/checksum and QA packaging
  differ. These isolated derivatives qualify parser/native SQLite compatibility, **not
  original store signatures or native OTA activation**. See
  [archived native compatibility](D13A-archived-native-compatibility-20261023.md).
- Final normal iPhone QA: all 16 artifact/isolation/signature checks pass, 680 sources
  match, instrumentation is absent. JS SHA256 is
  c48a0b6e3439e91630bebc37b80fb49b2a60ad21e358743aae471f7df1770773.
  Installed only com.oldrefery.dutch-learning-app.d13aqa. Final offline XCTest exits0,
  1 passed/0 failed/0 skipped; both screenshots were inspected and show the synthetic
  primary collections and current shared translation.
- The restored iPhone SQLite database is byte-identical to the saved functional backup:
  SHA256 813fad91bf7e897c707fa3047e2b355209d887e8bce928343046d00a1ced3606.
  All26 words (24 active),7 collections,7 review events and both synthetic owners are
  preserved; zero content commands or benchmark tables. All7 server events match exactly.
  The third Android-only synthetic 5000-word fixture remains locally for reproduction.

## Validation, final state and boundary

426 tests in18 relevant suites passed before the frozen matrix, with production TypeScript,
scoped lint and changed-file formatting. After the matrix, two test-only typing repairs
were applied: a renderHook prop annotation and a validated read-content fixture. The
10 affected tests, full mobile test TypeScript, scoped lint and formatting pass. Source
hash comparison proves that only those two test files differ from measured root sources;
no runtime code changed after measurement. Scoped git diff --check passes.

QA applications are stopped. The confirmed project proxy and four exclusive QA containers
were gracefully stopped; both QA proxy ports are closed. Containers, volumes, databases,
artifacts and logs are retained. Docker itself and other projects/services were untouched.
The main iPhone application and main account were not operated. No new paid call, hosted
mutation, EAS action, publication, migration, commit or push occurred in this completion.
Existing paid approvals remain consumed; historical unknown budget liabilities are unchanged.

Branch feature/shared-dictionary-schema, HEAD f97a733407a4d2b37e8f9ca030ad9574de85a794;
610 dirty status entries remain local and preserved. Do not resume from a fresh checkout
without transferring the task work/evidence. The JSON companion pins current sources and
all final receipts. Prior checkpoint notes remain historical; this decision supersedes
their open NPR-1/NPR-2 performance and exact-parser/native compatibility status.

**D13A.7: 6/6 complete, 0 steps remain. Seven broad milestones remain. Stop here.**
