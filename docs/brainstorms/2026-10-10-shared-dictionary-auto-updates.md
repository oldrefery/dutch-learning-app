---
date: 2026-10-10
topic: shared-dictionary-auto-updates
status: product-direction-accepted-implementation-pending
---

# Shared analysis with automatic published updates

## Accepted direction

One dictionary entry per resolved meaning owns the analysis. Each user's stable
personal word row holds its reference, collection membership and learning state.
Published same-meaning updates propagate after synchronization at safe review
boundaries. Versions remain immutable for history/rollback; latest published head
is followed automatically. Reanalysis operates on the shared entry, never creates
an individual analysis or silently detaches its reference.

Completed D01-D12, D13 activation, both OTA repairs and existing iOS acceptance
remain evidence. Old cards were not automatically linked. Their transition needs
reviewed meaning mappings, preservation of all data and explicit handling of
ambiguous/missing-source/private content. No new live operation is approved here.

## Approaches considered

- Personal copies: independent but duplicate analysis and leave old errors behind.
- Pinned shared versions: implemented baseline; stable but fixes require adoption.
- Automatically followed published shared analysis: owner selected this direction;
  publication quality, rollback and offline convergence need explicit handling.

## Final clarifications accepted

All analysis fields are common: no personal translations/examples/images override
shared content. The private reference keeps collection and learning state. Optional
separate personal notes are outside the feature scope; old content differences are
preserved until reviewed disposition, not silently transformed into notes/overrides.

Both full_access users and administrators can request shared reanalysis. The server
checks authority/quota, deduplicates work, validates same-meaning output and publishes
one version for all references. Failed/invalid results keep the previous head.
Read_only users cannot invoke the operation. Direct arbitrary dictionary mutation
and administrator rollback are not granted by full_access. Existing role sources,
protocol details and concurrency rules are specified at D13A.1.

Old cards require reviewed meaning mapping and visible approved content differences;
all learning/IDs/collections remain exact. Missing/ambiguous/private material stays
protected pending resolution. The prior snapshot's zero-safe-match result is not
an excuse to guess matches or claim a fully migrated collection.

## Next checkpoint and models

[D13A.1](../tasks/shared-dictionary-cefr/steps/D13A.md): GPT-6 Astra / High.
The [updated plan](../plans/shared-dictionary-cefr-2026-09-12.md) names the model and
reasoning effort for every D13A/D14 checkpoint. Product choices above are settled;
next specify/review the technical delta. Local development need not wait for D13 observation;
production release/linking and later retirement retain separate exact gates.
