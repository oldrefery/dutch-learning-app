# D11 safe completion without human meaning-level review

2026-10-04; branch `feature/shared-dictionary-schema`; starting HEAD `b354052`.

## Scope resolution

The owner cannot provide blind judgments for the 27 exact meanings and asked
for the best path requiring no human participation. D11 closes for its local
diagnostic and dormant worker mechanics only. This narrows the original D11
stage exit; it does not certify CEFR accuracy or make automatic estimates a
release feature. The original quality requirement moves to the separate,
blocking [CEFR activation gate](D11-cefr-activation-gate.md).

## Strongest available no-human evidence

- The 24-input v3 provider pilot is a bounded technical and cost observation.
  It had 19/19 exact agreements with an assistant-provisional reference and
  2/2 intentional abstentions. The reference is not independent gold, the
  prompt was revised after v2, and four required split/slice cells were empty.
  The report remains `qualified: false` and `calibration_eligible: false`.
  The [diagnostic closure](D11-offline-diagnostic-closure-20261004.md) and
  [live result](D11-gemini-v3-live-result-20261004.md) retain the frozen
  hashes, denominators and observed/unknown cost components.
- The owner's teacher corroboration concerns whole words, not these exact
  meanings. The 27 local candidates have only 1–4 items per cell. Graded
  material, lexical references and [NT2Lex](https://cental.uclouvain.be/cefrlex/nt2lex/)
  can corroborate exposure and sense, but do not assign an independently
  adjudicated CEFR level to each project input. The
  [source audit](D11-independent-quality-options-20261004.md) records this
  measurement and rights boundary.
- Local fail-closed tests verify synthetic qualification, authorization,
  ambiguity, retries, budgets and no-work behavior. They validate mechanics,
  not live linguistic accuracy. On this starting HEAD, cached Deno tests
  passed 73/73 and fake diagnostic Node tests passed 24/24. The prior
  unchanged PostgreSQL evidence passed 47/47; no SQL source changed since.

## Accepted deliverable and release boundary

D11.1 contract/persistence, D11.2 offline diagnostic, and D11.3–D11.7
dormant local mechanics satisfy this narrowed stage. No server-only approval
registry, live provider transport, runtime endpoint or schedule is configured.
The qualification token remains unavailable without a reviewed reference,
policy, provider report and separate server approval. An unqualified known
answer goes to review; absent/invalid answers remain unknown. The worker
defaults OFF and no-work/disabled paths make zero provider calls.

D12 may verify the shared dictionary and **disabled** CEFR path. D13 may
release that same reduced scope only with its own approvals, explicit feature
description and rollback evidence. Neither stage may infer CEFR quality from
the D11 `done` status. No new provider input, paid call, support inquiry,
worker/schedule activation, push, PR, hosted migration, publication or
deployment was performed or authorized by this scope resolution. Two unused
Gemini attempts still concern only the original 24 meanings; replaying the
completed pilot would not close the quality gap.

## Verification commands

```text
/Users/devrush/.deno/bin/deno test --cached-only --config supabase/functions/deno.json supabase/functions/_shared/cefr-calibration/ supabase/functions/_shared/cefr-worker/
Result: 73 passed, 0 failed.
/Users/devrush/.nvm/versions/node/v24.20.0/bin/node --test scripts/cefr-calibration/diagnostic.test.ts scripts/cefr-calibration/diagnostic-review.test.ts
Result: 24 passed, 0 failed.
```
