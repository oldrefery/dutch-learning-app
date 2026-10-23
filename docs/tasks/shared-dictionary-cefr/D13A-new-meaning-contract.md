# D13A.5 — New meaning resolution and creation contract

Status: resolution/acceptance, durable generation/judgement and first publication
and audited same-owner definitive recovery are complete locally. Creation HTTP
orchestration with explicit injected fake transport and durable SQLite/browser journals
and fresh-owner client transport plus explicit no-match/status recovery forms are complete locally.
Authoritative personal adoption/cache hydration remain pending.
Concrete provider request/transport qualification is still a separate release gate. Local-only, new gates OFF; GPT-6.1 Sol / High recommended. This refines
DEC-10/11 and the [D13A technical contract](D13A-technical-contract.md), without
new live authority.

## Separate user intent from trusted meaning identity

Published exact-lemma lookup returns candidates for explicit selection. Zero results
is not evidence that a new sense exists; hints, capitalization and spelling are not
meaning identity. Existing published references continue through v2 following import.

A resolution request contains exactly protocol_version2, resolution_id (UUID),
original_query and meaning_hint. Original query bytes (up to240 UTF-16 code units)
are retained; existing normalization must produce a nonempty query of up to120 units.
The hint is bounded to1000 units; controls are rejected. These are private owner
intent, not a public linguistic source or permission grant. No personal word_id,
collection, learning, images, provider output or credentials enter this wire contract.

Before any resolution RPC, persist the exact request and owner under fresh Auth and
mounted epoch guards. The server derives actor from Auth, checks the dormant gate and
current full_access OR trusted active administrator membership, serializes actor plus
resolution nonce and binds the exact immutable request hash. Changed payload with an
existing nonce is a conflict. Resolution performs no provider call and charges no
analysis quota. Ordinary read_only published lookup/adoption remains supported; it
does not grant new-meaning creation or reviewed-source authority.

A trusted resolver consults explicitly reviewed neutral identity/source evidence.
It must not turn the private hint into an approved anchor, assign human provenance
to a generated result or infer a sense from query similarity. Existing approved
source/anchor rules remain: audited human evidence is required for an eligible anchor.
Missing or ambiguous evidence returns review-required/meaning-uncertain. Unapproved
source or conflicting reviewed identity returns rejected/source-unapproved or
rejected/identity-conflict. These outcomes expose no identity token or publication.
No mandatory administrator confirmation is added to every permitted creation request;
requests with already eligible reviewed evidence proceed through automated validation.

A private reviewed identity record binds an opaque stable identity UUID to nl,
canonical lemma/POS/article/sense_key, source_id plus exact immutable source approval,
neutral gloss/examples, verified reviewer/time/audit, evidence hash and planned entry
UUID. It exists before any public draft/head; it is not an existing entry anchor with
an invalid FK. Its key and evidence must be reviewed independently of the requesting
account's analysis permission. Deduplication across actors uses this reviewed identity,
never original_query or lemma alone. Different reviewed senses keep different identities.
Private source approvals, actor IDs, hints and anchor payloads are not returned publicly.

The resolution receipt echoes the request and is immutable:

| Outcome          | Resolved identity             | Published reference                 | Decision                               |
| ---------------- | ----------------------------- | ----------------------------------- | -------------------------------------- |
| new-meaning      | Opaque reviewed identity UUID | null                                | null                                   |
| existing-meaning | null                          | Exact entry/revision/content SHA256 | null                                   |
| review-required  | null                          | null                                | meaning-uncertain                      |
| rejected         | null                          | null                                | source-unapproved or identity-conflict |

A token returned in new-meaning is a reference to a private server record, not a
client proof of approval. Acceptance must reload and validate that record. Future
review creates a new explicitly submitted resolution nonce; it does not rewrite a
saved terminal resolution or its original request. Existing outcome is handled only
by explicit exact-reference adoption after independent published dependency reads.

## Accept a new entry without a personal card or expected head

The creation command contains exactly protocol_version2, operation_id and
resolution_id. Operation and resolution nonces must differ. There is no client
actor, entry, expected revision/head, resolved identity, anchor, source approval,
provider configuration, content or personal learning. It is a separate operation
from existing-entry dictionary analysis v2 and old service-only canonical persistence v1.

