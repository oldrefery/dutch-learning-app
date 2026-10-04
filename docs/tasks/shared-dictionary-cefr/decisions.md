# Decisions and authorization ledger

Last updated: 2026-09-21. No production operations authorized by this file.

## Confirmed task intent

- Plan shared dictionary references and CEFR enrichment for backend, mobile and web.
- Make every stage resumable in a new session without chat history, including
  pauses across weekly allowance resets.
- Persist progress in repository files and announce model/effort at stage changes.

## Open design gates

### September 21 — Transition restrictions accepted

The user explicitly confirmed both presented compatibility restrictions and asked
to continue: retain one personal card per existing lemma/POS/article key while old
clients are supported; reject conflicting linked-card text from legacy clients
with upgrade/reconciliation and preserved pending data. The disclosed consequence
that this may delay the device's synchronization was accepted. Record this as
DEC-03's transition limit and DEC-04's compatibility behavior, not authorization
to impose the restriction in production now or delete any queue.

The [schema blueprint](D02-schema-blueprint.md) completes the technical design
baseline. Source publication defaults to denied without reviewed provenance and
separate publication approval. Retirement defaults to disabled; D13 must specify
observation/support windows and D14 still needs separate removal approval. These
safe defaults allow a local synthetic implementation proposal without selecting
live source material, spending limits or a production retirement date.

### September 21 — Foundation rules accepted

The user explicitly confirmed the three presented rules and asked to continue:
shared meanings/CEFR with unchanged personal IDs, progress and history; personal
examples/edits remain private; adopting a new shared content revision requires
explicit user confirmation. DEC-01/DEC-02 are accepted at this policy level.
This does not accept all text in linked proposals, authorize implementation, or
settle same-key personal-card multiplicity, legacy write restrictions, source
licensing, provider costs, retention windows or release operations.

The [compatibility contract](D02-compatibility-contract.md) now proposes a
single-personal-card-per-legacy-key transition limit and rejection/recovery for
changed legacy content on linked cards. Both were subsequently approved above.

### September 21 — iOS priority and design preparation

The user supplied P1 iOS version/sync screenshots, confirmed iOS is the primary
mobile platform, and requested continuation after being offered D02 design with
device checks remaining open. Continue local design-proposal preparation only;
this does not approve the proposed architecture, complete D01, retire Android,
authorize implementation, or waive any release/data-preservation checks.
P1 app-reported 2.3.1 (84) and visible pending counters are now evidenced; Android
and separate learning queues remain unknown. See
[iOS evidence](evidence/D01-ios-owner-evidence.md).

### DEC-09 — Cutover only after final verification (confirmed 2026-09-12)

The user requires the switch to the new schema only at the end, once the work
has been verified. The current production read/write path remains authoritative
through development, rehearsal and validation. P1/P2 must not be switched early
as test/canary users, including by a merged PR, automatic deploy or backfill.

Local/staging schema and client development are preparation, not cutover.
Any separately approved additive production preparation must remain dormant and
backward-compatible: no redirect of live reads/writes, no destructive schema
change, no disabling old-client sync and no background enrichment activation.

The final functional release gate in D13 requires completed D01-D12 evidence,
backend/web/mobile integration and physical-device/upgrade/offline verification,
P1/P2 data-preservation comparisons, required CI, no unresolved blocking defects,
verified backups and a rehearsed rollback retaining post-cutover learning writes.
Account for writes arriving during preparation; reconcile the final delta and
pending operations without data loss before switching. Record the exact revision,
schema/client versions and scope, then obtain explicit final cutover approval.
This instruction is a constraint, not approval to perform that operation now.

D14 is later optional-in-time legacy-storage retirement, not unfinished functional
work that justifies an early switch. Keep the old schema/compatibility safety net
through post-cutover observation; removal requires its separate verified gate.

### DEC-08 — Priority migration cohort (confirmed 2026-09-12)

The user identified two priority accounts: P1 is the primary owner/main learner;
P2 is a recent learner with simple vocabulary. Preserve both by default. P1's
words, personal IDs/content, collections, SRS, history and pending operations must
survive intact. P2 might accept starting over only if no viable preservation path
exists; this is a fallback tolerance, not permission to reset/delete anything.
Any such proposal needs its exact affected data, recovery plan and separate
approval before execution. No other account becomes disposable by implication.

D01 client evidence may focus on these two users and all their active devices;
an exhaustive installed-population census is no longer the rollout planning gate.
User-reported platforms: P1 uses iOS and web; P2 uses Android and possibly web.
Installed builds, active device inventory and pending-sync state remain unverified.
P2's original email spelling was confirmed by the user and matched in Supabase
Auth. Both P1/P2 exact email-to-UID pairs were verified in the project's production
Auth dashboard on 2026-09-12, using the existing Chrome session. Resolved IDs stay
only in the private mapping; no account, session or permission was modified.
Shared schema changes must still be assessed for effects on other accounts.

