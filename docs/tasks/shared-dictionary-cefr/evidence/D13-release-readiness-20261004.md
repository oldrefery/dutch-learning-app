# D13 release-readiness packet — 2026-10-04

Status: **preparation complete; execution blocked**. Recommended GPT-6 Astra /
High. Candidate source `13b97b0def2ea82449fadd7a676b7048397d29ad` on
`feature/shared-dictionary-schema`. This packet is not an approval or deploy
command. D12 local verification passed; production readiness is a separate gate.
The [machine manifest](D13-release-candidate-20261004.json) records exact migration
and control-source SHA-256 values. Recompute it after any source/version change.

## Read-only target inspection

On October 4 around 17:57 UTC the existing authenticated Chrome session displayed
`oldrefery`, `oldrefery's Org` (Free), `Dutch Learning App`, branch `main Production`,
project `josxavjbcjbcjgulwcyy`. Only overview/migration/backup pages were read;
no SQL, secret reveal, account switch, download or settings change occurred.

- Overview: Healthy; no GitHub repository connected; no branches.
- Migration table: 43 registered versions, latest `20260912110000`
  (`add_web_review_snapshot_rpc`). All 43 version IDs exist locally; local tree
  contains 52 migration files. The nine candidate additions below are absent
  from this displayed ledger. This compares identifiers, not deployed SQL bodies
  or undocumented schema drift. Recheck before execution.
- Scheduled backups: Free Plan does not include project backups.
- PITR: unavailable on this plan; the UI offers a Pro add-on. No upgrade selected.
- September 6's private logical backups remain documented under ignored `builds/`.
  Their README records successful isolated restore, not current recoverability.
  No private SQL data was opened or used. They cannot protect subsequent reviews.
- No production table rows, Auth users, vocabulary or learning payloads were
  exported in this readiness check. No EAS/store operation was performed.

The named browser tab is temporary and may close after inspection. Resume from
these observations and the exact project ID, not an assumed live browser handle.

## Candidate backend order

The nine files are ordered by repository version. Names do not authorize apply;
exact hashes and remote absence are in the machine manifest.

1. `20260921103000_add_shared_dictionary_schema.sql`
2. `20260921140000_add_dictionary_content_protocol.sql`
3. `20261002090000_add_official_dictionary_mappings.sql`
4. `20261002100000_add_dictionary_import_protocol.sql`
5. `20261002110000_add_dictionary_import_intents.sql`
6. `20261002120000_add_dictionary_import_recovery.sql`
7. `20261002130000_add_analysis_cefr_estimate.sql`
8. `20261003090000_add_dictionary_cefr_queue.sql`
9. `20261003100000_add_dictionary_cefr_budget.sql`

A future approved additive preparation keeps
`private.dictionary_content_runtime.operations_enabled`, `reads_enabled` and
`legacy_guard_enabled` false. Keep
`private.dictionary_cefr_worker_control.enabled = false`, `policy_id = NULL`,
no qualified enabled method and no worker/schedule. Do not deploy an entrypoint or
configure a secret merely because dormant helper modules exist.

Client opt-ins are `EXPO_PUBLIC_DICTIONARY_CONTENT_ENABLED` (native build-time)
and `DICTIONARY_CONTENT_ENABLED` (web server). Both default off. An actual release
must bind their values to the exact artifacts/environment and server capabilities.
D12 opted in only inside isolated QA. Production values were not inspected here.
Changes to `gemini-handler` are a separate Edge deployment artifact; do not include
an unrestricted all-functions deployment or a live analysis test in migration
approval. Public source publication, mapping apply and CEFR activation are distinct
operations requiring their own reviewed scope.

## Corrected preparation/cutover boundary

The old D13.5 wording could be read as permission to apply mapping batches during
dormant preparation. The executable D06 tool deliberately rejects that:
`scripts/shared-dictionary/rehearsal.sql` requires all three runtime flags in
`dictionary_rehearsal.apply_batch`, raising `cutover-capabilities-required` while
they are off. Its comment explicitly forbids preparation-time apply. A linked
personal card needs the legacy guard immediately. Do not weaken that guard or
turn it on early to make a preparation step pass.

Preparation may inspect, classify, freeze a candidate plan, calculate deltas and
rehearse against an isolated copy. It writes **zero live personal references**.
Hosted installation of the rehearsal/admin tooling itself is a separate schema
write; it is not one of the nine migrations and has no current approval. Mapping
apply belongs in the final, separately approved cutover sequence, after current
P1/P2 preservation/device evidence and backups. D13.5 and the main plan now express
this distinction; DEC-09 is unchanged.