Acceptance must atomically perform all of the following in the future SQL operation:

1. Derive actor; recheck gate, current full_access/admin permission and ready configured
   generation/independent-validator policies. Serialize actor/operation nonce; compare
   saved request hash before any quota charge. Load that actor's immutable new-meaning
   resolution and reviewed identity/evidence. Forged or foreign tokens fail closed.
2. Lock the reviewed identity and its planned entry consistently across actors.
   If this exact meaning is already published, retain its authoritative reference in
   an idempotent zero-charge existing-meaning response. If another attempt is active or
   its provider outcome is unknown, return zero-charge creation-in-progress. The busy
   response binds this command, not the other owner's private operation metadata.
3. Enforce existing dictionary semantic uniqueness and legacy personal-key restrictions;
   do not fabricate a sense/alias or silently merge conflicting content. Retired/draft
   identities require explicit resolution rather than spelling-based resurrection.
4. Reserve one existing gemini-analysis quota slot (current10/60) for the accepted
   generation attempt, materialize the reviewed draft entry and eligible immutable
   meaning anchor/head, and save actor/nonce/request hash, identity/evidence hashes,
   anchor/source/policy dependencies and positive entry fence in one transaction.
   No public published revision/head, personal word or collection is created here.

Accepted receipt charges quota even if generation later fails. Idempotent repeats,
reads, busy/existing responses and following import charge no generation slot.
Independent semantic judging remains a separate durable attempt and separate slot
under DEC-11; a successful generation+judge normally consumes two slots. No limit
increase or paid-call authority is inferred. The draft is invisible through published
entry/head/revision RLS; direct client writes and source approval remain prohibited.

## Dispatch, validate and publish

Commit dispatch intent before any external call; use the fenced immutable neutral
identity/anchor input, qualified server policy and fresh permission. Raw provider
results are bounded and reconciled durably before validation. A result is not a head.
Unknown outcome stays quarantined; timeouts/lease expiry/client restart never establish
that a provider was not called and never authorize automatic redispatch. Late-result
reconciliation needs explicit matching operation/fence/provider/input/result evidence.

Reuse existing schema/identity/media checks and independent same-meaning evidence.
Source/hint confidence, a generator's own claim and role membership cannot substitute
for validation. Uncertainty returns review-required, retains its result for review and
publishes nothing. Automated validation provenance cannot claim human linguistic review.

A new creation publication transaction rechecks current actor authority, gate, fence,
reviewed identity/source/anchor/policy and result/validator evidence. It requires no
published head for this draft and no concurrent semantic identity conflict. It creates
first published revision (revision_no1) and the global head cursor, normal immutable provenance/history and the
existing head/delivery event plus operation receipt atomically. No new publication
fanout or personal learning writes. Failure rolls back all publication effects; it
must not overwrite another entry/head or become an existing-entry reanalysis.

The published receipt identifies exactly this reserved entry, immutable revision and
content SHA256, a positive canonical global head cursor and durable provider result hash. No-change is
not a new-entry status. If another published meaning is found before acceptance, the
separate zero-charge existing-meaning response is used instead. Publication is not
personal adoption: verify the full published dependency and require explicit v2
following import. Existing receipt/conflict/recovery/hydration gates remain authoritative.
Native pending batch items may complete only after authoritative personal adoption,
not resolution, generation, publication or a cached optimistic result.

## Durable client boundary and fixtures

The domain session contains owner, exact request, optional immutable resolution,
optional matching command, submitted flag and optional bound creation response.
Pure reducers record resolution, reserve a creation command, claim submission and
reconcile response. They require the matching active owner; adapters must additionally
check fresh Auth plus mounted epochs at every asynchronous/storage boundary.
Persist claimed submitted=true atomically before sending. A restart after that save
permits status reads, never a second submission. No RPC or storage adapter is supplied
by this checkpoint; these reducers alone cannot prove durable disk or server state.

