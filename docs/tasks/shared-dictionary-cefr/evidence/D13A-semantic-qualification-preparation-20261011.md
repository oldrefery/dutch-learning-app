# D13A.7.5 — Semantic qualification pilot preparation

Date: 2026-10-11. Status: local preparation complete; real qualification pending.
D13A.7 remains **4/6 complete, 2 remain**. No provider calls were made.
The remaining broad milestones are D13.6, D13A.7, D13A.8, D13A.9,
D14.1, D14.2, D14.3 and D14.4 (eight). Next model: GPT-6 Astra / High.

## Reviewable proposed operation — not approved

Run one synthetic Gemini semantic pilot from this checkout using
`DICTIONARY_ANALYSIS_GEMINI_API_KEY`, after explicit owner authorization and
confirmation that the credential belongs to the intended personal Google project.
No key value belongs in chat, logs or evidence. Local presence checks found no
DICTIONARY_ANALYSIS_GEMINI_API_KEY, GEMINI_API_KEY or GOOGLE_API_KEY in the process,
.env or .env.local; remote secret stores were not inspected.

- Candidate generator and judge: `gemini-3.8-flash`. Existing production model configuration is unchanged.
- Packet: `reports/shared-dictionary-cefr/d13a7-semantic-qualification-20261011/packet.json` (ignored local report, retain across resume).
- Canonical packet SHA-256: `d397dcd23022e9fb4eaeef4469b2e7f0915ff7b57d225805cc0844600b256cf6`.
- Semantic prompt SHA-256: `af8ed6ed7c15abd5567bd5a524c107a396525ec498bf2ed7abe7413803faa64a`.
- Policy SHA-256: `9f86931444e3cbf1736e0bfe20b57d652828d6dccf5f1f10e933e7487cae1254`.
- Corpus SHA-256: `d97d418a8f14400aaa02491b698b040e09c31379824f3ffedac9a005f97d4430`.
- Eight implementation source hashes and every fixed request body/hash are inside the packet.
- Maximum **48 provider attempts**, no automatic retry; at most10 starts per60 seconds.
- Approval ceiling **USD15**, not an expected bill. Reserve USD0.28 before each attempt,
  maximum USD13.44. Unknown outcomes consume their reservation and stop the run.
- Scope expires **2026-10-18T00:00:00Z**; refresh model availability, pricing and packet after expiry.
- Send synthetic Dutch anchors/candidates only, using the current production prompts.
  No user cards, personal prompts, database writes, policy activation or publication.

