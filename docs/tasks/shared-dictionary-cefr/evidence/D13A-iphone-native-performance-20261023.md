# D13A.7.6 native iPhone performance investigation (NPR-1)

Status: open. Physical iPhone16 Pro/iPhone17,1 iOS27.0.1, isolated QA bundle only.
The separate fixed functional package/database is archived for restoration. Main app
and main account were never operated. QA network relay stays stopped throughout seeds.

## Method and validated pilot

Same release package for baseline personal snapshots and candidate following-cache
snapshots, equivalent lexical/SRS/events, synthetic owner only. Actual SQLite fetchWords
through store hydration and shipped review control through first native onLayout.
Load+review is the sum of these two measured segments, NOT elapsed icon-to-question time.
The native layout callback is not a pixel-presentation timestamp. UI screenshots confirm
actual question. Independent copied-SQLite checks enforce matching content hashes, word/
selection counts, following metadata, fresh warm fetch, no assessments or pending commands.

500/0/500 pilot passes both cold/warm variants. Large5000/5000/5000 preflight passes
functional parity in both orders but exposes material slowdown (NPR-1):

| Order                   | Variant   | Cold load/review/total ms | Warm load/review/total ms |
| ----------------------- | --------- | ------------------------- | ------------------------- |
| baseline then candidate | baseline  | 690.6/1586.3/2276.9       | 1244.2/2732.0/3976.2      |
| baseline then candidate | candidate | 2134.1/2336.1/4470.1      | 3177.3/5648.5/8825.8      |
| candidate then baseline | candidate | See retained receipt      | total8825.5               |
| candidate then baseline | baseline  | total2412.4               | total4493.8               |

These are warmup/pilot observations, not accepted10-pair medians or p95 estimates.
Do not run a full acceptance matrix until the reproducible delay is investigated.
Diagnostic-only clone phase markers now cover SQLite chunks/parser, word materialization,
review history/store, question snapshot/options/yields, and controller construction.
Profile timings may overlap/nest and must not be summed as exclusive wall time.

## Retained rejected attempts

- Initial replacement directory copy removed the QA login. Synthetic session restored
  through auth-only relay. All later copies merge ONLY stopped QA SQLite files, with
  remove-existing-content=false and empty WAL/SHM; main app unaffected.
- Initial warm swipe did not reload words: independent loadId check rejected the sample.
- Initial synthetic UUID prefix had seven digits: actual domain parser rejected it.
  Generator repaired; real repository/domain validation now precedes device copying.
- Pilot-v2 package and manifests retained before adding diagnostic instrumentation.

Evidence root: reports/shared-dictionary-cefr/d13a7-native-resume-20261023/native-performance.
No production source performance change yet.135 prior IOR-1 regressions remain carried.
Fixed D13A.7 status5/6 complete,1 remains;8 broad milestones remain. Exact original85/
repairOTA runtime also remains unverified. Stop beforeD13A.8; no paid or remote mutation.

## NPR-1 first bounded repair

Physical diagnostics show three simultaneous initial word loads and two warm refresh
loads. Auth restoration/entry route all call initializeApp for the same owner; the
collection root refresh invokes fetchWords directly and indirectly through refreshCount.
This duplicates full dictionary materialization and temporary allocations. Phase durations
vary strongly, so no exclusive CPU or GC attribution is claimed. Refined diagnostics
show full-vocabulary copying itself takes only11–14ms in candidate; earlier combined
capture timings must not be attributed to that copy alone. No snapshot semantics changed.

Local repair shares only unfinished local word/collection initialization for the same
owner. Permission requests retain their independent lifetime. Logout/owner transitions
invalidate the shared request; a settled request never becomes a data cache. Root refresh
loads words once and collections once. No global revision cache or validation bypass.

Three new concurrency assertions failed before repair (23 existing tests passed).
After repair62 tests pass across initialization, auth-provider and count-hook suites;
TypeScript and scoped zero-warning lint pass. Modified product files:
apps/mobile/src/stores/actions/appInitializationActions.ts,
apps/mobile/src/app/(tabs)/index.tsx, plus initialization regression tests.
The first135 IOR-1 regressions are carried separately. Physical performance recheck pending.
Diagnostic instrumentation restored to original five-path unprofiled timing package;
new release build in progress. Neither NPR-1 nor D13A.7.6 is closed yet.