Every response binds protocol/operation/resolution. Accepted entry/fence/result hash
are immutable. Observations may skip states, but cannot regress dispatch/validation,
replace terminal receipts, erase a durable result or turn an unknown result into a
new dispatch. Review/rejection/conflict/revocation/failure is terminal for that attempt.
Unknown is nonterminal quarantine. Busy is explicitly not acceptance and its command receipt is immutable. Any later
retry requires server confirmation of no accepted operation and a new operation nonce
from a separate explicit action, not mount, restore or background automation. Read/retained data grants no authority.

Native and web contract fixtures cover original retention, ambiguous/unapproved
resolution, distinct senses, authority-field injection, nonce/request/owner binding,
JSON restart, lost responses, quota/status/fence/result consistency, terminal review,
unknown-outcome reconciliation and exact first-publication/adoption reference.
These are executable contract fixtures, not PostgreSQL/RLS/provider/device evidence.

## Next checkpoint and required backend proof

Implement a dormant additive private identity/resolution and creation operation with
narrow authenticated/service-only wrappers, pinned search_path and explicit revokes.
Reuse quotas/validator/provenance/events; do not broaden roles or client direct writes.
Add local PostgreSQL/worker fixtures for foreign/forged resolution, changed payload,
source withdrawal, ordinary read_only versus administrator, acceptance/publication
revocation, same-identity concurrent owners, distinct senses and legacy-key conflict,
quota rollback, immutable anchor, lost accept/dispatch/result/publication responses,
unknown-result quarantine/reconciliation, no-head initial publication and atomic events.
Verify no personal/SRS writes or public draft leakage. Generate/check typed backend
contracts only against that implemented schema. Then add SQLite/browser storage and
fresh-owner client transport before connecting native/web no-match submission.
GPT-6.1 Sol / High; D13A.5 stays in_progress. D13 open, D14 pending, CEFR OFF.

## Backend acceptance checkpoint scope

Resolution requests are persisted as pending before trusted service resolution.
Authenticated request/get RPCs return null while pending, then the immutable typed
resolution receipt. A service-only resolver binds exact request SHA256 and reviewed
identity or explicit rejection/review decision; it never generates an approval from
a private hint. Repeat/changed-payload behavior and owner reads remain durable.
The acceptance checkpoint implements request/resolution/accept/status only; dispatch,
result/independent validation and first-publication wrappers remain pending and no
provider endpoint or UI is connected. The first revision number is1; head_sequence
is the existing global committed-version cursor, not a per-entry revision count.

The acceptance schema exposes only accepted operations; it cannot dispatch a provider
or mutate a published head. Leases do not expire or transfer automatically in this
block. Future dispatch/result/publication must extend transitions and get/accept
receipt derivation without rewriting the immutable original command. Account deletion
cascades pending/accepted owner journals and leases only while no dispatch capability
exists; the reviewed draft/source stays. The future provider journal must retain or
redact unknown attempts durably before any dispatch capability is implemented.
Source evidence hashes use UTC independent of session timezone. New requests/commands
canonicalize UUID spelling while preserving original query/hint bytes. Profiles and
identity availability remain service-owned and unseeded; applying migration1800 alone
enables nothing. Ordinary source or identity approval is not granted to app users.

## Durable generation checkpoint

Migration1900 adds a separate durable creation run and generation attempt. Accepted
owner operations and original command receipts stay immutable; owner get/accept replay
projects the current run receipt. Zero-charge busy/existing-meaning receipts remain
immutable and never become an accepted operation through a status read.

The service-only work lookup supplies a run UUID. Dispatch locks current Auth authority
before entry/run, verifies the canonical fence, reviewed identity/neutral anchor/source,
current exact qualified profile and all runtime gates. The new dispatch gate defaults
OFF. Its transaction records exactly one intent before returning neutral server-computed
input/hash/model. Only that first commit returns dispatch input. A lost dispatch reply,
worker restart or concurrent worker never grants another attempt. The accepted quota
reservation is reused once; no refund, renewed-window retry or automatic lease takeover.
Original query/hint is absent from run/provider input. A provider adapter is not wired.

