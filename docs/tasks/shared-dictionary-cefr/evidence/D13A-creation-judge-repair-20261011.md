# D13A.7.5 — CJR-1 repair and reviewed-terminal accounting

**2026-10-11 — D13A.7.5 CJR-1 locally repaired; terminal calculation/new packet await review.**

Owner confirmed GPT-6.1 Sol / High. Creation judge now uses six fixed prefixItems with
singleton dimension enums and explicit prompt order. Shared direct-analysis schema,
prompt,policy behavior and strict verdict parser are unchanged. CJR-1 is locally repaired,
pending Astra/High review; CRR-1 remains closed. No provider reply was edited or accepted
retroactively. Creation profile/prompt/request hashes changed and are bound in a new packet.

New offline terminal accounting verifies a pinned review,permanent allocation,exact raw
authority/run/frozen packet,complete directory inventory,ordered fixed-judge prefix,
one returned outcome per dispatch,request/result hashes,model/tier/token components and
independently derived charges. It does not regenerate old packets from changed sources.
Explicit apply rederives the exact pinned calculation under the shared lock and writes
a separate reviewed-terminated settlement once; it never renews authority or qualification.
Scope is reviewed,known returned fixed-judge prefixes only; other failed/unknown runs
retain the full reserve. Existing completed-run settlement checks remain intact.

Fresh cached/typechecked Deno71/71(34 runner+3 qualification+18 terminal+14 adapter+2 schema),
ESLint0 warnings,source formatting,diff and exact CLI prepare/verify pass. Independent
JSON Schema validation rejects the actual bad reply and12 duplicate/4 size mutations,
accepts both good replies. Maximum prepared request7330 bytes. All42 sources,195 historical
files and unchanged corpus/guards/thresholds/models/scope verified; generation prompt/schema
unchanged. New schema support is documented; provider acceptance remains unmeasured.

New packet `b7eda62bb37e7ba9c596d6d62ea2225a16803b27b35a3271584ac5c5e152d4a1` is immutable,qualified FALSE,approved_for_execution FALSE.
Exact terminal calculation `07c2af7cff205bf34c1c7847edf79a83a97b668383beda0f51a34019fc84acd9` prepares USD13.417926 release and
USD0.022074 retained charge. Current live ledger unchanged:USD14.2542535 committed,
USD0.7457465 remaining. After reviewed application only:USD0.8363275 committed,
USD14.1636725 remaining,including the olderUSD0.28 unsettled reservation. Invoice unverified.

Next **GPT-6 Astra / High**: review CJR-1 repair,terminal evidence/application/budget guards,
20 new regressions,exact new packet and exact calculation. No live settlement or paid
pilot before this review. AUTH-33 already covers today's pilots/paid checks withinUSD15
until2026-10-11T22:00:00Z; do not ask payment again within that scope/day/budget. No rollover.
AUTH-33-CREATION-01 remains consumed. No new paid call,key access or live settlement here.

Creation2/4,D13A.7 fixed4/6,8 broad milestones unchanged; direct-analysis pilot complete.
All690 entry dirty paths preserved;698 total,local-only/uncommitted. Four existing sources
modified,six sources/tests added;five task notes/evidence pair updated. Original195 provider
files,9 failed-run files and live allocation unchanged. Flags OFF outside QA,shared_analysis
FALSE,CEFR OFF;real2914,eligible/approved/applied0. No pending operation,commit,push or deployment.

## Implementation and scope

`dictionary-creation/responseSchema.ts` derives a creation-only schema from the existing
semantic schema. Six prefixItems each restrict dimension to one value; array bounds and
strict per-check fields remain. The creation prompt specifies order. The shared schema,
semantic prompt/parser and direct-analysis implementation are byte-unchanged. Provider
request/profile hashes are regenerated; no original response is transformed into accepted
evidence. Future schema compliance does not imply semantic qualification.

`creation-terminal-evidence.ts` verifies regular pinned files,exact review bytes and
authority allocation identity,receipt/run/frozen packet bindings and full run inventory.
Only a reviewed stopped prefix of1..40 fixed judges with a returned result for every
dispatch is supported. It verifies original order/timestamps/deadlines,request and result
hashes,raw-response reparsing,response IDs,observed model,standard tier and token component
sums including thinking,then independently recomputes charge and release. Failure or
unknown files,gaps,extras,changed bindings,missing usage and unsupported phases refuse.
No regeneration of the old packet from current sources is required. Reviewed hash references
are local operator evidence,not signatures against arbitrary privileged file replacement.