The [official model page](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash)
lists gemini-3.8-flash and its65,536 output-token ceiling. The current
[standard pricing](https://ai.google.dev/gemini-api/docs/pricing) is USD0.75/M input
and USD3.75/M output tokens including thinking through2026-12-31. Conservative
reservation uses32,768 input tokens and the full65,536 output ceiling:
(32768 * 0.75 + 65536 * 3.75) / 1000000 = USD0.270336 < USD0.28.
Requests are separately capped at32KiB and retain production maxOutputTokens8192.
No tools, paid search or cached-content resources are configured. This is a local
reservation/stop policy, not an account-level billing cap or a quota configuration change.

The [3.5 model page](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash)
now describes automatic routing to3.6. The legacy handler's3.5 setting is not changed
by this pilot. Exact observed modelVersion, responseId and usageMetadata are retained
from the [GenerateContent response](https://ai.google.dev/api/generate-content).
Unexpected/missing versions, mixed versions or unbounded/missing usage stop the run.
The first actual modelVersion is not fabricated in advance. Deployment qualification
must bind the observed version and handle alias drift; this pilot does not activate policy.

## Corpus and interpretation

Twenty-four original synthetic cases:8 positive,8 negative,6 uncertain and2 guard
rejections. Twenty-two judge cases run twice (44 attempts);2 generation probes each
get a separate judge only after actual generated content passes production guards
(up to4 attempts). Guard failures never enter the provider. Expected labels and
rationales remain local and are absent from provider request payloads.

Labels are **proposed, not independently human-reviewed**. This small corpus is a
pilot, not population accuracy evidence: negatives concentrate on financial `bank`,
positive cases cover four anchors, and repeated runs are correlated. Independent
label review and any justified corpus expansion remain required before qualification.

| Case                         | Category  | Proposed result   | Rationale                                                                  |
| ---------------------------- | --------- | ----------------- | -------------------------------------------------------------------------- |
| positive-1                   | positive  | same-meaning      | Translations and example preserve the explicitly disambiguated sense.      |
| positive-notes-1             | positive  | same-meaning      | Adding a neutral paraphrase of the protected gloss preserves the sense.    |
| positive-2                   | positive  | same-meaning      | Translations and example preserve the explicitly disambiguated sense.      |
| positive-notes-2             | positive  | same-meaning      | Adding a neutral paraphrase of the protected gloss preserves the sense.    |
| positive-3                   | positive  | same-meaning      | Translations and example preserve the explicitly disambiguated sense.      |
| positive-notes-3             | positive  | same-meaning      | Adding a neutral paraphrase of the protected gloss preserves the sense.    |
| positive-4                   | positive  | same-meaning      | Translations and example preserve the explicitly disambiguated sense.      |
| positive-notes-4             | positive  | same-meaning      | Adding a neutral paraphrase of the protected gloss preserves the sense.    |
| negative-english             | negative  | different-meaning | One extra English translation introduces the seat sense.                   |
| negative-russian             | negative  | different-meaning | Russian switches to the seat sense while English remains correct.          |
| negative-example             | negative  | different-meaning | The example expresses a seat rather than a financial institution.          |
| negative-example-translation | negative  | different-meaning | The example translations contradict the Dutch financial sentence.          |
| negative-related             | negative  | different-meaning | A furniture synonym is not the financial sense.                            |
| negative-notes               | negative  | different-meaning | Analysis notes introduce the furniture sense.                              |
| negative-contrasts           | negative  | different-meaning | Usage notes and contrasts replace the financial meaning.                   |
| negative-grammar             | negative  | different-meaning | A fabricated verb paradigm and wrong plural contradict the protected noun. |
| uncertain-injection-1        | uncertain | uncertain         | The exact judge prompt requires uncertainty for prompt injection.          |
| uncertain-injection-2        | uncertain | uncertain         | The exact judge prompt requires uncertainty for prompt injection.          |
| uncertain-injection-3        | uncertain | uncertain         | The exact judge prompt requires uncertainty for prompt injection.          |
| uncertain-injection-4        | uncertain | uncertain         | The exact judge prompt requires uncertainty for prompt injection.          |
| uncertain-anchor-1           | uncertain | uncertain         | The anchor cannot distinguish furniture from a financial institution.      |
| uncertain-anchor-2           | uncertain | uncertain         | The anchor cannot distinguish furniture from a financial institution.      |
| guard-identity               | guard     | guard-rejected    | A changed lemma is rejected before any judge call.                         |
| guard-media                  | guard     | guard-rejected    | A non-allowlisted media URL is rejected before any judge call.             |

Proposed screening thresholds: zero false acceptances or invalid verdicts; positive
acceptance >=87.5%, negative rejection >=87.5%, uncertain abstention >=83.3%; all44
fixed judge results with a single recorded model version. Reports calculate metrics
but always emit `qualified:false`. Passing a pilot does not close D13A.7.5.
Review all false accepts, false rejects, uncertain/invalid outcomes, per-dimension
verdict evidence, repeat disagreements and the two actual generation outputs.
Record proposed-versus-reviewed label changes without rewriting frozen evidence;
a materially changed corpus/prompt/model needs a new bounded operation proposal.

## Reproducible execution after authorization

Run from repository root, with the approved personal-project key already configured
in the environment. The command deliberately grants network access only to the
Gemini endpoint and environment access only to the required key. It is shown here
for review; it has **not** been executed against the provider.

```bash
/Users/devrush/.deno/bin/deno run --cached-only \
  --config supabase/functions/deno.json \
  --allow-read \
  --allow-write=reports/shared-dictionary-cefr/d13a7-semantic-qualification-20261011/live-run \
  --allow-env=DICTIONARY_ANALYSIS_GEMINI_API_KEY \
  --allow-net=generativelanguage.googleapis.com \
  scripts/shared-dictionary/semantic-qualification-cli.ts run \
  reports/shared-dictionary-cefr/d13a7-semantic-qualification-20261011/packet.json \
  reports/shared-dictionary-cefr/d13a7-semantic-qualification-20261011/live-run \
  d397dcd23022e9fb4eaeef4469b2e7f0915ff7b57d225805cc0844600b256cf6
```

The runner validates the packet/source hash before reading credentials, locks the
output directory, fsyncs each dispatch intent before transmission and retains raw
responses/usage. Resume reuses recorded results; dispatch without result stops for
reconciliation without redispatch. A crash lock requires manual review before removal.
A new output directory is not permission to repeat this one-off operation. No hidden
fallback model, retry, account switch or billing change is authorized.

## Local verification and evidence boundary

Fresh Deno13/13 with typechecking, ESLint zero warnings and Prettier passed. Tests
have read/write permission only: no network or environment access. They cover packet
hashes, guard/parser behavior, usage accounting, unknown outcomes, immutable evidence,
48-attempt exhaustion, expiry, version drift and a wholly simulated run/resume.
Simulated48 calls are not provider measurements. No live accuracy is reported.

Initial `deno check --cached-only` was rejected as unsupported command syntax; the
final cached Deno test command performs typechecking. Intermediate ESLint complexity
and repeated-string warnings were corrected; all logs are retained. Existing app,
server, domain, migration and device behavior is unchanged. Prior PG53/SQLite21/
inventory4 and client1321 are historical, not rerun for these standalone scripts.

Entry3629 SHA references verified;613 existing dirty paths preserved; final619.
Four new script files, this proposal and its manifest added; five task notes updated.
Prior source union396 retained and extended to400; web142/browser449 unchanged.
All owned checks exited. No external operation is pending. Flags OFF outside QA,
shared_analysis FALSE and CEFR OFF. AUTH27–29 remain consumed.

Next: obtain explicit pilot authority and a credential for the intended project;
review labels, execute only the approved packet, reconcile results and decide whether
further qualification is needed. Checkpoint6 then requires actual device/old-build/
offline-return/performance evidence. DEC-11 grants local architecture/code/tests,
“not provider use, live policy/role grants, publication, deployment or release.”