Result journaling binds run/fence/input hash, bounds and hashes one raw object, and
retains its optional unique provider response ID. Raw content and usage remain private;
the owner sees status and result hash only. `validating` means a durable generation
result awaits independent schema/media/identity/semantic checks, not accepted validation.
It grants no public revision or personal card. Late results after two minutes or an
explicit unknown transport outcome stay quarantined. Reconciliation needs the exact
result hash, separate immutable audit evidence, fresh authority and dependencies. It
does not send another request or charge another generation slot. Unknown cannot be
downgraded to known failure. A documented known failure is terminal; retry/recovery of
its reviewed draft remains pending, and its lease is conservatively retained.

Auth deletion cascades the private request/command/accepted owner operation and removes
the durable run's actor UUID. Run/attempt/input/hash/paid bit/result are retained with
restricted RLS and no direct service mutation grants. An unsent or known returned run
releases its lease; unresolved dispatch/unknown retains an actorless lease. A late reply
after deletion can only be quarantined. Recreating the same Auth UUID does not restore
ownership or reconciliation authority for that orphan. No public head/event, personal
content or SRS table is written by dispatch/result/reconciliation.

Independent separately charged judgement, immutable creation validation/provenance and
atomic first publication remain the next backend checkpoint. Preserve these durable
run IDs when extending it; do not attach publication proof to cascading owner operations
or overload the existing published-entry analysis FK. If new source columns are added,
preserve reviewed source approval hashes explicitly: existing evidence hashes cover
the source row as it existed at registration. Then implement storage/fresh-owner
transport and no-match forms. GPT-6.1 Sol / High; D13A.5 remains incomplete.

## Independent creation judgement and first publication (migration2000)

The durable creation run owns a separate private judge attempt, immutable derived
validation and same-transaction publication permit. No proof is attached to a
cascading owner operation or fabricated old analysis expected published head.
`creation_judgement_enabled` and `creation_publication_enabled` default FALSE;
no qualified policy/profile, role or real provider capability is seeded.

Judge dispatch computes the exact input from protected neutral gloss/examples,
strict candidate content, generation input/result hashes, reviewed evidence,
entry fence and pinned policy/model/prompt. Generator confidence/reasoning and
private original query/hint are excluded. Model must differ from generation.
Strict schema/identity/media checks precede the separate existing gemini-analysis
quota slot. A quota denial persists an uncharged terminal intent; successful
replay never recharges or redispatches. Raw bounded judge result/hash/provider ID
is immutable. Late/unknown results require separately audited reconciliation,
current owner authority and exact current reviewed dependencies. Unknown cannot
be converted into known failure or assigned to a recreated Auth UUID.

Validation RPC accepts only run/fence, then derives the complete immutable proof.
Exactly six unique dimensions (translations-en/ru, examples, related-words, notes,
grammar) require bounded quotes contained in the protected anchor. Claimed
same-meaning/different-meaning/uncertain must match preserved/contradicted/uncertain
checks, with exact anchor/content/generation result hashes. Contradiction rejects;
uncertainty requires review; malformed/ungrounded proof cannot authorize publication.
A private insert guard recomputes the proof. Rejected schema/identity/media content
needs no paid judge. No caller-provided approved outcome is accepted.

Versioned UTC source evidence explicitly projects the original source fields,
including automated_validation_id NULL. New creation_validation_id NULL does not
alter previously registered source approval hashes. No immutable identity evidence
is rewritten during the upgrade. Human review states have both machine IDs NULL;
machine provider provenance binds exactly one old analysis or creation validation.
Creation sources/revisions require an accepted same-XID permit and exact immutable
content/schema/CEFR hashes. Existing human and analysis guard branches stay enforced.
Machine publication never fabricates human reviewed_by/reviewed_at.

First publication rechecks fresh actor permission, gates, lease/fence, lexical
identity, source/availability, profile/policy and neutral anchor under locks. It
atomically creates permit/source/revision_no1/head/global event, sets the entry
published, stores exact publication receipt and releases the known lease. Existing
entry-state guard requires head insertion before published state in that transaction.
The actual global delivery sequence is a positive canonical PostgreSQL BIGINT string,
independent of revision_no1 and possibly above JavaScript safe integer range.
Concurrent publication and lost replies return the original receipt after later
heads, permission/policy/gate withdrawal or Auth actor redaction. Wrong validation
ID/fence cannot replay. No personal record, learning/SRS state or CEFR assessment
is written. Shared revision provenance retains the existing public projection.

