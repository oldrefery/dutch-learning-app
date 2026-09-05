# Native Synchronization QA — 2026-09-05

## Result

**FAIL: an older offline assessment overwrites newer remote learning progress.**
Both review events survive, but the word retains only one repetition and its
last-review timestamp moves backwards. This is not a successful conflict merge.
No runtime fix or hosted migration was applied during this investigation.

Follow-up: [protocol 2](learning-sync-protocol.md) implements a local fix with
PostgreSQL/SQLite regression tests. It is not deployed and has not yet been
retested on native devices; this document preserves the original failing run.

## Scope And Isolation

- Two isolated, read-only Android instances of `WoordenaarSDK57QA20260905`,
  serials `emulator-5580` (A) and `emulator-5582` (B), without snapshot saving.
- Retained QA APK: version **2.1.0 (80)**, built at `c47a957`, OTA disabled.
  Non-test mobile and shared-domain runtime sources are unchanged between that
  commit and `2744b86`, the branch HEAD tested here. This is not validation of
  the 2.2.0 store artifact, iOS, physical devices or production release settings.
- Dedicated allowlisted QA account, checked before login and through server
  `getUser`. No forbidden application account, service-role key or EAS command.
- One newly created collection and synthetic word, without AI/audio calls.
  Baseline: nine collections, 100 word rows, no progress or review-event rows.
- Actual native connectivity/AppState transitions, native SQLite read-only
  snapshots and authenticated Supabase reads; successful responses were not mocked.

## Reproduction And Observations

All timestamps below are UTC on 2026-09-05. EF remained 2.50 throughout.

| Step                                                        | Word state                                                              | Review history / synchronization                       |
| ----------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------ |
| Both clients load the new word                              | Interval 1, repetitions 0, no last review                               | Synced; no events                                      |
| A enters airplane mode and assesses Easy at 18:16:39.282    | A: interval 4, repetitions 1, due Sep 9                                 | A word and event pending; server unchanged             |
| B assesses Good at 18:18:16.085 and returns from background | B/server: interval 1, repetitions 1, due Sep 6                          | Good event synced                                      |
| A cold-restarts while offline                               | Same Easy progress                                                      | Same pending event ID survives restart                 |
| A reconnects, without forcing Sync Now                      | Server: interval **4**, repetitions **1**, last review **18:16:39.282** | Both distinct events retained exactly once             |
| B returns from background                                   | Both clients converge to A's older progress                             | Both events synced; another sync creates no duplicates |

Android reported airplane mode enabled and no active default network during A's
offline assessment. A's pending state was inspected before and after cold start.
The later Good assessment was already durable on the server before A reconnected.
The final last-review timestamp is therefore a confirmed regression, not merely
a different rounding result. Event retention alone does not preserve SRS progress.

The first attempt to load the fixture used an incorrectly forwarded Maestro
parameter; this was corrected. Client B also encountered an Android System UI
not-responding dialog, dismissed with Wait before successful login. These setup
failures are not attributed to application synchronization.

## Cause And Required Follow-up

`syncManager.performSync` pulls remote words while preserving unsynced local
rows, then uploads the entire local word snapshot. `mapWordToSupabasePayload`
includes interval, repetition count, EF, due date and last-review timestamp.
`executeWordsUpsert` has no remote-version compare-and-swap condition.
Review events are uploaded separately afterward, without applying/recalculating
their SRS effect on the server. Consequently the last upload wins, even when its
assessment happened earlier.

Preserving pending edits and rejecting stale local acknowledgements remains
necessary, but does not resolve a cross-client conflict. Existing unit tests
for those properties must not be presented as evidence of a merge policy.

Recommended next design: separate word metadata writes from review progress;
apply uniquely identified review events atomically on the server. Before changing
the protocol, specify out-of-order event handling, reset semantics, historical
event pre/post values and compatibility with installed clients that still upload
whole progress snapshots. A timestamp check or `max(repetitions)` alone would
still discard an assessment. No such shortcut was implemented.

## Secondary Offline Settings Finding

After A cold-started offline, Settings omitted the user's email and displayed
Read Only instead of its online access state. The same fallback was visible in
the immediate reconnect screenshot even though synchronization subsequently
succeeded. A later online cold start restored the email assertion on both clients.
Restoration of the Full Access label was not separately asserted.

This needs separate diagnosis of profile/session hydration. It is not evidence
that RLS or permissions should be relaxed, and the exact cause is not confirmed.

## Persistent Regression Tests

`useSyncManager.lifecycle.test.ts` adds nine hook tests for disconnected versus
reconnected notifications, background/inactive deferral, foreground triggering,
timer pause/resume, subscription cleanup, missing identity, disabled network
subscription, recovery after failure and successful data refresh notifications.

These execute the real hook with mocked native events and sync boundary. They
protect lifecycle orchestration, not the Expo bridge, hosted conflict behavior,
real JWT expiry or the unresolved two-client defect above.

## Cleanup And Evidence

Only the new fixture was removed: collection deleted, word soft-deleted through
the normal tombstone mechanism, associated review history removed. Both clients
received the tombstone and stopped displaying the collection; their local review
events were empty. The server retains the expected word tombstone. All original
collection, word, progress and review-event rows compared unchanged to baseline.
Both temporary Android instances were shut down without saving snapshots. The
already booted iOS simulator was not used.

Private evidence is retained outside Git at
`/private/tmp/woordenaar-native-sync.tt4aZv`: flow results, screenshots and scoped
server/SQLite snapshots. Raw login artifacts may contain credentials; do not
publish or commit that directory. This document contains the sanitized findings.
