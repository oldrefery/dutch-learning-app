# Offline meaning-level CEFR calibration

This harness validates explicit fixtures and captured responses without accessing
accounts, databases, environment credentials or a provider. It neither assigns
public assessments nor activates the existing analysis flag or any schedule.
All committed test data and TEST-ONLY references are fictional mechanics fixtures,
including reviewed-shaped variants used to test the qualification boundary.
No real reviewed fixture, provider sample, approval registry or operational profile
is shipped. D11.2 quality remains open.

## Run

Use the installed Deno runtime and the existing frozen dependency lock:

```sh
deno test --cached-only --config supabase/functions/deno.json supabase/functions/_shared/cefr-calibration/
```

The tests require no runtime permissions, network, devices or backend. For an
offline report, explicitly prepare four JSON files in an approved private folder:
fixture, method profile, reviewed acceptance policy (or JSON `null` for an
unqualified report), and captured responses. Grant read access only to these files
and write access only to a new report path:

```sh
deno run --cached-only --config supabase/functions/deno.json \
  --allow-read=FIXTURE.json,PROFILE.json,POLICY.json,RESPONSES.json \
  --allow-write=NEW_REPORT.json \
  scripts/cefr-calibration/report.ts \
  FIXTURE.json PROFILE.json POLICY.json RESPONSES.json NEW_REPORT.json
```

Existing output is never overwritten. Stdout includes aggregate counts only.
Reports include item IDs/hashes, reviewed references and method configuration;
keep real reports private. The harness does not load private account exports by
default. Never use private material without explicit permission. No shell env
file or secret is needed. CLI reports are always unqualified.

## Input contract

See `supabase/functions/_shared/cefr-calibration/synthetic-fixtures.ts` for executable
synthetic examples of the complete input shape. They are deliberately not a CEFR
gold set. The fixture namespace is `dictionary-cefr-calibration-v1`, with a
revision, origin (`synthetic`, `reviewed`, `unreviewed`) and distinct meaning items.
Each item has an ID, family, split (`calibration` or `held_out`), required coverage
slices, exact validated dictionary content, `canonical_input`, its `input_sha256`,
`input_schema_version: 1`, explicit ambiguity, expectation and review metadata.
Canonical input comes from the existing `canonicalizeCefrInput`, never the
aggregate analysis namespace `word-analysis-cefr-v1`.

Expect either abstention or an explicit acceptable set of A1–C2 levels. Except in
synthetic mechanics fixtures, known labels require a reviewed meaning, reviewer,
adjudication, evidence and use-permission reference. Whole-fixture digest covers
all input metadata. Family, exact spelling and equal-input overlap across splits
is rejected. Editorial review must establish true meaning families: string/hash
checks cannot discover all inflections or semantic relations.

The method profile pins provider, requested model, explicit resolved version
(null means unavailable, not pinned), method/prompt revisions, generation settings
and meaning input schema. Policy sizes, confidence threshold, confidence bins and
acceptance rates, scored/accepted denominator minima and abstention accuracy are mandatory inputs with reviewer/approval references; synthetic
thresholds are not operational recommendations. Required linguistic slices are
reported separately in each split, including empty slices.

Response batches bind the entire request and profile digests. Each captured
response identifies its item, input hash and distinct response ID; provenance
records a fake/provider origin and run ID. Missing item responses remain visible
and prevent qualification. Missing IDs, duplicate IDs and mismatched hashes reject
the batch. Malformed candidates count as invalid; model abstention stays unknown.

## Metrics and authority

Coverage uses all fixture items as denominator; exact/within-one/severe-error rates
use known outputs with expected level sets. Accepted accuracy includes all outputs
that would pass the proposed threshold and ambiguity guard, including incorrect
forced answers on expected-abstention inputs. Every rate carries numerator,
denominator and a null value for an empty denominator. Confusion matrices use only
singleton gold labels; acceptable sets have separate counts and nearest-set distance.
Confidence reliability includes wrong answers on expected-abstention items.

`buildCalibrationReport` snapshots inputs and produces reproducible fixture,
profile, request, response, policy and report digests. Reporting a confidence bin
or good score does not qualify it. `qualifyMethod` recomputes all evidence and
requires fully reviewed fixtures, real-provider provenance, sufficient independent
split/slice evidence, explicit policy, and a separate server-only approval pinning
the exact digests and provider reuse policy. Those references require actual review;
metadata alone is not authentication. The future worker must load approvals only
from its privileged reviewed registry, never request parameters or provider output.

A successful local validation mints an immutable in-process qualification token.
Its serialized copy cannot authorize `decideCandidate`. Missing qualification,
changed method settings or ambiguity yield `needs_review`; absent, invalid and
abstained output yields `unknown`. Successful decisions remain model `estimated`,
never editorial `reviewed`. This token does not authorize publication or spending.
The future worker must independently enforce source/lease/input/head binding,
authorization and budgets. No runtime caller or database write is wired here.

## Local diagnostic collector (fake transport only)

