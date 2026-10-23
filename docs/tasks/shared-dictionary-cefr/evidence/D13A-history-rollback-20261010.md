# D13A.4 — History/diff and administrator rollback checkpoint

Completed locally October 10, 2026, GPT-6.1 Sol / High (owner-confirmed).
This checkpoint is complete; **D13A.4 remains in_progress**. Semantic evaluator,
protected provider orchestration and final workflow gates remain unfinished.

Prepared an additive default-off migration with a private immutable rollback audit,
Auth actor redaction, administrator-only expected-head/sequence rollback and bounded
history/diff/admin-audit RPCs. Changed heads emit a new event even when revision
numbers decrease. Head/event/cursor/audit commit atomically. No learning, adoption,
personal IDs/content state, provider/quota or source/revision is rewritten. Current
publication fences a head changed by rollback. Full_access without administrator
membership does not qualify. Emergency rollback works with provider gates disabled.

Exact nonce replay preserves the original receipt after later changes and permission/
flag revocation. Changed requests fail. ABA or stale heads return durable conflict;
same-head returns no-change without a new event. Draft/explicitly retired revisions
cannot bypass their review hold; valid historical published revisions of the same
entry are candidates. Retired entries return entry-unavailable. New common history/
diff hides retired entries while original authorized pin/follow reads remain usable.

History pages contain lightweight public metadata, event ordering and exclusive
sequence cursor, with no actor/audit reason/private/source/provider evidence. Diff
contains both canonical revisions and every changed field, including full nested
values, null and media. Strict parsers recompute the entire diff, bind request/receipt
IDs and preserve BIGINT decimals. Separate bounded administrator audit uses paired
timestamp+UUID pagination; Auth deletion redacts only actor identity.

| Final gate                | Result                                                                                                                           |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Isolated PostgreSQL 16.13 | 74 selected checks pass: new history/diff/rollback 17 + unchanged authority 19, publication 22, following reads 16               |
| Mobile with coverage      | 162 suites / 1906 tests / 22 snapshots PASS                                                                                      |
| Focused contracts         | 6 suites / 105 tests PASS                                                                                                        |
| Types                     | Domain/contracts/mobile build+test/web PASS                                                                                      |
| Lint                      | Zero errors/warnings                                                                                                             |
| Formatting/target/diff    | Source formatting, exact generated target through20261010130000 and git diff --check PASS                                        |
| Preservation              | 32 prior source hashes, ten prior SQL bodies and four sealed archive/manifest hashes unchanged; all eleven SQL mirrors identical |
| Cleanup                   | Zero task test/type containers and type networks; no outstanding tool/external job                                               |

The first SQL run passed13/16: two fixture RPC names were wrong, and role-revocation
fixture needed service role. Fixed fixtures; expanded17/17 passes. Initial domain
inference required an explicit event map return type. Web ES2017 rejected `1n`;
used `BigInt(1)` as existing domain does, then reran all types/full mobile/contracts.
No lint/type suppression or previous source/test mutation. Failed logs retained.

See [exact evidence](D13A-history-rollback-20261010.json) for commands, hashes,
failed attempts, cleanup timestamp, dirty inventory and scope. Reports are retained
in `reports/shared-dictionary-cefr/d13a4-history-20261010`. The prior pinned isolated
adapter is unchanged, including its d13a3-test name prefix. Original cluster/fixtures/
platform and host PostgreSQL15 IPC remain untouched. Only the three relevant prior
SQL suites (57 checks) were rerun, not the entire previous158/database suite. No fresh
full web unit, exact embedded/build85/device or26-fixture end-to-end acceptance claim.

Seven source/type/test files plus task notes/evidence remain local-only/uncommitted
on feature/shared-dictionary-schema, HEADf97a733 unchanged. New flags OFF, real
memberships/validator policies unseeded, shared-analysis capability unavailable and
CEFR OFF. No hosted apply/grant/link/publication, paid/provider call, commit/push/PR/
merge, release/device or automation. Backups/QA/sealed exports and.playwright-cli
preserved. D13 observation open, D14pending, AUTH-27/28/29 consumed.

Next **D13A.4 — GPT-6.1 Sol / High**: inspect the current protected dispatch/result/
validation/publication contracts and Gemini/authorization helpers; fetch current API
documentation before changes. Implement injected/testable shared provider orchestration
and semantic evaluator, reviewed policy/positive-negative sense fixtures and explicit
uncertain/rejected handling. Commit dispatch before requests, journal results before
validation, retry from durable results, and never automatically redispatch an unknown
outcome. Use verified actor and protected anchor/content; no private prompt/overrides,
new quota bypass, live membership/policy seeding or paid call. Qualification and
publication remain distinct; a confidence score alone cannot accept same meaning.
