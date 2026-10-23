# D13A.7 acceptance review — October11

Checkpoints1 and2 are complete locally: **2/6 complete,4 remain**. This is a
prescribed sequential review, not an independent reviewer or a release approval.
D13A.7 remains in_progress. Eight broad milestones remain:
D13.6,D13A.7,D13A.8,D13A.9,D14.1,D14.2,D14.3,D14.4.
Next D13A.7.3: native/web delivery, private queues, imports, account lifetimes and
stable sessions, **GPT-6 Astra / High**. No picker switch is claimed.

## Acceptance traceability

[Current26-case overlay](../D13A-acceptance-traceability-20261011.json) binds each
case to implementation paths, test suites and current SHA256. There are89 suite
references across27 distinct suites. References identify covered components;
they do not certify the entire declarative scenario. The original D13A.1
`D13A-acceptance-fixtures.json` is retained byte-for-byte with its original hash.
Other client/operator suites are carried evidence, not newly executed checks.

DEC-11 introduced a separately charged independent semantic judge after the
original specification. Six current expectations are clarified:

| Case | Current expectation                                                                                                                                            |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A01  | Successful valid candidate: one generation and one judge call; two quota slots.                                                                                |
| A03  | Trusted read_only administrator uses that same two-attempt path; no direct head write or self-grant.                                                           |
| A05  | Successful publication plus lost-reply replay totals two attempts/two slots, one revision/event.                                                               |
| A06  | Winning valid analysis totals two attempts/two slots; competing operation stays busy without a new charge or leaked receipt.                                   |
| A08  | Generation-only journal requires one remaining judge call; both journals or accepted validation require zero. Unknown outcomes never automatically redispatch. |
| A26  | Unchanged valid content still needs two attempts/two slots; no new revision/event; exact replay adds nothing.                                                  |

These counts describe a completed valid path. Preflight rejection, malformed
candidate, unavailable judge quota and unknown results have different outcomes.
In particular, second-slot quota denial retains the first charge, records an
uncharged judge result and cannot turn into a later automatic paid attempt.

A26 previously had separate publication no-change tests and independent-judge
checks, but lacked one concrete endpoint assertion combining both. The added
endpoint test executes the SDK/handler/worker/independent evaluator against actual
local PostgreSQL RPCs and a synthetic provider. It asserts the original head,
exact sequence, unchanged revision/event counts, two attempts/two quota slots and
identical replay. The A08 response-loss test now explicitly asserts one call before
resuming a generation-only journal, then two total. No real provider is contacted.

## Server/domain review

Inspected the analysis command/receipt parsers, protected input and candidate
validation, transport, handler/runtime, caller/service stores, worker, independent
evaluator and prompt/verdict contracts. Reviewed SQL acceptance/dispatch,
protected reads, validation/publication, independent judging/profile gates,
redacted provenance and administrator history/rollback, with attention to:

- Verified Auth identity rather than caller-supplied actor or metadata; caller
  acceptance separated from service-only dispatch/result/validation functions.
- Exact command keys, UUIDs and decimal BIGINT fences, immutable same-intent
  receipts, bounded requests and redacted public errors/history.
- Current locked access/admin authority and feature/policy binding before paid
  work and publication; full_access alone cannot perform administrator rollback.
- One committed grant per generation/judge attempt, durable result journals,
  known failure versus unknown outcome, late-result quarantine and explicit
  reconciliation. A lease expiry is not permission to repeat a paid call.
- Expected revision plus event sequence and immutable human anchor; head ABA,
  authority revocation and changed profile cannot silently publish stale work.
- Strict content/schema/identity/media guards, six grounded independent verdict
  dimensions and exact input/result/content/evidence hashes. Provider reasoning
  and self-reported confidence are not semantic approval.
- Atomic source/revision/head/event/receipt publication; no-change does not emit
  a revision/event. Machine provenance does not fabricate human approval.
- Audited administrator rollback to a published same-entry revision emits a newer
  sequence; preserves personal learning, uses no provider and replays after gate
  revocation. Public history does not expose actor, private reasons or prompts.