Email-to-alias mapping is private local-only at
`reports/shared-dictionary-cefr/priority-accounts.json` (existing ignore rule).
Do not copy emails or resolved user IDs into portable docs, fixtures or SQL.
A fresh checkout without that private file must ask for the mapping privately;
never guess database identities from aliases. Read-only identity lookup completed;
this does not establish current app builds, word counts or pending sync state.

This clarification changes priorities, not implementation/release permissions or
the unresolved D02 identity/privacy contracts.

| ID     | Decision                        | Proposed default                                                       | Status                                               |
| ------ | ------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------- |
| DEC-01 | Content update policy           | Pin revisions; explicit adoption; protect active review                | accepted policy, 2026-09-21                          |
| DEC-02 | Personal content                | Owner-only overrides/fallback; no automatic public contribution        | accepted policy, 2026-09-21                          |
| DEC-03 | Meaning identity and UI         | Distinct meanings; one personal card per legacy key during transition  | transition policy accepted, 2026-09-21               |
| DEC-04 | Old-client support/retirement   | Reject conflicting linked legacy text; preserve queues; retirement off | compatibility accepted; release window remains gated |
| DEC-05 | Publication and CEFR provenance | Approved sources; input hashes; preserve reviewed levels               | safe default accepted for local D03                  |
| DEC-06 | CEFR schedule and spending      | Daily bounded job; provider/batch/cost caps decided from sample        | open                                                 |
| DEC-07 | Implementation scope            | Local synthetic D03; D01 evidence remains a release gate               | accepted 2026-09-21                                  |

Record accepted decisions with date, exact scope, rationale and affected stages.
A proposed default is not silently accepted by a later resume command.

## Authorization ledger

### AUTH-09 — Isolated native QA baseline

Granted 2026-09-12 by the user's explicit reply approving separate QA simulators
for mobile measurements. Scope: create task-owned disposable iOS/Android devices,
prepare/install local QA builds and synthetic fixtures there, and measure D01.4.
Never replace, reset, uninstall, log out or sync existing user apps/devices. No
production database mutation, cloud build purchase, deployment, account change,
dictionary implementation, commit or release is included. Reusable for this D01.4
baseline only. State: exercised and completed on 2026-09-12; 40 accepted native
samples saved. Both QA devices shut down; data/artifacts retained. Device IDs,
artifact provenance and limits are in the D01 native evidence. No other scope
was exercised or inferred from this approval.

| ID      | Scope                                               | State                      | Evidence / limits                                                      |
| ------- | --------------------------------------------------- | -------------------------- | ---------------------------------------------------------------------- |
| AUTH-01 | Create/update local plan and resume documents       | granted for setup          | User requested resumable stage plan and `/repo` entry                  |
| AUTH-02 | D01 read-only audit on explicit resume              | scoped                     | No remote writes, account changes, or paid enrichment                  |
| AUTH-03 | Local synthetic D03 schema/RLS implementation       | exercised, 2026-09-21      | Additive/dormant only; D01 remains mandatory before release            |
| AUTH-04 | Commits / push / PR / merge                         | not recorded for this task | Record each allowed operation; no inherited blanket release permission |
| AUTH-05 | Hosted schema changes or production backfill        | not granted                | Need environment, reviewed artifact/revision, operation and limits     |
| AUTH-06 | Public dictionary publication                       | not granted                | Need approved sanitized content and publication scope                  |
| AUTH-07 | Paid CEFR sample / bulk calls / schedule activation | not granted                | Need provider budget, batch/cost caps, target and cadence              |
| AUTH-08 | Web/native deployment or destructive retirement     | not granted                | Need exact release/retirement approval                                 |
| AUTH-10 | Local D04 shared contracts and synthetic tests      | exercised, 2026-09-21      | User explicitly authorized local D04; no remote/runtime activation     |
| AUTH-11 | Local D05 server paths and compatibility tests      | exercised, 2026-09-21      | User explicitly authorized local D05; additive/dormant, local-only     |
| AUTH-12 | Local D06 tooling and disposable rehearsal          | exercised, 2026-09-21      | User continued after the D06 handoff; no hosted apply or cutover       |
| AUTH-13 | Local D07 mobile SQLite storage and tests           | exercised, 2026-09-21      | User explicitly continued at D07; local-only, no app release           |
| AUTH-14 | Local D08 mobile sync, UI and synthetic tests       | local review completed     | Implementation/review/tests done; D08.4 device scope remains separate  |
| AUTH-15 | Isolated D08.4 native and local-stack QA            | completed, 2026-10-02      | Final native acceptance passed; task resources stopped before deadline |

