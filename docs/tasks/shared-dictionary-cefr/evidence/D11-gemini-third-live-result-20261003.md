# D11 complete personal Gemini pilot — result, 2026-10-03

The separate `oldrefery@gmail.com` registry was executed exactly once after
the successful zero-network check. Its `--execute` exited 0 with 49 reserved
requests: one model metadata read, 24 exact-body token counts and 24
sequential generations, at most one per frozen meaning. This was attempt 2
of the user's at-most-five further attempts; three remain. Neither of the
two older consumed registries was replayed. The temporary key and transfer
scripts were removed immediately after completion.

The owner-only private root is `/private/tmp/d11-gemini-third-1xWFRl`.
Integrity digests:

| Artifact                     | SHA-256                                                            |
| ---------------------------- | ------------------------------------------------------------------ |
| External `consumed.json`     | `a82545d8d6d7da74c9a5dcbff4e1afa8239e23f1f176a251487c28339f2c4b38` |
| SQLite journal               | `21a979ceb13cc03fe631babb429be7f2ddd07ebccf16cf631fdab3438a06800a` |
| Private report file          | `033886d33c1fcd31df0e0cf43e337e575506b3cdaeaef5f0c1672d68ede62cba` |
| Report-body canonical digest | `ad6060bfc56fed636c487f6e02d92159f156a731d60fd06cc3331aa5e15b9e49` |

The journal has 1/1 metadata and 24/24 token-count receipts, with zero
control failures. All 24 generation captures have distinct response IDs and
the same resolved model version, `gemini-3.5-flash`. There were no timeouts,
retries, invalid captures or missing meanings. Observed generation usage was
88,273.5 micro-USD ($0.0882735) using the bound published Standard token
rates. The 24-generation maximum reservation was $0.956736. The 25 control
requests have no verified charge or maximum; the combined $10 user estimate
is not a hard bound or an observed bill. AI Studio spend data may lag, so no
dashboard amount is attributed to this run.

The diagnostic comparison yielded 19/19 exact and within-one agreement with
the assistant's provisional bands. These bands are not independent CEFR gold
labels, so agreement is not accuracy. All 24 responses supplied a known level;
the two intentional ambiguity/conflict probes (`pilot-23` and `pilot-24`)
both failed to abstain. Confidence was at least 0.8 on every item, including
those probes. The report explicitly remains `qualified: false` and
`calibration_eligible: false`; it cannot activate the worker or set a live
threshold. It does not contain a quality pass/fail decision.

A local parser audit after the run found that the provider `ambiguous`
boolean was only type-checked, not cross-checked with its candidate. The
parser now rejects both contradictory combinations: `ambiguous: true` plus
a level, or `ambiguous: false` plus null level/confidence. A matching known
candidate and an explicit abstention remain valid. This repair is prospective:
the raw provider JSON for the completed run was not retained, so it cannot
establish what flag the model returned on either probe or change the
immutable report. Node 24 diagnostic tests passed 108/108; scoped strict
TypeScript, zero-warning ESLint and Prettier passed.

D11 remains in_progress and D12 pending. The next useful experiment is a
versioned abstention prompt with unchanged 24 frozen meanings and local
binding checks, followed by at most one distinct provider run if justified.
No support message, worker activation, push, PR or deployment.
