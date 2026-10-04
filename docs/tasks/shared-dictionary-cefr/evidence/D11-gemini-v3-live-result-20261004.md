# D11 personal Gemini v3 pilot — result, 2026-10-04

The distinct `oldrefery@gmail.com` v3 registry was executed exactly once
after its successful zero-network preflight. The command exited 0 and
reserved 49 requests: one model metadata read, 24 exact-body token counts,
and one generation for each of the unchanged 24 meanings. This consumed
attempt 3 of the user's at-most-five further attempts; two remain. No
completed registry was replayed. The temporary personal key and local
transfer/preparation scripts were removed immediately after completion.

The owner-only private root is `/private/tmp/d11-gemini-v3-7zEmDZ`; run ID
`927f5b4e-0a96-49eb-9eea-564b2b4186be`. Its bundle binding is
`1248911a0b948e2c84ac1344731f2c7fd898a5ceaad9fd78be3f074199d5ae35`.

| Artifact                     | SHA-256                                                            |
| ---------------------------- | ------------------------------------------------------------------ |
| External `consumed.json`     | `4e7a81d14adfd512ee0fe53422bc0b8e880bce0169f7bf9b4ffae27a6c34ef40` |
| SQLite journal               | `614dbf0d90c14ef73d696c2c5a45f07ca9dd2b3eb3890831d6854af3c3fce120` |
| Private report file          | `9556d31bd804f5642723a78add9c9e7fa50d7bd4d4d309b4bf80a76ce1d12785` |
| Report-body canonical digest | `fe13739be3e434449b0c908e32a3e7c42b0dcdf6c09809bde61648fa7179fe77` |

The journal has 1/1 model metadata and 24/24 token-count receipts, with
zero control failures or unknown outcomes. All 24 meanings have one attempt
and one verified capture, with 24 distinct response IDs and the resolved
model version `gemini-3.5-flash`. There were no retries, timeouts, invalid
captures, or missing items.

The report records 95,473.5 micro-USD ($0.0954735) in observed generation
usage at the bound published Standard rates. The 24-generation reservation
was $0.956736. The 25 control requests have no verified charge or maximum.
Across the two completed full pilots, observed generation usage totals
$0.183747, excluding controls and the metadata-only probe; it is not a
provider bill or a hard total-cost bound. The user's combined $10 figure
remains an estimate.

The v3 report shows 19/19 exact and within-one agreement against the same
assistant-inferred provisional bands as v2. Its two intentional ambiguity
and conflict probes (`pilot-23`, `pilot-24`) both abstained, compared with
0/2 in v2. A specialized item (`pilot-19`) also abstained. Coverage is
21/24 overall, 10/12 on the calibration split and 11/12 held out. There are
no independent reviewed gold labels; provisional agreement is not
accuracy, and two successful probes do not establish production quality.
The report remains `qualified: false` and `calibration_eligible: false`.

The v3 prompt change addressed the observed abstention failure without
changing the input set or provisional reference. A fourth paid attempt on
the same fixture would add little independent evidence. Next D11 work should
focus on an independently sourced/reviewed CEFR reference and the disabled
worker's local safety gates. D11 remains in_progress, D12 pending, and the
worker/schedule disabled. No support message, push, PR, or deployment.
