# D08 closure review — 2026-09-26

Branch: `feature/shared-dictionary-schema`\
Committed HEAD: `c5dfb14d49b9a53521b53e13bdd19991999ede5d`\
Persistence: local, uncommitted and unpushed\
Review setting: GPT-6 family; recommended Astra / High. Exact picker variant and
effort were not independently observed. No independent review agent was used.

## Result

The closure review found two UI defects and an incomplete native acceptance
matrix. Both UI defects are fixed locally with failing-before/passing-after
regressions. **D08 remains in progress; D08.4 cannot be marked complete.**

On entry, the branch, committed HEAD and all seven runtime fingerprints in
`D08-platform-qa.md` matched. That report remains historical evidence for the
September 21 builds. It is not native evidence for the runtime changes below.

## Findings and fixes

1. **Repeated or newly arriving content conflicts became inaccessible.**
   `DictionaryConflictResolver` trusted the selected word snapshot and kept a
   permanent `resolved` boolean. Collection/history/insights details can remain
   open while synchronization changes the store. A second conflict therefore
   required closing the details. The resolver now derives conflict visibility
   from the current owner-scoped store word, clears the previous comparison after
   applying a decision, and hides removed words. `HeaderSection` mounts it for
   stored words even when its input snapshot predates the conflict.
2. **Open details retained obsolete content after a server choice.**
   `WordDetailModal` rendered the original selected object after the store had
   been refreshed. The same stale object remained visible after deletion or an
   account switch. Details now resolve the selected personal ID against the
   current owner's store. Tests prove updated content is visible without closing
   the modal, and stale content is hidden after deletion/account change. The
   active review session's frozen word list is not changed by this fix.

Six new regressions reproduced these failures before the fixes (three per test
file). The focused post-fix run passed 17 tests across three suites, including
the existing word-card snapshots.

The review also inspected dictionary dependency hydration, versioned pending
commands, receipt validation, atomic SQLite acknowledgement, conflict operation
identity checks, revision cursors, legacy metadata-only writes, correction
capability persistence and cold-start recovery. No server/schema/protocol change
was made during this review.

## Verification

Commands use `PATH=/opt/homebrew/opt/node@24/bin:$PATH` and the current dirty tree.

- From `apps/mobile`: `npx jest --watchman=false --runInBand --silent` —
  **142/142 suites, 1,626/1,626 tests, 22/22 snapshots passed**.
- `npm run mobile:typecheck` and `npm run mobile:typecheck:test` — passed.
- `npm run lint:ci` — passed with zero warnings after test-only literal/mock
  helper cleanup. The focused three-suite run was repeated afterward:
  17/17 tests and 4/4 snapshots passed; test typecheck also passed again.
- `npm run format:check` — passed across the repository. Changed checkpoint
  documents/test helper were checked again after the final edits;
  `git diff --check` passed.
- Native builds/smoke: **not run on the revised UI**. PostgreSQL was not rerun
  because the migrations, protocol and storage implementation were unchanged.

Runtime fingerprints after the fixes:

| File under `apps/mobile/src/components/`       | SHA-256                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| `DictionaryConflictResolver.tsx`               | `bd2d2492f10e271b72e0272562d3c1238e39e909129947c5b4e6f7726021c6e1` |
| `WordDetailModal.tsx`                          | `4c2ba8e99b32f227449375ed5cdb62278a27da30f4f16270b01b553fe2b8a4a2` |
| `UniversalWordCard/sections/HeaderSection.tsx` | `4c62cd4ad838a0b4bce201ebce56d988f1e160f8beeea0aaa0d908e3f5691303` |

## Remaining native acceptance matrix

September 21 proved CEFR rendering, owner switching, learning correction/reset
recovery and legacy web convergence. The saved flows/report do **not** establish
the following planned dictionary-content scenarios on actual native clients.
Jest/SQLite coverage is useful but does not replace these native checks.

1. Rebuild the revised runtime for isolated iOS (primary) and Android, then run
   smoke on both. Record source and artifact fingerprints separately.
2. Exercise private add/reanalysis and image replacement with deterministic
   loopback fixture responses. Exercise a pending content edit while offline,
   terminate/relaunch, reconnect and compare the exact persisted operation IDs,
   versions and final content on both devices. Do not call paid providers.
3. Cause a same-word conflict using a second synthetic client. On iOS, exercise
   both **Keep my version** and **Use server version**; verify private content,
   references, queues, unchanged learning history and immediate detail refresh.
   Repeat a conflict without closing the modal and confirm the controls return.
4. Change the local edit or server version while comparison is open. The stale
   choice must be rejected while the pending intent is retained. Check deletion
   and account switching with details open; no previous owner's text may remain.
5. Interrupt delivery after server acceptance but before local acknowledgement;
   retry the same operation and prove one receipt and an empty reconciled queue.
   Inject a missing dependency; the hydration obligation/cursor must remain
   recoverable until the dependency is restored. Record native versus transport-
   injected fault evidence explicitly.
6. Verify the revised content and existing learning state converge across iOS,
   Android and the supported legacy web client. Preserve the earlier dormant-
   client compatibility evidence unless the new build changes that path.

## Environment recovery and resume

Read-only inspection on September 26 found the retained temporary directories,
but `supabase/config.toml`, copied migrations and the private fixture file are no
longer available in the old D08 roots. Old native logs/artifacts must not be
assumed intact. Docker is available; its running containers belong to other
projects. No D08 service/device was started or changed during this review.

Recreate a task-owned loopback QA environment and fresh synthetic identities;
record its config/setup durably outside temporary storage and store credentials
only in ignored private files. Inspect retained devices before reusing any of
them. Existing `D08-native-build.mjs`, `D08-native-fixture.mjs` and Maestro flows
are reusable helpers, but the missing config/source-copy preparation must be
restored first. Do not blindly replay commands against an old temporary path.

Next recommended setting: **GPT-5.6 Sol / High** for the remaining isolated QA;
return to **GPT-6 Astra / High** if QA discovers protocol/concurrency defects.
D09 has not started. Release flags stay off; D01 and D13 gates remain unchanged.
