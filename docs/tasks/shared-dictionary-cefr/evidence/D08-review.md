# D08 local review and fixes

Date: 2026-09-21\
Model / effort: GPT-6 Astra / High, after the user's model switch\
Branch: `feature/shared-dictionary-schema`\
Committed HEAD: `c5dfb14d49b9a53521b53e13bdd19991999ede5d`\
Persistence: all D03–D08 work remains local, uncommitted and unpushed

## Scope

AUTH-14 local review, fixes and synthetic verification only. No hosted database,
real-user synchronization, device installation, paid provider call, deployment,
activation, commit, push or PR occurred. The review was performed in the same
task, not by an independent review agent. D08.4 remains incomplete.

## Findings and fixes

1. **Dormant client rollout.** Added the explicit build-time
   `EXPO_PUBLIC_DICTIONARY_CONTENT_ENABLED` gate, default off. Disabled builds
   neither enqueue dictionary commands nor overlay dictionary content. Enabled
   builds require the server capability and cannot silently downgrade. No release
   environment or runtime flag was enabled.
2. **Pending intent and atomic acknowledgement.** Reproduced remote card state
   replacing a pending local edit at equal or higher projected versions. Remote
   hydration now preserves any remaining pending intent. Card persistence and
   acknowledgement of the exact owner/word/operation IDs use one exclusive SQLite
   transaction, with receipt/version validation before mutation. Successful
   command chains are batch-hydrated, not fetched separately for every card.
3. **Crash-safe hydration debt.** Added `dictionary_card_refresh_queue` to the
   unreleased additive SQLite v13 schema. Remote word updates durably record
   hydration debt before advancing the legacy cursor. Missing dependencies leave
   the debt for retry; card persistence clears it transactionally. Deleted cards
   are excluded from pending dispatch and shared-revision refresh.
4. **Safe coexistence writes.** Enabled clients insert missing legacy words using
   conflict-ignore semantics; existing cards receive collection metadata updates
   only. Whole-row legacy uploads no longer precede content commands. Pending
   legacy edits present at initial activation receive private fallback/command
   state transactionally before dictionary hydration. Image edits retain all
   accumulated private overrides instead of replacing them with an image-only map.
5. **Visible conflict resolution.** Conflicts remain queued and visible in sync
   status. The word-detail resolver compares local and server content and requires
   an explicit choice. Keeping local content creates a private resolution command
   against the latest remote version. Taking the server version removes only the
   captured intent for that word. Changed remote versions or newer local edits
   invalidate the choice; no learning state is replaced.
6. **Learning isolation and account races.** Dictionary failures are reported but
   do not prevent protocol-2 learning uploads. Conflict refresh updates local UI
   without treating the sync as successful. Identity is checked before dispatch
   and persistence; asynchronous word-store loads cannot populate another account.
7. **CEFR refresh correctness.** Assessment-head reads are paginated. Explicit
   missing heads clear stale cache entries while immutable assessment history
   remains intact.
8. **Returning old-client private edits.** The dormant legacy guard now captures
   changes to unlinked legacy content in private fallback state and advances its
   content version. New clients observe the edit and stale commands conflict.
   Content-command projection does not double-increment the version. Linked-card
   protection and learning protocol behavior remain unchanged. This fixes a D05
   compatibility gap in the local, not-yet-deployed migration.

Context7 Supabase JavaScript documentation confirmed conflict-ignore upsert
return behavior and explicit `.select()` for update acknowledgements. No new
dependency or public target-schema drift was introduced.

## Final verification

Run from the repository root unless otherwise stated, with
`PATH=/opt/homebrew/opt/node@24/bin:$PATH`.