Historical one-off performance release approval was consumed by the earlier
performance work. It does not authorize these operations. Do not request broader
organization access to work around a project-specific permission boundary.

### AUTH-03 — Local synthetic D03 implementation

Granted 2026-09-21 by the user's explicit confirmation after the D02 handoff and
model switch. Scope: implement and verify the additive shared-dictionary schema,
constraints, RLS, invoker read surface, local generated target contract and
synthetic PostgreSQL tests on a branch created from current `main`. Outstanding
D01 Android and full learning-queue evidence may remain open during this local
work but stays mandatory before release. New behavior must remain dormant and the
legacy application path authoritative. No hosted migration, production/staging
mutation, live backfill, source publication, paid CEFR call, schedule activation,
deployment, cutover, destructive cleanup, commit, push or PR is included. State:
exercised and completed locally on 2026-09-21.

For any new approval record: date, user instruction summary, environment, exact
target/artifact, limits, single-use/reusable scope, and state (unused/consumed/
revoked/expired). Never store tokens, share URLs, passwords or account secrets.

### AUTH-10 — Local D04 shared contracts

Granted and exercised 2026-09-21 by the user's explicit instruction to continue
local D04. Scope: create/refine the dependency-free shared dictionary/CEFR
contracts, validators, deterministic resolver/canonical-input behavior and
synthetic mobile/web/Edge tests in this checkout. D03 remains local-only and D01
release gates remain open. No hosted migration/data mutation, deployment, public
publication, paid call, schedule, activation, commit, push or PR is included.

### AUTH-11 — Local D05 server paths and compatibility

Granted 2026-09-21 by the user's explicit instruction to continue local D05.
Scope: implement and verify additive dormant server-side dictionary capability,
trusted/idempotent content commands, canonical analysis/cache mapping, bulk
effective-content reads, legacy coexistence guards/projection, and synthetic
PostgreSQL/Edge/web compatibility tests in this checkout. The legacy read/write
path remains authoritative and every activation flag must default off. No hosted
migration or data mutation, deployment, production/staging activation, public
publication, paid call, schedule, cutover, destructive cleanup, commit, push or
PR is included. State: exercised and completed locally on 2026-09-21; evidence is
recorded in `evidence/D05-server-compatibility.md`.

### AUTH-12 — Local D06 tooling and rehearsal

Granted 2026-09-21 by the user's continuation after the D05 completion/D06 handoff.
Scope: local dry-run/backfill tooling, synthetic disposable database rehearsals,
preservation/concurrency/recovery tests and durable evidence. No hosted execution,
real-account mutation, public publication, paid calls, activation, deployment,
commit, push or PR. State: exercised and completed locally on 2026-09-21.
Evidence: `evidence/D06-backfill-rehearsal.md`.

### AUTH-13 — Local D07 mobile storage

Granted 2026-09-21 by the user's explicit continuation after the D06 handoff.
Scope: non-destructive SQLite v13 migration, local dictionary revision/assessment
cache, owner-scoped card state and pending content-command storage, repository
parsing/materialization, and synthetic file-backed SQLite tests in this checkout.
No hosted mutation, production data access, device/app replacement, deployment,
activation, commit, push or PR. State: exercised and completed locally on
2026-09-21. Evidence: `evidence/D07-mobile-storage.md`.

### AUTH-14 — Local D08 mobile synchronization and integration

Granted 2026-09-21 by the user's explicit instruction to continue after the D07
handoff. Scope: locally implement and verify mobile dictionary dependency/card
synchronization, revision-cursor refresh, offline content commands, effective
content/CEFR integration in add/edit/list/detail/review surfaces, and synthetic
cross-account/restart/compatibility tests in this checkout. Existing learning
protocol 2 remains authoritative and all shared-dictionary runtime flags remain
off by default. No hosted mutation, production data access, real-user sync,
device/app replacement, deployment, activation, paid calls, commit, push or PR.
State: local implementation, GPT-6 Astra / High review/fixes and synthetic
verification exercised on 2026-09-21. The user confirmed the model switch and
continued the review. No remote/device scope was exercised. See
`evidence/D08-review.md`; D08.4 disposable-device/local-stack scope remains separate.

### AUTH-15 — Isolated D08.4 native and local-stack QA

