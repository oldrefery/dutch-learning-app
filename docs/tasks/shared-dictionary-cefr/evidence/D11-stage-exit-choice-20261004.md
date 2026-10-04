# D11 stage-exit scope decision — pending owner choice

2026-10-04, starting `62ca85d`, `feature/shared-dictionary-schema`.

## Completed local result

D11.1 is implemented and reviewed. The owner approved D11.2 as an offline
assistant-provisional diagnostic only. D11.3–D11.7 now have a checked,
source-mapped [local acceptance record](D11-local-checkpoint-acceptance-20261004.md):
private eligible-meaning selection, bounded leases and retries, reviewer
priority and input fencing, server-only invocation, daily accounting and
kill switch. The worker, schedule and real registry remain OFF and absent.
The 24-input pilot remains `qualified: false` and
`calibration_eligible: false`. Current technical verification is 47
PostgreSQL, 73 Deno and 24 fake diagnostic tests; no new provider call
or source transmission occurred during acceptance reconciliation.

## Why the original D11 exit cannot be claimed

The current [stage exit](../steps/D11.md) requires an independently
reviewed meaning-level fixture with adequate denominators in both splits,
a prespecified acceptance policy and an approved small live sample to
measure quality and cost before any automatic enrichment. The
[validation protocol](D11-independent-validation-protocol-20261004.md)
records four empty slice/split cells in the frozen pilot, and the
[27-input pool](D11-quality-gate-decision-20261004.md) is unreviewed,
with only one to four candidates in each cell. The owner's later
word-learning history is valuable feedback, but is not a blind,
meaning-level CEFR reference for these exact inputs. The owner has no
teacher/reviewer to supply this reference. Existing authorization does
not cover a new input pool; two remaining Gemini attempts concern only
the original 24 and cannot repair the coverage/independence gap.

## Choices

1. **Keep the original D11 exit (recommended for the original product
   scope).** Leave D11 `in_progress` with the worker OFF. The next work
   would have to obtain an independent, adequately sized meaning-level
   reference and prospective policy, then seek separate exact-input,
   provider and spending authorization for a new live sample. The
   assistant can prepare materials, but cannot certify its own guesses
   as independent gold. D12 final acceptance remains blocked by D11.
2. **Accept a diagnostic-only D11 deliverable and defer automatic CEFR
   enrichment.** Amend the plan and stage exit explicitly so D11 can be
   marked done for local diagnostics and dormant mechanics. Create a
   separately tracked, still-blocking activation gate for independent
   quality, provider/sample approval and source/budget review. D12 may
   test the shared dictionary and disabled CEFR path, but cannot claim
   that automatic CEFR estimates work for imported meanings. Any final
   release plan must identify this reduced feature scope before cutover.
   Nothing here permits worker activation or publication.

No option has been selected for the full D11 stage. The October 4 owner
approval narrowed D11.2 only. Do not infer a new exit criterion, mark
D11 done, advance D12 acceptance or activate a worker from this draft.
No support inquiry, push, PR, hosted migration, publication or deployment
is implied by either option.
