# D11.2–D11.7 — calibration and worker implementation contract

2026-10-02 engineering contract under AUTH-20, following the D11.1 contract
review. This selects the local implementation structure; it does not approve a
live source, provider budget, publication, deployment or schedule activation.
DEC-06 remains open. No SQL/job/provider adapter is implemented by this document.

## 1. Separate evidence from operational tests

The next checkpoint is an offline harness and fail-closed decision policy. Use
synthetic fixtures and deterministic fake responses to verify its mechanics.
Mark every such fixture `synthetic`; never report it as measured provider quality
or a human-reviewed CEFR gold set. D11.2 stays partial until real reviewed evidence
and a separately approved bounded provider sample satisfy its quality gate.

A versioned fixture must identify each distinct meaning, exact canonical input,
input digest/schema, fixture revision, review state and evidence origin. A known
expected level requires explicit reviewed meaning-level evidence and permission
for its use. Disputed, ambiguous or unsupported cases must expect abstention or
carry an explicit reviewed acceptable set, not a guessed forced label.
Record reviewer/adjudication metadata and a digest of the whole reviewed fixture.
Unreviewed or synthetic fixtures cannot qualify an operational method profile.
Do not infer labels from pack names, lemma/POS alone, NT2Lex corpus counts, SUBTLEX
frequency or provider self-confidence. Never load private account exports by default.

Partition calibration and held-out evaluation by meaning family, preserving
homograph/sense pairs in the same split to avoid leakage. Coverage must include
distinct senses of the same spelling, inflections, reflexive/separable verbs,
compounds versus idioms, ordinary and specialized uses, rare/missing source data,
ambiguous context and examples that disagree with the gloss. Exact fixture sizes
and acceptance thresholds remain explicit reviewed policy inputs, not defaults
invented from a tiny synthetic sample.

## 2. Offline report and decision policy

Separate candidate parsing from deciding whether a candidate is usable. Produce
`unknown`/`needs_review` for missing/invalid output, explicit model abstention,
ambiguous input, unsupported method/profile, missing quality qualification or
confidence below the qualified threshold. A worker queue's `needs_review` state
must not be confused with a public assessment's `reviewed` status.

Reports include fixture/profile/request digests, model and settings, evaluated and
missing item counts, abstentions, coverage, confusion by level, exact/within-one
agreement, severe errors (distance greater than one level), accepted-item accuracy,
per-slice sample counts and confidence-bin reliability. Report the denominator
for every rate. Empty slices or absent responses remain unknown, never perfect.
Record response provenance and refuse missing, duplicate or mismatched item IDs
or input hashes. Observed raw confidence does not itself qualify a threshold.

A qualified immutable profile binds fixture and held-out report digests, method
revision, prompt revision, requested model and resolved provider version when
available, generation configuration, input schema and reviewed acceptance policy.
Changes invalidate qualification until re-evaluation. Record unavailable provider
version information explicitly; do not pretend an alias pins a model build.
Operational defaults are disabled/unqualified, with no inferred live threshold.

Keep the existing analysis estimate namespace `word-analysis-cefr-v1` distinct
from dictionary `assessment_schema_version: 1`. A policy can share validation
utilities, but cannot cast an analysis hash into a dictionary assessment hash.
The client response/form is untrusted input even when its digest looks valid.

## 3. Meaning input and provenance boundary

The first worker selector targets unresolved current published dictionary heads,
including approved imported entries that never used the analysis endpoint. It
reads published entry/revision/provenance tables only. It never joins personal
words, overrides, fallback content, usage history or the aggregate analysis cache.
Retired/draft/ineligible sources do not trigger provider work. Historical personal
pins and existing assessments remain unchanged; the worker never adopts a newer
revision for a learner or assigns the latest meaning's CEFR to an older hash.

Capture `entry_id`, `revision_id`, the versioned linguistic input and its SHA-256,
current assessment head (or explicit absence), method/profile revision and source
approval reference. Recompute the input from the immutable revision with the
existing `canonicalizeCefrInput`; a mismatch with its recorded digest fails closed.
The request carries the captured identity and input digest. Do not replace meaning
identity with spelling/POS/article or a hash of aggregated translations.

Model results remain `estimated`; only the separate reviewed workflow may produce
`reviewed` or `locked`. Provider output cannot choose status, source identity,
supersedes target or input identity. Source-backed evidence remains distinguishable
from model estimates and must use exact meaning-level evidence, not corpus presence.