Granted 2026-09-21 by the user's explicit reply after the D08 review handoff.
Scope: create separate task-owned disposable iOS and Android simulators/emulators,
prepare and install fixed-bundle local QA builds from the current uncommitted tree,
run a loopback-only disposable Supabase stack with the local migrations and only
new synthetic `example.invalid` identities, enable dictionary protocol flags only
inside that stack/build, and execute D08.4 native/web/returning-client scenarios.
The already running user simulator, installed user apps, retained D01 artifacts,
production accounts/data and all hosted projects must remain untouched. Local
build/network inspection and task-only shutdown are included. Cloud/EAS builds,
hosted mutation, real-user sync, paid calls, public publication, deployment,
release activation, destructive cleanup outside the new task artifacts, commit,
push and PR are excluded. State: exercised on 2026-09-21; initial platform
evidence is recorded in `evidence/D08-platform-qa.md`. The remaining native
content acceptance is not complete. Native operations were paused by the user
on 2026-09-26 and explicitly resumed on 2026-10-01 with "Resume QA on devices".
This resumes the same isolated scope only: iOS
`DDEDCE4E-153B-48A4-A47C-B4ED0F499F1F`, Android AVD
`woordenaar_d08_qa_20260921` on port 5584, Docker project
`woordenaar-d08-qa.ZFsE50`, loopback services and synthetic identities.
Other sessions' devices remain out of scope. Durable ignored artifacts now live
under `reports/shared-dictionary-cefr/`; portable evidence is recorded in
`evidence/D08-native-content-qa-20261001.md`.

### October 2 — Task-only shutdown before another project runner

User required finishing current work and stopping task emulators/simulators
before 02:30 Europe/Amsterdam. AUTH-15 shutdown scope exercised immediately:
exact D08 iOS/Android stopped, four task QA containers stopped without removing
volumes, task proxy/web and named browser closed. No other-session resource was
operated; no data reset/deletion or production/schema-switch authority granted.
Native/device work is paused until an explicit user resume. D08.4 review remains
pending; the saved next action is local GPT-6 Astra / High closure review.
Evidence: [task shutdown](evidence/D08-task-shutdown-20261002.md).

### October 2 — Deadline-bounded continuation and D08 closure

After task-only shutdown, the user explicitly resumed current work with periodic
clock checks and a hard 02:30 Europe/Amsterdam finish/save deadline. Closure review
found and fixed a store-only reanalysis personal-state race. Completed local tests
and incremental native rebuild/smoke within AUTH-14/AUTH-15's original task-only
scope. This continuation superseded the prior session pause; no scope expansion
to other devices/projects or production. QA cutoff set at 02:15; final task-only
shutdown was verified at 01:38, with data/volumes retained and all faults disabled.
D08.4/D08 complete; D09 is next but not started. Current next-stage model routing:
GPT-6.1 Sol / High, using the Sol model the user already made available.
No release/cutover/paid call/Git publication or destructive retirement authority.
Evidence: [final closure review](evidence/D08-final-closure-review-20261002.md).

### AUTH-16 — Scheduled D09 continuation and autonomous model routing

Granted 2026-10-02 after D08 closure: the user authorized continuation at 06:00
Europe/Amsterdam and autonomous selection/switching of model and reasoning effort.
Use GPT-6.1 Sol instead of GPT-5.6 Sol for future Sol work; D09 uses High.
Apply the plan's Astra escalation/review rules when needed. Announce and confirm
actual switches through available controls; report unavailable controls honestly.
This supersedes the earlier manual-switch requirement for this task only.
Same-thread heartbeat `d09-06-00` was created ACTIVE and verified, with one
06:00 occurrence on October 2 and instructions to pause after the run. Earlier
unrelated paused automations were left unchanged. Local D09 work starts at D09.1;
all implementation and QA stays stopped until then. Existing task-only device
isolation remains mandatory. No production/cutover, publication, deployment, new
paid operations, commit, push, PR or merge authorization is added.

### AUTH-17 — Local D10 continuation

Granted 2026-10-02 by the user's explicit continuation after D09 closure. Scope:
local compatible official/shared/bundled import and export contracts, dormant
server/client integration and synthetic verification in the existing checkout.
Preserve immutable published manifests, personal IDs/SRS/history and all pending
queues. QA only task-owned resources listed in the handoff, when needed; no other
session/device operation. No production/cutover, deployment, public publication,
paid provider, commit, push, PR or merge. State: local implementation in progress.
Autonomous model/effort authority from AUTH-16 remains in force.

### AUTH-18 — Local commits and D10 Astra review

Granted 2026-10-02: user explicitly requested necessary commits and continuation,
and confirmed selecting GPT-6 Astra / High. Local commits on the existing feature
branch may preserve the shared-dictionary task's reviewed implementation, tests
and sanitized task documentation. Do not include unrelated/private QA artifacts,
credentials or the locally excluded root AGENTS.md. No push, PR, merge, production,
schema cutover, deployment, publication or paid operation is authorized. Continue
D10 review/fixes within the existing stage boundary and task-only QA constraints.

### October 2 — D10.3 recovery technical review completed