## Repaired package and interrupted device attempt

Combined regression verification passes244 tests in seven suites. Normal QA source is
restored and a separate non-instrumented package is ready for eventual functional restore;
it is not installed. The archived NPR-1 timing package remains installed. The first physical
recheck waited on DeviceLocked and was explicitly cancelled without observations (exit73,
incomplete xcresult retained). After owner unlock, unique npr1r2-5000-full pair is running.
Both variants must pass actual XCTest exit status, independent SQLite parity, and the new
read-only thermal/low-power checks before results are used.

## Physical duplicate repair and remaining parser work

Opposite-order paired rechecks npr1r2/npr1r3 validate one cold and one warm load per
variant, full fixture parity and zero assessment writes. Twelve environment captures
show thermalState0 and lowPowerModefalse. Warm total remains25–33% slower.
Load-only profile npr1-load-profile attributes candidate warm parse870ms and projection/
store305ms; these nested measurements are diagnostic, not exclusive CPU/GC attribution.

Exact decimal sequence comparison now uses validated canonical strings ordered by length
and ASCII digits. Tests compare thousands of boundary/deterministic values against an
independent BigInt oracle and reject overflow/noncanonical text. Physical benefit remains
unproven. The first comparison attempt reached the preserved-session connection error
before collection load; auth-only refresh passed and a fresh pair is running. Failed
attempt retained under npr1-sequence-profile; it contributes no timing sample.

## Allocation repair under physical recheck

Sequence comparison experiment produced no demonstrated benefit and was reverted exactly
in root and QA source; retain npr1-sequence-experiment-decision.json. No parser batching or
validation bypass was introduced. Following display projection now incorporates its six
metadata fields during its existing construction, and fetchWords avoids a full Word copy
when no import flag exists. Validation/deep-copy semantics remain.82 targeted tests, mobile
types and scoped lint pass. Installed diagnostic JS47be485a…; paired recheck running.

## CPU diagnosis and reverted follow-up experiments

Sequence comparison, reduced Word copying and batched cache parsing were measured on
physical iPhone in separately archived QA packages. None demonstrated sufficient total
latency benefit; all three product/test source changes were restored byte-for-byte.
See native-performance/npr1-followup-experiments-decision.json and per-experiment receipts.
Only IOR-1 and the NPR-1 duplicate-load repair remain from those investigations.

Time Profiler now captures only the verified QA PID. A first recording ended before the
UI workload and is explicitly excluded. The synchronized candidate and baseline traces
cover all three phase captures, including the warm question. Independent SQLite checks
pass, with identical lexical/SRS/event hashes, 5000 words/events/selected and no assessments.

| CPU sample scope                      | Baseline | Candidate |
| ------------------------------------- | -------: | --------: |
| Whole recording JavaScript sampled ms |     6862 |      7674 |
| OldGen search leaf sampled ms         |     1025 |      1506 |
| Warm UI window JavaScript sampled ms  |     4457 |      5010 |
| Warm UI window OldGen search leaf ms  |      971 |      1252 |

Source: native-performance/npr1-cpu-comparison.json, resolved stack exports and trace TOCs.
The warm window includes refresh, UI navigation and review. These are statistical CPU
samples from one diagnostic pair, not exclusive parser wall-time or acceptance estimates.
GC work is material in both variants; this does not establish a leak or one sole cause.

A fourth bounded experiment hoists immutable parser field sets and field-path strings.
It preserves every parser invocation, missing/unknown-field validation and independent
nested returned content.72 tests pass in3 suites; domain types and scoped test lint pass.
Initial test invocations were corrected for inherited Jest worker/watch flags; final run
exits0. Signed QA artifact eb3241e11ebc441d86285a04f09053bfe1719b53a347798da614fe84f3bd89ba
passes16 isolation/signature/source checks. The physical pair is running; no improvement
or acceptance is claimed yet. Main application/account untouched; relay55341 stopped.

## Final checkpoint

All six follow-up experiments were reverted, including parser shapes,100-row cache reads
and compact option pooling. See D13A-iphone-qa-checkpoint-20261023.md for exact results,
CPU comparison, final244-test verification, restored normal QA/functional SQLite and
remaining gates. Earlier chronological experiment entries describe superseded states.
