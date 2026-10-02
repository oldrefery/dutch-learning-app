# D03 independent schema review

Date: 2026-09-21. Reviewer model: GPT-6 Astra / High, as selected by the user.
Scope: local additive SQL, grants/RLS, synthetic tests and target type generation.
Branch: `feature/shared-dictionary-schema`; base HEAD: `c5dfb14d49b9`.
All changes are uncommitted. No hosted schema/data, account/device, deployment,
source publication, paid enrichment or scheduled job was changed.

## Findings resolved

1. A NULL predecessor made the protected CEFR head check evaluate to unknown;
   deleting/recreating or moving a head also bypassed its update guard. Successors
   now use NULL-safe comparison, head identities cannot move, and deletion is
   denied. Reviewed-but-unlocked assessments also require an explicit reviewed
   successor; a locked head additionally preserves its lock.
2. New cards could link retired content. Only published entries/revisions permit
   new links. Existing unchanged pins remain readable/resendable after retirement.
3. Changing an entry's identity changed the meaning behind existing immutable
   revisions. Identity is frozen after the first revision; published entries
   cannot return to draft, and revision-head keys cannot move to another entry.
4. Immutable receipt DELETE guards broke existing account-deletion cascades.
   A receipt may now be deleted only when its owning card is actually absent.
   Direct deletion and mutation remain denied; tombstones retain receipts.
5. Private state could store a full duplicate fallback on a linked card or omit
   the fallback on an unlinked card. Deferred guards validate final transaction
   layout across words/content-state, allowing atomic link/detach in either order.
6. Publication, provenance edits, retirement and head deletion needed shared parent
   row serialization. Locks now protect those transitions; overlap tests wait for
   real PostgreSQL locks rather than relying on timing sleeps.
7. Trusted-worker ALL grants included TRUNCATE, which bypasses row guards. New
   tables explicitly revoke inherited grants and grant only guarded DML/read.
   Client-grant defaults, anonymous reads and forged request flags are tested.
8. Type generation exposed a temporary PostgreSQL port on all host interfaces and
   could leave anonymous Docker volumes. It now runs the official Postgres Meta
   engine on a task-owned internal network without published ports, uses tmpfs,
   bounded commands and exact-name container/volume/network cleanup. The manifest
   pins multiarchitecture image digests and rejects a stale migration head.

The first six added regression cases failed against the pre-review migration
(8 pass / 6 fail), then passed after the fixes. Further coverage proves source
approval/digest enforcement, private ownership, current-head movement without
personal adoption, and no CEFR inheritance when the assessed input changes.

## Verification

All results below refer to the final local working tree, not a remote CI run.

- `npm run test:db`: **145/145 passed**, including all **20/20 D03 tests**;
  fresh schema, upgrade, non-owner roles and concurrent sessions; 84.1 seconds.
- `npm run supabase-contracts:target:generate`: passed using isolated Docker
  PostgreSQL 16 and pinned Postgres Meta 0.99.0.
- `npm run supabase-contracts:target:check`: passed after the final SQL/grants;
  generated target matches exactly. Deployed `database.generated.ts` unchanged.
- `npm run typecheck --workspace @woordenaar/supabase-contracts`: passed.
- `npm run lint:ci`: passed.
- Full formatting initially flagged only the edited handoff table; corrected
  and rechecked at session closure. Explicit formatting also covers both `.mjs`
  files, which are outside the repository-wide extension glob.
- `git diff --check`: passed. Exact `woordenaar-types-*` container/network
  inventory is empty after generation/check. No test process remains running.
- Both pinned image manifests include Linux arm64 and amd64. Native local DB
  tests used PostgreSQL 15; generation replayed migrations on Docker PostgreSQL 16.
  This is not evidence of a remote CI or hosted deployment.

Local commands used Node 24 via `/opt/homebrew/opt/node@24/bin` and
`WOORDENAAR_PG_BIN=/opt/homebrew/opt/postgresql@15/bin`. No application env file
or hosted credential was loaded. Docker/PostgreSQL tests required local sandbox
permission for the disposable infrastructure only.

## Artifact fingerprints (SHA-256)

- Migration: `e97a31d8b28ff8858193e0d1b2d937dc0ab81715db6ddefe391625377ea8b884`
- D03 tests: `7232b7e5bb496e31a86e660e58bc7b0edc230ef8e806cd848f0d79cca6ac36c9`
- Target generator: `2002f8b9215933601365091e61b667af86eff62720e5b615f26036ccfee72aa2`
- Generated target: `6f33520517aa0ce1e46bd44ef69c1c47bd1599b6124ff0fbe727abf38461dc13`

## Explicit downstream gates

D03 adds dormant structures, not a usable content-write API. No unresolved D03
review finding remains. D04 must supply strict linguistic field/value/schema
validation, canonical hashes, effective-content and CEFR applicability rules.
The SQL currently validates object/tag layout, not the entire future payload.
D05 must enforce those validators at trusted commands, require complete migrated
state, guard legacy writes, serialize receipts and implement commit-safe cursors.
Missing content-state rows remain valid for unmigrated legacy cards in D03.
No backfill or activation may bypass those stages. Existing client code does not
import the target contract. D01 Android/full learning-queue evidence remains a
release gate, and production cutover remains gated until the end.

Generator implementation was checked with Context7's official
[Postgres Meta source](https://github.com/supabase/postgres-meta/blob/master/src/server/constants.ts)
and the actual pinned image's constants. It no longer depends on CLI-to-host
network routing; do not restore the former LAN-port workaround.
