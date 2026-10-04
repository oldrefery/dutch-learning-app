# D11.2 offline diagnostic closure — 2026-10-04

## Authorized interpretation

The owner chose the narrower D11.2 outcome on October 4: complete a
local, assistant-reviewed diagnostic and retain `qualified: false`.
This changes the checkpoint's completion criterion, not the production
quality or spending gates. No independent human or published
meaning-level CEFR gold is claimed. No additional provider request or
new-input transmission is authorized by this decision.

## Frozen inputs and retrospective measurement

The existing [24-item worklist](D11-pilot-review-worklist.json) is the
provisional diagnostic input fixture. Its raw SHA-256 is
`9f9871355c205684b0ad2583ea8ed813fe80cd334e00dc17558fc99ad4da9310`.
The [assistant reference](D11-pilot-provisional-reference.json), frozen
before the v3 run, has raw SHA-256
`a2e9a25d5abf07882b482e201367de5d172a8eedc893b66f8e20c1a2920adc58`.
It contains 19 inferred bands and five `unknown` cases. Twelve items
have a lexical source reference and twelve do not. None of its bands
is a source-adjudicated CEFR label, and every item says
`calibration_eligible: false`. The separate 27-input candidate pool and
its [graded-context ledger](D11-graded-context-ledger-20261004.json)
remain unreviewed, unscored and provider-unapproved; material exposure
must not be transferred to the different 24-input hashes.

The already completed, owner-only [v3 pilot report](D11-gemini-v3-live-result-20261004.md)
has private file SHA-256
`9556d31bd804f5642723a78add9c9e7fa50d7bd4d4d309b4bf80a76ce1d12785`.
A read-only local check on this date verified 24 unique worklist and
reference ID/hash pairs, recomputed each canonical-input SHA-256,
matched the report's worklist and reference file hashes, and matched
its method/prompt digests to
[the v3 proposal summary](D11-pilot-proposal-summary-v3.json). The
profile digest is a normalized method digest, not the raw profile
file's SHA-256. The report is explicitly `qualified: false`,
`calibration_eligible: false`, with provider provenance and no missing
or invalid responses.

| Diagnostic observation                     |           Existing v3 result | Interpretation                                        |
| ------------------------------------------ | ---------------------------: | ----------------------------------------------------- |
| Known responses                            |                        21/24 | Response coverage, not correctness                    |
| Assistant-reference exact agreement        |             19/19 comparable | Consistency with assistant guesses, not CEFR accuracy |
| Intentional ambiguity/conflict abstentions |                          2/2 | Prompt behavior on two probes only                    |
| Reference `unknown`                        |                         5/24 | No positive target for these cases                    |
| Split sizes                                | 12 calibration / 12 held out | Four required slice/split cells are empty             |

The four empty cells are calibration `separable-verbs` and
`conflicting-examples`, and held-out `inflections` and `ambiguous`.
The same 24 meanings were used in v2 and v3; v3's prompt was revised
after v2. Thus its held-out name does not imply an untouched external
validation set. The observed generation charge and unknown control
charges remain as recorded in the v3 result; no new charge was incurred.

## Diagnostic-only policy

The policy for this closure is descriptive and fail-closed. Report
coverage, abstentions and agreement with their denominators; preserve
`unknown` and empty cells as unknown; never choose a confidence cutoff
or acceptance threshold from this run. A preliminary source-level
observation cannot become a word-sense label. No percentage here
qualifies a method, approves a server registry or permits a user-visible
estimated CEFR level. This interpretation was written after the v3
run and is **not** a prospective production acceptance policy.

The offline calibration suite was rerun with cached dependencies and
no network permission:
`deno test --cached-only --config supabase/functions/deno.json supabase/functions/_shared/cefr-calibration/`.
All 50 tests passed, including rejection of guessed reviewed labels,
small denominators and unqualified known outputs. No production code
was changed in this closure.

## Boundary after D11.2

The revised **offline diagnostic checkpoint is done**. The original
independent-reviewed quality gate remains unmet as a separate D11
stage-exit and worker-activation prerequisite. D11.3–D11.7 may proceed
locally under their own safety gates, but the schedule, worker and
public CEFR estimates stay disabled. A future real quality study needs
an independent meaning-level reference, adequate split/slice sizes,
a prospectively reviewed policy, separately authorized new provider
inputs and a bound server-only approval before any qualification.
