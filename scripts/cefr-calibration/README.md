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
are unchanged. Live provider token counting, billing, source transmission,
authorization, and a real transport adapter require a separate implementation and
exact approval; this command cannot make a paid call.

The executable checks use the same local Node runtime:

```sh
node --test scripts/cefr-calibration/diagnostic*.test.ts
```