`creation-terminal-settlement.ts` prepares a calculation under the shared lock using the
current source-bound packet,historical ledger and all allocations. It prevents overlapping
historical accounting and records before/after balances. Explicit apply takes the exact
calculation file SHA256,rechecks every input/current balance under the lock and writes an
exclusive durable settlement. Repeated application refuses; claim file remains unchanged.
`creation-pilot-budget.ts` separately verifies this settlement kind on each accounting read;
completed-run settlement requirements are preserved. No provider/credential API is involved.

CLI review commands (already executed):

```text
creation-pilot-cli.ts prepare reports/shared-dictionary-cefr/d13a7-creation-judge-repair-20261011/candidate-packet-final.json
creation-pilot-cli.ts verify reports/shared-dictionary-cefr/d13a7-creation-judge-repair-20261011/candidate-packet-final.json
creation-terminal-cli.ts prepare reports/shared-dictionary-cefr/d13a7-creation-judge-repair-20261011/candidate-packet-final.json reports/shared-dictionary-cefr/d13a7-creation-failure-review-20261011/reconciliation-review.json 2a21c1cfda010fef5ee01cfdcdfd1cfc2bae2589176fa99466630972758f0c00 reports/shared-dictionary-cefr/d13a7-creation-judge-repair-20261011/terminal-calculation-final.json
```

All used `/Users/devrush/.deno/bin/deno run --cached-only --check --unstable-detect-cjs --config supabase/functions/deno.json --allow-read`;
write permission was limited to the new report directory and shared budget lock for calculation.
No apply command ran on the live ledger. After prescribed review,the separate `apply <packet>
<calculation> <calculation-sha256>` command must pass the same exact verification. Its current
calculation file hash is `07c2af7cff205bf34c1c7847edf79a83a97b668383beda0f51a34019fc84acd9`. Editing code/evidence or changing the
budget makes a stale calculation refuse; reprepare and review any changed artifact.

## Verification

- Fresh cached/typechecked Deno71/71:34 runner,3 qualification,18 terminal,14 creation
  adapter and2 schema tests. Command: `deno test --cached-only --unstable-detect-cjs --config supabase/functions/deno.json --allow-read --allow-write`
  with creation-pilot_test.ts,creation-qualification_test.ts,creation-terminal_test.ts,
  dictionary-creation/geminiTransport_test.ts and dictionary-creation/responseSchema_test.ts.
  -20 new cases cover the saved invalid/valid replies,all prepared judge schemas,old frozen
  packet accounting after source repair,no live change on prepare,exact release,concurrent
  apply,repeat refusal,claim reuse before credentials,tampered settlement,unknown outcome,
  inventory extras/gaps/conflicts,request/raw/result/model/usage/review/run/packet/termination
  tampering,existing lock,changed calculation/review and stale ledger. Apply tests use only
  disposable mock ledgers; all temporary directories removed.
- Independent jsonschema Draft202012 validates the actual new provider schema: rejects
  original invalid reply and12 duplicate/4 size mutations; accepts2 saved valid replies.
  `audit-packet.py` also verifies corpus/guards/thresholds/scope/models/history unchanged,
  all42 source bindings and max request7330 bytes. Generation prompt/schema unchanged;
  generation input binding hashes change with the new creation policy as expected.
- Scoped ESLint0 warnings,Prettier and git diff --check pass. Full client/SQL/device suites
  were not rerun; no app/client/migration changes. Prior live provider results remain
  historical and do not qualify the new prompt/schema. Current documentation's prefixItems
  support was established in the linked failure review; no new paid compatibility probe.
- Earlier attempts retained: `deno check --cached-only` refused its unsupported flag before
  checking; first new-test compile found a string/literal enum comparison and was corrected;
  initial lint found duplicated literals/test complexity,refactored without suppression.
  The intermediate18 new tests passed; final71 pass after all final source changes.

## Accounting and review boundary

Original allocation and9 failed-run files remain byte-identical. Current reserve13.44,
new known charge0.022074,release candidate13.417926. Current aggregate14.2542535/remaining
0.7457465. Prospective after reviewed application0.8363275/14.1636725 includes historical
0.5342535 reported and0.28 unsettled; no invoice claim or double counting. All figures are
nanodollar integers in the calculation. AUTH-33-CREATION-01 remains consumed. AUTH-33 day
scope covers today's reviewed paid checks up to aggregate15 until22:00Z,no repeated payment
question,no automatic renewal. Local review/calculation needs no paid call.

Entry4413 reference hashes verified; four old source paths and five task notes intentionally
changed,4404 prior references preserved. Six source/test additions yield432 current source
bindings and42 packet sources.195 historical provider files,9 failed-pilot files and live
allocation unchanged.690 entry dirty paths preserved;698 final. No commit/push/hosted action.
Next Astra/High reviews exact source,packet,calculation and failure cases before live
reconciliation or any new one-use pilot. CJR-1 is locally repaired,pending review; CRR-1 closed.
