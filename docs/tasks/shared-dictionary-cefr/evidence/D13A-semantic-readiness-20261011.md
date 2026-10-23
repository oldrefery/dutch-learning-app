# D13A.7.5 local semantic readiness fixes — 2026-10-11

Both review findings implemented and verified locally;semantic qualification remains
false. No new provider call,credential access or external publication/deployment.

## SEM-REVIEW-01: exact observed versions

Independent-v3 binds explicit generation and judge version pins into its policy hash.
Enabled runtime requires both pins;requested aliases cannot establish observed versions.
Missing/non-string/wrong `provider_response.modelVersion` is refused on fresh/stored/
reconciled results. Wrong generator consumes no additional judge slot;wrong judge cannot
accept/publish. Five old stored diagnostic probes now have four review-required cases
and the matching accepted control. Update and creation paths are both covered.

Creation uses separate private SQL candidate/proof logic,not the TypeScript independent
evaluator. The additive migration fences both creation and update SQL paths, preserves
terminal/reconciled receipts and charged attempts, and seeds no flag or live profile.
Historical v1/v2 registrations remain historical;current factory requires full v3.
Public RPC signatures unchanged;deterministic target-contract check passes locally.

## SEM-REVIEW-02: expanded corpus and candidate

42 synthetic cases:14 positive,14 negative,12 uncertain,2 structural guards;6 negative
senses;4 parts of speech (noun,verb,adjective,expression). All six dimensions have focused
negative cases. Positive valid usage contrasts/non-null nested translated examples and
incorrect nested translations are included. Labels/anchors/rationales remain proposed,
not independently human-certified. Readiness review is the immediate next action.

One attempt per40 distinct judge fixtures;four generation cases with up tofour contingent
judges. Maximum48 attempts/USD15,automatic retries0. Existing call-rate/output/reservation
bounds retained. This candidate is unapproved and cannot reuse consumed AUTH-30.

- Packet SHA: `d30ec7fbbec479622d17060b3947f5b8ddb10f2fc2b713a8e21ca397aa9f1961`.
- Policy SHA: `27d7b63fefd109f2526f771c109b2426b4a76871dc8e6f8a299cf4cd659a3374`.
- Corpus SHA: `829a84be8e8c43c3376b43d572da404f6014f668c5744091c8b814601e1e1ae4`.
- Packet: `reports/shared-dictionary-cefr/d13a7-semantic-readiness-20261011/candidate-packet.json`.

## Verification and limits

Fresh cached-only typed Deno147/147 and disposable PostgreSQL82/82 pass (endpoint21,
creation-publication37,observed-version10,semantic-check14). Five stored synthetic probes
pass. Scoped server/script lint,format/diff and target-type check pass. New source bytes
are sealed in the companion manifest;older full client/device checks remain historical.

46 historical provider responses replayed;all94 immutable journal files verified.
41/44 judge outputs parse;3 schema failures remain rejected. Old narrow-corpus replay:
14/16 positive accepts,16/16 negative rejects,11/12 uncertain abstentions,0 false accepts.
Bank generation remains invalid;slot structural-only. These responses do not measure
v3 prompts/configs,expanded corpus or new generated-content+judge behavior.

Failures retained:three initial Deno fixtures corrected;four endpoint assertions repaired
for existing parent `rejected`/`validation-review-required` contract while proof remains
`review-required`;new semantic fixtures recreated Auth actor after deletion test;initial
Docker socket denial;two native shared-memory setup failures from wrong backend selection;
stale target header regenerated;two lint duplicate literals corrected. Final checks pass.
No skipped/relaxed regression and no provider retry. Temporary clusters closed by finalizers.

## Progress and exact next action

Local package1 of3 implemented. Two packages remain inside existing checkpoint5:

1. Prescribed readiness/labels/profile/packet review,then separately authorized exact
   measured qualification.
2. Final failure/evidence review and scoped qualification decision.

Next **GPT-6 Astra / High**,local review only;no new paid calls. D13A.7 still4/6 complete,
2 numbered checkpoints remain (5 semantic qualification;6 real device/old-client/offline/
performance acceptance). Eight broad milestones:D13.6,D13A.7,D13A.8,D13A.9,D14.1,D14.2,
D14.3,D14.4. Flags OFF outside QA/shared_analysis FALSE/CEFR OFF;real2914 applied0.
Local-only/uncommitted;no model-picker switch or independent human reviewer claimed.
Model supports High per [official model documentation](https://developers.openai.com/api/docs/models/gpt-6-astra).