## Native release route

`node scripts/prepare-release.js --check` passed: local sources agree on
**2.3.1 (84)**. This does not mean 84 is available for another store upload.
`appVersionSource` is local, production `autoIncrement` is false, and runtime
policy is `fingerprint`. A new unused build number/marketing-version decision
must follow a fresh personal-account store/build inventory. No number was guessed
or changed. Before any remote EAS command, use the repository identity guard and
stop unless the effective identity and linked owner are exactly `oldrefery`.

Use **new native binaries** for this candidate. D12 changed native Expo SDK57
patch dependencies; no matching installed release runtime has been established.
Do not send this candidate to build 84 by OTA. The current QA APK and simulator
app embed loopback endpoints, disable OTA and skip Sentry upload: they are testing
artifacts, not distributable releases. The existing preview profile is also an
iOS simulator profile. A future physical-device build must use an explicitly
reviewed suitable profile, signing, backend and channel; do not repurpose QA output.
Retain native build-time bundle/maps and verify upload from those exact artifacts.

Official [Expo runtime-version guidance](https://docs.expo.dev/eas-update/runtime-versions/)
confirms that native compatibility determines OTA eligibility and fingerprint
policy detects changes that may affect that runtime. Consulted through Context7.

## Private backup and local restore — completed

Backup/local restore scope **completed under AUTH-21** on October 4 using an
owner-supplied existing password. See [verification](D13-backup-verification-20261004.md).
The following scope was executed; later connection-blocker/proposal notes are
historical and superseded, not instructions to create a role or repeat capture:

- Source: only `Dutch Learning App` production project above, using an existing
  authorized database connection if available. No password reset, key creation,
  account/plan change or broader organization access is implied.
- Export roles, schema, migration history and a consistent data snapshot including
  application, Auth and Storage metadata. This necessarily contains real private
  records across the project, including account/authentication data. Never print
  row data, connection strings or tokens. A P1/P2 count report is not a backup.
- Destination: a fresh ignored `builds/d13-preflight-backup.<unique>/` directory,
  mode 0700, files 0600, excluded from Git/EAS/Vercel uploads. No cloud transfer,
  support message, new paid service or public publication. Retain original copies.
- Record time, server PostgreSQL version, included/excluded schemas/tables,
  extensions, migration versions and SHA-256. Use one coherent data snapshot;
  document schema/data snapshot timing. If concurrent DDL invalidates consistency,
  stop and obtain a reviewed quiescent window rather than claiming a full backup.
- Restore only into an isolated matching PostgreSQL container with no network or
  published ports, no application/Auth worker, and read-only backup mount. Compare
  exact original-column sorted row hashes and counts, not counts alone. Remove only
  the newly created verification container; preserve the exported backup.
- Storage **objects**, external media, provider configuration/secrets and device-only
  queues are outside a logical database backup. Inventory metadata first; any
  object export or independent protected copy needs its exact scoped destination.
- This is an initial recovery rehearsal, not the final cutover snapshot. Refresh
  the baseline/delta immediately before approved writes. Never restore an older
  snapshot over later accepted learning commands.

### Approved backup connection preflight

Starting HEAD `1ad4021`; installed Supabase CLI 2.75.0. Linked project ref matches
`josxavjbcjbcjgulwcyy`. Cached server version is 17.4.1.075, not a fresh probe.
The cached pooler URL contains a password placeholder, not a usable password.
Inspected environment names contain no database password/management token.
Targeted Keychain lookup for service `Supabase CLI`, account equal to this project
ref returned not found (exit 44); no secret value was printed. `~/.pgpass` and
`~/.pg_service.conf` are absent. No broad secret-store search was performed.

Do not run `supabase db dump --linked` without a supplied existing password.
The [installed-version connection source](https://raw.githubusercontent.com/supabase/cli/v2.75.0/internal/utils/flags/db_url.go)
creates a login role with `ReadOnly: false` when no password is supplied; pooler
retries can also delete network bans. Even dry-run connection initialization is
not a safe substitute for authorization. Neither dump nor remote DB connection
was executed. No hosted role, key, password, network rule or data was changed.

Private directory `builds/d13-preflight-backup.cbabcezm` is mode 0700 and currently
contains only its mode-0600 operation receipt, no data or credentials. Resume
receipt: `reports/shared-dictionary-cefr/d13-preparation-20261004/backup-operation.json`.
Local native pg_dump is version 15, unsuitable for dumping server 17. An existing
local Supabase PostgreSQL 17.6.1.075 image is available; no image was pulled or
container started. Confirm actual server/client versions after access is available.

### Historical additional access proposal — superseded, do not execute

Use existing authorized Supabase management authentication for this project only,
after checking its availability without displaying it. Issue **one**
`POST /v1/projects/josxavjbcjbcjgulwcyy/cli/login-role` with
`{"read_only": true}`. This creates a database login role, an access-configuration
write beyond AUTH-21's existing-connection scope. The official
[create-login-role API](https://supabase.com/docs/reference/api/v1-create-login-role)
returns a temporary password and `ttl_seconds`; record the actual expiry privately.
The endpoint is beta. Do not infer role deletion from password expiry.

Keep the returned credential in memory or a mode-0600 private temporary file,
never command arguments/logs/Git. Connect with that explicit credential using
PostgreSQL tools, with read-only session settings and bounded timeouts. Verify
actual privileges before capture; if full Auth/schema/role visibility is missing,
stop without widening grants or calling a partial export a full backup. Complete
the already approved local export/isolated restore only if coverage is sufficient.
Do not automatically repeat role creation after an uncertain response or expiry.
Remove the local temporary credential after use, preserving backup artifacts.

No password reset, writable login, network unban, API key creation, paid plan or
production migration is included. The documented
[delete-login-roles endpoint](https://supabase.com/docs/reference/api/v1-delete-login-roles)
has no single-role selector and may affect other CLI access; do not call it as
cleanup. Permission for this narrowly scoped read-only login creation is pending.
Alternatively, an existing DB password can be supplied through a private local
credential mechanism, never in chat; that route needs no new login role.

Official [Supabase backup guidance](https://supabase.com/docs/guides/platform/backups)
confirms database backups exclude Storage objects and that logical restore alone
does not restore the complete project configuration. Consulted through Context7.

## Device and release gates

October 4 update: [P1 USB/SQLite verification](D13-primary-ios-preservation-20261004.md)
confirms native2.3.1(84) and empty SQLite queues with a stable private snapshot.
Exact OTA/AsyncStorage remain outside capture. Owner directs continuation without
unavailable P2 Android; its build/queues remain unknown and legacy compatibility
is mandatory. [Real-snapshot rehearsal](D13-dormant-snapshot-rehearsal-20261004.md)
applies all nine migrations without changing original rows or existing learning
functions. The [next exact operation](D13-dormant-production-operation-20261004.md)
requires separate approval. Earlier device-access statements below are historical.

Preserve September 21's P1 screenshot evidence; do not ask for it again as if absent.
P1 iOS app-reported 2.3.1 (84), visible 0/0/0 counters and matching card totals are
known, but exact binary/update identity and review/reset/correction queues are not.
P2 Android installed build and queues remain unknown. Asked only whether phones
are available; no device action is authorized or started by that question.

A future scoped diagnostic must be owner-specific and read-only: native version,
build/runtime/update identity, schema version, all word/collection/legacy progress
and learning review/reset/correction queues, dictionary/import/recovery queues
when supported, command IDs/receipts, conflicts and snapshot time. Unsupported
fields stay unknown. Preserve private snapshots if access is separately granted.
No forced sync, logout, reinstall, queue deletion, timestamp rewrite or fresh IDs.
Do not assume a production-signed app permits direct SQLite extraction on either
platform; establish the available access path before promising a diagnostic.

Remaining execution gates: real device evidence; fresh backup/restore; exact live
schema/RPC drift comparison; reviewed source provenance/publication manifest;
current P1/P2 baseline/delta; clean isolated release checkout and hosted CI; signed
native artifacts/runtime/source maps; web/Edge artifact and rollback target;
operation-specific approval and final DEC-09 cutover approval. The unrelated
`.playwright-cli/` remains untouched and prevents treating this checkout as a clean
release checkout; prepare a separate clean checkout later rather than deleting it.

D11's unqualified CEFR path stays off. At least seven days of approved post-cutover
observation, including offline return, precede any separately approved D14 removal.
No task reminder or monitor was created. No D13 execution checkbox is complete.
