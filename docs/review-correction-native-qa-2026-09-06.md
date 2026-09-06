# Native review correction recovery QA — 2026-09-06

## Scope

Verified commit `61866cf` on `feature/isolated-fixture-ci` using a freshly
built Android ARM64 Release QA APK, a disposable local Supabase stack with
repository migrations, and a synthetic `@example.invalid` account.
No hosted application account, production data, remote build, or deployment
was used. In particular, the `oldrefery` application account was not accessed.

The APK contained the local emulator backend URL, not the hosted Supabase URL.
QA mode was enabled and OTA updates were disabled. A temporary network security
configuration permitted cleartext only for the emulator host `10.0.2.2`.
The emulator used a dedicated QA AVD in read-only, no-snapshot mode.

## Results

1. Synthetic-account login, collection loading, and Recognition start passed.
   Manual ratings were off by default.
2. Answering `fiets` with `bicycle` automatically recorded Good and advanced
   to the next word. Previous word exposed correction controls.
3. Changing Good to Hard succeeded. Both native SQLite and the server showed
   one repetition, interval 1 day, and easiness factor 2.35.
4. A local fault proxy forwarded the subsequent Easy correction to the real
   local RPC but discarded its successful response. Four HTTP 200 responses
   were discarded during transport retries. The app offered
   `Retry same correction` rather than reporting success.
5. At that point the server had accepted Easy at revision 2, while SQLite
   retained Hard and durably stored the pending Easy correction in both the
   command queue and recovery record. The original Good event was unchanged.
6. The app was force-stopped and relaunched without clearing its data.
   Startup synchronization automatically reconciled the accepted correction
   through receipt reads, even with response dropping still enabled.
   No additional correction RPC was observed after restart. No manual retry
   was needed for this recovery path.
7. The original correction ID became synced; both pending queues were empty.
   Native and server progress matched: one repetition, interval 4 days,
   easiness factor 2.50, and the same next-review date.
8. A new Recognition session could start and finish. Opening the full word
   card showed Reviews 1, Ease Factor 2.5, and Next Review September 10, 2026.

Executable snapshot assertions passed for durable command identity, unchanged
original review event, exact canonical SRS fields, empty recovery queues,
unchanged server state across restart, and unchanged unrelated fixture words.
There was one original review event and two intentional corrections, not
additional repetitions from retries.

Maestro flows for the successful review start, Hard correction, dropped Easy
response, and post-restart card inspection passed. Earlier start-flow attempts
needed corrected navigation preconditions; these were automation setup errors.
A concurrent UI-dump command also failed because Maestro already owned Android
UI automation; this was a tooling failure, not an application crash.

## Cleanup and boundaries

- The exact synthetic account was deleted. Local database counts for users,
  words, and assessment corrections were all zero afterwards.
- The original ignored Android manifest and existing APK were restored and
  compared against their backups. The temporary network XML was removed.
- The disposable database stack, emulator instance, and fault proxy were
  stopped after verification; no emulator snapshot was saved.
- Private snapshots, flow logs, screenshots, and the QA-only APK remain under
  `/private/tmp/woordenaar-sync-v2.a64pGN`; they are not release artifacts and
  must not be committed or distributed.

No application source fix was required by this check. Unit tests and Stryker
were not rerun for this documentation-only result. This is Android emulator
verification, not a claim of fresh iOS, physical-device, or store-build coverage.
No production migration or publication was performed. The bounded native
review-correction and restart-recovery QA stage is complete.
