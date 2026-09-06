# Learning Sync Diagnostics

Status: implemented locally on the quality branch; not deployed or verified in
live Sentry. No alert rules, dashboards or scheduled monitoring were created.

`SyncHealthReporter` observes completed native `SyncManager.performSync` attempts.
It does not observe startup/session-gate failures before synchronization starts,
aborted processes, or every Auth request. Existing error capture remains separate.

## Signals

| Signal      | Condition                                                                | Event               |
| ----------- | ------------------------------------------------------------------------ | ------------------- |
| `session`   | Sync cannot establish a usable session                                   | Warning immediately |
| `protocol`  | Required backend protocol is unavailable/unsupported                     | Warning immediately |
| `old_queue` | Non-offline attempt, pending command timestamp at least 24 hours old     | Warning             |
| `stalled`   | At least three failed attempts spanning at least five minutes            | Warning             |
| `recovered` | Previously alerted reporter sees successful sync and a known empty queue | Info once           |

One aggregate breadcrumb is recorded per completed attempt. Offline results alone
never create health issues. They do count toward the failure window if a later
non-offline attempt also fails. Each reason has a 15-minute cooldown **within
one reporter and user identity**. App restart or identity change resets it; this
is not global deduplication or a durable outage clock. A session/protocol signal
takes precedence over old-queue/stalled signals for that attempt.

Queue counters include review and reset commands for the current user only. Age
uses the original review/reset timestamp, not insertion into the queue. Invalid
timestamps are ignored by the aggregate; a wholly unknown age is null and future
timestamps clamp to zero. Device clock changes therefore affect age estimates.
Successful sync does not imply an empty queue; both conditions are checked for
recovery. An unavailable queue read is unknown, never treated as empty.

The diagnostic database wait is bounded to one second. It does not cancel an
underlying SQLite query. Diagnostic failures are swallowed and do not change the
sync result; the extra wait can delay completion by up to that bound. There are
no new sync retries, data writes, queue deletions or timers outside an attempt.

## Privacy Boundary

Health events use a fixed message and allowlisted reason/fingerprint. Numeric
extras are limited to duration, observed failure-window duration, failure count,
queue count, review/reset counts, oldest command age and expected protocol (2).
Only finite nonnegative numbers survive; unavailable/invalid values become null.

The Sentry `beforeSend` hook rebuilds these events after scope enrichment,
discarding user, request, exception, breadcrumbs, custom contexts and extra tags.
It retains event identity/time, SDK/platform, environment, release and dist for
version-level diagnosis. No account identifier, word, command payload, token or
raw exception is added by the reporter. The internal user identifier only resets
local aggregation when accounts change.

This narrower guarantee applies to `module:sync-health` events, not every existing
application log, transaction, attachment or legacy exception. No live Sentry
payload was sent to verify ingestion in this change.

## Triage After An Approved Deployment

In the mobile Sentry project, filter `environment:production module:sync-health`
over 14 days; use `sync_health:protocol`, `sync_health:session`,
`sync_health:old_queue` or `sync_health:stalled` to narrow findings. Remove an
error-only level filter because these signals are warnings (recovery is info).

- Protocol: compare deployed migration history and the client's required protocol.
- Session: correlate release and existing sanitized Auth errors; never request tokens.
- Queue/stalled: examine counts and age, distinguish network failures from rejected
  commands, then follow the [rollout/reconciliation guide](learning-sync-rollout.md).
- Recovery: evidence from that reporter only, not proof all devices are healthy.

Do not resolve an issue solely because it stops appearing: the app may be closed,
offline, disabled for QA, rate-limited or unable to send telemetry. Do not clear
queues or retry ambiguous legacy commands under new IDs to silence an alert.

Regression tests cover thresholds, cooldown, recovery, identity changes, unknown
queue reads, the one-second deadline, SDK exceptions, scope privacy and actual
SQLite aggregation. They do not measure delivery, production event volume or
physical-device performance.
