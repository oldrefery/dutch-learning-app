# D11.3–D11.7 local acceptance reconciliation

2026-10-04, starting `62ca85d`, `feature/shared-dictionary-schema`.
AUTH-20 local implementation/review and AUTH-18 scoped commits. Recommended
GPT-6.1 Sol / High announced; actual picker attribution is not independently
verified. This reconciles the already implemented D11.3–D11.7 mechanics and prior
synthetic acceptance results; no implementation file changed at this checkpoint.

## D11.3 criterion mapping

| Requirement                    | Implementation and evidence                                                                                                                                                                                                                                                                                                                                                                             | Result                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Bounded daily job              | `start_dictionary_cefr_run_v1` calls the bounded selector/claim under an explicit immutable budget policy. The policy defaults to `daily`, while a UTC-day request/token/cost ledger and batch/concurrency limits bound work. `createCefrWorkerHandler` is disabled by default.                                                                                                                         | Local mechanics present; no scheduler activated.             |
| Eligible unresolved meanings   | `enqueue_dictionary_cefr_jobs_v1` reads current published entry/revision heads. `dictionary_cefr_revision_eligible_v1` verifies approved content provenance, canonical content and input hashes. The selector excludes non-unknown, locked or reviewed heads, retired/draft entries and duplicate jobs.                                                                                                 | Present.                                                     |
| Imports that bypassed analysis | `import_official_dictionary_pack_v1` reuses a reviewed mapping to a published shared entry/revision; its personal card points to that reference. The queue selects that shared head independently of `word_analysis_cache`, so an analysis endpoint call is not required. `import_dictionary_copies_v1` instead makes a personal copy without a shared head; that private copy is correctly ineligible. | Present for approved shared imports.                         |
| Personal fallback boundary     | Selection reads only `dictionary_entries`, `dictionary_entry_heads`, `dictionary_revisions`, their approved source and CEFR heads. It never reads `words`, `word_content_state`, overrides, fallback content or analysis cache. Completion writes a model estimate bound to the captured public entry/input/provider source.                                                                            | Present; personal content cannot flow through this selector. |
| No work                        | `start_dictionary_cefr_run_v1` returns `no_work` before reserving budget. The fake handler integration observed no second provider call after the completed job; disabled/empty paths have separate tests.                                                                                                                                                                                              | Present.                                                     |

The October 3 [queue foundation](D11-queue-foundation-20261003.md),
[budget implementation](D11-budget-invocation-20261003.md) and
[worker review](D11-worker-review-20261003.md) bind earlier code and tests.
The October 4 [qualification boundary review](D11-qualification-boundary-review-20261004.md)
retested current source: 47 disposable PostgreSQL, 73 cached Deno and 24
fake diagnostic tests passed. Relevant SQL tests are `selection excludes
drafts, retired entries, corrupt inputs, reviewed heads and private cards`
and `authorized request handler integrates reservation, fake provider,
receipt and no-work paths`. The D10 official import test covers reuse of an
approved shared mapping with a separate personal identity and no analysis
endpoint invocation. No new code required to satisfy this local checkpoint.

## D11.4 criterion mapping

- Durable leases: private jobs persist state, method, entry, revision and input
  hash. Claim rotates an unguessable token, increments the attempt and records
  expiry under a method lock; expired leases can be reclaimed. Current
  capacity excludes only expired leases, and each batch is bounded by policy
  and eight concurrent evaluations.
- Retry/timeout: evaluator bounds input/output bytes and 1–5000 ms timeout,
  aborts late transport work and treats 429, 5xx and transport errors as
  retryable. SQL stores bounded exponential backoff and capped Retry-After;
  retries reserve a new potentially billable attempt. Permanent errors fail;
  exhausted attempts become `failed`, and abstention/invalid output becomes
  `needs_review`.
- Idempotent completion: settlement binds lease token, attempt, input and
  qualification. An identical completion returns the saved assessment;
  changed payloads are rejected. The head update is compare-and-set with
  the expected assessment; losing or expired writes roll back the inserted
  assessment and change journal. A reviewer race cannot leave an orphan
  estimate. Completion rechecks expiry after lock waits and before commit.

The current 47-test PostgreSQL run includes retry, expiry, overlapping claims,
reviewer race, duplicate completion and attempted stale settlement. The 73
Deno tests include timeout and late provider behavior. This establishes
**D11.4 dormant local mechanics**; it is not a provider SLA or live retry
policy. No source changed during this reconciliation.

