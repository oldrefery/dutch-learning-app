# iOS Session Recovery QA

Follow-up to [Android transport recovery](native-auth-transport-qa-2026-09-06.md),
based on `8966fa3`, on branch `codex/app-quality-session-sync-tests`.

## Scope And Isolation

The local iOS Release build uses a fixed embedded bundle, a loopback fault proxy
at `127.0.0.1:55325` and a fresh disposable Supabase project at port 55321.
Packaged configuration was inspected: QA mode is enabled, native OTA is disabled,
the bundle contains the local endpoint and not the hosted project URL. Build
environment files and Sentry uploads were disabled. No hosted account or service
was used for application testing.

A new iPhone 16 Pro simulator running iOS 26.5 was created specifically for this
run. Existing simulators/devices and other projects' Docker containers were not
used. The account is a newly generated `sync-<uuid>@example.invalid` identity;
no existing account was used or deleted. The retained generated native project
labels this non-distributable artifact 2.1.0 (80), whereas the JS Settings screen
shows 2.2.0 (81). This is not a store build validation.

iOS simulators do not implement airplane mode: Maestro's airplane-mode commands
are no-ops there. The fault proxy tests backend unavailability and stalled
requests, not a real radio/Wi-Fi loss or a NetInfo disconnect/reconnect event.
Host networking was not changed. Physical-device network transitions remain
unverified. See [Maestro's documented limitation](https://github.com/mobile-dev-inc/maestro-docs/blob/main/api-reference/commands-available/setairplanemode.md).

## Lifecycle Race Found

The provider awaited network availability and `getSession()` before starting
auto-refresh on foreground resume. A background/inactive transition or unmount
could occur during either await; its stop operation was then undone by the old
completion starting auto-refresh again. A newer foreground transition could
also be superseded by an older pending check.

Added an effect-lifetime guard and app-state generation checks before session
work and after its completion. In-flight SDK refresh/rotation is not cancelled
by a lifecycle transition; only stale follow-up work is prevented. Active
online resume still checks the session and starts auto-refresh; offline resume
does not. No authorization or storage semantics changed.

Nine regression cases were added to the real provider tests. Seven failed on
the original implementation and all nine pass with the fix. These tests cover
both async waiting points, background/inactive/unmount, overlapping resumes,
and active online/offline behavior. The exact race is proven by controlled
unit tests; a native UI pass alone cannot prove its internal timing.

## Native Run

- UI login, collection/word loading, saved email and Full Access passed.
- Before further recovery checks, the fixture's SQLite identity, SRS fields,
  history and persistent command queue were saved read-only. The fixture starts
  unreviewed with an empty history and queue.
- The local Auth container's JWT lifetime is verified as 180 seconds. Clock
  values and tokens are not forged or edited for expiry tests.

- Auth issued the password session at 04:08:48 UTC. The app was terminated at
  04:09:23 and relaunched after the real expiry at 04:11:48. The first refresh
  reached the proxy at 04:12:20.919; it was deliberately held without forwarding.
- The unavailable/retry screen appeared within the 20-second UI assertion;
  the login screen did not appear. The first held request was cancelled after
  9,964 ms. Subsequent held refresh requests were cancelled at approximately
  ten seconds each while the unavailable state remained recoverable.
- At 04:16:08.180 the proxy began allowing new requests. The already-held
  request still timed out normally; the next refresh started at 04:16:15.964
  and completed in 103 ms. Without relaunch, tapping retry, clearing app data
  or entering credentials, the collection screen returned within the
  45-second assertion. Settings showed the same email and Full Access.
- Read-only SQLite snapshots before expiry and after recovery are byte-equal:
  the same fixture word/identity, zero repetitions, one-day interval, easiness
  factor 2.5, empty review history and empty persistent command queue.

This confirms expired-session recovery from a stalled Auth transport on iOS.
It does not establish real iOS network disconnect/reconnect behavior, a complete
backend restart scenario, long-duration offline behavior or store-build health.
Those checks remain separate from this controlled native run.

## Validation

- iOS simulator Release build and all three native UI flows passed.
- Provider tests: 26 passed, including nine new lifecycle cases.
- Full mobile suite: 101 suites / 1,216 tests / 18 snapshots passed.
- Mobile test typecheck, repository lint and diff checks passed.
- Full web/SRS Stryker run (`npm run web:mutation -- --force`) passed at 98.91%:
  786 mutants, 454 killed, four survived, one uncovered and 327 compile errors.
  No prior mutant results were reused. The existing mutation gaps remain;
  this is the configured 16-file scope, not coverage of the entire application
  or mutation testing of the native provider change.

## Cleanup

The new synthetic account and disposable backend were deleted, and the new
simulator and proxy were removed/stopped after the run. Existing accounts,
devices and other projects' containers were not operated on. Generated native
configuration files were compared against their pre-build backups. The
unrelated staged/deleted plugin is excluded from this change.

Private credentials, logs and artifacts are under
`/private/tmp/woordenaar-sync-v2.1bz1XZ`; do not publish them.

Commit message: `fix(auth): ignore stale foreground session checks`
