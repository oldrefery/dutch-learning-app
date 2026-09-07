# Review preparation monitoring

## Measurement boundary

Mobile cold session preparation creates a standalone Sentry transaction/span:
`review.prepare`. It starts before question preparation and ends after controller
creation, cancellation or failure. The custom `review.duration_ms` value uses
the monotonic `performance.now()` clock, including cooperative yields.

This is **not** tap-to-first-card time: review-history loading, navigation and
first-card rendering are outside the measurement. Cached controller resumes and
already-aborted cold requests are excluded. A retry creates a fresh measurement.
Word limits, question selection and SRS formulas are unchanged.

## Sentry data and sampling

In the React Native project (`dutch-learning-app`), filter transactions by
`transaction:review.prepare`, or spans by `span.op:review.prepare` in Explore.
Filter completed work by `review.outcome:ready`; compare durations by word count,
platform and OTA update ID. Inspect p50/p95 only with a meaningful sample size.

Attributes:

- `review.word_count`: number of requested session words.
- `review.vocabulary_count`: size of the vocabulary snapshot supplied to preparation.
- `review.mode`: requested mode, including adaptive.
- `review.outcome`: ready, cancelled or error.
- `review.duration_ms`: elapsed preparation time in milliseconds.
- `review.platform`: ios or android.
- `review.update_id`: OTA UUID, or embedded for the build-bundled JavaScript.

Existing tracing sampling is retained: 10% in production, 25% in preview.
Development, test and fixed-bundle QA runs do not emit this diagnostic.
No global sampling increase or new native dependency is required.

A successful preparation taking **at least 3,000 ms** also creates the warning
`Slow review preparation`, grouped by `review.prepare / slow`. Find it in Issues
with `module:review.prepare`. It does not depend on tracing sampling; warnings
are limited to one per 15 minutes per app process, across sessions. The threshold
is an initial diagnostic policy, not a device SLA or a session-size cap.
Cancelled/failed preparation does not generate a slow warning. Existing loader
error capture remains responsible for preparation failures, avoiding duplicates.

The privacy filters run after SDK scope enrichment. They keep only allowlisted
diagnostic fields and release metadata, removing inherited users, breadcrumbs,
requests, custom contexts, unexpected tags and child spans. No word text,
translations, word IDs, user IDs or collection IDs are sent in these diagnostics.
SDK failures must not change the review result or replace its original error.

## Limitations and rollout

These measurements are emitted when preparation settles. A permanently blocked
JavaScript thread or process termination before completion may produce no span
or warning. This is not an independent native watchdog. Background/route blur
cancels preparation; those samples must not be treated as successful startup.

Tests use synthetic data and mocked Sentry, including threshold boundaries,
rate limiting, outcomes, retries, cache reuse, SDK failures and privacy after
scope enrichment. The existing 2,500/5,000-word tests guard bounded preparation
and one-time distractor indexing without flaky CI wall-clock thresholds.

After merge and an explicitly authorized OTA, verify a real sample in Sentry.
With 10% tracing, an absent transaction after one review is not evidence of a
broken integration. No production sample, dashboard or notification rule was
created as part of the local implementation. A server-side alert on new
`module:review.prepare` issues can be configured separately if notifications
are desired.

Reference: [Sentry custom instrumentation](https://docs.sentry.io/platforms/react-native/guides/expo/tracing/instrumentation/custom-instrumentation/).
