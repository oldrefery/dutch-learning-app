# D13A.6.1–2 — saved inventory and immutable reviewed planning packet

Date: October11,2026. Status: D13A.6 in_progress; fixed checkpoints2/5 complete,
3/5 remain. Branch feature/shared-dictionary-schema, HEAD
f97a733407a4d2b37e8f9ca030ad9574de85a794. Local-only/uncommitted.

## Completed evidence

The explicit-file operator inventory verifies exact input SHA256, full cohort
counts and unique personal IDs. Saved October4 P1/P2 cohorts contain2914 cards:
ambiguous2465, missing429, private-review18, excluded2. Eligible links0; reviewed
real-card decisions0; applied real cards0. This is historical evidence, not a fresh
live census. Neither spelling nor D06 media-only overrides prove the same meaning.
Protected IDs/hash receipts stay in ignored0600 immutable-intent storage; no
personal content appears in this report or becomes shared source material.

The new administrator-only planning schema is outside deploy migrations and reuses
unchanged D06 hash/snapshot helpers. One inventory statement retains every scoped
source row, raw content state and full effective visible content. An eligible
synthetic decision binds owner/source/content/version, exact published target
entry/revision/head sequence/content hash, meaning-review attestation and all
changed fields, including media and explicit nulls. Target rows are locked during
planning. Source/head/hash mismatches are stale holds; incomplete/changed diffs
fail atomically. Exact sequence strings and SQL originals retain counters above
JavaScript's safe integer limit. Attestation hashes do not prove a human reviewed
meaning, licensing or real-card owner approval; positive fixtures are synthetic.

Plan request/items are immutable, including delete/truncate guards. Exact retries
return the same packet after later personal deletion without resurrection; a new
plan with a deleted source fails. Count mismatch and transaction rollback leave no
partial packet. Protected evidence survives deletion without blocking it. Ordinary
anon/authenticated/service roles cannot access this operator schema. Planning does
not write cards, common revisions, heads, collections, SRS, review events or progress.
No apply or rollback endpoint exists yet.

## Fresh validation

- Node24 inventory:4/4, zero failures/skips/todo.
- Actual disposable PostgreSQL/current migrations + D06 helpers + new planning SQL:
  14/14, zero failures/skips/todo. Cached pinned Docker image, local Unix socket,
  network none/no exposed ports, owned tmpfs cluster removed on completion.
- Scoped ESLint with max-warnings0, scoped Prettier and git diff check pass.
- Final logs and hashes are recorded in the [JSON evidence](D13A-following-mapping-plan-20261011.json).

Native PG15 initdb failed before SQL because the host could not allocate shared
memory. No kernel settings, shared-memory cleanup or other clusters were changed.
The local Docker fallback succeeded. Earlier synthetic test failures were corrected:
usage_notes must be an object; the cursor table is dictionary_delivery_cursor.
Repeated test literals were factored for zero-warning lint. Final retry validation
was moved after immutable request lookup and tested against deletion; no domain
validation or production guard was weakened. Failed attempt logs remain retained.

## Preservation and limits

Prior D13A.5 evidence and all application/domain/migration/performance harness bytes
stay unchanged. Entry verified3378 prior SHA references;3373 remain exact, with only
five task progress documents intentionally updated. New operator source5 makes
source union376; web boundary142 and browser inputs449 remain unchanged. Exact580
dirty paths include573 preserved entry paths plus five new operator files and two
evidence files. The ignored final dirty manifest and integrity hashes are in JSON.

Web119/1253, native196/2670/22 SQLite, Edge108, PG547/worker35 and browser440/recovery10
are carried historical results with verified boundaries; they were not rerun in
this checkpoint. The new14 focused PG tests do not prove the entire prior suite or
apply/rollback. No SQLite transition has been rehearsed in D13A.6 yet. Prior native
22 SQLite tests belong to earlier behavior and do not close this stage's rollback.
No owned process remains pending. No provider/paid/hosted/Git/EAS/device/release/
automation action occurred; flags OFF outside QA, shared_analysis FALSE, CEFR OFF.
AUTH27–29 remain consumed. No approval or permission was broadened.

## Exact next checkpoint

D13A.6.3 — GPT-6.1 Sol / High recommended; no picker switch claimed. Implement
bounded apply (default50/max100) in disposable operator tooling with immutable
plan/decision hash, current source fingerprints and published head/content/diff
checks under locks in the same transaction, per-row durable receipts, unchanged
IDs/owner/placement and no learning writes. Keep stale/unreviewed rows held.

The fixed remaining list is3 apply/receipts;4 interrupted batches plus concurrent
content/head/deletion/learning delta;5 selective rollback preserving later learning
and edits in actual PostgreSQL and file-backed SQLite. Real linking, device queues
and live delta remain separate approval/acceptance gates. Nine broad milestones
remain: D13.6, D13A.6–9, D14.1–4. No new checklist items were added.