Known public assessments already require approved provenance. A worker must not
self-approve a source, borrow an unrelated approved editorial/content source, or
fabricate a reviewer. Before enabling writes, resolve an explicit approved provider
reuse/method policy and bind it to the operational profile and resulting assessment
provenance. The current schema's generic approved-source check alone is insufficient
for that policy binding. Local tests can use explicitly synthetic approved fixtures;
without a real approved policy, live enrichment remains disabled. Preserve raw
provider material privately, if retention is approved; public rows contain only
validated assessment metadata. Logs default to IDs/counts/error categories.

## 4. Durable job and completion boundary

Use additive private job/run/budget tables and narrow privileged claim/complete
operations. Start with small configured batches and concurrency. A job key binds
entry/input/method-profile; claims include an unguessable lease token, expiry and
monotonic attempt/generation. Queue states distinguish ready, leased, retry wait,
completed, obsolete, needs review and terminal failure. Retrying a completed job
returns its existing outcome; it never creates another assessment.

Claim and reserve capacity transactionally, then release database locks before
the network call. Each attempt uses an explicit timeout and bounded input/output.
Completion locks/rechecks the job and relevant published/assessment heads in a
consistent order. Require the current unexpired lease/generation, captured input,
eligible source/profile, and expected assessment head (including absence).
If discovery has moved to a different linguistic hash while the call ran, mark
the old attempt obsolete and discard its response. A media-only revision with
the same validated linguistic input may remain applicable, with exact identity
and publication rechecked. No stale completion may update a replacement lease.

Append the immutable assessment and advance its matching head in the same database
transaction, then mark the job complete. Reviewed/locked heads are skipped at
selection and protected again at completion by both the worker and existing SQL
triggers. A reviewer winning the race must never be overwritten. Ordinary clients,
including authenticated full-access learners, cannot claim/complete jobs or write
assessment history. Service credentials never enter web/mobile bundles.

Use bounded retry/backoff for retryable 429/5xx/transport failures, respecting a
bounded Retry-After when available. Permanent authorization/validation failures
do not spin. Exhausted attempts become terminal/review work. Scheduler retries,
crashes, timeouts, expired leases and duplicate completion are explicit test cases.
Do not assume provider-side idempotency or cancelability.

## 5. Invocation and accounting

Privileged worker invocation must validate a server-only credential before any
claim/provider work. A public API key or ordinary user JWT is insufficient. Method,
provider target and limits come from validated server configuration, not request
parameters. Keep schedule and kill switch disabled by default. A disabled or empty
queue path makes zero provider calls and reserves no request budget.

Persist a UTC-day request/token/cost ledger and reserve a conservative maximum
per attempt atomically across concurrent runs. Exact provider pricing and input,
output and reasoning-token bounds require a reviewed provider configuration and
separate spending approval; unknown bounds/configuration fail closed. Retries count
as additional potentially billable attempts. Timeout/crash/unknown usage retains
the conservative charge rather than refunding uncertain spend. Reconcile verified
usage without double charging or exceeding an already reserved ceiling.

Do not hold a database transaction while waiting for the provider. Run summaries
report selected/claimed/completed/unknown/retry/obsolete/review/failed counts,
remaining eligible coverage, reserved/observed usage and budget stops. A run with
no work or a disabled flag must be inspectable without paid work. Weekly cadence
can later be configured; this implementation does not activate any cadence.

## 6. Acceptance order

1. D11.2 offline fixture/report validation and decision policy, synthetic fake tests;
   reviewed real calibration remains explicitly pending where evidence is missing.
2. D11.3–D11.5 local private queue, selection, leases and atomic completion with real
   disposable PostgreSQL concurrency tests and a deterministic fake provider.
3. D11.6–D11.7 authorization, atomic reservations, limits and disabled/no-work paths;
   test overlapping runs, 429/5xx, timeout/crash, expired lease, changed input,
   reviewer race, duplicate response, malformed output, unknown usage and cap races.
4. Astra / High review of the implemented concurrency/provenance/budget boundary.
   Keep all runtime defaults OFF and preserve personal IDs, SRS and queues.
5. Separately approved small live sample, qualified held-out evidence and verified
   provider cost before any bulk enrichment. D11 is not done merely because fake
   tests pass; source/quality/spending and later release gates stay explicit.

Next implementation model: **GPT-6.1 Sol / High**. Use the current feature branch,
fake transports and disposable local resources. Devices/retained backend are not
needed for the next checkpoint. No paid call or production operation is authorized.