| Gate                                                                 | Result                                       |
| -------------------------------------------------------------------- | -------------------------------------------- |
| `npx jest --watchman=false --runInBand --silent`, from `apps/mobile` | 141 suites, 1,614 tests, 22 snapshots passed |
| `npm run test:db`, additionally using PostgreSQL 15 binaries         | 174/174 passed                               |
| Focused dictionary content PostgreSQL tests                          | 13/13 passed                                 |
| `npm run typecheck:test --workspace @woordenaar/mobile`              | passed                                       |
| `npm run typecheck --workspace @woordenaar/mobile`                   | passed                                       |
| `npm run lint -- --quiet`                                            | passed                                       |
| `npm run supabase-contracts:target:check`                            | passed; no public target drift               |
| Formatting and `git diff --check`                                    | passed at documentation closure              |

Regression coverage includes pending-edit preservation, atomic acknowledgement
rollback, receipt mismatch, deleted-card exclusion, durable hydration debt,
metadata-only updates, legacy pending adoption, learning uploads after content
failure, conflict choices and owner isolation, assessment removal, command batching,
and returning-old-client fallback/version changes. UI tests do not establish
native visual or cross-device end-to-end correctness.

Intermediate failures were resolved: the migration table inventory needed the
new queue, earlier D08 test fixtures needed correct mutable/response types, and
new sync mocks needed reset/argument alignment. Disposable PostgreSQL initially
hit sandbox shared-memory restrictions; the approved escalated run passed.
Target-contract checking similarly required approved Docker socket access.
Do not confuse these preflights with failing product assertions.

### Reviewed artifact fingerprints (SHA-256)

- `apps/mobile/src/services/dictionaryContentSync.ts`:
  `a20abafaed43933d99476c92980b2887d80f498fbaebdaadf1a247391094d891`
- `apps/mobile/src/db/dictionaryContentRepository.ts`:
  `4e07818f260a110a0386f2c9e49651a5bed4c34a0ac70f90c60cba1e60a26c45`
- `apps/mobile/src/db/dictionaryContentSchema.ts`:
  `ef9ce6516eef7b6e5c6a265719b791462ba283832b8dc2d9f042677c56a1e52e`
- `supabase/migrations/20260921140000_add_dictionary_content_protocol.sql`:
  `a7a65c027559fe5089989004a243d8e4520bb9e3bbb8e12988c1c6fc35096326`

This checkpoint supersedes earlier D05/D07 fingerprints for modified artifacts;
earlier evidence still describes its historical tested snapshot.

## Next checkpoint: D08.4 isolated platform QA

Recommended model: GPT-5.6 Sol / High for executing the prepared QA; use GPT-6
Astra / High again if protocol/concurrency findings require a design review.

Before native installation, obtain explicit scope for disposable task-owned iOS
simulator and Android emulator, local QA builds and a loopback-only Supabase stack
with synthetic `example.invalid` accounts. AUTH-09 was consumed for D01 baseline
only; AUTH-14 does not authorize device/app replacement or real-user sync. Do not
reuse production accounts, linked databases, existing user apps or expired
one-off permissions. No EAS/cloud build or paid call is needed for this scope.

1. Follow `docs/local-sync-qa.md`; identify and isolate the temporary stack/devices
   and record exact artifact hashes, ports and synthetic owners. Enable dictionary
   capabilities only inside the disposable test stack/builds. Keep release flags off.
2. Test iOS first (primary platform), then Android: private add/edit, shared-linked
   materialization, unknown/estimated/reviewed CEFR, image overrides and both
   conflict choices. Verify no linked whole-row content upload.
3. Exercise offline content plus review/reset/correction, app termination before
   and after acknowledgements, retries, dependency failure and reconnect. Verify
   exact operation IDs, final card versions and unchanged learning intent.
4. Test two-device convergence and logout/account switches. Inspect persistent
   queues and hydration debt, not only the sync badge. Require explicit conflict
   choice and prove a newer local edit invalidates an older choice.
5. Verify coexistence with the currently supported legacy web/mobile path:
   metadata updates, unlinked content changes and linked-content rejection.
   D09 new-web integration is still pending; do not claim full new-web coverage.
6. Save sanitized evidence, shut down only task-owned services/devices, preserve
   artifacts for resume. Mark D08 complete only when all D08.4 exits pass.

D01 Android build and complete learning-queue evidence remain pre-release gates.
Production cutover remains deferred until D13 verification and explicit approval.
