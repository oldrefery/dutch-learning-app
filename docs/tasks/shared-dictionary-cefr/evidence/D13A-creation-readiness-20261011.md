# D13A.7.5 — Creation profile, transport and qualification readiness

Date:2026-10-11. Local preparation complete; prescribed review and provider measurement pending.

## Prepared implementation

`supabase/functions/dictionary-creation/geminiModel.ts` constructs an explicit creation
profile with distinct requested models and distinct expected observed versions. Its
independent-v3 policy hash includes the creation workflow, request mapping version,
generator/judge prompts, schemas/configuration, output template, observed pins and
no-redispatch contract. The judge prompt hash is also bound by the server grant. No
existing analysis policy or database migration is changed; the new creation profile
must be separately registered only after accepted qualification/activation authority.

`geminiTransport.ts` adapts committed grants to the existing single-call bounded HTTP
transport. The worker first parses the grant against its current run/receipt and profile;
the adapter rechecks model/profile/input hash, canonical BIGINT fence and judge prompt
binding before mapping the grant. It transmits only the committed creation input, never
private resolution hints or caller authorization. The SQL grant hash remains separately
available from the canonical provider/model/body request hash. SQL journalling continues
to use the former; the packet/audit binds the latter. Requests are bounded to32768 bytes.

Generation uses protected identity/anchor data; judgement uses the committed candidate,
anchor and bound content/result hashes with six evidence dimensions. All strings remain
data rather than instructions. Both responses use APPLICATION_JSON with the existing
strict schemas, single candidate and8192 configured output tokens. The adapter returns
raw envelopes and observed versions for durable journalling. Wrong versions must be
recorded and refused by SQL, not discarded or treated as permission to repeat a call.
Transport remains explicitly injected with no env reader,serve entrypoint or live default.

## Proposed model choice and documentation

