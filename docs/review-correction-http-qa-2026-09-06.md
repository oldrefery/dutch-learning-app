# Review correction HTTP/Auth verification

Branch: `feature/isolated-fixture-ci`, following `e4c2672`.

## Scope

This follow-up tests the actual correction RPC through local GoTrue, Kong,
PostgREST and PostgreSQL with the installed Supabase JS client. It does not run
the web or native UI. No hosted backend, existing application account, or
application `.env` file is used. Nothing is committed, pushed, or deployed.

## Defect reproduced and corrected

The undeployed correction migration used SQLSTATE `40001` for business conflicts
(stale revision, a newer review/reset, or out-of-ledger progress changes).
Direct PostgreSQL tests saw the expected exception, but the first real HTTP run
returned gateway HTTP **504** after approximately **60 seconds** for concurrent,
newer-review and reset conflicts. Neither client could classify that response as
the intended conflict.

This matches the upstream-documented [automatic retries of serialization
failures](https://github.com/PostgREST/postgrest/issues/3673). The local service
was PostgREST **14.3**, with GoTrue **2.195.0**, PostgreSQL **17.6** and Supabase
CLI **2.75.0**. The observed before/after comparison used the same service images;
the fix did not depend on upgrading the middleware.

The migration now raises **`PT409`**, PostgREST's explicit HTTP 409 error, rather
than the retryable serialization-failure code. Web and mobile recognize `PT409`
and retain compatibility with the earlier local `40001` contract. Operation IDs,
ownership, locking, revisions, original events and SRS calculation are unchanged.
Because this migration has not been deployed, the fix belongs in that migration;
there is no hosted data repair or historical replay.

The six new HTTP scenarios then passed in **4.1 seconds**, including the three
previously delayed cases. RPC calls in these regressions have a ten-second abort
deadline so the old behavior fails promptly rather than hanging for a minute.
SQL tests also assert the `PT409` code for all three business-conflict branches.

References: [PostgREST custom status codes](https://docs.postgrest.org/en/v14/references/errors.html#raise-errors-with-http-status-codes)
and [JWT clock skew](https://docs.postgrest.org/en/v14/references/auth.html#time-based-claims-validation).

## Scenarios

- Good → Hard recomputes from the original checkpoint: one repetition, interval
  one, ease 2.35. The original Good event and review timestamp stay immutable;
  the other authenticated client sees one effective Hard event at revision one.
- Two concurrent edits of revision zero accept exactly one command and return
  HTTP 409 for the other. An explicit subsequent edit at revision one succeeds.
- An injected offline transport fails before sending a request and changes
  nothing. A second injected fault discards a **real successful HTTP response**
  after the server commits. Retrying the identical ID yields one correction and
  one SRS application. This is transport fault injection, not device airplane mode.
- A new review or reset invalidates a fresh edit of an earlier event. Retrying
  its already accepted correction returns a receipt without restoring old SRS.
- Foreign JWTs and anonymous callers cannot correct another user's review or
  read its correction/checkpoint/head/effective-history records. Malformed UUIDs
  are rejected before an application write.
- The existing real-expiry test now also submits a correction, waits past the
  JWT lifetime **and PostgREST's 30-second clock-skew allowance**, verifies RPC
  rejection, refreshes the session and retries both original command IDs.
  It checks unchanged canonical state and the exact correction receipt list.
  Tokens are genuinely issued by GoTrue; no clock or authentication mock is used.

The earlier expiry assertion waited only two seconds past `exp`: Auth rejected
the token, but PostgREST still accepted it within its documented allowance.
That was a test expectation error, not evidence of authentication bypass.

## Stryker worker lifetime

`maxTestRunnerReuse: 100` bounds Jest worker lifetime after the two previously
reproduced Node 24.20.0/V8 native crashes. The first forced verification completed
all 1,318 mutants without a worker crash in 10m38s, scoring **97.95%**. No cached
mutants were reused. This is a runner mitigation, not a claim that the initiating
V8 problem has been diagnosed or fixed.

After adding `PT409` handling and its regression, a second full forced run also
completed without a worker crash, in **9m41s**: **97.96%**, 1,324 mutants across
21 files, **719 killed, 14 surviving, 1 uncovered, 590 compile errors**, zero
timeouts and zero runtime errors. All mutants were retested, with no incremental
reuse. Both runs used Node 24.20.0 and the same bounded worker lifetime. No new
macOS Node crash report appeared during either run.

The 90% break threshold, static mutants, TypeScript checker and all 21 source
targets remain enabled. No failed tests or mutant statuses are suppressed.

## Checks and remaining boundary

- Web: 53 suites, **521 tests** passed.
- Mobile: 127 suites, **1,495 tests**, 22 snapshots passed. Existing `act(...)`
  warnings remain visible in the mobile suite; they were not suppressed here.
- Disposable PostgreSQL: **102 tests** passed; all 16 correction safety tests
  were repeated after strengthening the exact SQLSTATE assertions.
- Web/mobile app and mobile test typechecks, repository and web lint passed.

## Final clean-stack HTTP result

After deleting the first disposable stack's volumes, all repository migrations
were applied to a fresh empty database, including the corrected migration.
`npm run test:sync:http` then passed **10/10 tests** in **341.2 seconds**. The
expiry/refresh scenario itself took 334.5 seconds and verified HTTP 401 plus
the JWT-expired error before refreshing. Replaying both original IDs preserved
the complete canonical word/event state and the exact correction receipt list.

Cleanup verified zero users, words and correction rows before stopping the
disposable `woordenaar-sync-v2.Sbn7YK` project with `--no-backup`. Its containers
and data volumes were removed; unrelated local projects were not targeted.
No `oldrefery` application account was read or modified.

For reproduction, follow [the local stack setup](local-sync-qa.md#repeatable-http-tests)
and run from the repository root with Node 24.20.0:

```bash
WOORDENAAR_LOCAL_QA_DIR=/private/tmp/woordenaar-sync-v2.YOUR_SUFFIX npm run test:sync:http
npm run web:mutation -- --force
```

These are local protocol/transport checks, not a claim about a hosted release.
Native restart/recovery and web interaction with the correction controls still
require their own runtime checks. Migration
`20260906160000_add_review_corrections.sql` remains undeployed.
