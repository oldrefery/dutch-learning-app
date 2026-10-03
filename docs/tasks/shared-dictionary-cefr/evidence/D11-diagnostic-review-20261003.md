# D11 diagnostic collector review and repairs

2026-10-03, starting `6342502`, branch `feature/shared-dictionary-schema`.
Required review recommendation GPT-6 Astra / High announced; actual picker/model
attribution remains unverified. AUTH-20 local review/fixes and AUTH-18 ordinary
local commits apply. No subagent, external reviewer or teacher dependency.
Baseline source inventory: 200/200 exact before edits.

## Reproduced findings

Five P2 findings were repaired in the fake collector before any live adapter:

1. Caller-owned run options remained mutable across asynchronous preflight. A
   caller could replace the validated bundle or transport function and collect
   evidence under a different binding. Capture option references and callable
   identities before the first await; keep the prepared bundle deeply frozen.
2. The UTC budget day was checked only at startup. A running batch could cross
   midnight and keep dispatching. Recheck before preflight, reservation and
   dispatch. An already received result is captured before stopping; a reservation
   made just before midnight stays charged even when dispatch is suppressed.
3. Malformed/incomplete/over-sized answer JSON discarded verified usage and
   response/model identities. This understated observed usage and let a later
   resolved version escape the mixed-version guard. Parse the candidate separately
   from the receipt; retain verified metadata for invalid candidates within the
   bounded envelope. Unverified/over-sized envelopes remain conservatively unknown.
4. A permanent HTTP rejection stopped one meaning only; later meanings and later
   resumes continued. Persist the failed capture, stop the whole run and reject
   subsequent resumes from that run before any preflight/generation.
5. The loader claimed 12/12 splits and all eleven pooled slices but checked only
   that both split names existed. Enforce the documented exact coverage, including
   when an altered worklist has internally recomputed bindings.

Also close SQLite immediately when initialization or resume binding fails. The
operational worker, approved-fixture qualifier and production defaults are unchanged.

## Evidence

Eight regression cases failed on the original collector. After repairs, all ten
new regression cases plus the existing twelve tests pass: **22/22 PASS**. Additional
cases cover midnight after reservation and rejection on a later resume. The tests
check actual SQLite attempt/capture counts and provider-call counts; no paid call
or real provider credential is involved.

Commands used with Node 24.20.0:

```sh
node --test scripts/cefr-calibration/diagnostic.test.ts scripts/cefr-calibration/diagnostic-review.test.ts
```

Scoped TypeScript check (`ES2022`, ES modules, bundler resolution, Node types),
strict ESLint with zero warnings, Prettier and diff checks pass. Private sanitized
logs are under `reports/shared-dictionary-cefr/d11-diagnostic-review-20261003/`.
The first test-file draft had a missing closing brace; it was repaired before the
eight behavioral failures were measured. Existing Node module-type warning remains
non-failing. Source bindings are in the [202-path inventory](D11-diagnostic-review-source-sha256.json).
The previous implementation note overstated unchanged prior paths: its README was
modified, so 191 of the prior 192 paths were retained at that checkpoint.

## Review outcome and next action

Local fake collector review passes after the reproduced repairs. Its report still
measures unqualified agreement with model-origin bands, not independent CEFR
accuracy. Real adapter/control-request accounting, current provider/account/source
and spending approval, independent quality and live acceptance remain open.

**Next GPT-6.1 Sol / High**: prepare and test the real provider adapter locally,
including token-count/control-request limits, verified response/usage metadata,
price/model binding and a concrete source/account/$2 proposal. Finish that local
preparation before requesting live authorization. Do not ask for a teacher. D11
remains in_progress; D12 not started. No network/provider call, hosted migration,
device/backend action, activation, deployment, publication or push/PR/merge.
