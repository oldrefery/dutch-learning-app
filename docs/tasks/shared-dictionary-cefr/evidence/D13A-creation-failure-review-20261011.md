# D13A.7.5 — Failed judge and budget review

**2026-10-11 — D13A.7.5 failed judge/budget review complete; CJR-1 P2 repair next.**

Owner confirmed GPT-6 Astra / High. CJR-1 P2: provider checks schema allows repeated
dimensions,so the exact invalid response satisfies that schema despite the prompt's
six-distinct requirement. Strict parser/runner behavior is correct: raw reply saved,
third call stops,zero retries,no generation,no qualification. CRR-1 remains closed.

Fresh3 offline review tests pass,including exact raw-response mock replay through
the runner and refusal to settle an incomplete run as complete. JSON Schema2020-12
probe confirms current schema and uniqueItems both accept the bad reply; proposed
six prefixItems with singleton dimension enums reject it,accept2 saved valid replies,
and reject12 duplicate plus4 missing/extra mutations. Provider support is documented;
the proposed request has not been measured. No runtime source or provider file changes.

Budget arithmetic accepted:3 returned requests,3832 input+5120 output including thinking,
USD0.022074 reported cost,invoice unverified. All3 outcomes known; no new unknowns.
Current full13.44 reserve is correct under the existing completed-only settlement
contract. Current day commitment14.2542535,remaining0.7457465. No ledger change.
Technical review accepts22,074,000nanousd as the basis for a distinct reviewed-terminal
settlement after its implementation/tests/review. This could release13.417926 and
leave total commitment0.8363275/remaining14.1636725,including the old0.28 reservation.
Those are prospective numbers,not currently spendable funds. Never renew the claim.

Next **GPT-6.1 Sol / High**: fix CJR-1 in creation judge schema/prompt,retain the strict
parser,add the real-response regression; implement explicit reviewed-terminal accounting
with complete journal/binding/charge verification,immutable one-use claim and no network.
Keep the direct-analysis request/policy behavior intact. Prepare a new immutable packet,
then Astra/High reviews code/packet/reconciliation before any new paid pilot. Review the
saved accounting contract; do not fabricate successful completion or release via hand edit.

AUTH-33 already covers today's pilots/paid checks within aggregateUSD15 until22:00Z;
no repeated payment question,no automatic retry/rollover. AUTH-33-CREATION-01 stays
consumed. This review adds no paid call,key access,live settlement or external operation.
Creation2/4,D13A.7 fixed4/6,8 broad milestones unchanged; direct-analysis pilot complete.
All688 entry dirty paths preserved;690 total,local-only/uncommitted. Five task notes and
this evidence pair updated;426 source files,36 packet sources,195 old and9 new provider
journal files unchanged. Flags OFF outside QA,shared_analysis FALSE,CEFR OFF;
real2914,eligible/approved/applied0. No pending operation,commit,push or deployment.

## Finding CJR-1 — P2: Encode each required dimension in the provider schema

Location: `supabase/functions/dictionary-analysis/responseSchemas.ts:104-109` as used
by creation's generationConfig in `supabase/functions/dictionary-creation/geminiModel.ts`.
The six-element checks array gives every item's dimension the entire six-value enum.
Thus repeated dimensions and omitted checks are schema-valid. The actual third reply
has two translations-ru entries and no examples entry. JSON Schema validation accepts
it,while parseSemanticVerdict correctly returns null. This prematurely aborts a paid
qualification run and blocks progress. No incorrect verdict was accepted or published.

The third entry's reason discusses examples; changing only its dimension to examples
in a disposable diagnostic copy makes the strict parser accept it. This isolates the
structural label defect. The original reply is unchanged and remains invalid; do not
repair provider evidence or infer acceptance from its reason text.