## D11.5 criterion mapping

- Reviewed/manual heads: selection excludes reviewed and locked assessments;
  claim and completion recheck the current head. The existing public head
  trigger also rejects a model replacement of a reviewed/locked assessment.
  A concurrent reviewer wins without an orphan model row.
- Changed input: jobs bind the revision and linguistic input hash. Claim and
  completion recompute the current published head and reject a changed hash,
  expected assessment or ineligible source. Media-only revisions may retain
  the same input hash; the tests distinguish this allowed case. The evaluator
  also checks its captured content against the exact hash before provider
  dispatch.
- Empty work: the SQL start path returns `no_work` with no attempt or budget
  reservation. The handler skips evaluation for a nonrunning/empty batch;
  fake integration shows zero extra provider calls after work is complete.

The 47 current SQL tests include changed input/head, reviewer race, media-only
revision and zero-budget no-work behavior. The 73 Deno tests include empty
queues and preflight failures. D11.5 therefore passes as **dormant local
mechanics**. It neither approves a real provider nor permits publication.

## D11.6 criterion mapping

- The handler factory accepts server-owned configuration and a provider/store
  adapter. Its separate secret is checked before method, payload or any store
  operation. Missing or wrong secret, ordinary `apikey` and user JWT are
  rejected; a request body or query cannot choose the profile, provider,
  policy or limits. Disabled and unqualified configurations stop before work.
- The low-level queue, dispatch, accounting and settlement RPCs grant execution
  only to `service_role`; private tables deny ordinary and service DML.
  The typed store names only the four bounded invocation RPCs and does not
  create a client or read a URL/credential itself. The implementation has no
  runtime endpoint, installed schedule, live provider adapter or real secret.
- Handler and RPC store catch failures without returning raw provider text,
  credentials or personal content. The HTTP response uses `no-store`.
  Tests reject public credentials and untrusted request configuration before
  any privileged adapter call. The SQL role test confirms permission denial.

D11.6 passes as **dormant local authorization mechanics**. Real deployment
would still require a dedicated server secret, approved method/budget/provider
configuration and a separate activation decision; this checkpoint supplies
none of those values.

## D11.7 criterion mapping

- Immutable budget policies require explicit approval, price and token-bound
  references, expiry and input/output/reasoning limits. The UTC-day ledger
  reserves one request and conservative maximum tokens/cost atomically
  before provider work; overlapping runs cannot consume the same capacity.
  A replacement policy cannot reset a day's used bucket. Daily is the
  policy's default cadence; weekly is an allowed configuration value.
- Unknown usage, timeout, crash and retries keep their reservation. Only a
  separate transport-verified receipt may reconcile usage once; request
  count is never refunded. A bound violation retains the charge and turns
  the global control OFF. The control row defaults OFF and no schedule is
  installed.
- Run summaries expose selected/claimed/completed, unknown/review/retry/
  obsolete/stale/failed/pending counts, remaining eligible meanings,
  budget stops and reserved/charged/observed usage. No-work and disabled
  paths reserve no request budget.

The 47 current SQL tests include each cap dimension, concurrent reservations,
unknown/verified usage, cost rounding, UTC day changes, policy replacement,
kill switch and run summary. Fake-provider tests cover 429, 503, 401,
malformed, transport and timeout results. D11.7 passes as **dormant local
accounting mechanics**. The bounds and pricing in these tests are fictional;
there is no approved live price, budget, scheduler or bill guarantee.

D11.3–D11.7 are accepted as **local dormant mechanics only**. There is no approved
real method/provider/budget registry, deployed endpoint or active schedule.
Independent meaning-level quality, qualified held-out evidence and a
separately authorized live sample remain D11 stage-exit and worker-activation
gates. This checkpoint does not qualify the 24-input diagnostic or allow new
provider inputs. The two remaining Gemini attempts stay restricted to the
original 24; no attempt or external write occurred.

Next: resolve the separate D11 stage-exit decision. The original gate
requires independent meaning-level gold, adequate denominators, a
prospectively reviewed policy and an approved live sample. Those inputs
are absent. A diagnostic-only technical closure with the worker kept OFF
would change the stage exit and needs an explicit owner choice. See the
separate decision record before any plan/status change. Do not
re-run unchanged suites unless a gap or source change warrants it.