The 24-item D11 diagnostic worklist and provisional reference are model-origin
preparation, not an independently reviewed calibration fixture. The separate
collector accepts only its built-in fake transport. Run it with Node 24 using five
explicit, committed inputs and a **new private run directory**:

```sh
node scripts/cefr-calibration/diagnostic-fake.ts \
  docs/tasks/shared-dictionary-cefr/evidence/D11-pilot-review-worklist.json \
  docs/tasks/shared-dictionary-cefr/evidence/D11-pilot-provisional-reference.json \
  docs/tasks/shared-dictionary-cefr/evidence/D11-pilot-profile.proposed.json \
  docs/tasks/shared-dictionary-cefr/evidence/D11-pilot-prompt.txt \
  docs/tasks/shared-dictionary-cefr/evidence/D11-pilot-proposal-summary.json \
  reports/shared-dictionary-cefr/my-new-private-diagnostic-run
```

The command has no network or credential loader. Fake token counts and A1/abstain
answers are deterministic mechanics data. It creates a private SQLite journal and a
new `diagnostic-report.json`; an existing report is never overwritten. The journal
binds the worklist, provisional reference, profile, prompt and proposal digests. An
attempt reserves its full request/token/cost maximum in a durable transaction before
generation. A crash or unknown usage keeps that reservation; retries consume another
attempt. An active collector holds a short database lease, and concurrent collectors
cannot reserve against the same run. Resume requires identical inputs and the same
UTC day. The collector rechecks the day before each dispatch and stops across
midnight while retaining existing charges. Permanent HTTP rejection stops the
whole run, including later resumes. Invalid candidate JSON still retains its
verified usage and response/model identities. The reference never enters a provider
request.

The report records simulated reserved and observed usage, retries, timeouts, output
coverage, split/slice counts, confidence-bin counts and agreement with provisional
bands. It displays unknown-reference and ambiguity probes separately. Its
`qualified` and `calibration_eligible` fields are always false. Agreement is not
accuracy. The existing reviewed-fixture report and operational qualification path
are unchanged. The separate dormant live runner requires exact private source/account/spending
authorization; this fake command cannot make a paid call.

The executable checks use the same local Node runtime:

```sh
node --test scripts/cefr-calibration/diagnostic*.test.ts
```

## Gemini REST preparation (injected test HTTP only)

`diagnostic-gemini.ts` prepares the exact Gemini Developer API REST body for the
frozen pilot. `createGeminiTestAdapter` requires injected HTTP and uses a fixed
dummy key. It has no default fetch, environment loader, real credentials, live mode
or CLI. The existing fake collector rejects this adapter as a generation transport.
This adapter exercises the wire contract. Only the separately authorized runner
may bind its HTTP to a private operator key.

The tokenizer receives `generateContentRequest` containing the complete generation
body, including system instructions and configuration. A stable run/meaning
identity permits the same counted body across attempts. No reference bands, split
or slice metadata enter it. The runner retains separate attempt reservations and response IDs and rejects any
changed counted body.

The adapter explicitly requests Standard service and disables request logging.
It enforces a 5-second maximum timeout, abort, redirects disabled, JSON/UTF-8
validation and a 16 KiB streaming envelope bound. Active body readers are cancelled
on timeout; late responses and rejected headers release unread bodies. Invalid
envelopes return a receipt stop, while network/read failures remain transport
errors. Parsed receipts require the exact Flash alias or a three-digit numeric
revision (never sibling model names), subsequent exact version binding, Standard
usage tier, disjoint prompt/answer/thinking counts,
their total and the combined 2048-token output cap. Missing zero-valued protobuf
counters are accepted only with a consistent total. Cache/tool charges are rejected.
Invalid candidates preserve verified receipts; invalid receipts are a separate
stop condition. No HTTP retry is hidden in the adapter. `models.get.version` is
descriptive and never substitutes for `response.modelVersion`.

`probeGeminiControls` reserves one metadata read and at most one token count per
meaning in the existing private fake-run journal before dispatch. Verified results
are immutable and cached by the full request digest. A crash, timeout or rejected
control response leaves its reservation unknown and prevents replay. Same-day
resume and the single-owner lease apply. All wire requests are validated before
the metadata reservation, and the lease is rechecked immediately before each
dispatch. This probe never generates answers; its
output explicitly says billing unverified and live not ready.

[The proposed live request](../../docs/tasks/shared-dictionary-cefr/evidence/D11-gemini-live-request.proposed.json)
binds all frozen artifacts and 24 input hashes. Account/key, source transmission,
spending approval, control endpoint billing and the complete total cost bound remain
unset. The $1.913472 generation reservation is not an established total including
control calls. The draft cannot authorize execution or qualify CEFR accuracy.

## Dormant authorized Gemini diagnostic runner