Generator requested/expected `gemini-3.8-flash`; judge requested/expected
`gemini-3.6-flash`. These are proposed pins, not observed qualification evidence.
[Gemini3.6 documentation](https://ai.google.dev/gemini-api/docs/models/gemini-3.6-flash)
currently documents a stable distinct model with structured output and65536 output limit.
[Gemini3.7 documentation](https://ai.google.dev/gemini-api/docs/models/gemini-3.7-flash)
says its requests are automatically routed to3.8, so3.7 was excluded. Context7's earlier
model table lacked this deprecation; primary-source verification resolved the discrepancy.
Future measurement must stop/review any mismatch; aliases do not prove independence.
A Pro judge would change both profile/budget and its qualification target; it is not
silently substituted. The prepared Flash pair preserves the proposed bounded pilot size;
its actual semantic adequacy remains to be measured.

## Exact packet and scope

Packet: `reports/shared-dictionary-cefr/d13a7-creation-readiness-20261011/candidate-packet.json`.

SHA256: `5c37f3240a54271eff1a615d436b3171ebdcea698bc163f6c99ca71249c36d29`.
Policy SHA256: `b9c2515d5fbaebbc25f798292a9cae62a4780b96993de940fbfc6da529a7f827`.
Judge prompt SHA256: `868b88a80fccf82cd0c50b074a16be861b133f63bb24f796c23d64a6d2e071dd`.

The packet freezes27 source files, profile,42-case corpus/proposed labels, requests,
execution scope, limits and thresholds. Forty fixed judges use candidate fixtures;
4 protected-input generations can each produce one newly bound contingent judge.
Maximum48 calls. Synthetic grants follow the current SQL schemas, and separate actual
SQL-to-mocked-HTTP tests verify those shapes/hashes. Fixture result versions are synthetic,
not real provider observations. The completed direct-analysis pilot remains separate.

Covered: creation grant request mapping, protected-input generation, distinct-model
semantic judging, guards/parsing on noun/verb/adjective/expression fixtures. Excluded:
hosted database publication, real-user cards, client devices, runtime activation. Registry
proposal is disabled. Packet qualified:false,approved_for_execution:false; labels proposed
and not independently human reviewed. Reviewed labels/scope enforcement remain activation
prerequisites. No production accuracy or full workflow qualification is claimed.

CLI `scripts/shared-dictionary/creation-qualification-cli.ts` has only local prepare/verify
commands, no paid execution/credential path. Saving is exclusive/write-once and fsynced.
Verification rebuilds the packet and refuses altered bytes/scope/sources before external
work. A future authorized runner still needs current aggregate allocation, durable unique
journals, version/usage checks, deadline/rate/no-retry guards and contingent bindings.
That runner is not implemented or implicitly authorized by this readiness checkpoint.

## Verification

- Cached Deno187/187 with typecheck:170 existing contract/provider/worker/qualification
  cases plus17 new adapter/creation-packet cases. HTTP is injected/mocked; no env/net
  permission. Coverage includes correct grant/request separation, HTTP400/408/503 with
  one call, profile/prompt/hash tampering, BIGINT/byte bounds, wrong-version raw journalling,
  lost journal reply/resume without redispatch and rejection of private caller fields.
- PostgreSQL15/15:3 new actual SQL grant mapping tests plus12 observed-version tests.
  Both phases send the real committed grants through mocked HTTP and preserve hashes;
  one isolated first revision publishes/replays once. Wrong generation version prevents
  judge quota; pending judge validation refuses, retains its later raw wrong-version result,
  then cannot publish. No hosted SQL or actual provider request.
- All48 fixed/fixture-contingent requests validate against saved public v1beta
  Discovery revision20261010, including APPLICATION_JSON. Packet27 source hashes and
  exact verification pass. Actual generated contingent byte size must be checked again.
- Scoped ESLint zero warnings,Deno lint,source/document formatting and diff pass.
  Existing app/web/device/full-suite checks are carried only; no fresh broad device claim.

Deno command: `/Users/devrush/.deno/bin/deno test --cached-only --unstable-detect-cjs --config supabase/functions/deno.json --allow-read --allow-write` followed by the10 paths in `deno-final.log`.
PostgreSQL command: `WOORDENAAR_PG_DOCKER=1 /Users/devrush/.nvm/versions/node/v24.20.0/bin/node --test --test-concurrency=1 --test-timeout=120000 scripts/postgres-tests/dictionary-creation-gemini.test.mjs scripts/postgres-tests/dictionary-observed-versions.test.mjs`.
Packet commands use cached Deno run --check with read permission and write permission
restricted to the new report directory for preparation; verification is read-only.

Initial local test checks exposed fetch overload typing and an incomplete unknown-state
fixture; those test definitions were repaired, then all187 passed. PostgreSQL first failed
under ambient Node20's TS loader, then required the established dynamic import hook, then
native PostgreSQL15 hit the known macOS SysV memory exhaustion. No unrelated resource was
removed. Tests succeeded with existing local Docker fallback:cached pinned image,no
network/ports,random tmpfs container,automatic removal. Escalation was automatically
approved for local tests/cleanup verification; no approval rejection. Docker check found0
remaining test containers. All runners exited; failures and successful logs are retained.

## Budget, authority and remaining work

[Standard pricing](https://ai.google.dev/gemini-api/docs/pricing) for both proposed Flash
models is inputUSD0.75/M and output including thinkingUSD3.75/M throughDecember31,2026.
At32768 maximum input-token reservation and65536 output including thinking, per-call
maximumUSD0.270336 fits conservativeUSD0.28. Forty-eight reserves total13.44. Earlier day
committed0.8142535 plus13.44 would be14.2542535,within15. This is a conditional allocation
calculation, not payment authority or an inspected invoice. No new call/cost occurred.
Day remaining14.1857465 stays unchanged; original three journals/ledger remain immutable.

AUTH-32 remains the owner's same-day direct-analysis authority through22:00Z, no rollover,
no automatic retries and no repeat same-scope payment question. The new creation/distinct
judge workflow is outside that recorded scope. Current preparation/review requires no paid
call or new permission; no payment request was made. Any later measurement must reconcile
actual owner authority and all current day allocations before credentials/dispatch.

Next GPT-6 Astra / High for local review of this exact implementation, SQL evidence and
packet. Creation track4 substeps:preparation now complete,3 remain(review,measurement,
result review). Inside checkpoint5 the compatible creation measurement package and final
combined workflow/scope decision remain. D13A.7 fixed4/6 complete,2 remain;8 broad
milestones remain. Completed direct-analysis pilot has0 steps and must not be repeated.

Entry4198 references/657 paths verified;all prior source/web/browser/provider hashes
preserved. Seven new files plus evidence pair yield666 local-only/uncommitted paths.
No existing runtime/migration/corpus changed,no Git/hosted/EAS/device/release action.
Flags OFF outside QA/shared_analysis FALSE/CEFR OFF;real2914,eligible/approved/applied0.
No secret accessed or retained,no paid call,no pending operation.
