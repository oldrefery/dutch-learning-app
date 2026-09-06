# Native Settings And Reset Recovery QA

## Scope And Result

Local-only Android follow-up to [protocol QA](local-sync-qa.md), based on
`0ff9296` plus the Settings/access changes in this commit. No hosted account,
production data, EAS operation or deployment was used.

**PASS:** stored-session profile display offline, server-confirmed access
restoration after reconnect, and persistent reset delivery after process death.
**OPEN:** one repeated offline cold-start UI check exceeded its 30-second wait;
this is not a complete offline-startup or expired-session sign-off.

The subsequent [bounded startup follow-up](native-session-startup-qa-2026-09-05.md)
adds recoverable session-check deadlines and native expired-token evidence; it
also records an open backend-restart recovery case.

## Implementation

- Settings subscribes to auth session events, including `INITIAL_SESSION`,
  instead of racing a network `getUser()` call against those events. Session
  metadata is display-only and filtered by the store's current user ID. The
  subscription is synchronous and unsubscribed on unmount; no nested auth call
  runs inside its callback. Missing sessions clear the displayed user.
- Successful sync refreshes access from the server as well as words/collections.
  Offline/network errors still fail closed to `read_only`; cached profile data
  never grants access. This change does not relabel that conservative fallback
  as a confirmed server permission or implement persistent offline identity.
- Access requests carry a generation and identity guard. New requests, logout
  and account changes invalidate older results, including exceptions. Account
  changes immediately clear the prior account's access level.

## Native Evidence

A fresh fixed-bundle ARM64 Release APK used only `http://10.0.2.2:55321`;
packaged config asserted `extra.qaBuild=true` and OTA disabled, and the bundle
was checked for the absence of the hosted Supabase URL. QA mode disables Sentry.
The retained native project reports **2.1.0 (80)** in Android package metadata;
the current JS Settings screen reports **2.2.0 (81)**. This artifact is not a
store build and must not be distributed.

One temporary `-read-only -no-snapshot -no-window` instance of the dedicated
`WoordenaarSDK57QA20260905` AVD ran on port 5580. A fresh local Supabase stack
used the isolated ports and safety checks described in the preceding report.
The only account was a newly generated `sync-<uuid>@example.invalid` fixture.
Its new word was made due today before the first assessment. Subsequent Good
and Reset Progress operations were performed through the native UI.

1. Online login and Settings displayed the fixture email and **Full Access**.
2. Good at `21:08:18.469 UTC` synchronized: one repetition, interval 1, EF 2.5.
3. Airplane mode was enabled; Android confirmed no active default network.
   After force-stop/relaunch, Settings retained the email and safely displayed
   **Read Only** because its access lookup could not contact the server.
4. Reset Progress at `21:10:03.733 UTC` set local repetitions to 0 and last review
   to null. SQLite held exactly one pending `reset` command; the server still
   held the preceding Good result.
5. Another force-stop/relaunch retained the exact reset command, including its
   operation ID, sequence, timestamp and date. Network remained unavailable.
6. Reconnection delivered the reset automatically, without Sync Now. Server and
   SQLite converged to repetitions 0, interval 1, EF 2.5, last review null and
   next review `2026-09-06`. The queue emptied; one matching private reset
   receipt existed; the preceding Good history event remained intact.
7. Settings displayed **Full Access** again. Another background/foreground sync
   left server data unchanged and the queue empty. UI asserted **New**; the
   detail card displayed Reviews **0**, Ease Factor **2.5**, Next Review
   **9/6/2026**. Screenshots were inspected.

Executable assertions compared saved server/SQLite snapshots, exact pending
command identity across restart, receipt count and repeat-sync equality.
An initial read during a SQLite write lock was retried after activity settled.
The second offline startup UI flow timed out waiting for `screen-collections`
after 30 seconds (35-second flow duration); after reconnect the UI and subsequent
checks passed. Do not hide this failure by simply increasing the test timeout.
Next investigate startup auth/access/network waits, including an expired token
and a longer offline period, with bounded loading and no session loss.

## Validation And Cleanup

- 96 mobile suites / 1165 tests / 16 snapshots pass (14 new regression cases).
- Mobile test typecheck, root/mobile ESLint and diff checks pass.
- Web, PostgreSQL, HTTP-expiry and Stryker were not rerun as part of the native
  exercise; this follow-up does not change their implementation.
- Private evidence, flows, assertions and non-distributable APK are retained in
  `/private/tmp/woordenaar-sync-v2.fVz6Y0`. Raw artifacts contain disposable
  credentials; do not publish them.

The generated account was deleted, the disposable database volume removed, and
the temporary emulator stopped without a saved snapshot. The prior APK output
and original Android manifest were restored. Existing Docker projects and the
iOS simulator were untouched. No shared image cache or unrelated data was pruned.

Commit message: `fix(mobile): restore profile and access after reconnect`