Within AUTH-17/AUTH-18, accepted the [recovery implementation contract](evidence/D10-target-recovery-contract-20261002.md)
after the user's requested Astra model-switch confirmation. Durable personal-ID
origin and version/placement CAS fence delayed imports/recovery; terminal
cancellation precedes unsettled-import deletion; separate placement debt prevents
stale receipt acknowledgement from echoing an older target through generic sync.
This is an engineering decision under existing scope, not a new user policy or
release approval. Pre-upgrade provenance and legacy direct-write coexistence remain
explicit gates. SQL baseline 3/3 and model 10/10 (40,320 orderings) support the
review's stated limits; production/SQLite recovery implementation is still pending.
Review/test commit `b92eba9`; next GPT-6.1 Sol / High for contract checkpoint 1.

### October 2 — Recovery server and SQLite implementation checkpoint

Sources `1828f57` and `1748066` implement accepted-contract checkpoints 1–3 under
AUTH-17/AUTH-18. This supersedes the preceding architecture note's implementation
pending state. Exact v14 origins are retained; v15-only markers remain unknown,
without reconstructing origin or acknowledging placement. New SQLite write paths
use exclusive transaction handles and owner guards before/after mutations. This
is local engineering progress, not new release authority. Next checkpoint 4 on
user-confirmed GPT-6.1 Sol / High connects sync/deletion; entrypoints are not yet
wired. Astra review and native/both-client acceptance remain open.

### October 2 — R1/R2 review repair routing

Under AUTH-17/AUTH-18, ordinary settled mobile import moves reuse the existing
immutable recovery request/receipt protocol with persisted expected placement and
version. This removes the current client's unguarded metadata delivery route;
retained debt without a durable base requires explicit Saved imports recovery.
Cancellation acknowledgement hands pending status to ordinary tombstone delivery.
[Repair evidence](evidence/D10-recovery-review-repairs-20261002.md). No new schema
or release authority. Astra re-review and integrated acceptance remain open.

### October 2 — Device availability restriction for web implementation checkpoint

Latest user continuation permits local D10 work but requires notification before
using a simulator/emulator: the user will first pause its use in another session.
Do not infer current device availability from earlier off-state evidence. No device
operation until availability is explicitly handed back. This does not block local
web implementation/tests or necessary local commits under AUTH-17/AUTH-18.

### AUTH-19 — D10 assigned native devices handed back

Granted 2026-10-02 after web acceptance `6d3d355`: user explicitly permits the iOS
simulator and Android emulator. This satisfies the pending availability handback
for iOS `DDEDCE4E-153B-48A4-A47C-B4ED0F499F1F` and Android AVD
`woordenaar_d08_qa_20260921` / `emulator-5584` only. Existing local QA scope and
AUTH-18 commits remain; no other sessions/devices, production, schema cutover,
publication, deployment or paid operations. Preserve installed apps and all data.

### AUTH-20 — Local D11 continuation

Granted 2026-10-02: user confirmed the requested GPT-6.1 Sol / High switch and
continued after D10 closure. Scope: D11 local contract, persistence and bounded
worker implementation with synthetic/fake-provider verification in the existing
branch. AUTH-18 necessary local commits remain authorized. Retained native QA
resources remain off until needed; no other session devices/resources. No paid
provider sample, schedule activation, hosted migration, production/cutover, public
publication, deployment, push/PR/merge. DEC-06 budget/cadence remains open.

### October 2 — D11.1 review and calibration/worker engineering contract

Under AUTH-20/AUTH-18, user-confirmed Astra / High review passes the dormant D11.1
contract (`a756680`). The [engineering contract](evidence/D11-calibration-worker-contract-20261002.md)
selects offline fixture/report validation and fail-closed qualification, then
published-meaning-only selection, lease/head CAS completion and conservative
atomic attempt budgets. This is local engineering direction, not new user source,
quality, spending, publication or runtime approval. No analysis-cache/client
candidate may be cast into a dictionary assessment. Worker provenance may not
self-approve or borrow unrelated approved sources. D11.2 stays partial until real
reviewed evidence and an authorized sample qualify the method; synthetic labels
prove test mechanics only. DEC-06 and all live gates remain open. Next Sol 6.1 /
High for the offline checkpoint; devices/retained backend not needed.

### October 3 — D11.2 offline continuation

User explicitly resumed `/repo continue` and confirmed GPT-6.1 Sol / High.
AUTH-20/AUTH-18 continue to cover local offline mechanics and necessary commits.
This supersedes the October 2 pause without adding live source/provider, spending,
runtime, deployment or Git publication authority. D11.2 real quality stays open.

### October 3 — D11 invocation/budget continuation and model announcements

