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