Seven new service-only RPCs expose journal/dispatch/record/failure/reconciliation,
validation and publication, with empty search_path and explicit ACLs. Private durable
tables have RLS and no direct ordinary/service grants. Owner SDK/get/accept remains
unchanged except live status projection. Known-failure/review draft recovery, HTTP
creation worker, durable SQLite/browser storage, fresh async owner transport,
no-match forms and explicit authoritative published-reference adoption remain pending.
GPT-6.1 Sol / High recommended; D13A.5 remains incomplete.

## Audited same-owner recovery (migration2100; complete locally)

Ordinary acceptance still cannot reuse an existing draft. An explicit administrator
review and a separate owner command are required only for recovery of a definitive
terminal attempt. Recovery does not add mandatory administrator confirmation to
ordinary permitted creation/reanalysis. Unknown generation/judge outcomes remain
quarantined, including a result already retained without audited reconciliation.
Neither lease expiry nor a caller's failure claim permits takeover. Actorless histories
and recreated Auth IDs cannot obtain prior ownership or recovery authority; broader
orphan reassignment is not implemented by this checkpoint.

`review_dictionary_creation_recovery_v2` takes exactly review_id, prior_run_id,
expected_fence (canonical text), actor_id, operation_id, resolution_id, audit_reference
and audit_evidence_sha256. The reviewer comes from authenticated auth.uid and must
be a current trusted administrator. The actor must be the same surviving prior owner
with current full_access/admin authority. A distinct new owner resolution must have
immutable server-reviewed new-meaning authority for the identical reviewed sense.
The unused new nonce, latest retained run/fence/known lease, draft lexical tuple,
neutral anchor head/source/evidence and current qualified profile are checked. The
immutable15-minute review snapshots definitive attempt/result hashes and validation
proof hash, excluding original query/hint, generator/judge raw input/output. It reserves
no quota and dispatches no work. Reviewer/actor deletion redacts the audit's authority
columns without deleting the audit or enabling Auth UUID resurrection.

`accept_dictionary_creation_recovery_v2` takes exactly protocol_version2,
operation_id, resolution_id and recovery_id. Exact durable command replay projects
existing live status/publication before new-work gates, without another charge. A new
reservation rechecks owner/reviewer, review expiry, neutral/source/profile equality,
latest fence and known lease; old terminal rows remain immutable. It atomically consumes
one current existing gemini-analysis generation quota slot, creates a new run at fence+1,
transfers the retained known lease and records command/immutable same-XID handover.
Quota denial, stale review, competing command, overflow and rollback consume neither
approval nor quota and retain the old lease. Any later generation and independent judge
remain separately journaled and accounted. Published entries never use this recovery;
the existing shared reanalysis path remains authoritative. First successful publication
still uses revision_no1 regardless of recovery fence/global sequence.

Both new RPCs are authenticated-only; service/anon cannot review or reserve recovery.
Review checks administrator membership internally; owner commands check exact bindings.
Both new private tables have RLS, no direct service/client grants and immutable audit
guards. Private helpers are non-executable by service/client roles. The new
creation_recovery_enabled gate defaults FALSE and no real actor/source/policy is seeded.
Full integration, HTTP worker, SQLite/browser journals, fresh-owner forms/adoption and
broader mode/history/account-return/review/performance remain D13A.5 checkpoints.

Recovery qualification: full42 PostgreSQL files/547 tests and focused149 (35 new
recovery plus114 existing creation/RLS), isolated schema-rejection repair1, all PASS.
Exact179-path DB source manifest, regenerated target/check, contract/native production+
test/web types, changed-fixture lint/format/diff pass. Previous client runtime suites
are carried only; two additive RPC types reconstruct prior generated bytes exactly.
995 baseline references,310 source union,37 mirrors/47 sealed artifacts preserved.
All runners exited; temporary task containers/networks removed, six QA containers
untouched. No live/provider/paid/hosted/Git/release/EAS/device action; gates OFF.
See [recovery evidence](evidence/D13A-creation-recovery-20261011.md) and exact JSON.
Next fake HTTP creation worker, storage/fresh-owner forms/adoption; D13A.5 remains
in_progress, GPT-6.1 Sol / High,10 numbered checkpoints remain.