User explicitly continued and requested the required model before each next
checkpoint. Announce the saved recommendation at every transition; do not claim
an automatic picker change. AUTH-20/AUTH-18 local implementation, fake-provider
verification and necessary commits remain in force. This adds no live spending,
source, deployment, scheduler or Git publication approval. Local D11.6–D11.7
mechanics are implemented under the accepted engineering contract; next Astra /
High review. Real pricing/bounds and DEC-06 remain open; control defaults OFF.

### October 3 — Autonomous D11 meaning review without a teacher

User explicitly continued and stated that no teacher is available and the assistant
should do the work. This resolves the pending reviewer clarification and overrides
the earlier teacher prerequisite for the local diagnostic pilot. The assistant may
review meanings and produce clearly labeled provisional model bands using public
lexical sources. This does not create an independent gold set, calibrated accuracy,
provider transmission permission, spending or publication authority. Do not ask
for a teacher again to continue this local path. Reference unknowns stay unknown.

Use a separate diagnostic agreement report; the reviewed-fixture qualifier remains
unchanged. AUTH-20/AUTH-18 local implementation/fake testing/necessary local commits
continue. Prepare the collector before requesting any exact live authorization.
Next GPT-6.1 Sol / High, announced before the checkpoint. Actual model attribution
for this review remains unverified; no external reviewer or subagent was used.

### October 3 — Dormant live-runner integration boundary

AUTH-20/AUTH-18 cover the resumed local runner, fake HTTP tests, disabled operator
registry template and necessary ordinary local commits. Public draft/template,
nonempty evidence references and local readiness checks do not create human
account/source/spending approval. Account/project/key membership, paid tier and
control billing need external verification and exact later authorization. A private
registry binds that evidence to one immutable bundle/draft/runtime, key digest,
run directory/UUID and UTC day; changing or deleting the journal must not reuse the
approval. Current template is unapproved; zero real-provider calls. Next Astra /
High technical review, announced before transition. Teacher availability stays
resolved; independent gold quality and live acceptance remain open.

### October 3 — Signed-in personal-account inspection permission still pending

After the unapproved live-pilot packet, the user replied "Continue" to a question
about read-only personal Google account/project/key-binding inspection. Automatic
approval review rejected opening the signed-in AI Studio API-keys page because
that reply was not explicit enough for private account/key metadata. No key,
account, provider or paid operation was accessed, and no alternate route was used.
An exact read-only permission request is pending. This creates no source
transmission, spending, registry activation or execution authority; AUTH-20 and
the disabled defaults remain unchanged.

### October 3 — Personal-account console and billing inquiry authorization

The user explicitly authorized the two pending actions only for the Google
account `oldrefery@gmail.com`: read-only Google Cloud Console Credentials
inspection for its personal projects, and sending the prepared account-free
control-billing inquiry to Google Cloud Billing Support from that same account.
This does not authorize revealing/copying key values, changing credentials or
billing settings, purchases, source transmission, paid provider calls, registry
activation or use of any work account. The external inquiry is one message; its
actual delivery and case identity must be checked before retrying an uncertain
submission.

### October 3 — Small paid diagnostic permission and billing-account boundary

The user subsequently allowed a small paid model diagnostic without another
spending prompt, with costs to be analyzed afterward, while retaining the
`oldrefery@gmail.com` account restriction. The frozen proposal's $2 API-use
ceiling remains the local maximum; this permission does not change credentials,
buy credits, publish results or activate the production worker. The exact
application key/project binding, direct REST control charges and applicability of
the four app-limited inputs still need evidence before the disabled runner can be
made executable. Do not infer an actual run from the permission.

Read-only Google Cloud Console Credentials inspection verified the personal
account and Gemini API restrictions on the available keys, with no bound service
account shown. The key value was never displayed; the UI did not establish the
application's secret-to-project match. The billing assistant requires selection
of a billing account before the prepared question can be submitted. Automatic
approval review rejected opening the Cloud Billing page to establish that link
because it exceeded the prior Credentials/support authorization. No alternative
route was attempted. A separate exact read-only billing-page permission question
is pending. The support message has not been sent.

### October 3 — Personal billing/limits inspected; support inquiry canceled

The user explicitly authorized read-only Billing and limits inspection under
`oldrefery@gmail.com`, then directed that no question be sent to support. This
revokes the earlier one-message authority; the draft remains unsent and must not
be submitted on resume. The personal Gemini API project was visibly linked to a
paid Cloud Billing account in EUR. Its active €10 monthly billing-account budget
has alerts at 50%, 90% and 100% but no spend cap; the former €5 project budget
is expired. Google AI Studio showed paid Tier 1, no configured project monthly
spend cap, and Gemini 3.5 Flash limits of 1,000 RPM, 2,000,000 input TPM and
10,000 RPD. AI Studio warns of delayed spend reporting and an automatic Postpay
to Prepay transition after October 12. The local $2 pilot reservation, if ever
executed, must remain the operative per-run control. No payment detail, billing
identifier or key value was persisted in the repository. Exact application key
binding and direct REST control-method cost remain unresolved.