Recommended local repair: creation-specific six-position prefixItems,each with a
singleton dimension enum,plus minItems=maxItems=6 and explicit order in the creation
prompt. Preserve common per-check fields and strict runtime validation. Do not alter
the direct-analysis request/policy behavior just to fix this creation measurement.
An ordinary uniqueItems constraint is insufficient because the two duplicate-dimension
objects have different reasons/quotes. The local proposed schema rejects the bad reply,
accepts both saved good replies and rejects all tested duplicate/missing/extra cases.
Gemini documents [prefixItems support](https://ai.google.dev/gemini-api/docs/generate-content/structured-output).
Actual provider acceptance of the new request still needs a reviewed new packet and
measurement. A more invasive named-object wire format is unnecessary for this repair.

## Budget disposition

All3 new dispatches have exact request bindings,durable raw results,matching hashes,
exact modelVersion3.6,standard service tier and STOP finish reason. Per-response total
tokens equal prompt+candidates+thoughts. Charges are0.0072105,0.007185,0.0076785 in
dispatch order; total0.022074. Official [standard pricing](https://ai.google.dev/gemini-api/docs/pricing)
confirms0.75/M input and3.75/M output including thinking through2026-12-31.
No billing invoice was verified. Prior0.5342535 reported+0.28 unsettled remains0.8142535.
New spending is included within the13.44 reservation,not added on top of it.

The current reservation is conservative and consistent with the reviewed contract;
it is not a billing charge or an accounting defect. A stopped process with three fully
known outcomes can be reconciled in principle,but the current settlement reader requires
a completed48-result sealed replay. The mocked attempt to settle a partial replay as
complete is rejected. Do not hand-write a regular settlement,remove the allocation or
rename termination as completion. The permanent authority remains consumed forever.

The exact22,074,000nanousd cost is accepted as the technical basis for a separately
implemented reviewed-terminal settlement. Its full contract and exact evidence hashes
are in `reports/shared-dictionary-cefr/d13a7-creation-failure-review-20261011/reconciliation-review.json`. It must enumerate the entire journal,verify
one outcome per dispatch,no gaps/extras/conflicts,all raw/request/authority/run/packet
bindings,versions,tier and usage; independently derive charges; acquire shared lock;
write once durably; refuse stale/tampered evidence; preserve the one-use allocation.
Unknown/missing outcomes cannot use this known-outcome release path. Accounting for
old frozen evidence must not depend on regenerating that old packet from edited current
sources. Current replay intentionally pins current sources and is insufficient for
that future archival accounting use. Semantic qualification remains incomplete.

No reconciliation applied now. Current commitment14.2542535 and remaining0.7457465 are
authoritative. After a verified22,074,000nanousd terminal settlement,the released amount
would be13.417926,aggregate commitment0.8363275 and remaining14.1636725. A new13.44 full
reserve could then fit with0.7236725 spare if authority/time still permit. These numbers
are prospective; no new dispatch or permission renewal follows automatically.

## Fresh checks and preservation

- Cached/typechecked Deno review probes:3/3. Exact bad raw envelope reparses identically;
  parser failure isolated to duplicate label; raw evidence unchanged. All token components
  and historical/current ledger arithmetic reconcile. Mock runner stops after3 actual
  saved envelopes,retains13.44 and rejects same-authority reuse before another factory.
  A fake completed settlement from partial evidence fails. Temporary mock files removed.
- Independent Python jsonschema Draft202012 validation: actual response accepted by old
  schema and by uniqueItems; rejected by prefixItems proposal. Two valid replies accepted;
  12 duplicate and4 missing/extra mutations rejected. No provider call.
- Entry4397 hash references verified; only five task notes intentionally changed;
  4392 previous references preserved. All426 source/36 packet/195 old/9 new provider
  file bindings and original shared allocation unchanged.688 entry dirty paths preserved,
  690 final. Old51+4 tests and3 process-kill probes retained,not rerun this review.
- No network or environment permission for Deno probes; documentation retrieval only.
  No key access,paid execution,live settlement,commit,push,hosted or runtime operation.

Commands/logs are in `reports/shared-dictionary-cefr/d13a7-creation-failure-review-20261011`: `schema-probe.py` via python3; `review-probes_test.ts` via
`/Users/devrush/.deno/bin/deno test --cached-only --unstable-detect-cjs --config supabase/functions/deno.json --allow-read --allow-write`.
See `schema-probe.log`,`review-probes.log`,`sources.md`,the local schema proposal and
companion manifest. Recommended next model is GPT-6.1 Sol / High for local CJR-1 and
terminal-accounting implementation,then GPT-6 Astra / High code/new-packet review.
