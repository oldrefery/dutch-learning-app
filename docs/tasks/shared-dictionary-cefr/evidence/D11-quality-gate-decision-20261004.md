# D11.2 quality-gate decision — 2026-10-04

## Verified state

The current local candidate pool has 27 exact canonical inputs in 20
split-isolated families. It fills all 22 required slice/split cells, but
each cell contains only one to four candidates. The
[graded-context ledger](D11-graded-context-ledger-20261004.json) has 24
preliminary observations for 20 inputs. These are levels of learning
materials, not adjudicated CEFR levels of the exact meanings. Four
conflict/polysemy inputs have preliminary expected-abstention rules;
the [three specialist senses](D11-specialist-gap-disposition-20261004.md)
have no admitted graded language context and remain unsupported for a
positive label. All 27 inputs remain unreviewed and provider-unapproved.

The completed Gemini v3 run concerns a different, 24-input pilot and
used an assistant-inferred reference. Its 19/19 provisional agreement
and 2/2 ambiguity abstentions cannot validate accuracy because the
reference is not independent reviewed gold. Reusing the run or its
responses to choose a policy would leak the evaluation set into the
threshold. The two remaining paid-attempt permissions cover those
original 24 inputs only, and the owner has prohibited repeating them
without a new evidence question. No new candidate may be transmitted
under that permission.

## Why D11.2 cannot be marked done under its current gate

The [stage checkpoint](../steps/D11.md) requires calibration on a
reviewed fixture. The [validation protocol](D11-independent-validation-protocol-20261004.md)
requires a meaning-level reference independent of Gemini's outputs,
adequate denominators in both splits, a prespecified reviewed policy
and a separately approved provider sample before quality qualification.
An assistant can screen and document sources, as done here, but cannot
represent its own screening as external human review or independent
quality gold. A single A1/B2 text occurrence does not establish when a
learner first knows a word. Setting a one-item-per-cell minimum merely
to pass the 27-item draft would not be a credible quality gate.

The safe behavior is already implemented in
`supabase/functions/_shared/cefr-calibration/policy.ts`: without a
reviewed fixture, provider provenance, a reviewed policy and bound
server approval, `qualifyMethod` returns no qualification, and
`decideCandidate` leaves unqualified positive answers in
`needs_review`. This screen made no code or provider changes.

## Decision required before the next path

1. **Keep the current quality gate.** D11.2 remains blocked for an
   independent, meaning-level reviewed reference and a much larger
   held-out pool. No teacher has been supplied, and the owner has
   asked the assistant to do the work. The assistant can continue
   preparing candidate evidence, but cannot honestly certify its own
   labels as independent gold. Provider and worker stay off.
2. **Narrow D11.2 to an experimental offline deliverable.** The owner
   explicitly accepts assistant-reviewed labels as a
   _provisional diagnostic reference_, with clear provenance and
   lexical sources where available, and
   `qualified: false`. This can close a revised offline checkpoint but
   does not satisfy the existing production quality gate or authorize
   the worker. A new provider sample on the 27 inputs would still
   need its own exact input, destination and cost authorization.

Neither path converts absent specialist evidence into a CEFR band.
Neither authorizes push, PR, migrations, publication or deployment.
The owner had to choose whether the stage definition could be narrowed;
the assistant could not silently redefine “reviewed fixture”.

## Owner resolution

On October 4 the owner chose option 2. The implemented closure uses the
already frozen [24-input assistant reference and v3 pilot](D11-offline-diagnostic-closure-20261004.md)
as a retrospective, unqualified diagnostic. It does not promote any of
the separate 27 candidates or claim source-adjudicated CEFR bands for
the 24 pilot items. The original production quality gate remains open.