### October 3 — Explicit read-only personal AI Studio access

The user then explicitly authorized the signed-in Google AI Studio API-keys page
inspection and continued. This approval was used for read-only API-keys, Projects
and Billing views in the personal profile. Two imported projects showed paid Tier
1 Postpay and masked keys under one billing account. Neither the app's exact
key/project match nor key type/restrictions was proven. No key value or account
identifier was persisted in the repository, and no settings, purchase, provider
request or paid pilot action occurred. This permission is consumed for the stated
read-only inspection and does not authorize private credential retrieval, source
transmission, paid requests, registry activation or billing-plan changes.

### October 3 — Exact D11 source transmission and one-run key use

After reviewing the destination and content, the user explicitly authorized
transmitting the frozen 24 meaning inputs in
`evidence/D11-gemini-live-request.proposed.json` to the Google Gemini Developer
API. This includes the four bundled app entries. The prior small paid diagnostic
permission and personal-account-only restriction remain in force. The user also
explicitly authorized revealing an existing key from the personal `oldrefery`
project and storing it in an owner-only local file for one D11 run; this does not
authorize creating or rotating keys, using a work account, changing billing
settings, deployment, publication or a support message.

AI Studio visibly confirmed `oldrefery@gmail.com` and a key in its paid personal
Gemini API project. The key was copied into an owner-only private temporary file
outside the repository; no key value or local secret path is committed. Opening
the details card unexpectedly exposed the key value in the tool's technical
output, contrary to the intended no-trace handling. Do not reproduce the value;
recommend owner rotation after this one-run use. No provider request has yet been
made. The direct REST control-cost maximum remains unverified, so the proposed
hard $2 ceiling cannot be asserted. A precise question on accepting an estimated
instead of guaranteed ceiling for at most one generation per meaning is pending.
The temporary key and draft copies were removed before the session boundary;
no credential file remains from this checkpoint.

### October 3 — Alternate personal-account billing inspection

The user authorized read-only billing inspection of `curysef@gmail.com` to check
whether the D11 key might belong to that account. AI Studio verified this
identity and showed two imported Gemini API projects, each with a masked key on
Free tier. The visible billing account had zero linked projects and requested
prepay setup. No key was revealed, copied or used; no billing change or provider
request occurred. The inspection cannot match the deployed app secret to an
account. It does not extend the previous one-run `oldrefery` key permission to
`curysef` or answer the pending estimated-cost policy question. Keep the
provider runner disabled and the support inquiry canceled.

### October 3 — Partial key identifier comparison

The user supplied a partial Gemini key identifier. On the verified
`oldrefery@gmail.com` AI Studio API-keys page, its last four characters
matched the masked `Generative Language API Key` in the paid `Gemini API`
project. Neither of the two visible `curysef@gmail.com` keys matched. AI
Studio masked the fifth character from the user-supplied suffix; the deployed
Supabase secret was not read or compared. This is strong account/project
evidence, not an exact app-secret binding. No full value was opened or copied,
and no provider request, source transmission, key change or billing change
occurred. Prior one-run key authority remains scoped to `oldrefery`. The
cost-policy decision remains pending.

### October 3 — One-run estimated Gemini cost policy accepted

The user explicitly accepted an estimated, not guaranteed, $2 ceiling and
instructed D11 to continue. Scope is one run of the previously authorized 24
frozen inputs through the personal `oldrefery` Gemini key, with at most one
generation attempt per meaning, 24 token counts and one model metadata request.
The published generation reservation is $0.956736. The exact direct REST
control-method charges remain unknown; no registry may label their assumed
cost as a verified maximum or claim a hard $2 total. Preserve the private
journal, immutable run binding and stop-on-unknown-control behavior. A failed
or incomplete run is not authority to start another. No support inquiry,
production worker activation, publication or deployment is authorized.

### October 3 — First live attempt consumed the one-run approval

One authorized `--execute` was issued after a successful private `--check`.
The preserved private journal contains one model metadata control reservation
with no receipt; no token count, generation attempt or source input was sent.
The control outcome and possible charge are unknown. A private unqualified
report was written and the temporary credential file deleted. Do not retry
this registry or create another run from the same approval. The cause is not
proved by public connectivity checks or the unavailable AI Studio Usage page.
Local fake-only diagnostic improvements remain within existing implementation
authority; any new provider request requires a new explicitly scoped user
authorization. The canceled support inquiry stays unsent.

### October 3 — One new personal Gemini run authorized

