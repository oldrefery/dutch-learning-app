# D13A.7.5 — AUTH-30 live semantic pilot result

Date: 2026-10-11. Pilot execution complete; exact policy/model qualification FAILED.
D13A.7 remains4/6 complete,2 remain; eight broad milestones remain.

## Authorized operation and execution

AUTH-30 authorized one frozen Gemini3.8-flash pilot, maximum48 attempts and USD15.
Owner confirmed the locally configured key belongs to a personal Google project;
project membership/billing was not independently inspected. The key was read only
from the named .env.local assignment and passed in the child process environment.
No secret values were printed or retained in evidence. A local preflight initially
used an overly narrow key-character check; it was corrected before any dispatch.

Canonical approved packet SHA:
`d397dcd23022e9fb4eaeef4469b2e7f0915ff7b57d225805cc0844600b256cf6`.
Packet: `reports/shared-dictionary-cefr/d13a7-semantic-qualification-20261011/packet.json`.
The frozen corpus, prompts, policy, all eight pinned source files and provider settings
remained unchanged throughout execution. The network command ran with approved
sandbox network access to generativelanguage.googleapis.com; automatic approval
review did not reject it. No retry, second run, activation or publication occurred.

- Durable dispatches: **46**, returned results: **46**, failures/unknown outcomes: **0**.
- Completed fixed judge requests: **44/44**.
- Generation probes: **2**; see the original report for guard outcomes.
- Actual reported model version: **gemini-3.8-flash**.
- Reported input tokens: **41843**.
- Reported output including thinking tokens: **56285**.
- Calculated standard token cost: **USD0.24245100**;
  conservative consumed reservations: **USD12.88**, within USD15.
- Cost is calculated from reported token usage and current standard pricing, not a
  verified provider invoice. No credits were purchased or billing settings changed.

