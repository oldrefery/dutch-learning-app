# D13 real-snapshot mapping rehearsal — October 4, 2026

Status: snapshot-bound local rehearsal passed; no production publication or personal linking.
Model: GPT-6 Astra / High. No independent review agent is claimed.

## Immutable source proposal

The previously approved official release passes its existing offline artifact
validator:21 packs/2053 entries, aggregate
`5e02d4e1e02c1d56222ced6dca23f720a479e991f16c0af13bc124de707ac90b`.
Original manifests and review ledger remain immutable. The existing shared
`officialEntryToDictionaryContent` adapter produces2053 D04-valid contents,
with2053 distinct content hashes and stable proposal resolution/source UUIDs.
No wording was generated or edited; no provider was called.

Private proposal: `reports/shared-dictionary-cefr/d13-mapping-rehearsal-20261004/source-proposal.json`.
Exact SHA256: `4d54ba82661604b7b5f0e70d2126b988daadaeb8ccb370e4c19192b6c713166d`.
Each entry retains the original pack/version/entry identity and manifest hash,
complete license/provenance/content-review metadata, canonical D04 content and
separate CEFR-input hash. Proposed source kind is licensed, review state pending.
There are zero meaning-level CEFR assessments; pack levels are not converted.
This is a reviewed mechanical proposal, not new publication authority or a new
license claim. New hosted source approval/publication remains a final-release gate.

## Isolation and preservation

The pre-preparation backup `builds/d13-preparation-backup.2ebz4aqm/database.sql`,
SHA256 `0ee03456a6c6b232b1174d9ca0811c2d267c68ae13dcd1bb8ef990d074165414`,
is mounted read-only in a new PG17.6 container with network none, no ports and
only tmpfs database storage. All56 original table digests match after restore.
The nine already deployed migration files are applied only to this old local
snapshot, followed by administrator-only D06 tooling. No live operation is replayed.

A synthetic reviewer and its trigger-created profile/default collection exist only
inside this disposable copy. Local fixture source approval permits a hypothetical
publication rehearsal; portable sources remain pending and no human approval is
fabricated. Preserve every original public personal/learning column, allowing only
new dictionary references and delivery updated_at changes during bounded apply.
Private row reports and resolved P1/P2 identifiers stay in ignored reports.

## Local attempt history

1. First preservation assertion compared the snapshot from before synthetic reviewer
   creation with the seeded state. Auth triggers create the reviewer's public profile,
   access level and default collection. This was a harness baseline error, not a
   demonstrated personal-data mutation. Container removed; original backup retained.
2. After correcting the fixture baseline, all2053 revisions matched the independent
   SQL projection of the original published packs, with zero CEFR assessments.
   A single2053-row official-mapping insert hit the120-second statement timeout
   while validating canonical manifest JSON. That transaction rolled back; container
   removed. No application or SQL schema source was changed.
3. The third runner uses separate25-row official-mapping transactions, a30-second
   statement limit, explicit resolution IDs and per-batch progress receipts. Personal
   mapping apply remains at most50 rows per transaction. Each call opens a fresh
   connection, preserving durable progress rather than a connection-local cursor.

4. Attempt3 completed all2053 mappings in83 bounded transactions and classified
   both cohorts, then failed because the harness assumed at least one real safe
   match. There were zero. No real row was linked; all original protected fields
   still matched. This was an invalid harness assumption, not permission to weaken
   matching. Container removed.
5. Attempt4 accepts zero matches, independently reproduces cohort classifications,
   and diagnoses differences by field name/count. It reuses attempt3's completed
   mapping validation evidence without repeating83 unchanged transactions. A new
   synthetic card from official content is scoped separately for the positive
   apply/review/rollback test; no real card is rewritten to create a match.

## Verified results

| Cohort | Total | Safe match | Possible match | Missing source | Private only | Excluded |
| ------ | ----: | ---------: | -------------: | -------------: | -----------: | -------: |
| P1     |  2344 |          0 |           2003 |            322 |           17 |        2 |
| P2     |   570 |          0 |            462 |            107 |            1 |        0 |

Both reports have zero unplanned or changed/missing rows. Planning and zero-item
apply preserve all14 original personal/learning tables (original columns; word
updated_at excluded from the comparison). Sources match all2053 independent SQL
projections; no CEFR assessments exist. All56 original table digests match restore.

Closest-candidate comparisons show real differences: P1/P2 translations573/140,
examples580/145, dutch_original1962/454 and register1727/454. Counts overlap; closest
candidates are diagnostic only, never a semantic-match assertion. Automatic
normalization or spelling-only association would bypass the accepted safeguard.
Retain all2914 existing cards unchanged and unlinked for the release proposal.
Future approved imports/analyses may reuse shared content through the new protocol;
existing ambiguous/private/missing-source cards retain their legacy content.

The separate synthetic positive control has exactly one safe match, one applied
reference and one authenticated post-link review. Disabling dictionary reads keeps
the entire post-review protected snapshot and that event unchanged. This proves the
rollback mechanism on the real restored schema, not a real-cohort linking success.
No backup was restored over later reviews. Runtime changes existed only locally.

Final private receipt:
`reports/shared-dictionary-cefr/d13-mapping-rehearsal-20261004/attempt-4/operation.json`.
Phase local-apply-read-rollback-verified, container_removed=true, production_writes=0.
Original backup, source proposal, all attempts and private reports remain protected.
No local mapping operation is running or uncertain. Existing Android QA remains.

## Remaining release gate

This result is bounded to the saved snapshot and a zero-personal-link release
proposal. D13.5 still needs final current delta and exact publication packet; D13.6
still needs final functional-release approval. Source approval/publication, native
build/distribution, client/server flags, personal linking and CEFR activation are
not authorized by source PR/merge. A dormant web deployment from the existing Git
integration keeps DICTIONARY_CONTENT_ENABLED absent/false.
