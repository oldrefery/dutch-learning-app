# Isolated PostgreSQL Review Tests

Run from the repository root with the pinned Node 24 runtime:

```bash
npm run test:db
```

Requirements: `initdb`, `pg_ctl`, `psql`, and the `uuid-ossp` / `moddatetime`
extensions from the same PostgreSQL installation. Tested locally with PostgreSQL 15. The CI database job uses PostgreSQL 16 on Ubuntu 24.04. It installs the server
and contrib packages using the [Ubuntu PostgreSQL packages](https://packages.ubuntu.com/noble/postgresql-contrib).
No npm dependencies are needed: the runner uses Node's built-in test/process APIs
and imports the shared TypeScript SRS calculator using Node 24 type stripping.

If the PostgreSQL binaries are not on PATH, select their directory explicitly:

```bash
WOORDENAAR_PG_BIN=/opt/homebrew/opt/postgresql@15/bin npm run test:db
```

Missing binaries, extension failures or SQL errors fail the command; tests are
never silently skipped. Do not run as root: PostgreSQL refuses root-owned servers.

## Isolation

- Each test file creates a new private `woordenaar-pg-test-*` temporary directory
  and PostgreSQL cluster. It never uses an existing cluster or application DB.
- TCP is disabled (`listen_addresses=''`). All psql connections use the cluster's
  private Unix socket, explicit database/user, and `-X` to ignore `.psqlrc`.
- `.env` files are not loaded. Ambient PGHOST, PGSERVICE, PGDATABASE, PGOPTIONS,
  credentials and connection URLs are not forwarded to child processes.
- The platform fixture defines only synthetic auth users, the `auth.uid()` claim
  adapter, schemas and roles. All application migrations are applied in filename
  order without rewriting their SQL. Core table grants normally supplied by
  Supabase are installed explicitly; review-event and RPC grants come from migrations.
- Only `example.invalid` fixture users exist. No real account is used.
- Teardown stops the generated cluster before deleting its generated directory.
  Failed tests use the same teardown. A forced process/OS kill can bypass hooks;
  inspect any leftover test directory before manually stopping/removing it.

## Executed Contracts

- RLS runs under `authenticated`, which is neither table owner nor superuser and
  has no BYPASSRLS flag. The RPC remains security-invoker.
- Anonymous/missing subjects, private/shared foreign words and forged event
  ownership are denied; product-level read-only users can review owned words.
- RPC results and event history agree. Identical retries do not change progress
  or timestamps; changed payloads cannot reuse an event ID.
- Event insertion failure rolls back a preceding word update, and a caller's
  transaction rollback undoes both rows.
- Event upserts preserve immutable data. Tombstoning removes history, denies new
  reviews and cannot be reversed by a stale update.
- Two independent psql sessions overlap. The first holds a transaction open until
  `pg_stat_activity` proves the second is waiting on a lock. Distinct assessments,
  identical retries, mismatched retries and cross-word event collisions are tested.
- 240 SRS combinations compare actual SQL output with the shared domain calculator;
  five independent regression examples protect ties, zero intervals and a binary
  floating-point product just below a half. Returned dates and stored history are
  checked as well.

## Regression Found And Fixed

The previous RPC used `ROUND(double precision)`, which rounded half-way values to
even on the tested server: `Good` with interval 9 / EF 2.5 returned 22 days, while
the application returned 23. It also lacked the one-day minimum for later
`Good`/`Easy` assessments with a zero starting interval.

`20260905180000_align_review_rpc_srs_rounding.sql` replaces the RPC with
fraction-based positive rounding matching JavaScript and a one-day minimum except
for `Again`. It retains the existing auth, ownership, lock and idempotency checks.
The original migration is unchanged. Applying this migration to a hosted project
requires separate deployment authorization; these tests do not deploy it or
backfill previously calculated intervals.

## What This Does Not Prove

This is real PostgreSQL SQL/RLS/transaction testing, not a complete Supabase stack.
The auth adapter does not validate JWT signatures, rotate sessions or implement
GoTrue/PostgREST. Tests do not exercise HTTP permissions, provider configuration,
production schema drift, browser reconnect behavior or Expo native networking.
Applying every migration also does not execute every unrelated function body.
Those boundaries remain separate integration/E2E work.