The user separately authorized one new run with the same 24 frozen
meanings through the personal `oldrefery@gmail.com` key, at most one
generation per meaning, and an estimated $2 API-use figure without a
guaranteed hard bound. This scope does not revive the consumed first
registry. It permits one new immutable registry/run binding and one
`--execute`; a partial or uncertain outcome consumes the new approval.
The support inquiry, worker activation, publication and deployment
remain excluded.

### October 3 — Second live attempt consumed its separate approval

The second `--execute` stopped after one model metadata control
reservation and local `validation` failure. No frozen meaning input,
token-count control or generation was sent. Preserve the second private
journal/report/consumption record, treat the control charge as unknown,
and do not replay or replace this run under its consumed one-off
permission. Investigating the exact metadata shape through one
provider probe requires a new, separately scoped approval. The
canceled support inquiry remains unsent.

### October 3 — Up to five further personal Gemini attempts

The user authorized at most five additional attempts under the personal
`oldrefery@gmail.com` Gemini key and an approximate $10 total for all five.
This is an estimate, not a guaranteed hard spending limit. Prior two one-run
grants remain consumed and their registries must not be replayed. The first
new attempt is limited to a metadata-only model `GET`, with no meaning input
and no generation. Count it when `--execute` is invoked, even if the outcome
is uncertain; inspect the durable consumed/result files before any subsequent
operation. Remaining attempts before this dispatch: five. The canceled
support inquiry stays unsent. No production activation, publication, billing
changes or deployment is authorized by this grant.

The metadata-only probe was dispatched once and returned HTTP 200. It consumed
attempt 1 of 5. Its sanitized result identified absent `baseModelId`; no
meaning input, token count or generation was sent. Four attempts remain under
the same approximate combined figure. The temporary personal key was removed.
No earlier registry is eligible for replay.

The next full pilot was dispatched once and completed all 49 allowed requests:
one model metadata read, 24 token counts and 24 generations. It consumed
attempt 2 of 5; three remain. The private report stays unqualified because
the reference is not independent gold and both ambiguity probes received
levels rather than abstentions. No completed registry may be replayed.
The temporary key was removed; the combined $10 estimate remains approximate.

The distinct v3 full pilot was dispatched once and completed all 49 allowed
requests. It consumed attempt 3 of 5; two remain. The temporary key and
transfer scripts were removed. Both intentional ambiguity probes abstained,
compared with 0/2 under v2, and the same 19 provisional bands agreed exactly.
The reference is still assistant-inferred rather than independent gold, so
this is diagnostic improvement, not quality qualification. The worker and
schedule remain disabled. No fourth attempt is justified on the unchanged
fixture without a new evidence question. The combined $10 figure remains
approximate; direct REST control charges are unknown.

### October 4 — D11.2 offline diagnostic scope accepted

After reviewing the [quality-gate decision](evidence/D11-quality-gate-decision-20261004.md),
the owner chose the recommended narrower D11.2 outcome: finish the local
diagnostic using assistant-provisional labeling while keeping operational
qualification false. The [closure record](evidence/D11-offline-diagnostic-closure-20261004.md)
binds the already completed 24-input v3 pilot and its frozen reference;
it does not create independent CEFR gold or a prospective production
policy. The original independent meaning-level quality gate remains a
separate D11 stage-exit and worker-activation prerequisite. This choice
does not permit transmission of the separate 27-input candidate pool,
repeat the 24-input pilot, spend the two remaining attempts, activate
the worker, push, open a PR, migrate, publish or deploy.

### October 4 — Full D11 stage exit retained

After the dormant D11.3–D11.7 checkpoints were accepted locally, the owner
asked how else quality could be verified and requested full completion of
the item. This selects option 1 of the
[stage-exit choice](evidence/D11-stage-exit-choice-20261004.md): retain
the original independent meaning-level quality, adequate denominators,
prospective policy and separately approved live-sample gate. The
[source and measurement audit](evidence/D11-independent-quality-options-20261004.md)
is preparatory evidence, not a reviewed gold set or authorization to send
new inputs. The existing two Gemini attempts remain restricted to the
original 24. Worker/schedule stay off; D11 remains in progress.

### October 4 — Full-quality route selected; teacher corroboration reported

The owner explicitly selected option 1 of the proposed D11 resolution:
retain the full original quality gate. They also reported that their
earlier ratings coincide with a teacher's ratings. This corrects the
earlier assumption that the feedback has no external corroboration,
but the teacher's exact sense coverage and independent timing are
still unknown; see the [feedback follow-up](evidence/D11-owner-review-feedback-20261004.md).
Use any verifiable teacher judgments as seed development evidence
without rewriting the frozen v3 pilot or counting its retrospective
agreement as held-out accuracy. A new adequately covered prospective
pool, reviewed policy and separately approved new-input live sample
remain required. This choice authorizes local preparation under
AUTH-20/AUTH-18, not new provider transmission, worker activation or
remote publication.
