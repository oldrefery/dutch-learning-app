# NPR-2 native allocation repair and frozen measurement packet

Status: full NPR-2 physical matrix completed; residual regression remains; D13A.7.6 is not complete. Main application
and account are excluded. All backend data is synthetic on the dedicated local stack.

## Root cause and repair

Whole-store subscriptions made the collection list and cards rerender on unrelated
review-session changes. The collection hook also rebuilt sorted data on every render.
The inline header function changed component identity, remounting the search input.
The default FlatList window rendered many offscreen rows during review preparation.

The retained candidate narrows three Zustand subscriptions, memoizes sorted collection
words by source array/collection ID, preserves header component identity, and limits the
list render window to five viewports. It retains all5000 words and variable row heights.
Time-sensitive review statistics remain recomputed; no due-date cache was introduced.

Diagnostic following5000 cold/warm row renders fell436/1288 to45/150. Allocated bytes
reported by diagnostic counters fell approximately632/1089MB to393/481MB. These are
allocation totals, not retained heap size or a proven leak. Diagnostic timings include
counter overhead and cannot substitute for the final five-marker matrix.

Additional candidate changes transfer400 cached SQLite rows as one JSON value, retain
strict per-row card/revision validation, compare canonical decimal sequences without
BigInt conversion, precompute fixed parser field sets/paths, and avoid two redundant
full Word copies. Owner joins, transaction boundaries, missing dependency failures,
canonical validation, independent nested projections and snapshot semantics remain.
No settled request cache, global revision cache, validation bypass or queue truncation.
A repeated bounded per-watermark batch-parser experiment did not help and was reverted.

## Validation before the matrix

- 319 tests/14 suites cover initialization/auth, store words, sync, imports, repository,
  materialization, following sessions, contracts and both UI themes.
- 51 additional tests/2 suites cover following runtime and conflict-display consumers.
- Mobile TypeScript and scoped mobile lint pass. Domain files are ignored by the root
  ESLint configuration; domain formatting/types/contracts were checked instead. The
  initial ignored-file warnings remain in the evidence, not represented as a lint pass.
- Physical scroll/search test: actual XCTest exit0,1 passed,0 failed/skipped. Scrolled
  rows40–51 are visible without blanks; searching woord-04999 finds1of5000. Screenshots
  were inspected. No assessments were submitted.

## Frozen package and measurement

Artifact: native-performance/npr2-allocation-app/DeWoordenaar.app.
JS SHA256:35a4b484bde473e8967ab5408b578e76b7e15d0ac1b420f7f16bcbed3380f3e1.
16 signature/isolation/source checks pass.679 root/QA source files are hash-pinned;
only the declared five timing paths differ. Heap/row diagnostics are absent.
Product delta:15 files in npr2-frozen-product-changes.json and npr2-frozen-product.patch.
These files are compared to the pre-NPR-2 snapshots, not to the much older Git HEAD.

The same installed release package measures personal and following snapshots on the
same physical iPhone16 Pro. Four cases:500/0/500,2500/501/2500,5000/5000/5000 and
5000/5000/20 words/events/selected. Each case has two excluded warmup pairs and ten
alternating measured pairs; each pair includes cold and warm observations for both
variants. Source/app/DB/relay remain frozen while tests run. The runner stops on failure
without automatic retry and retains every receipt. Actual XCTest and copied SQLite
assert counts, lexical/SRS/event equality, following metadata, fresh warm load and no
new assessments/content commands. Thermal pressure/Low Power Mode invalidate a test.

Report load and review segments separately and their sum. The sum excludes navigation
and host polling gaps; onLayout is not a pixel-presentation timestamp. Screenshots
confirm the actual first question. With ten observations, observed p95 is the maximum,
not an estimated population percentile. The existing10% investigation threshold is
not a blanket SLA and does not justify ignoring a material regression.

Full results are in npr2-matrix-summary.json:5000 full cold/warm1888/2439ms versus
1467/1606ms baseline;5000/20 is995/1503ms versus457/584ms. A bounded streaming
projection experiment is now under evaluation. Final acceptance remains open. Do not substitute a
single diagnostic pair for matrix acceptance or describe old functional archives as
the current fixed package. Rebuild plain functional QA and restore its fixture before
ending device work. Exact archived-client compatibility is a separate remaining check.

Evidence root: reports/shared-dictionary-cefr/d13a7-native-resume-20261023.
