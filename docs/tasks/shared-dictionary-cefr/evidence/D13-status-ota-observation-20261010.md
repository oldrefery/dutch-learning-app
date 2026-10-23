# D13 post-confirmation observation — October 10, 2026

Read-only observation at **00:44 Amsterdam** (22:44UTC October9), after the owner
confirmed iOS synchronization and status without errors following AUTH-29.
Personal EAS identity and linked owneroldrefery checked before every remote command.
[Sanitized evidence](D13-status-ota-observation-20261010.json).

## Current release

| Platform | New OTA downloads / users | Failed installs | Channel embedded users | Channel OTA user sum         |
| -------- | ------------------------- | --------------- | ---------------------- | ---------------------------- |
| iOS      | 1 / 1                     | 0               | 1                      | 2 across AUTH-28 and AUTH-29 |
| Android  | 0 / 0                     | 0               | 4                      | 0                            |

Metrics are through22:44:36UTC. Counts may include diagnostic traffic. Downloads
are not independent proof of launch; summed group user counts may count the same
person twice. No Android adoption is established. User-reported iOS success is the
separate functional evidence; exact on-device update ID was not captured.

Sentry production/14d queries return zero issues for either exact AUTH-29 OTA ID,
and zero dist85 events after its22:28:25UTC publication. Original parser4C and
status-lock4E lastSeen remain22:06:40/22:06:48UTC, before AUTH-29;49 unchanged.
This short window is not the full observation gate or proof all users are healthy.

## Offline warning attribution

Unresolved issue48 is a warning from getUserAccessLevel: internet connection offline.
Three recent samples at22:17:39–22:18:32UTC are on previous iOS AUTH-28 update
01a122ad-683e-7763-a736-9a522c38cec8. Five events are returned in the14d aggregate;
issue lifetime count is6. This is consistent with the owner's offline test and
predates AUTH-29. It is not an observed sync-write or data-loss failure and does
not reproduce either repaired error. No suppression or Sentry resolution performed.
[Issue48](https://oldrefery.sentry.io/issues/7714106978/).

## Next checkpoint

D13 remains in progress for the at-least-seven-day observation gate, including
fresh sync/orphan/CEFR-disabled/cost/latency and adoption evidence before closure.
No new server census or latency measurement was made in this check. The original
October12 elapsed-time boundary alone is insufficient; both recent repairs need
adequate observed behavior. D14 retirement stays pending; CEFR stays OFF under its
separate qualification/activation gate. No background monitor was created.

On explicit resume, refresh exact-update Sentry/EAS health and the outstanding
D13 acceptance evidence; do not republish consumed AUTH-29/28 or infer Android
upgrade from elapsed time. Owner-reported AUTH-28 iOS offline preservation and
AUTH-29 iOS online/status acceptance are retained as distinct evidence.

No new external mutation, implementation, test run, commit/push or release.
Rootf97a733 and ten source/test changes plus task records remain local-only;
all original artifacts/backups/QA/unrelated.playwright-cli preserved. All read
processes completed, no uncertain operation. Private receipts:
reports/shared-dictionary-cefr/d13-observe-20261010-0044/.
