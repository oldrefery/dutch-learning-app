# D01 observed production clients

## Current priority-device matrix — 2026-09-21

| Account alias | User-confirmed platform | Installed version/build                              | Device-local pending sync         |
| ------------- | ----------------------- | ---------------------------------------------------- | --------------------------------- |
| P1            | iOS (primary)           | User screenshot: 2.3.1 (84), app-reported            | UI 0/0/0; learning queues unknown |
| P1            | Web                     | Current deployed revision not rechecked this session | Unknown                           |
| P2            | Android                 | Awaiting device evidence                             | Unknown                           |
| P2            | Possibly web            | Active use not confirmed                             | Unknown                           |

P1 supplied [iOS screenshots](D01-ios-owner-evidence.md) on September 21;
2,311 local words and 12 collections agree with the earlier server aggregates.
Do not re-request this evidence. P2 Android version/build and sync status remain
outstanding. Ask for missing evidence only.
If the app does not expose queue state, retain that gap and arrange a scoped
non-destructive diagnostic; do not treat a successful login or server word count
as an empty local queue. Never reinstall, reset, log out or clear storage to
produce evidence. Current production paths remain authoritative.

The cohort database census completed September 21; see
[aggregate evidence](D01-cohort-census.md). The access gap below is historical.

## Device evidence collection and limits — 2026-09-21 10:00 UTC

Source inspection at `e962870`; not a fresh observation of either user's phone.

- In `apps/mobile/src/app/(tabs)/settings.tsx`, the Settings header displays
  `Version <version> (<build>)`. Capture this header on P1 iOS and P2 Android.
  Values come from `Constants.expoConfig`, not a native installed-binary query;
  treat them as reported app metadata, not proof of the binary or OTA revision.
  If inconsistent with store/device metadata, reconcile before accepting the build.
- Capture the same screen's `Sync Status` section, including the summary,
  Words/Collections/Progress counters, Last sync and any error. Redact the email
  or unrelated account details. A missing section on an older build is evidence
  of a diagnostic limitation, not a reason to reinstall or upgrade immediately.
- `syncStatusService.ts` computes total pending only from word, collection and
  legacy progress repositories. `syncManager.ts:1135` separately reads learning
  resets, review corrections and review events. Those queues are not included
  in the displayed total. `Up to date` therefore cannot certify an empty learning
  command queue, and the zero placeholders while loading are not accepted counts.
- The status hook reads metadata and subscribes to sync events; it does not itself
  start synchronization. Normal app lifecycle auto-sync can still run independently.
  Do not press `Sync Now` merely to collect read-only evidence or discard queues.
- For migration/rollback acceptance, require owner-scoped evidence covering all
  queue types and conflicts. UI screenshots provide partial evidence only. A new
  diagnostic implementation or device database extraction needs separate scoped
  planning/access; neither was performed during D01.

D01.2 remains open. Do not manufacture installed-build or empty-queue evidence
from source code, server counts, store availability, or QA simulator builds.

## Historical Sentry observation — 2026-09-12

Captured 2026-09-12 18:34 UTC, source `e962870` unchanged.
Read-only Sentry project `dutch-learning-app`, existing local credentials;
no broader access, credential changes or issue mutations.

The bundled read-only Sentry helper queried unresolved issues with
`environment=production`, `statsPeriod=14d`, limit 10. Three issues returned.
Up to three events were read per returned issue; three events total returned.
Event metadata was then filtered again to production and the 14-day window.
Only release, dist, OS when present, and timestamp were retained; no user IDs,
emails, stack traces, vocabulary or response bodies were persisted.

| Release                                   | Dist | Observed event timestamps UTC | OS tag       |
| ----------------------------------------- | ---- | ----------------------------- | ------------ |
| `com.oldrefery.dutchlearningapp@2.3.0+83` | 83   | 2026-09-06 22:48:49           | Android      |
| `com.oldrefery.dutchlearningapp@2.2.1+82` | 82   | 2026-09-06 13:28:53; 13:28:25 | Not returned |

This confirms those release/build identifiers emitted production events recently.
It does not prove store publication, current installation, active-user counts,
coverage of error-free clients, absence of older clients, pending queue contents,
or the user's current installed version. No 84 event in this small unresolved
issue sample is not evidence that build 84 is unused. Do not estimate adoption
percentages from these three events or infer a minimum supported version.

D01.2 remains partial. Preserve legacy compatibility pending owner confirmation
of the deployed client/support inventory. Retirement policy remains a D02 gate.
D01.3 remains partial: no database connector or database/admin credential key was
found in the scoped environment preflight. Only key names were inspected/output;
values were not exposed. The owner-run aggregate SQL report remains the next step.

Documentation was checked through Context7 (`/getsentry/sentry-docs`); event tags
are event-specific diagnostic metadata, not an installed-population inventory.
Reference: [Sentry event tags](https://docs.sentry.io/product/issues/issue-details/).
