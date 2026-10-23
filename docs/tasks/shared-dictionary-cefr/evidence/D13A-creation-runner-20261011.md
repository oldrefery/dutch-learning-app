# D13A.7.5 — Bounded creation pilot runner readiness

Date:2026-10-11. Local implementation complete; prescribed execution review pending.
No paid request,credential access,live allocation or runtime activation occurred.

## Implementation and exact packet

Eight new files under `scripts/shared-dictionary/creation-pilot*` provide the execution
packet,exclusive journal utilities,token-accounting checks,daily budget,runner,replay,CLI
and21 failure/lifecycle tests. Existing source files remain unchanged. Transport,prompts,
schemas,corpus and creation grant adapter remain the previously reviewed implementation.

Execution packet:`reports/shared-dictionary-cefr/d13a7-creation-runner-20261011/candidate-packet.json`.
Canonical SHA256:`dba036688086857d23dd8b705e4610faab2151c5cf788ab5987c745b4991ec02`.
Policy remains`b9c2515d5fbaebbc25f798292a9cae62a4780b96993de940fbfc6da529a7f827`.
Readiness packet remains`5c37f3240a54271eff1a615d436b3171ebdcea698bc163f6c99ca71249c36d29`.
The new execution contract binds36 source digests,195 historical provider files and strict
completion requirements. Exact audit confirms requests,profile and corpus unchanged.
The proposed3.8 generator/3.6 judge observed pins remain unmeasured. Qualified:false,
approved_for_execution:false. Packet sources include the reused exclusive/fsynced writer
and semantic summary helper; no old CLI paid execution is reused for this workflow.

## Lifecycle and guards

Authority is a separate explicit reviewed creation receipt bound to this exact packet,
local Amsterdam day/deadline,USD15 aggregate ceiling,48 maximum calls,no retries,personal
Google project and distinct judge acknowledgment. Exact fields reject extra data. The
receipt format is an execution guard; it is not evidence that the owner has issued it.
No such live receipt was created. AUTH-32 continues to cover its recorded direct-analysis
scope only. Local preparation/review needs no new payment question.

Preparation and verification use cached Deno with read permission and report-directory
write permission only. Run mode reads `DICTIONARY_ANALYSIS_GEMINI_API_KEY` from the environment
only after exact packet/source/history/authority checks and durable full allocation.
No .env file reader or credential printer is added. Production transport reuses the
existing one-call bounded HTTP implementation. Pilot probes do not invoke hosted SQL,
publication,real-user cards,devices,release flags or a production endpoint.

The CLI uses fixed `reports/shared-dictionary-cefr/creation-pilot-day-budget` for cooperating
creation runs. Exclusive budget.lock serializes allocation/execution/settlement. Existing
locks refuse; stale lock removal/reconciliation is manual. All historical dispatches are
reconstructed from sealed receipts for the authority's actual local day. New allocations
are scanned under the same lock. Known standard returned usage can settle cost; invalid
or missing historical accounting retains0.28 per attempt. Integer nanodollars avoid float
summation. The historical95 attempts reconstruct0.8142535 including one0.28 failure reserve.
No invoice or unrelated Google-project usage is claimed verified.

A full48-call reserve(13.44) is written exclusively before the transport factory/key.
New run directories must not exist. Per-row intent includes packet/phase/full prepared
request and both SQL-grant/provider-request hashes,then raw result/request ID/result hash
is fsynced before version/usage/schema/scoring. Synthetic fixture run/fence IDs are shared;
unique packet row IDs name journals and transport attempt IDs. Returned wrong versions,
malformed content or missing/out-of-bound/non-standard usage stop after durable storage.
Known/unknown/thrown provider outcomes get a failure journal and stop without retries.

Rate limiting counts recent historical and allocated-run dispatch times plus this run,
with10 calls per61-second window. Authority receipt/source hashes/deadlines are rechecked
before each new dispatch and after waits. In-flight requests use the existing bounded
transport timeout; no new request begins after expiry. Deadline does not establish that
an already dispatched provider operation was cancelled.

