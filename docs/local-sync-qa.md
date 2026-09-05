# Local Protocol 2 QA

## Result — 2026-09-05

**PASS for the reproduced two-client conflict on isolated Android clients.**
This is not a hosted deployment, store build validation, iOS test or complete
release sign-off. The original failure remains documented in
[the earlier report](native-sync-qa-2026-09-05.md).

Both clients ran a fresh ARM64 fixed-bundle Release APK built from `2ef8ffb`
plus this follow-up's startup/QA telemetry fixes. The retained generated Android
project still labels it **2.1.0 (80)**; it is not the 2.2.0 store artifact.
Packaged configuration confirmed OTA disabled, `extra.qaBuild=true`, and the
bundle contained `10.0.2.2:55321`, not the hosted Supabase project URL.
Development credentials and application `.env` files were excluded at build time.
HTTP was allowed temporarily in the ignored QA Android manifest only; the
cleartext setting was removed afterward. Do not distribute this APK.

Two temporary `-read-only -no-snapshot -no-window` instances of the dedicated
`WoordenaarSDK57QA20260905` AVD ran on ports 5580 and 5582. The original AVD and
the existing iOS session were untouched. A fresh local Supabase project used
separate ports, real GoTrue/PostgREST/PostgreSQL and only newly generated
`sync-<uuid>@example.invalid` accounts. No existing application account was used.

## Native Evidence

The synthetic word's due date was set to today as administrative fixture setup,
before any assessment, because protocol 2 initializes new words for tomorrow.
All subsequent assessments were entered through the native UI, not injected.

| Step                                        | Verified result                                                                                                                    |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| A assesses Easy offline at 20:38:57.174 UTC | Interval 4, repetitions 1, one pending event and one persistent command; Android reports no active default network                 |
| A cold-restarts offline                     | Same event ID, same command and provisional progress survive after startup settles                                                 |
| B assesses Good online at 20:40:20.615 UTC  | After foreground sync, server/client B have interval 1, repetitions 1 and one acknowledged event                                   |
| A reconnects, without Sync Now              | Server and A become interval **10**, repetitions **2**, EF **2.50**, next review **2026-09-15**; newer Good timestamp is preserved |
| B returns from background                   | Both SQLite databases converge to the same canonical progress and event before/after values; both command queues are empty         |
| Both sync again                             | Server state remains identical; exactly two unique event IDs remain                                                                |
| B opens collection/card                     | Badge changes from **New** to **Learning**; card displays Reviews **2**, Ease Factor **2.5**, Next Review **9/15/2026**            |

Saved server/SQLite snapshots were checked with executable assertions, including
event identity across restart, timestamp ordering, canonical history on both
clients, empty queues and repeat-sync equality. Screenshots were inspected too.

## Defects Found And Fixed

1. Application services threw at import time when development email/password
   variables were absent, even though neither value was used. Removed that
   startup requirement and added an isolated module-load regression test. The
   first clean-environment APK reproduced the blank-screen failure; the rebuilt
   APK successfully logged in on both clients without those credentials.
2. Fresh migrations omitted `words.analysis_notes`, despite the deployed contract
   and native payload including it. Native word upload failed with a PostgREST
   schema-cache error and retained its queue. Added the forward-only nullable
   column repair using `IF NOT EXISTS`; PostgreSQL tests verify fresh creation
   and preservation of existing notes. After the local repair, the same queued
   Good was delivered successfully. Generated contracts were not hand-edited.
3. Explicit fixed-bundle QA now skips Sentry initialization. Normal build behavior
   is unchanged; tests cover the config flag and repeated initialization calls.

## Repeatable HTTP Tests

`npm run test:sync:http` runs four real Auth/REST scenarios: delayed event upserts
versus newer progress, batch history/reset retry, foreign-user ownership/private
receipts, and a genuinely expired access JWT followed by refresh and replay of
the same event ID. Word fixtures include the full native metadata field set.
The JWT test waits approximately five minutes; it does not forge tokens, change
clocks or mock auth responses. Fixture users are removed after the run.

This deliberately restricted macOS runner requires a disposable project created
under `/private/tmp/woordenaar-sync-v2.<suffix>`, matching `project_id`, no hosted
project link, and API URL exactly `http://127.0.0.1:55321`. It verifies Docker
project labels and the gateway port before any writes. It does not load `.env`.
Fixture-only access grants/cleanup use the verified local database container;
tested application operations use actual authenticated JWTs through HTTP.

To prepare a new stack from the repository root:

```bash
qa_dir="$(mktemp -d /private/tmp/woordenaar-sync-v2.XXXXXX)"
supabase init --workdir "$qa_dir" --yes
cp -R supabase/migrations "$qa_dir/supabase/migrations"
```

Edit the generated `supabase/config.toml` before starting: keep its generated
`project_id`; use API 55321, DB 55322, shadow DB 55320, Studio 55323, mail 55324
and pooler 55329. Set `auth.jwt_expiry=300` and `db.seed.sql_paths=[]`. Leave
email signup enabled and confirmation disabled for these synthetic local users.
Do not link the project, import production data or expose this development stack
to an untrusted network. A Docker-compatible runtime is required; other projects
must remain untouched. Starting can download missing service images.

```bash
supabase start --workdir "$qa_dir" \
  --exclude realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
WOORDENAAR_LOCAL_QA_DIR="$qa_dir" npm run test:sync:http
supabase stop --workdir "$qa_dir" --no-backup
```

The verified run used CLI 2.75.0, PostgreSQL image 17.6.1.063, GoTrue v2.195.0
and PostgREST v14.17, selected from the local cache through the CLI's temporary
version files. The CLI also initialized storage schemas even though its runtime
was excluded. Legacy administrative JWTs were rejected by this Auth/CLI
combination; the first run's assertions passed but its cleanup failed. Cleanup
was changed to exact generated user ID/email deletion in the isolated database,
and the complete HTTP run was repeated successfully. This is not a claim that
the mixed-version Auth Admin API is compatible.

## Validation And Boundaries

- Mobile: 95 suites, 1151 tests, 16 snapshots pass; test typecheck and lint pass.
- PostgreSQL: 58 tests pass, including the SRS comparison grid and schema repair.
- Local Auth/REST: four scenarios pass, including real five-minute JWT expiry.
- Native: UI login on both clients, offline cold restart, two-client convergence,
  repeated sync and displayed learning progress verified as described above.
- Commit hooks also passed all 46 web suites / 319 tests. Stryker was not rerun;
  its preceding results are in the
  [branch plan](plans/app-quality-session-sync-2026-09-05.md).

The separate offline Settings profile/access-label hydration finding is not
resolved by these changes. Native reset sequencing after process death, legacy
queue cutover/reconciliation and physical-device/iOS release checks remain
distinct work. Hosted migrations, rollout and minimum-client-version decisions
still require explicit approval; do not deploy protocol 2 as an isolated change.

Private evidence and the non-distributable APK are retained at
`/private/tmp/woordenaar-sync-v2.EqNC6o`. Raw auth/UI artifacts contain disposable
credentials and must not be published. This report contains no credentials.

Cleanup completed: the native fixture user was deleted; the remaining five
synthetic users from the first failed cleanup were removed with the disposable
database volume (`supabase stop --no-backup`, this project only). Both read-only
emulators were stopped without saving snapshots; ADB lists no devices. No QA
project containers/volumes remain, and pre-existing Docker containers retain
their original uptime. The prior APK was restored at its original output path;
the local-backend APK remains only in the private evidence directory. Downloaded
Docker image caches and ignored build intermediates were not globally pruned.