## Creation HTTP worker with injected transport (complete locally)

The explicit factory in supabase/functions/dictionary-creation/endpoint.ts is dormant:
no serve entrypoint, environment reader, default provider transport or deployment.
It uses Auth getUser(token), a caller-scoped anonymous-key client for ordinary/recovery
acceptance and an isolated service client for retained-run work. A strict bounded2048-byte
HTTP command is exactly ordinary3-key or reviewed recovery4-key; caller actor, run, fence,
model, candidate, approval, private query/hint and administrator review are not accepted.
Allowed-origin CORS and no-store responses reuse the established analysis boundary.

Worker continues by service run UUID/canonical BIGINT fence. SQL generation/judge grant
must have exact fields, canonical input hash and configured qualified model/version/policy;
judge must use a different model with matching prompt hash and exact candidate/result/fence
bindings. Transport receives only neutral committed grants. All tests inject local fake
transport/fetch; no concrete Gemini HTTP request adapter is qualified by this checkpoint.
Real provider payload/prompt/profile and paid/live activation still require D13A.7/8 gates.

Auth is checked afresh before reserve, dispatch, transport, validation and publication.
Current SQL rights and gates independently fence transitions. Failure after a grant but
before transport retains conservative in-flight intent; never fabricate known failure.
Provider exceptions become unknown. Lost journal replies do not imply uncommitted result:
retry reads saved state and never pays twice. Existing dispatch grants are never repeated;
missing/late/unknown stays quarantined until exact separately audited reconciliation.
No worker recovery, takeover, orphan reassignment or active abandonment is inferred.

SQL candidate-invalid is the only typed schema rejection branch: call server validation
for its durable rejected proof without judge charge. Arbitrary storage failure does not
become rejection. Returned independent judge is separately journaled; only server-derived
accepted validation may publish. Already saved judgement/validation/publication replays
survive lost replies; original publication receipt stays exact after rights/gate withdrawal.
No personal/SRS placeholder or adoption is created by publication or HTTP success.

35 fresh PostgreSQL HTTP integrations and108 Deno tests (32 creation+76 analysis), typed
endpoint checks and24-file Edge lint PASS on Node24.20.0/repository Deno2.9.4. Prior full
42 DB files/547 PASS is carried with179 exact unchanged source paths, not a new combined
582-test full run. Native/web/target/type results carried only; runtime/contracts exact.
No new browser/native/device/performance evidence. Initial synthetic RPC parameter regex
and host-runtime/import-map diagnostics are retained in the evidence; no server guard or
historical fixture was relaxed. See [worker evidence](evidence/D13A-creation-worker-20261011.md).
Next durable client journals/fresh-owner forms/adoption; D13A.5 stays in_progress.

## Durable creation journal checkpoint — 2026-10-11

The strict local envelope stores original request, immutable owner/session identity
UUID tags, resolution, exact ordinary or recovery command, submitted bit, creation
status/publication and separate published-reference adoption request/receipt. Tags
are not permissions: each journal access needs an injected fresh async owner check
and latched synchronous guard. Native migration22 has no word/Auth FK and uses
exclusive transaction handles; browser uses one owner key and an exclusive Web Lock.
A restored submitted command never authorizes dispatch; only a fresh successful atomic
claim may precede later transport. Generic save grants no dispatch. Corruption, stale
snapshot, nonce reuse, storage failure and bounded capacity fail closed without eviction.

Adoption nonce differs from creation/resolution; reference/hash must exactly match a
published receipt or existing published resolution. Durable import receipt does not
mean cache hydration or complete a batch. Equivalent idempotent replay preserves the
first receipt. Personal cards/SRS/queues stay separate. Unknown can acquire its first
quarantined result hash, which then cannot change or become a known failure. Judgement
failure/unknown after validating is supported. Terminal publication/status are immutable.

See [evidence](evidence/D13A-creation-journals-20261011.md). Fresh native188/2451/22,
web113/1117 including Node benchmark, Edge108 and all scoped types/lint pass. File-backed
SQLite and synthetic browser Storage/locks are not real device/browser acceptance.
Client SDK/lifecycle/gates/forms/adoption hydration remain next, GPT-6.1 Sol / High.

