# Following concurrency and interruption qualification (D13A.6.4)

These tests run only synthetic data and operator attestations in a new disposable
local PostgreSQL database. Existing D06/planning/apply SQL stays unchanged. Current
migrations are installed by the existing fixture, followed by the three operator
SQL files outside migrations. No real personal-card linking, shared publication,
provider calls, hosted migration or global runtime flag change is performed.

```sh
WOORDENAAR_PG_DOCKER=1 node --test --test-concurrency=1 --test-timeout=120000 scripts/postgres-tests/dictionary-following-concurrency.test.mjs
```

Use the repository's Node24 runtime and existing local Docker fallback: cached
pinned image, local Unix socket, network none/no ports, owned tmpfs container and
owned cleanup. No pull, other cluster/process cleanup or system settings change.

`following-session.fixture.mjs` opens independent named sessions, records each
owned backend PID and observes statement/output barriers and server lock wait state.
A blocked writer is verified using pg_stat_activity plus the exact owned blocking
PID from pg_blocking_pids. Tests do not infer overlap from a delay. Timeouts bound
statements/idle sessions; every connection is closed in finally. Fault triggers are
uniquely named, restricted to one synthetic run, removed idempotently and exist only
in the owned disposable fixture. Backend termination checks exact owned PID/name;
no server restart or unrelated process is signaled.

The suite covers personal/state/collection contention with no false applied count
or terminal receipt; concurrent content/placement/state changes becoming stale after
commit; absent-state insertion in both directions; publication/capability locks;
head changes becoming stale; tombstone/hard deletion without resurrection; an actual
RLS-authorized review event and idempotent retry preserving server-calculated SRS/
history; overlapping workers selecting disjoint bounded items; same-batch callers
waiting for one receipt; row receipt lock failure and final batch receipt failure;
owned backend termination halfway through a multi-row batch followed by exact retry;
and connection loss after commit returning the immutable batch receipt.

An identical batch UUID returns its saved counts, including a saved busy result.
Progress after busy uses a fresh batch UUID. `remaining` is an observation from that
transaction: another worker's uncommitted receipts can make it temporarily nonzero.
Workers must continue after all in-flight transactions settle; the tests verify final
zero remaining, unique per-row receipts and a single version increment.

Selective reversal after a committed apply is not implemented or qualified here.
D13A.6.5 still must preserve later reviews/edits in PostgreSQL and file-backed SQLite,
restoring only receipt-owned mode/reference/content when its result fingerprint
still matches. This suite is server-local; real device queues, live deltas and
release acceptance remain separate gates. Historical2914 real cards permit0 links.
