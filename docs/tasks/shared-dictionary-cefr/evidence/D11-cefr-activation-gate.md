# Automatic CEFR activation gate

**Status: blocked; not part of the reduced D11 completion or current D12/D13
release scope.** No human review is requested from the owner now.

Before any automatic CEFR estimate, provider-backed worker run or schedule:

1. Obtain a rights-compatible, independently adjudicated **exact-meaning**
   CEFR reference, with distinct-family calibration/held-out splits and
   adequate denominators for every required slice. Whole-word learner or
   teacher feedback, corpus frequency, graded-text appearance, and model
   self-consistency cannot replace that reference.
2. Freeze a prospective acceptance policy and run a genuinely new held-out
   evaluation, including ambiguity/abstention, severe errors, coverage and
   uncertainty. Preserve unknown/review outcomes when thresholds fail.
3. Present the exact provider, inputs, request limits and estimated spend for
   separate owner authorization. Verify observed quality, cost and data-use
   rights in a small live sample. The two remaining old-input Gemini attempts
   do not authorize new inputs and cannot substitute for this sample.
4. Bind the reviewed fixture, report, profile, policy and approval in a
   server-only registry. Recheck authorization, budget caps, kill switch,
   metrics and rollback in the target environment before a separate
   activation approval. Enable worker/schedule only after that approval.

Until every gate passes, `qualified: false`; automatic CEFR enrichment and
its schedule remain OFF. D12 tests the disabled path. A D13 release can
include the shared dictionary but must describe automatic CEFR as deferred,
and must not treat D11 completion as permission to activate it.