No runtime defect was confirmed in this reviewed scope. The provider qualification
and client/operator acceptance gates below remain open; this is not a whole-product
approval. Creation/import client completion is part of the remaining client review.

## Fixed review findings

1. **Acceptance expectation drift:** the preserved D13A.1 fixture predated DEC-11.
   The current overlay resolves six expectations without rewriting old evidence.
2. **Focused Edge typecheck failure:** Deno2.7.9 plus Node/global fetch overloads
   inferred a union whose RequestInit member lacked properties used by two mocks.
   The first focused run failed with four TS2339 errors before executing tests.
   Explicit `RequestInit` annotations in those two mock callbacks fix inference;
   no cast, suppression, runtime API change or dependency update was used. A
   reconstructed pre-edit file matches the prior SHA256 exactly.
3. **A26 integration coverage gap:** added the actual endpoint no-change case and
   strengthened A08 as above. These are behavioral assertions across the durable
   provider/SQL boundary, not tests of a documentation constant.

## Fresh verification

Reports: `reports/shared-dictionary-cefr/d13a7-acceptance-review-20261011`.
Exact command receipts, source/report hashes and progress are in the accompanying
[checkpoint manifest](D13A-acceptance-review-20261011.json).

- Server PostgreSQL review suites:96/96 across analysis operations, publication,
  worker reads, semantic checks, endpoint, actor permissions and head rollback.
  This run precedes the added endpoint test; runtime/migrations are unchanged.
- Final endpoint suite:17/17 after adding A26 and strengthening A08. Combined with
  the unchanged other six suites, this represents97 distinct current tests;
  the16 earlier endpoint executions are not counted twice.
- Focused Edge:76/76, with typechecking enabled and cached dependencies; zero
  network permission or real provider calls. The initial failed log is retained.
- Four domain-contract suites:82/82.
- Scoped ESLint with zero warnings, Deno lint on the changed Edge test, repository
  Prettier and git diff whitespace checks pass.

An exploratory Deno formatter check reported its existing import/brace/trailing
comma preferences. This repository uses Prettier; the two annotations and the
original file conform to that configured formatter. No broad reformat was made.
Historical full native/web/Edge/PostgreSQL/browser suites are not represented as
fresh. The old full Edge boundary has two test annotations changed; the new
focused76 result supersedes that part, not the entire historical108-test run.

## Remaining four fixed checkpoints

3. Native/web review: delivery transaction and missing dependencies, pending private
   payloads, account A→B→A fences, imports/creation/adoption/export and active-session
   boundaries. For A12/A13 specifically, verify actual native session/review paths;
   cache materialization and separate restart tests do not alone prove those cases.
4. Mapping/apply/compensation review: immutable original/fingerprint/receipt fences,
   concurrent learning and deletion, bounded recovery and live-operation prerequisites.
   SQLite compensation remains disposable rehearsal, not an authoritative server
   delivery packet. Real-card approval and queue/delta reconciliation are unproven.
5. Exact semantic model/prompt/policy qualification: run a reviewed positive and
   negative sense corpus, measure errors and retain failure review. Bind the exact
   generator and judge models, both request builders/configuration, prompt hashes,
   policy, corpus and source/artifact hashes. A policy hash alone does not freeze
   every generator source change. Synthetic verdicts establish protocol behavior,
   not model sensitivity; no paid/provider run or policy enablement is authorized.
6. Actual two-owner/devices, offline reviews/cold return, embedded build85 and both
   repair OTA artifacts, queue reconciliation and same-environment before/after
   representative performance. Structural no-fanout/query-count tests do not prove
   device timing. Capture artifact identities and sanitized evidence before closure.

Local-only/uncommitted; all600 entry dirty paths retained. No app runtime/domain/SQL
implementation changed. Only two existing test files and current review/task notes
changed. Real2914 eligible/approved/applied0; flags OFF outside QA, shared_analysis
FALSE, CEFR OFF, AUTH27-29 consumed. No Git write, hosted migration, device operation,
provider call, EAS operation or release. Owned runners/containers exited; no pending
operation. Do not mark D13A.7 done until all six actual gates are evidenced.
