# D13A.7.5 — Provider repair re-review

Date: 2026-10-11. User-confirmed Astra / High. No new actionable findings.

**2026-10-11 local — D13A.7.5 provider repair re-review passed.**

SEM-PROVIDER-01 and SEM-PROVIDER-02 are closed after source/test/packet review.
No new actionable finding. APPLICATION_JSON matches the saved Discovery20261010
wire contract for all44 fixed and4 contingent requests. Diagnostics contain only
bounded allowlisted statuses/fields and synthesized messages. Original evidence hash,
uncertainty classification, request limits and no-retry semantics remain intact.
Fresh cached Deno170/170 with typecheck passes. Seven additional mocked review cases
cover missing/broken/oversized bodies and durable400/408/503 failure/resume; all pass.
Five scope-tampering probes reject before transport/credentials. Exact packet and17
sources match; no runtime/test/corpus/policy/packet changes in this review.

Reviewed packet: `e833fbc991f9e2ed066a09c3f79213362836a4c4f996024ac6b104c5832c76de`.
42 cases,48 requests/USD15 ceilings,USD13.44 maximum reservation,0 automatic retries,
expiry2026-10-18T00:00:00Z. Ready to propose a separately authorized direct-analysis
pilot; not authorized for execution and not qualified. Creation/publication/devices/
activation excluded. AUTH-30/31 consumed; no paid call or key access in this review.
Historical rejection cause remains unproven.94 old provider files and3 AUTH-31 journal
files are immutable;46-response offline replay carried with verified hashes.

D13A.7 fixed4/6 complete,2 remain;8 broad milestones. Inside checkpoint5 two existing
packages remain: exact scoped measured qualification, then final failure/evidence
review and scoped decision. Local preparation and prescribed re-review are complete;
passing this direct pilot alone does not qualify excluded workflows. Next **GPT-6.1
Sol / High** for one exact pilot only after fresh explicit authority, then **GPT-6
Astra / High** to review its result. No paid approval has been inferred from continue.
653 local-only/uncommitted paths;651 entry paths preserved. No pending runner/external
operation. Flags OFF outside QA/shared_analysis FALSE/CEFR OFF;real inventory2914,
eligible links0, approved/applied0.

## Review disposition

SEM-PROVIDER-01 (P1), closed: shared jsonGenerationConfig now emits the direct REST
APPLICATION_JSON enum. The independent saved fixture matches the full public Discovery
revision20261010 projection exactly. Both generation and semantic builders use that
config; both configs enter the policy hash. Forty-four fixed and four contingent
requests pass a fresh independent field/type/enum audit, and all48 request hashes
recompute correctly. HTTP Content-Type remains application/json. Full domain/meaning
and observed-version guards remain enforced. Fixture source is previously retained
public documentation; no new online request is needed for this unchanged dated packet.
Nested output schema uses Discovery type:any, so this limited audit cannot establish
live provider acceptance. The documented guide discrepancy remains; the historical failure cause is unproven.

SEM-PROVIDER-02 (P2), closed: providerDiagnostics returns only constants or paths from
finite allowlists plus the HTTP status. It never copies arbitrary message/description,
status, path, exception text or response headers. Known snake-case paths normalize to
known camel-case paths; unrecognized/private schema paths are discarded. At most8
unique field hints are retained. Transport bounds response bytes before parsing.
Synthesized messages trade verbatim detail for safe operator diagnostics, as documented.

Known4xx except408 retains the original exact status/body SHA256 algorithm.408/5xx and
incomplete/oversized bodies remain unknown with null hash, even when a claimed Google
status says INVALID_ARGUMENT. Available HTTP diagnostics survive missing/broken body
reads. Network and timeout exceptions remain redacted; no retry or redirect is added.
The runner stores failure.json before raising its fixed error, releases its lock and
refuses redispatch on resume. Existing analysis/creation worker boundaries forward only
the prior kind/hash arguments and do not expose diagnostics in ordinary client receipts.
The new production helper is included among17 frozen sources; a diagnostic source edit
invalidates the frozen approval packet. Public RPC/SQL signatures remain unchanged.

## Fresh verification

- Cached Deno170/170 with typecheck across the8 focused suites; no env/network permission.
- Four additional transport probes: missing body400/503, broken stream400, oversized400.
  All preserve unknown classification and status without leaking fixture secrets.
- Three durable runner probes400/408/503: one mocked call each, safe diagnostic retained,
  unchanged failure bytes on resume, no redispatch, no completion report, lock released.
- Five independently mutated execution-scope packets reject before transport factory.
- Exact packet canonical hash,17 current source hashes and48 request hashes verified.
- Independent wire audit48/48; saved fixture agrees with official Discovery snapshot.
- Corpus42, labels, limits, thresholds and execution scope remain as previously reviewed.

No runtime, production test, corpus, policy, fixture or packet bytes edited. All4024
entry evidence references verified before review. Source union411, web boundary142,
browser app449 and old94+3 paid journal files preserved. Old46-response replay is carried
from the last repair with unchanged hashes; it is not new-provider qualification.
SQL/device/client/full-suite checks are historical only, not rerun. No new provider call,
credentials access, external write, commit, deployment, billing/account or flag change.
The7 mocked review scenarios and5 scope-tampering probes are separate from170 suite tests.
No unresolved tool/test failure or pending operation.

## Concrete next step and authority boundary

The exact reviewed packet is
reports/shared-dictionary-cefr/d13a7-semantic-provider-repair-20261011/candidate-packet.json,
SHA256 e833fbc991f9e2ed066a09c3f79213362836a4c4f996024ac6b104c5832c76de.
Request a new one-off pilot authority for this unchanged packet in the personal Google
project: at most48 requests and USD15, no automatic retries, expiry as encoded above.
Use a new journal directory, recheck all packet/source hashes before reading credentials,
and stop on the first failed/unknown result. Prior AUTH-30/31 cannot be reused. Do not
start until the user explicitly authorizes; a model switch or continue is not payment
approval. No new authority identifier or approval receipt is created by this review.

Next execution model GPT-6.1 Sol / High after authority; result review GPT-6 Astra / High.
The two existing checkpoint5 packages remain measurement and final evidence/qualification
decision. Separate compatible creation workflow evidence remains necessary before any
broader checkpoint5 completion claim. Fixed4/6 and eight broad remaining milestones are
unchanged; this review completes the existing local preparation prerequisite.
