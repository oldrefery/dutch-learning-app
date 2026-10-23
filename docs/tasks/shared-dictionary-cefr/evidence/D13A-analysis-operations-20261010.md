# D13A.3 — trusted authority and durable operation journal

October 10, 2026, Europe/Amsterdam. GPT-6.1 Sol / High, owner-confirmed.
Subcheckpoint complete; D13A.3 remains in_progress. All changes are local-only and
uncommitted on feature/shared-dictionary-schema, root HEAD f97a733. See the
[exact source/log/hash packet](D13A-analysis-operations-20261010.json).

## Prepared implementation

Additive migration20261010100000 adds private service-managed administrator
membership, immutable human-verified neutral meaning anchors and protected pointers,
actor-scoped operation receipts, entry fences and immutable raw-result journals.
Anchored source evidence is frozen even before a revision references it. There are
no live grants, seeded real anchors, user enum changes or historical revision edits.

Acceptance derives a verified Auth actor, checks full_access OR enabled trusted
administrator, exact expected revision/decimal head sequence and an existing
protected anchor. Same-key/same-payload retry returns the stored receipt; another
payload conflicts. Different concurrent actors on the same entry get one accepted
attempt and one busy response. Receipt, fence and one existing quota reservation
commit atomically. Defaults match current application configuration:10 attempts
per60seconds; the same gemini-analysis counter is reused.

Service-only dispatch rechecks authority, head sequence (including ABA) and anchor;
only its first committed transition returns shared provider input. Retry never
returns another dispatch payload. The raw result is journaled privately and can be
replayed without another paid attempt. Late results and uncertain provider outcomes
remain quarantined, even after lease expiry. Explicit known-failure reconciliation
requires trusted evidence SHA256; a journaled late result cannot currently be
released/published. Expired work with no dispatch may be replaced by an explicit
new operation with a higher fence. Leases are five minutes; no timeout implies that
a provider call was unpaid.

Owner receipt/history RPCs expose bounded metadata, not raw results, prompts or
actor identity. Enabled administrators can explicitly audit another actor's bounded
history. Worker roles use RPCs rather than direct operation/result mutations.
Auth deletion removes private receipts/results and releases the entry lease while
preserving its monotonic fence. Domain parsers cover command/receipt/outcome shapes
and decimal BIGINT precision. Public target types were regenerated and checked.

`analysis_operations_enabled` defaults false; capability2 still advertises shared
analysis as false. There is no Edge Function/provider integration or publication
implementation in this packet. Human reviewed_by/source/revision constraints remain
unchanged; machine validation must not masquerade as human approval.

## Verification and evidence limits

106 unique PostgreSQL checks pass:19 operation regressions,83 unchanged legacy
read/command/recovery/mapping/schema tests and4 official-import regressions.
The combined102-test run retained one operation fixture failure after a refactor
turned a quoted constant into the SQL identifier FAILED. Its83 legacy tests passed;
the corrected full operation suite separately passed19/19. The failed combined run
is recorded as exit1, not silently rewritten as green. Earlier trigger ACL, SQL NULL
fixture decoding, CLI flag and lint failures are also retained with repairs in JSON.

Mobile159 suites/1854 tests/22 snapshots and coverage gates pass. Focused domain
contracts3 suites/53 tests pass. Domain, target contracts, mobile build/test and web
typechecks, root lint with zero warnings, targeted formatting, target-type exact
check and git diff check pass. No fresh full web unit run was needed for this
backend/domain checkpoint; the preceding read checkpoint contains its full result.

The existing session-local Docker adapter used pinned PostgreSQL16.13 with synthetic
fixtures, network none, Unix socket and tmpfs. Test bodies match source hashes;
only the cluster adapter differs. Host PostgreSQL15 shared-memory exhaustion remains
untouched. Type generation used its existing temporary private internal network.
Read-only final inventory confirms zero task test/type containers and type networks.
All tool sessions completed; no pending external operation.

All13 D13A.2 repair/config source hashes and the four sealed OTA source archive/
manifest hashes remain unchanged. Earlier following-read implementation/test files
also retain hashes; the export index, target manifest/types are intentionally extended.
Private reports, older evidence, backups/QA and unrelated.playwright-cli are preserved.
No commit/push/PR/merge, hosted migration/grant, provider call, publication, release,
device write or automation was performed. Production flags unchanged; CEFR OFF;
D13 observation open, D14pending, previous approvals consumed.

These checks do not establish validated same-meaning publication, actual provider
idempotency, exact embedded/build85 device compatibility, client hydration or all26
declarative acceptance cases. Raw-result hashing is PostgreSQL JSONB text SHA256,
not a validated canonical-content hash. Service-supplied reconciliation evidence
needs the future worker's actual provider evidence/review policy.

## Exact next checkpoint

Continue D13A.3 with GPT-6.1 Sol / High. Read the authority/journal implementation
notes in the technical contract and this packet. Add immutable automated validator
provenance bound to actor/operation, protected anchor/input and durable result;
keep human approval distinct. Implement explicit late-result reconciliation and a
short guarded publication transaction that rechecks current permissions, operation
status/fence, source/meaning validation and exact expected revision plus head
sequence, then writes revision/head/existing delivery event/receipt atomically.
Prove no-change and lost-publication-reply replay without new provider/quota work.
After that, finish versioned import/cache/legacy command contracts and final stage
validation. Do not start D13A.4, enable flags, apply hosted migrations or infer live
publication authority from these local tests.