The [official pricing](https://ai.google.dev/gemini-api/docs/pricing) used in the
approved packet is USD0.75/M input and USD3.75/M output including thinking.
Every dispatch/result is retained under `reports/shared-dictionary-cefr/d13a7-semantic-qualification-20261011/live-run`. The runner exited and released its
lock. AUTH-30 is consumed by this completed pilot; unused contingent attempts do not
authorize another run. See `reports/shared-dictionary-cefr/d13a7-semantic-qualification-live-20261011/runner-exit.json`.

## Result of the unchanged production implementation

The original report is `reports/shared-dictionary-cefr/d13a7-semantic-qualification-20261011/live-run/report.json`. It has qualified:false,
44 invalid verdicts, positive acceptance0,
negative rejection0 and uncertain abstention0.
Zero false accepts in this report reflect rejection of every parsed response, not
proof of semantic accuracy. The exact implementation fails the pilot thresholds.

The provider returns text parts with `thoughtSignature`. The transport accepts only
`text` and `thought` keys on output parts and therefore sets content:null. The
[official Part schema](https://ai.google.dev/api/generate-content) defines
thoughtSignature as optional opaque base64 metadata. This metadata is separate from
the model-generated lexical/semantic JSON. Supporting it must preserve the original
provider envelope and must not permit arbitrary fields inside the verdict.

## Offline diagnosis, not substituted live evidence

`analyze-saved.ts` replays retained responses without network/environment permission,
removing only string-valued thoughtSignature from a COPY for diagnosis before using
the existing transport and strict verdict parser. It does not alter original receipts,
prompt/policy hashes, live scores or the model's generated JSON fields.

Diagnostic strict-parser counts after signature normalization: {'same-meaning': 14, 'invalid': 3, 'different-meaning': 16, 'uncertain': 11}.
Positive acceptance: 0.8750; negative rejection:
1.0000; uncertain abstention:
0.9167; false acceptances:
0; invalid verdicts: 3.
These rates describe the small proposed synthetic corpus, not population accuracy.
No independent human label review or release qualification is claimed.

Extra verdict-field cases: positive-notes-1-1, positive-notes-1-2, uncertain-injection-3-1.
The strict semantic parser correctly rejects extra fields; do not strip them or
weaken its exact schema/binding/grounded-quote checks to manufacture a pass.
Full per-case reasons are in receipt-inspection.json and diagnostic-current.json.

| Request                        | Original verdict | Diagnostic verdict after signature normalization |
| ------------------------------ | ---------------- | ------------------------------------------------ |
| positive-1-1                   | invalid          | same-meaning                                     |
| positive-1-2                   | invalid          | same-meaning                                     |
| positive-notes-1-1             | invalid          | invalid                                          |
| positive-notes-1-2             | invalid          | invalid                                          |
| positive-2-1                   | invalid          | same-meaning                                     |
| positive-2-2                   | invalid          | same-meaning                                     |
| positive-notes-2-1             | invalid          | same-meaning                                     |
| positive-notes-2-2             | invalid          | same-meaning                                     |
| positive-3-1                   | invalid          | same-meaning                                     |
| positive-3-2                   | invalid          | same-meaning                                     |
| positive-notes-3-1             | invalid          | same-meaning                                     |
| positive-notes-3-2             | invalid          | same-meaning                                     |
| positive-4-1                   | invalid          | same-meaning                                     |
| positive-4-2                   | invalid          | same-meaning                                     |
| positive-notes-4-1             | invalid          | same-meaning                                     |
| positive-notes-4-2             | invalid          | same-meaning                                     |
| negative-english-1             | invalid          | different-meaning                                |
| negative-english-2             | invalid          | different-meaning                                |
| negative-russian-1             | invalid          | different-meaning                                |
| negative-russian-2             | invalid          | different-meaning                                |
| negative-example-1             | invalid          | different-meaning                                |
| negative-example-2             | invalid          | different-meaning                                |
| negative-example-translation-1 | invalid          | different-meaning                                |
| negative-example-translation-2 | invalid          | different-meaning                                |
| negative-related-1             | invalid          | different-meaning                                |
| negative-related-2             | invalid          | different-meaning                                |
| negative-notes-1               | invalid          | different-meaning                                |
| negative-notes-2               | invalid          | different-meaning                                |
| negative-contrasts-1           | invalid          | different-meaning                                |
| negative-contrasts-2           | invalid          | different-meaning                                |
| negative-grammar-1             | invalid          | different-meaning                                |
| negative-grammar-2             | invalid          | different-meaning                                |
| uncertain-injection-1-1        | invalid          | uncertain                                        |
| uncertain-injection-1-2        | invalid          | uncertain                                        |
| uncertain-injection-2-1        | invalid          | uncertain                                        |
| uncertain-injection-2-2        | invalid          | uncertain                                        |
| uncertain-injection-3-1        | invalid          | invalid                                          |
| uncertain-injection-3-2        | invalid          | uncertain                                        |
| uncertain-injection-4-1        | invalid          | uncertain                                        |
| uncertain-injection-4-2        | invalid          | uncertain                                        |
| uncertain-anchor-1-1           | invalid          | uncertain                                        |
| uncertain-anchor-1-2           | invalid          | uncertain                                        |
| uncertain-anchor-2-1           | invalid          | uncertain                                        |
| uncertain-anchor-2-2           | invalid          | uncertain                                        |

The raw generation for financial `bank` also fails content schema after signature
normalization: usage_notes.contrasts[0].example is a string, but the domain contract
requires a translated example object (nl/en/ru) or null. The current generation
prompt names the field without specifying its nested shape. The `slot` generation
passes structural guards after signature normalization, but neither generated output
received a live semantic judge: both original transport results had content:null.
Do not treat these diagnostic guard checks as generated-content semantic approval.

## Next checkpoint

D13A.7.5 remains open. First remediate the documented transport metadata handling
with regression tests; preserve strict generated-content validation and retain the
raw envelope. Then replay these immutable responses offline, investigate remaining
schema/meaning failures and prepare any changed model/prompt/policy operation as a
new bounded packet. Do not rerun this consumed packet or infer another paid approval.
Actual generated-content-plus-judge acceptance, reviewed labels, broader negative
coverage and exact-version activation controls remain qualification gates.

Next implementation: GPT-6.1 Sol / High; prescribed qualification review:
GPT-6 Astra / High (AUTH-16). D13A.7.6 remains actual devices/old builds/offline return
and same-environment performance. Runtime flags OFF/shared_analysis FALSE/CEFR OFF.
Code was unchanged during this pilot; prior Deno13/13, server/client/operator suites
are historical. No app test rerun is claimed for this provider measurement.