## Fresh-owner creation transport checkpoint — 2026-10-11

Shared workflow resolves an already persisted original intent, prepares a command only
for a resolved new meaning, claims submitted durably before Edge invoke and recovers
only through same-operation status. Null/malformed/foreign replies and lost HTTP cannot
clear submitted or create a new nonce. Explicit reviewed recovery keeps all four command
keys; an empty recovery ID is invalid. Resolution is uncharged/idempotent; its pending
status is separate from permission to generate. Publication does not perform adoption.

Mobile/web SDK factories capture fresh Auth and mounted guard lifetimes per explicit
action. Synchronous Auth listener latches A-to-B-to-A, awaits use getUser checks, and
collected bearer uses getUser(token) before invoke. Optional context AbortSignal is passed
to the SDK; forms must bind it to lifecycle. It cannot undo an already committed call.
Following/shared-analysis capability and actor preflight do not advertise dormant
creation-specific server gates. New work checks preflight before/after claim; current
owner status bypasses those feature/permission checks, retaining server authority.
Native creation endpoint bypasses generic retry statuses503/504/520/546, like analysis;
actual FunctionsClient/fake fetch regression keeps one attempt. No legacy retry helper
is used for creation. No Auth/provider/profile/token data enters the strict journal.

See [evidence](evidence/D13A-creation-client-20261011.md): native190/2490/22 coverage,
web114/1150 with Node benchmark, focused130/105, Edge108, scoped types/lint PASS.
No real device/browser/Auth/provider/profile qualification. Next no-match/recovery forms
and distinct published-reference adoption/cache hydration, GPT-6.1 Sol / High.

## Explicit no-match/status recovery forms checkpoint (October11)

Shared mounted action controller and native/web panels are wired into published meaning
add screens; see [forms evidence](evidence/D13A-creation-forms-20261011.md). Mount reads
owner-local metadata only through fresh Auth. No-match hint resolution, same-intent
resolution continuation, creation and saved status reads are explicit. Same normalized
word/hint changes cannot mint a replacement request in the view; list is re-read before
a new intent. Existing server lease/permission/source/model policy remains authoritative.
Submitted/unknown/terminal status has no redispatch or new-attempt shortcut. Failed
local recovery leaves new work disabled; original private query/hint/IDs stay retained.
Mounted Auth A-B-A latching and lifecycle AbortSignal fence await/SDK boundaries; Strict
Mode cleanup/setup renews lifetime and discards stale replies. No auto polling or admin
review command is added. Publication stays separate from personal adoption/cache hydration.
Full native2536/web1195/Edge108, types/lint/coverage pass final bytes. These are synthetic
UI/SDK/SQLite/storage tests, not actual device/browser/provider acceptance.
Next explicit authoritative published-reference adoption/import/cache hydration,
GPT-6.1 Sol / High. D13A.5 in_progress; all new live gates remain OFF.

## Explicit creation-to-personal adoption (October11 local checkpoint)

An eligible published receipt or existing-meaning resolution supplies the exact
published-reference/hash. Personal adoption has a separate immutable operation/word
ID and selected owned collection. The creation journal precedes the import journal;
only an exclusive fresh claim dispatches the initial non-provider import. A bridge
failure retains IDs. Submitted imports require explicit Check and Confirm actions;
confirm reads current placement then replays only that original non-provider nonce.
A known prior insertion may recover its immutable server receipt with new-work gates
OFF; unconfirmed insertion still requires availability. Any registered recovery or
cancellation, changed placement/version or mounted/Auth A-B-A fences completion.

Receipt presence permits separate loading through existing guarded personal/shared
loaders, followed by a fresh journal/placement check. No receipt-derived learning or
content placeholder is written. Existing-card conflicts use their own explicit load
and do not complete a new import's batch item. Native batch completion requires the
actual loaded following card/current shared reference/head, current owner and queue,
matching original query/item and unchanged owned target. Only that queue item status
is updated. Loaded UI state is runtime-only. See creation-adoption evidence for exact
scope; synthetic client tests are not device/provider/performance acceptance.
