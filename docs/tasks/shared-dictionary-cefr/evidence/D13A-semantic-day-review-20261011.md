# D13A.7.5 — Final AUTH-32 direct-analysis pilot review

Date: 2026-10-11. Result: accepted scoped synthetic pilot; no new actionable finding.

## Decision and evidence boundary

The final review accepts the measured result for exact packet
`e833fbc991f9e2ed066a09c3f79213362836a4c4f996024ac6b104c5832c76de`,
policy `ef5164c9c51781f44e19a2cc3424d4d5a01e8c10232d3c27d7139f59010d40b6`,
validator `shared-meaning-independent-v3`, with requested and observed generator/judge
`gemini-3.8-flash`. A separately issued judge request supplies contextual independence;
the two roles use the same model, so this is not model-diverse validation.

This accepts direct protected-input generation, bound judging and candidate parsing/guards
on the supplied finite synthetic noun/verb/adjective/expression corpus. It does not
establish population accuracy, linguistic certification or repeat-run stability.
Labels remain proposed and not independently human reviewed. Production qualification,
creation, database publication, client devices and activation remain false/excluded.
The original packet and runner report retain `qualified:false`; the scoped decision is
recorded separately in this review. No runtime registry/flag/profile is activated.
The direct pilot track is now complete; do not rerun it merely to repeat this review.

## Semantic content review

All40 fixed verdicts were compared against supplied anchors and candidate content.
Fourteen positives preserve the selected senses, including bank financial versus seating,
slot lock versus castle, vorst weather versus monarch, lopen walking, licht brightness,
opbellen telephoning and the idiom de knoop doorhakken. Explicit contrasts can describe
an excluded sense without claiming it belongs to the selected entry.

All14 negative cases are rejected for the actual injected contradiction, spanning all6
dimensions: EN/RU translations, ordinary and nested translated examples, related words,
notes and grammar. In particular, nested 'castle of the door', irregular lopen forms,
and physical cutting in the idiom are rejected. All12 uncertain cases abstain on injected
instructions or an unresolved anchor. Candidate instructions are treated solely as data.
Two structural cases reject a changed lemma and unapproved media before judging.
No label correction or unexplained false acceptance was found in this finite corpus.

| Generated entry     | Content review                                                                                                                                            |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| slot                | Door lock, het/sloten, EN/RU examples and deurslot align with the anchor; castle/ending occur only as explicitly different senses in contrast notes.      |
| lopen               | Walking on foot, examples and loop/liep/liepen/gelopen agree; notes distinguish running and leisure walking. Related words remain within that comparison. |
| licht               | Bright/well-lit and Russian brightness translations agree; examples concern room/daylight, with low weight explicitly contrasted.                         |
| de knoop doorhakken | Figurative decision after hesitation is retained in both languages/examples/notes; no instruction to cut a physical knot is introduced.                   |

All4 generated candidates pass guards and their separately issued judges. Review found no
blocking sense-preservation contradiction. This is not a separate editorial certification
of every synonym, register nuance or historical claim. The synthetic corpus lacks broad
lexical coverage and held-out human labels; existing activation prerequisites remain.

## Fresh local verification

A new offline audit re-parses all48 retained provider envelopes through `journalPacket`,
compares exact stored content, validates model/usage and request IDs, reconstructs the4
contingent requests from actual generations, and recomputes all48 canonical request hashes.
It calls production guards/scoring and reproduces every fixed/generated score and summary
field exactly. All17 frozen source bindings still match. Both structural guards reject.
Forty fixed judges produce14/14 positive accepts,14/14 negative rejects,12/12 uncertain;
invalid0,false accepts0. All48 responses use exact gemini-3.8-flash and standard tier.
Rate <=10 starts per60s; all attempts and completion occur within the authorized local day.

Command: `/Users/devrush/.deno/bin/deno run --check --cached-only --unstable-detect-cjs --config supabase/functions/deno.json --allow-read --allow-write=reports/shared-dictionary-cefr/d13a7-semantic-day-review-20261011 reports/shared-dictionary-cefr/d13a7-semantic-day-review-20261011/replay-review.ts`.
No network or environment permission. Audit typecheck passed. The first local audit used
body-only hashing instead of the actual canonical provider/model/body binding; it correctly
failed. The audit was corrected to match the source contract and then passed. No product
change, provider call or altered journal resulted; initial and passing logs are retained.

A separate Python Decimal audit recomputes all95 historical/current dispatch charges,
checks prelaunch durable allocation ordering and expiry, and reproduces the daily ledger.
Three fresh wrapper budget probes pass: fitting allocation, aggregate overrun rejection,
and expiry rejection. No credential read. The prior170-test code review remains carried
with unchanged source hashes; no fresh full SQL/mobile/web/device acceptance claimed.

## Budget and authority

| Journal                            | Attempts | Accounted USD |
| ---------------------------------- | -------: | ------------: |
| AUTH-30 returned usage             |       46 |      0.242451 |
| AUTH-31 historical failure reserve |        1 |          0.28 |
| AUTH-32 returned usage             |       48 |     0.2918025 |
| Aggregate                          |       95 |     0.8142535 |

Remaining daily budget USD14.1857465. This uses same-day verified standard pricing and
reported token usage, not an inspected billing invoice. Current run input45380 and output
including thinking68738 reproduce its estimate. No cached/tool/priority charge was used.
Original full-run reservation13.44 plus prior0.522451 =13.962451 was within15 before launch.
Unknown historical cost retains0.28; it is not silently treated as free.

AUTH-32 expires2026-10-11T22:00:00Z (Amsterdam midnight), no rollover. Same-scope reviewed
requests within today's aggregate authority need no repeat payment question. Do not reuse
the single-use wrapper: it accounts for the two runs preceding it. Any later wrapper must
account for all3 existing journals plus later allocations, use a unique journal and retain
no-retry/expiry guards. Creation, runtime activation and publication remain outside scope.
The completed pilot has no pending lock/runner/unknown outcome; the old known failure is
accounted for. Historical AUTH-31 root cause is still not proven by this successful run.

## Remaining work and persistence

Direct pilot:0 remaining substeps, previously1. D13A.7 remains4/6 because checkpoint5 also
requires compatible creation profile/grant/transport qualification and the final combined
scope decision. These are the same2 remaining packages inside checkpoint5; checkpoint6
covers actual-device/old-client/offline/performance acceptance. Eight broad milestones
remain: D13.6,D13A.7,D13A.8,D13A.9,D14.1,D14.2,D14.3,D14.4.

Next GPT-6.1 Sol / High: prepare the creation profile/transport/packet locally and exercise
mocked lifecycle/bindings; retain distinct generator/judge models required by
`dictionary-creation/contracts.ts`. The creation endpoint currently injects its transport;
it has no default live provider transport. Do not treat direct analysis results as proof
of creation grant mapping. Save a concrete reviewable packet and evidence, then request
Astra / High review. No paid call is necessary for that preparation. Reviewed labels and
scope enforcement remain activation prerequisites; no new numbered milestone is added.

Entry4177 hash references and655 dirty paths verified. Preserve411 source,142 task-web,
449 browser and94+3+98 provider-journal file hashes. Only5 existing task notes plus this
new evidence pair change:657 local-only/uncommitted paths. No commit/push, hosted mutation,
EAS/device operation, credential access or paid call. Flags OFF outside QA; shared_analysis
FALSE/CEFR OFF; real2914,eligible links0,approved/applied0. No pending operation.