Contingent judges derive only from actual returned generation envelopes,with freshly
computed content/result hashes and generation grant hash. Invalid identity/media/schema
prevents that judge call. Completion requires all40 fixed judges,all4 generated/judged
pairs,48 returned responses,2 structural guards and valid phase versions/usage. Threshold
pass additionally requires the frozen fixed scores and every generated judge same-meaning.
A partial run or a failed generated pair cannot hide behind passing fixed-case scores.
Reports remain qualified:false and require subsequent result review.

Only a complete sealed replay can write settlement. The allocator rechecks every retained
file hash and replays raw envelopes/grants before rederiving charge; edited settlement
values cannot free budget. An interrupted/failed/incomplete run retains the full allocation,
including unused capacity,until explicit reconciliation. This is deliberately conservative.
Locks are released on caught termination; a hard kill leaves its lock/reserve for inspection.
Run mode never resumes or redispatches an existing journal. Replay reconstructs locally,
checks exact packet/dispatch/result/seal bindings and refuses extra or modified evidence.

## Verification

Fresh Deno38/38 with typecheck:21 new runner tests plus3 existing creation-packet tests and
14 existing adapter tests. New tests cover complete48-call mocked runs,unique IDs,rate waits,
o-network replay,attempt reuse refusal,wrong observed version,missing usage,invalid verdict,
known/unknown/thrown outcomes,scope/review/expiry/source/budget/lock preflight refusal,
95-attempt historical reconstruction,changed/missing seal,expiry during wait,unsupported
billing cases,generated semantic failure,wrong generated lexical identity,settlement charge
tampering and changing authority mid-run. All temporary run/budget directories removed.
No env/network permission and no real key were needed for tests.

Command:`/Users/devrush/.deno/bin/deno test --cached-only --unstable-detect-cjs --config supabase/functions/deno.json --allow-read --allow-write scripts/shared-dictionary/creation-pilot_test.ts scripts/shared-dictionary/creation-qualification_test.ts supabase/functions/dictionary-creation/geminiTransport_test.ts`.
CLI prepare and verify both ran with --check and cached dependencies,without env/net
permission. Preparation wrote only the new report directory;verification was read-only.
Scoped ESLint0 warnings,Prettier and git diff check pass. Prior170 other Deno cases and
PostgreSQL15/15 remain source-bound historical checks; no fresh SQL/device/full-suite claim.

Initial check found the existing scorer's broad observed-version return type; replay now
narrows it locally without editing old sources. ESLint identified unused imports,duplicate
literals and complex functions; helpers reduced them without suppression. An attempted
`deno check --cached-only` flag was unsupported; cached `deno run --check` prepare/verify
successfully typechecked the CLI instead. All failures are terminal local checks retained
in logs; no provider retry,paid operation or pending runner.

## Next checkpoint and fixed progress

Next GPT-6 Astra / High: review this exact runner,authority/locking/budget/timing,journals,
contingent generation pairs,scoring/completion,settlement/replay and packet source/history
bindings. Local review requires no paid request. After accepted execution review, reconcile
actual owner's creation/distinct-judge authority and then-current daily aggregate allocations
before credentials/dispatch. No payment question was asked in this implementation turn.
No approval should be inferred from a valid packet hash or the readiness review alone.

AUTH-32 remains October11 direct-analysis scope until22:00Z,USD15 aggregate,no repeat
same-scope payment questions. Day committed0.8142535/remaining14.1857465 unchanged; a13.44
creation reserve would conditionally fit at14.2542535,but no live reserve or permission was
created. Packet's historical cost illustration does not override fresh ledger calculation.

Creation track fixed4 deliverables:2 complete(preparation,accepted readiness review),2
remain(measurement,final result review). Execution preparation inside measurement is now
complete;execution review/authority reconciliation/actual measurement remain. No new
numbered milestone added. D13A.7 fixed4/6 complete,2 remain;8 broad milestones. Completed
direct-analysis pilot remains complete with0 remaining substeps.

Entry4258 references/668 paths verified. Only eight new source/test files,five task notes
and this evidence pair change;678 paths local-only/uncommitted. Previous418 source union,
142 web/449 browser and94+3+98 provider files unchanged. Source union now426. Flags OFF
outside QA,shared_analysis FALSE,CEFR OFF;real2914,eligible/approved/applied0. Pending0.