`diagnostic-runner.ts` joins the repaired adapter and private SQLite ledger. Every
control/generation reservation precedes HTTP; unknown outcomes retain their full
allowance. The report separates controls and generations and combines reserved
requests, tokens and microUSD under `reserved_all`. Actual control cost stays null
when only an upper bound is verified. Reports always remain unqualified and cannot
activate the operational worker or establish independent CEFR accuracy.

Generation retries are limited to two attempts per meaning. HTTP 408/429/5xx,
network failures and timeouts use persisted exponential backoff plus jitter; a
`Retry-After` up to five seconds is honored. A longer delay stops the batch rather
than shortening the provider's requested delay. Unknown generations after a crash
also wait before retrying and consume a new reservation. Controls never retry an
unknown outcome. Permanent errors and invalid receipts durably stop the entire
batch. Duplicate response identities and mixed-model capture conflicts persist a
run rejection before raising an error; reports expose `rejection_reason`. A valid receipt is captured even when approval expires during HTTP. Leases,
day/expiry, implementation and approval/key digests are checked before dispatch.

[The unapproved registry template](../../docs/tasks/shared-dictionary-cefr/evidence/D11-gemini-execution.unapproved.json)
is documentation, with execution disabled. The live CLI has no environment loader,
implicit credential path, default registry, scheduling or activation. The current
checkpoint has performed zero provider calls. Local runner technical review and
repairs are recorded in the task evidence.

A future authorized operator must first establish the personal provider account,
project/key membership, paid tier, pricing and control billing evidence outside the
parser. The parser validates these exact attestations and their digest bindings;
it cannot discover remote ownership or make an independent billing verification.
A nonempty evidence reference alone is not evidence of human approval. Only after
separate explicit human approval may the operator populate a private registry with
source references for all 24 exact hashes, key digest, combined cost/token ceiling,
current implementation digest, exact draft digest, absolute run directory, UUID,
one UTC day, expiry and approval reference. Missing/unknown control prices are
rejected; the committed draft's complete live cost remains unverified.

Copy the reviewed draft and template to private files (owner-only mode 0600), keep
the key in a separate owner-only file, and choose one owner-only run directory.
Symlinked/public/foreign-owned registry, draft or key files are rejected. Editing
or revoking the registry/key, changing implementation bytes, changing the bound
run/day or rotating credentials stops the run. Approval is scoped to that single
run directory; resume preserves its journal and does not refund uncertain spend.
The registry also pins an absolute `journal_binding_path` outside the run directory,
in an existing owner-controlled directory without group/other write access. On
first execution the runner exclusively creates and fsyncs a private consumption
record there, binding the directory/database identity and a nonce stored in the
journal. It rechecks this record before dispatch. A missing/replaced/truncated
journal, lost record or incomplete initialization stops execution; moving the
registry does not relocate its consumption record. Recovery requires review and
new explicit authorization, never automatically recreating an allowance. The
record remains private local state, not an adversarial tamper-proof spending
service: a process with the operator's filesystem privileges can erase both copies
or restore old snapshots. Preserve them together and never roll either back to
reuse an approval. Never commit an approved registry, key, consumption record,
account details or private captures.

The explicit CLI, for a separately approved future run, is:

```sh
node scripts/cefr-calibration/diagnostic-live.ts --check \
  WORKLIST REFERENCE PROFILE PROMPT PROPOSAL \
  PRIVATE_DRAFT PRIVATE_AUTHORIZATION PRIVATE_KEY EXACT_RUN_DIR

node scripts/cefr-calibration/diagnostic-live.ts --execute \
  WORKLIST REFERENCE PROFILE PROMPT PROPOSAL \
  PRIVATE_DRAFT PRIVATE_AUTHORIZATION PRIVATE_KEY EXACT_RUN_DIR
```

Use Node 24 with native TypeScript support. `--check` validates private bindings
without HTTP or creating a journal; it does not verify account/billing evidence
remotely. `--execute` is the only CLI mode that dispatches real HTTP, after all
explicit private approvals pass. Errors are sanitized. `test-only` registries can
only use injected HTTP and are rejected by both live CLI modes. Provider executions
reject injected test hooks. No real credential or approved registry is supplied by
the repository. Generation alone reserves up to $1.913472; full authorization must
include 24 count controls and one metadata control within the proposed $2 API-use
ceiling. These figures are bounds, not spending approval or a verified live bill.

For the separately accepted D11 one-run diagnostic, a private registry may set
`pricing.cost_policy` to `estimated_unknown_controls` only when its bound private
draft specifies 24 total generations and one attempt per meaning. The registry
must explicitly acknowledge unknown control costs and leave their maximum and
billing verification fields null. Its `total_reserved_tokens` is 194304. The
journal reserves the $0.956736 maximum for the 24 generations and records zero
as a placeholder for each control; those zeroes are **not** claims that Google
charges nothing for controls. The report marks its cost scope as
`generation_maximum_controls_unknown` and `hard_total_cost_bound: false`. The $2
figure is an estimate, not an enforced total spending cap. An uncertain or failed
call does not permit a second generation for that meaning or a replacement run.
