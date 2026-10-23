# D13A.3 — Following storage and read checkpoint

Date: October 10, 2026, Europe/Amsterdam. Model: GPT-6.1 Sol / High, using the
owner-confirmed setting from D13A.2. Status: this local storage/read checkpoint is
complete; **D13A.3 remains in progress**. No hosted migration or runtime activation.

## Implemented contracts

Additive migration `20261010090000_add_dictionary_following_reads.sql` defaults all
existing words to `legacy` and the new `following_reads_enabled` flag to FALSE.
No card is converted. A trusted later conversion may select `follow` only with a
published, delivery-tracked shared head and enabled compatible reads. Direct users
cannot set the mode. Following state rejects fallbacks/overrides transactionally;
content writes remain guarded even if the older legacy guard is disabled.

Following effective reads join the current published head. The stored personal
revision remains adoption provenance, so publishing/rolling back shared content
never rewrites personal rows, updated_at, collection or learning. Existing legacy
pins/private overrides retain their deployed behavior. No new private-analysis store,
second publication log, or per-person publication fanout.

Protocol2 returns owner-only references, deduplicated immutable revision dependencies,
explicit modes, adopted/applied revision IDs, head sequence and a snapshot watermark.
Every new BIGINT is a canonical decimal string. Domain parsers reject missing or
wrong-entry dependencies, duplicate cards/revisions, unpublished following content,
private overlays, malformed/overflowing sequences and inconsistent cursor pages.
Sequence comparisons use validated BigInt values, including adjacent values above
JavaScript's safe integer boundary.

The existing transactional delivery log/cursor is reused, with an index for per-entry
revision head sequences. Rollback to an older revision generates a newer sequence.
The new capability advertises enabled read/command versions separately. Shared
analysis remains explicitly unavailable until its operation implementation exists.
Review snapshot3 adds the versioned batch without changing snapshots1/2 shapes.
Explicit ID requests are bounded to1000; full owner review snapshots to10000,
including libraries above1000. Clients must hydrate before acknowledging watermark;
client cache/session integration remains D13A.5, not completed by server/domain work.

Version1 effective reads adapt following rows to their actual current revision,
matching strict content and empty removed-field overrides. Newly submitted v1 content
commands on following rows fail with existing `legacy-content-upgrade-required`
before mutation/receipt. Existing applied receipt replay retains original semantics.
Learning remains independent. V1 decimal-unsafe numeric cursors/content versions fail
explicitly. Exact embedded/build85 SQLite/device compatibility remains D13A.7's gate;
a successful SQL wire adapter alone does not authorize cohort conversion.

Privileged reads pin an empty search_path, qualify relations, check auth.uid ownership
and explicitly revoke/grant execution. No new private helper privilege is granted
to callers. Existing historical migrations, approved sources, revisions and OTA
artifacts remain unchanged. No administrator membership or analysis publication
permission was created in this checkpoint.

## Validation and environment

[Machine-readable evidence](D13A-following-reads-20261010.json) records final source
hashes, exact commands, log hashes, outcomes and environment limits. All values in
new tests are synthetic. Raw logs, mirrored test files and the temporary backend
adapter are local-only under `reports/shared-dictionary-cefr/d13a3-reads-20261010/`.

- Final following PostgreSQL suite:16/16, including two owners, deduplication,
  publication without fanout, later-review preservation across content rollback,
  concurrent uncommitted head visibility, old commands/direct writes, missing head
  events, disabled flags, snapshots above1000, privileges and large BIGINT cursors.
- Domain final focused suites:2/28, including original strict/private contract and
  new following parser/sequence tests.
- Full mobile:158 suites/1829 tests/22 snapshots; coverage gates passed.
- Full web:86 suites/780 tests;1 existing skipped suite/test.
- Mobile build/test, domain, target contracts and web typechecks passed.
- Full root lint with zero warnings passed. Relevant source/document formatting
  and git diff check passed. Target schema types generated and exact check passed.
- Prior command/import/recovery/schema regressions:71/71 (34 command/import/recovery,
  37 mapping/schema). Together with16 new read cases:87/87 local PostgreSQL cases.
  The existing schema suite includes its earlier migration-stage fixtures; this
  aggregate is not a new full release acceptance matrix.

Node24.20.0/npm11.19.0 selected explicitly from the existing nvm installation.
Host PostgreSQL15 could not initialize because the Mac's shared-memory segment
limit is exhausted, including outside the sandbox. No host shared-memory object or
unrelated database/process was removed. Tested real PostgreSQL16.13 through the
existing pinned Docker image, no network and no host ports, with Unix-socket psql
connections. Only task-owned temporary containers/volumes were created/removed.
Target-type generation used the repository's existing disposable internal-network
script and installed pinned images; no production credential was loaded.

The session-local Docker adapter replaces cluster startup/connection transport;
repository test bodies and application migrations are unchanged. Source copies/hashes
are verified in JSON. A relative-import failure in the relocated official mapping
suite was repaired by preserving its repository directory layout; that file was
then rerun. This is local database compatibility evidence, not hosted Supabase/GoTrue
acceptance. Normal CI continues to use the unchanged native PostgreSQL harness.

Failed attempts retained privately: host shared-memory startup twice; adapter
initialization/readiness first hit the initdb temporary-server window, then an
incorrectly quoted listen_addresses argument; both adapter issues repaired before
successful migration/test runs. One initial domain assertion incorrectly rejected a
valid empty terminal cursor page and was corrected. Initial focused ESLint warned
about an ignored domain path and duplicated test literal; root-config domain ignore
was preserved and the test literal factored. No application source bug is hidden by
these environment/helper failures.

## Remaining D13A.3 work

Next checkpoint remains **D13A.3 — GPT-6.1 Sol / High**:

1. Private trusted administrator membership and immutable reviewed meaning anchors;
   no live grants. Add domain command/receipt contracts with actor derived server-side.
2. Durable actor/operation receipts, payload conflicts, entry leases/fencing and atomic
   existing-quota reservation; journal dispatch/result and fail closed on unknown
   provider outcomes. Permission revocation/head ABA must prevent stale publication.
3. Automated-validation provenance distinct from human approval, guarded publication
   transaction support and rollback command authority; fake/local tests only.
4. Versioned import/cache/legacy operation contracts and final D13A.3 acceptance.
   Provider/semantic workflow is D13A.4; hydration/cache/UI is D13A.5.

Read `D13A-technical-contract.md` sections2/4/5, current quota/access functions and
provenance/history triggers. Preserve the new read migration and all D13A.2 sources.
No new product choice is needed. Do not mark D13A.3 done or start D13A.4 yet.
Re-estimate the remaining backend checkpoint after operation tests, rather than
assuming this partial block closes the original2–4 day estimate.

D13 observation remains open, D14 pending, CEFR OFF. Source commit/push/PR/merge,
live schema/data conversion, paid calls and release retain separate scoped authority.
Persistence: local-only/uncommitted; branch/HEAD unchanged. No pending external
operation or background monitor. The D13A.2 patch is historical integration evidence;
new D13A.3 source is a subsequent local delta, not part of the sealed delivered OTA.

Current SQL privilege guidance was fetched through Context7 from
[Supabase database functions](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/database/functions.mdx)
and [RLS documentation](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/database/postgres/row-level-security.mdx).
