# Project Review Remediation Execution Tracker

Date: 2026-07-25
Branch: `feature/project-review-remediation-plan`
Source plan: `docs/plans/project-review-remediation-plan-2026-04-26.md`

This file is the recovery point for future sessions. Read it before changing
code, then continue from the first item marked `IN PROGRESS` or `TODO`.

## Status Legend

- `TODO`: not started.
- `IN PROGRESS`: current work package; do not start a later package.
- `READY FOR USER COMMIT`: implementation and verification are complete.
- `COMMITTED`: the user confirmed that the work package was committed.
- `BLOCKED`: requires a documented decision or external dependency.

## Working Agreement

- Codex edits and verifies one work package at a time.
- The user creates all commits.
- After a package reaches `READY FOR USER COMMIT`, Codex provides:
  - one short Conventional Commit message in English;
  - what changed;
  - why it changed;
  - how to verify it.
- Codex stops after that handoff. Work resumes only after the user confirms the
  commit and says to continue.

## Decision Log

1. Password recovery uses a dedicated Supabase client with no persisted
   session and no automatic token refresh.
2. One shared parser classifies auth callbacks before any session is created.
3. The root deep-link handler is the single owner of inbound auth callback
   routing.
4. A successful password reset signs out the recovery account globally and
   clears any persisted primary session on the current device.
5. Dependency upgrades remain separate from auth and observability fixes.

## Execution Order

### P0.1 Auth Callback Classification And Recovery Isolation

Status: `COMMITTED`

Commit: `3c8b752 fix: isolate password recovery sessions`

Scope:

- Add a typed auth callback parser.
- Distinguish recovery callbacks from OAuth callbacks.
- Remove duplicate auth deep-link listeners.
- Use a non-persistent recovery Supabase client.
- Guarantee cleanup for resolved errors and rejected promises.
- Prevent recovery callbacks from initializing authenticated application state.

Required tests:

- Recovery URL is never handled as OAuth.
- OAuth URL is never routed to password reset.
- Malformed or incomplete callbacks do not create a session.
- Recovery uses the isolated client.
- Recovery never initializes application state with a user id.
- `setSession`, `updateUser`, and `signOut` resolved errors are handled.
- `setSession`, `updateUser`, and `signOut` rejected promises are handled.
- Successful reset clears local application state and routes to login.

Verification:

- Targeted auth/deep-link Jest suites.
- `npm run typecheck`.
- Targeted ESLint.
- `npm run format:check`.
- `npm run test:ci`.

Completed:

- Added one typed parser for recovery, primary-session, invalid, and unrelated
  deep links.
- Moved inbound auth callback ownership to the root deep-link handler.
- Removed the duplicate provider and Google OAuth linking listeners.
- Removed recovery tokens from navigation params and the reset screen.
- Added a dedicated recovery client with persistence and refresh disabled.
- Added explicit recovery cancellation and cleanup behavior.
- Covered resolved errors and rejected promises from session setup, password
  update, recovery sign-out, and primary sign-out.

Verification results:

- Targeted auth/deep-link tests: 5 suites, 27 tests passed.
- Full Jest run: 46 suites, 752 tests passed.
- Build TypeScript: passed.
- ESLint: passed with the same 7 pre-existing warnings and no new warnings.
- Prettier: passed.
- `git diff --check`: passed.
- Full test TypeScript still reports the pre-existing
  `src/lib/__tests__/supabase.test.ts:197` FunctionsClient mock error. This is
  tracked for `P1.3 Required CI Quality Gates`.

### P1.1 Sentry Environment, Sampling, And Payload Redaction

Status: `COMMITTED`

Commit: `521cc12 fix: harden Sentry telemetry privacy`

Scope:

- Set explicit environment, release, and dist.
- Add transaction and span sanitization.
- Harden `logSanitizer`.
- Configure environment-specific sampling.
- Add a controlled telemetry smoke-check procedure.

Completed:

- Added explicit environment resolution for development, preview, production,
  and unrecognized test builds without defaulting unknown channels to
  production.
- Added native application metadata through `expo-application` so runtime
  `release` and `dist` match the source map convention
  `<application-id>@<version>+<build>` and `<build>`.
- Reduced production tracing, profiling, and session replay sampling while
  retaining error-triggered replay sampling.
- Added `beforeSendTransaction` and `beforeSendSpan` sanitization and explicit
  replay masking for text, images, and vectors.
- Hardened log sanitization for auth headers, JWTs, credentials, session ids,
  standalone assignments, email addresses, hostile objects, invalid dates,
  cycles, shared references, control characters, and oversized strings.
- Added configuration, payload-hook, and sanitizer boundary tests.
- Added `docs/SENTRY_TELEMETRY_SMOKE_CHECK.md` with a non-production preview
  verification and rollback procedure.

Verification results:

- Targeted Sentry/logger tests: 4 suites, 54 tests passed.
- Full Jest coverage run: 48 suites, 775 tests passed.
- Build TypeScript: passed.
- ESLint: passed with the same 7 pre-existing warnings and no new warnings.
- Prettier: passed.
- `git diff --check`: passed.
- Production Sentry query for unresolved issues over 14 days returned no
  issues. A preview smoke check remains required after a preview native build
  because an empty issue query does not prove ingestion health.
- Expo Doctor passed 18 of 19 checks and still reports the SDK 55 patch
  mismatches assigned to `P2.1 Expo Patch Alignment And Dependency Audit`.
- Full test TypeScript still reports the pre-existing
  `src/lib/__tests__/supabase.test.ts:197` FunctionsClient mock error assigned
  to `P1.3 Required CI Quality Gates`.

### P1.2 Delete Account Edge Function Hardening

Status: `COMMITTED`

Commit: `988ddb3 fix: harden account deletion function`

Scope:

- Validate configuration and Bearer headers.
- Normalize request ids.
- Add Deno tests for public responses and safe logs.

Completed:

- Split the deploy entry point from the request handler so the production path
  can be tested without starting a server.
- Added strict required-configuration and Bearer JWT validation before creating
  Supabase clients.
- Normalized caller-provided request ids and replaced unsafe values before they
  can reach response headers or structured logs.
- Kept public error bodies stable and excluded tokens, headers, raw user ids,
  dependency errors, and configuration values from logs.
- Made diagnostic user-id hashing non-blocking for account deletion.
- Added a function-local Deno lockfile and 17 regression tests covering CORS,
  methods, authorization, configuration, auth failures, deletion failures,
  safe logging, unexpected errors, and the success path.

Verification results:

- Deno check: passed for the entry point, handler, and tests.
- Deno lint: 3 files passed.
- Targeted delete-account Deno tests: 17 passed.
- Full Edge test suite through Deno 2.9.4: 58 passed.
- Full Jest coverage run: 48 suites, 775 tests passed.
- Build TypeScript: passed.
- ESLint: passed with the same 7 pre-existing warnings and no new warnings.
- Prettier: passed.
- `git diff --check`: passed.
- `npm run test:edge` still cannot find a globally installed `deno`; the
  equivalent full suite passed through `npx -y deno`, and installing/pinning the
  CI runtime remains assigned to `P1.3 Required CI Quality Gates`.

### P1.3 Required CI Quality Gates

Status: `COMMITTED`

Commit: `22c0d8f ci: enforce project quality gates`

Scope:

- Use a Node version supported by Expo SDK 55.
- Run install, typecheck, lint, format, Jest, Edge tests, and Expo Doctor.
- Replace the ineffective Maestro YAML validation.
- Add test TypeScript checking.

Completed:

- Added a required GitHub Actions quality workflow for pull requests, pushes,
  and manual runs with read-only repository permissions and concurrency
  cancellation.
- Standardized GitHub Actions on Node 22.13.0, which is supported by Expo SDK 55.
- Added application and test TypeScript checks, formatting, a seven-warning
  ESLint budget, Jest coverage, Edge tests, Maestro flow validation, Expo
  Doctor, and coverage artifact upload to CI.
- Replaced the Python compilation placeholder with a real YAML parse and
  round-trip validation for every tracked Maestro flow.
- Pinned Deno 2.9.4 as a dev dependency and added a frozen shared Edge Function
  lockfile so `npm run test:edge` works after `npm ci` without a global runtime.
- Corrected the Supabase FunctionsClient test mock so the complete test
  TypeScript project passes.
- Cleared `withTimeout` timers on every settlement path and added
  open-handle regression checks.
- Restored the undiscovered StyledText test as a typed Jest test and added
  `lcov` plus `json-summary` coverage reports.
- Removed `act(...)` warnings and expected error noise from the
  `useLocalProgress` hook suite with awaited initialization and scoped console
  spies.

Verification results:

- Clean `npm ci`: passed.
- Build and test TypeScript: passed.
- ESLint CI budget: passed with the same 7 pre-existing warnings.
- Prettier and all 28 Maestro YAML files: passed.
- Jest coverage: 49 suites, 776 tests passed.
- Targeted retry tests with `--detectOpenHandles`: 49 passed.
- Edge Function tests: 58 passed through `npm run test:edge`.
- Expo Doctor: 18/18 checks passed with only the dependency-version check
  deferred to `P2.1 Expo Patch Alignment And Dependency Audit`.
- actionlint 1.7.12: all three GitHub Actions workflows passed.
- Coverage artifact contains both `lcov` and `json-summary`.
- `git diff --check`: passed.
- `npm ci` still reports 28 dependency advisories (2 low, 12 moderate, 13 high,
  1 critical); assessment and upgrades remain assigned to P2.1.

### P2.1 Expo Patch Alignment And Dependency Audit

Status: `COMMITTED`

Initial commit: `39bdf2c chore: align Expo dependencies and harden update checks`
Follow-up commit: `f9fb65c ci: update GitHub Actions dependencies`

Scope:

- Align Expo SDK 55 patch versions.
- Re-run Expo Doctor and dependency audit.
- Assess remaining advisories for runtime reachability.

Completed:

- Aligned Expo SDK 55, React Native, Expo modules, `eslint-config-expo`, and
  `jest-expo` with Expo's current compatibility matrix.
- Added `babel-preset-expo` as an explicit development dependency because the
  project Babel configuration imports it directly.
- Upgraded `eslint-plugin-sonarjs` to remove its independently remediable
  vulnerable transitive dependency without changing the lint warning budget.
- Applied non-breaking `npm audit fix` updates to the lockfile and deliberately
  rejected `--force` proposals that require incompatible Expo, React Native,
  Jest, or Babel major versions.
- Removed the Expo Doctor dependency-version bypass from required CI.
- Added weekly npm and monthly GitHub Actions Dependabot version checks.
- Confirmed that the project uses Expo CNG with ignored, untracked native
  directories, so no native project regeneration belongs in this package.
- Reduced the audit to two underlying advisory packages:
  - `brace-expansion` is reached through legacy `minimatch` versions in
    Expo/React Native/Jest/ESLint Node tooling. Its denial-of-service condition
    requires attacker-influenced brace patterns.
  - `uuid` is reached through Expo config plugins and the `xcode` Node build
    tool. The advisory affects the v3/v5/v6 external-buffer APIs.
- Verified from an iOS production source map that `brace-expansion`, `uuid`,
  and `xcode` are absent from the shipped JavaScript bundle. The remaining
  advisories are accepted temporarily pending compatible upstream SDK/tooling
  releases.

Verification results:

- Clean dependency installation: passed.
- Expo dependency check: all dependencies are up to date.
- Expo Doctor: 19/19 checks passed with the complete version check enabled.
- Build and test TypeScript: passed.
- ESLint CI budget: passed with the same 7 pre-existing warnings.
- Prettier and all 28 Maestro YAML files: passed.
- Jest coverage: 49 suites, 776 tests passed.
- Edge Function tests: 58 passed.
- iOS production export: passed; source-map reachability scan found none of the
  two advisory packages or `xcode`.
- GitHub Actions and Dependabot YAML parsing: 4 files passed.
- `git diff --check`: passed.
- Full `npm audit`: 0 critical, 42 high, 9 moderate, 0 low. These 51 entries
  are npm meta-vulnerability propagation from the two underlying advisories,
  not 51 independent vulnerable implementations.
- `npm audit --omit=dev`: 0 critical, 33 high, 9 moderate, 0 low. Expo exposes
  its CLI and config/build tools through the production dependency tree, so
  this count does not represent mobile-bundle reachability.

Follow-up:

- Updated `actions/checkout`, `actions/setup-node`, and
  `actions/upload-artifact` to their current official releases after IDE
  inspection identified the older major versions.
- Confirmed the three tags against their official GitHub release pages; the
  workflow YAML parse, Prettier check, and `git diff --check` passed.

### P2.2 Persisted Word Contract Test Strengthening

Status: `COMMITTED`

Commit: `cdb5294 test: strengthen persisted word contracts`

Scope:

- Prove UI success uses the repository-returned word.
- Cover collection creation followed by save failure.
- Cover mapper optional and nullable fields.

Completed:

- Strengthened the hook success test with distinct analyzed and persisted
  lemmas, proving that the success toast uses the `Word` returned by
  `saveAnalyzedWord`.
- Added the default-collection path where collection creation succeeds but the
  subsequent repository-backed word save rejects; the hook returns failure and
  never emits a success toast.
- Exercised the analysis-to-`Word` mapper through the public store action with
  omitted optional fields and explicitly nullable register/conjugation values.
- Confirmed the persisted object, returned object, and Zustand state entry are
  the same complete `Word`.
- Followed React Native Testing Library 13.3.3 guidance by awaiting hook state
  changes inside `act` and using `waitFor` for effect-driven selection.

Verification results:

- Targeted hook and store suites: 2 suites, 35 tests passed.
- Full Jest coverage: 49 suites, 778 tests passed.
- Build and test TypeScript: passed.
- ESLint CI budget: passed with the same 7 pre-existing warnings.
- Prettier: passed.
- Edge Function tests: 58 passed.
- All 28 Maestro YAML files: passed.
- `git diff --check`: passed.

### P0.2 Word Delta Cursor And Pending-Write Protection

Status: `COMMITTED`

Commit: `9477285 fix: protect incremental word sync`

Scope:

- Replace the global word timestamp with a per-user, per-table cursor.
- Pull remote word updates by `updated_at`, including words created earlier.
- Use `word_id` as a deterministic tiebreaker for equal timestamps.
- Prevent a remote pull from overwriting local unsynced word changes.

Completed:

- Added validated, typed sync cursor persistence keyed by user and table.
- Replaced the word pull's `created_at` boundary with an `updated_at` boundary
  and deterministic `(updated_at, word_id)` ordering.
- Added ordered 500-row pagination so Supabase response limits cannot silently
  truncate a large word delta.
- Kept the inclusive server boundary and filtered it locally so words sharing
  the cursor timestamp cannot be skipped or applied twice.
- Advanced the cursor only after the remote rows were successfully applied to
  SQLite.
- Preserved local `pending`, `error`, and `conflict` word rows during remote
  apply.
- Made repository matching prefer an exact `word_id`, then fall back to the
  semantic key, and persist remote semantic-field edits against the existing
  local id.
- Kept the legacy global timestamp helpers for compatibility, but removed them
  from the active word synchronization path.
- Added regression coverage for cursor isolation and validation, updated words,
  equal-timestamp boundaries, failed local apply, pending local writes, and
  semantic-field updates.

Verification results:

- Targeted network, repository, and synchronization tests: 3 suites, 65 tests
  passed.
- Full Jest coverage: 49 suites, 786 tests passed.
- Build and test TypeScript: passed.
- ESLint CI budget: passed with the same 7 pre-existing warnings.
- Prettier: passed.
- Edge Function tests: 58 passed.
- All 28 Maestro YAML files: passed.
- `git diff --check`: passed.

### P0.2 Follow-up: Word Repository Complexity Refactor

Status: `COMMITTED`

Commit: `374e31b refactor: simplify word repository save logic and enhance statement management`

Scope:

- Remove the cognitive-complexity warning from `wordRepository.saveWords`.
- Preserve the P0.2 SQL, bind-value, pending-write, and telemetry contracts.
- Keep prepared-statement cleanup explicit and safe on partial preparation.

Completed:

- Split statement preparation, per-word persistence, value mapping, merge
  telemetry, and cleanup into focused repository helpers.
- Reduced `saveWords` below the configured complexity threshold without lint
  suppression or a new abstraction layer.
- Ensured statements prepared before a later preparation failure are
  finalized, matching Expo SQLite's recommended explicit lifecycle.
- Added coverage for populated and nullable mappings, runtime SRS defaults,
  and partial preparation cleanup.

Verification results:

- Targeted repository tests: 1 suite, 15 tests passed.
- Full Jest coverage: 49 suites, 789 tests passed.
- `src/db` branch coverage: 50.78%, above the required 50%.
- Build and test TypeScript: passed.
- ESLint CI budget: passed with 6 pre-existing warnings; the
  `wordRepository.saveWords` warning was removed.
- Prettier: passed.
- Edge Function tests: 58 passed.
- All 28 Maestro YAML files: passed.
- `git diff --check`: passed.

### P0.3 Offline Delete Tombstones

Status: `COMMITTED`

Commit: `ab90e1c fix: preserve offline delete tombstones`

Scope:

- Replace hard word/progress deletes with durable local tombstones.
- Add compatible remote delete tracking.
- Prevent stale offline upserts from resurrecting deleted records.

Completed:

- Added SQLite schema v5 with `deleted_at` for words and user progress plus
  partial semantic uniqueness for active words.
- Replaced local word, collection-word, orphan-word, and progress hard deletes
  with durable tombstones.
- Excluded tombstones from active local and Supabase reads, duplicate checks,
  review queries, shared collection results, and maintenance lookups.
- Split remote word pulls into active rows and exact-ID tombstones, applied
  both before advancing the `(updated_at, word_id)` cursor, and kept
  tombstones out of semantic matching.
- Pushed local word and progress tombstones before active upserts and
  acknowledged them locally only after the remote update succeeded.
- Soft-deleted remote words for direct word deletion, collection deletion, and
  settings cleanup; collection deletion retains word rows before the
  collection is hard-deleted.
- Reconciled collections deleted on another device only when an exact
  Supabase count proves the remote snapshot is complete.
- Added a Supabase word tombstone migration, active-only partial unique index,
  partial-index-compatible import conflict target, and a `BEFORE UPDATE`
  anti-resurrection trigger.
- Kept the missing remote `user_progress` table, RLS, pull cursor, and clean
  reset contract scoped to P0.4.
- Captured the selected design and rejected alternatives in
  `docs/brainstorms/2026-07-25-offline-delete-tombstones-brainstorm.md`.

Verification results:

- Targeted schema, repository, synchronization, Supabase service, and sharing
  tests: 6 suites, 105 tests passed.
- Full Jest coverage: 50 suites, 803 tests passed.
- Build and test TypeScript: passed.
- ESLint CI budget: passed with the same 6 pre-existing warnings.
- Prettier: passed.
- Edge Function tests: 58 passed.
- All 28 Maestro YAML files: passed.
- `git diff --check`: passed.
- Official Supabase and PostgreSQL documentation confirmed soft-delete updates,
  null filtering, partial unique indexes, partial-index conflict inference,
  and row-level `BEFORE UPDATE` trigger behavior.
- Local Supabase runtime validation was attempted twice but the stack did not
  reach migration application because auxiliary Docker image pulls stalled;
  no linked or production database was modified, and no local container was
  left running.

### P0.4 User Progress Remote Contract

Status: `COMMITTED`

Commit: `80409ad fix: complete user progress synchronization`

Scope:

- Add the missing `user_progress` Supabase migration, indexes, and RLS.
- Add pull/delete handling and verify a clean migration reset supports Stage 5.

Completed:

- Added the remote `user_progress` table with ownership foreign keys, four
  operation-specific RLS policies, cursor/delete indexes, and server-managed
  `updated_at`.
- Added a progress tombstone trigger that prevents stale upserts from clearing
  `deleted_at`.
- Added a per-user `(updated_at, progress_id)` pull cursor with deterministic
  500-row pagination and local boundary filtering.
- Applied remote progress tombstones before active rows and advanced the cursor
  only after both SQLite operations succeeded.
- Preserved local `pending`, `error`, `conflict`, and `deleted` progress during
  active remote apply.
- Pulled progress after words so local foreign-key dependencies resolve, then
  retained the existing word-before-progress push ordering.
- Fixed the historical clean-reset chain by defining `words.article` before
  the semantic uniqueness migration that indexes it.
- Captured the design and rejected snapshot/hard-delete alternatives in
  `docs/brainstorms/2026-07-25-user-progress-remote-contract-brainstorm.md`.

Verification results:

- Targeted schema, progress repository, and sync manager tests: 3 suites,
  71 tests passed.
- Full Jest coverage: 50 suites, 815 tests passed.
- Build and test TypeScript: passed.
- ESLint CI budget: passed with the same 6 pre-existing warnings.
- Prettier and all 28 Maestro YAML files: passed.
- Edge Function tests: 58 passed.
- Expo Doctor: 19/19 checks passed.
- Production Sentry query for unresolved issues over 14 days returned no
  issues.
- Official Supabase documentation confirmed operation-specific RLS policies,
  `USING` plus `WITH CHECK` for updates, ordered range pagination, soft deletes,
  and `updated_at` triggers.
- `supabase start` could not run because Docker Desktop's content store contains
  corrupted blobs and fails even on `docker image ls`; no container was left
  running.
- As an independent runtime check, the complete migration chain passed against
  a clean temporary PostgreSQL 15 database with Supabase-compatible
  `auth`, `extensions`, and role bootstrap.
- Runtime assertions confirmed 9 progress columns, 4 RLS policies, 4 indexes,
  2 triggers, durable tombstone preservation, and automatic `updated_at`.
- `git diff --check`: passed.

Follow-up:

- The otherwise-passing Jest run still emits pre-existing `act(...)` warnings
  and expected error logs from `useLocalWords.test.ts`; keep this in the
  remaining test-hygiene backlog.
- A read-only live Supabase metadata check on 2026-07-25 confirmed that remote
  migration history does not yet contain
  `20260725150000_add_word_delete_tombstones.sql` or
  `20260725170000_create_user_progress.sql`. Consequently,
  `public.user_progress` is not present remotely yet. No remote migration or
  data change was performed.
- The same read-only check returned 25 security advisor notices and 7
  performance notices. The security notices cover one RLS-without-policy
  informational finding, mutable function search paths, exposed
  `SECURITY DEFINER` functions, disabled leaked-password protection, and an
  available Postgres security update. The performance notices cover five unused
  word indexes and duplicate permissive SELECT policies on words and
  collections. These pre-existing live-project findings were not remediated in
  P1.4.

### Quality Follow-up: Database Initialization Diagnostics

Status: `COMMITTED`

Commit: `5104ebe fix: harden database initialization`

Scope:

- Remove the remaining SonarJS duplicate-literal warnings.
- Reduce `initializeDatabase` cognitive complexity without changing migration
  behavior.
- Add direct regression coverage for database migration orchestration.

Completed:

- Replaced repeated fixture literals with shared test constants.
- Split base-schema creation, version checking, and pending migrations into
  focused helpers while preserving migration order and schema version 5.
- Reused the idempotent column helper for migration v4, removing the locally
  caught rethrow diagnostic.
- Discarded and closed a failed initialization connection so a later call
  retries migrations instead of returning a partially migrated cached database.
- Shared one in-flight initialization promise across concurrent callers so no
  caller can receive the database before schema migration finishes.
- Treated malformed or negative stored schema versions as a fresh database
  instead of silently skipping every migration.
- Added database initialization tests for an already-current schema, a fresh
  migration chain, malformed version metadata, concurrent callers, an existing
  column, and retry after a real migration failure.

Verification results:

- Targeted database, sharing, and history tests: 4 suites, 67 tests passed.
- Full Jest coverage: 51 suites, 821 tests passed.
- Build and test TypeScript: passed.
- ESLint CI budget: passed with zero warnings.
- Prettier: passed.
- `git diff --check`: passed.
- Official Expo SDK 55 SQLite documentation confirmed the async open, execute,
  and close lifecycle used by the implementation.

### P1.4 Sync Metadata Timestamp Integrity

Status: `READY FOR USER COMMIT`

Scope:

- Stop changing domain `updated_at` when only sync status changes.
- Record sync-specific timestamps independently.
- Reconcile server-issued timestamps after successful pushes.

Completed:

- Inspected word, progress, collection, active-push, and tombstone-push paths.
- Added idempotent SQLite schema v6 columns for `last_sync_attempt_at` and
  `synced_at` on collections, words, and user progress.
- Kept status-only success and error transitions from changing domain
  `updated_at`.
- Chained Supabase word, progress, collection, and tombstone writes with
  returning selects and reconciled SQLite with server-issued `updated_at` and
  `deleted_at` values.
- Removed client `updated_at` from progress upserts so the server remains the
  timestamp authority.
- Replaced collection `INSERT OR REPLACE` with conflict updates that preserve
  existing local sync-attempt metadata.
- Required complete, typed acknowledgements before clearing pending state; an
  incomplete response now leaves rows retryable.
- Added optimistic `updated_at` guards so acknowledgements, duplicate handling,
  and error handling cannot clear a newer local mutation that happens while a
  network request is in flight.
- Captured the chosen design and rejected alternatives in
  `docs/brainstorms/2026-07-25-sync-metadata-timestamp-integrity-brainstorm.md`.

Verification results:

- Targeted schema, repository, initialization, and synchronization tests:
  6 suites, 128 tests passed.
- Full Jest coverage: 51 suites, 831 tests passed.
- Build and test TypeScript: passed.
- Full ESLint: passed with zero warnings.
- Prettier and all 28 Maestro YAML files: passed.
- Edge Function tests: 58 passed.
- Expo Doctor: 19/19 checks passed.
- Production Sentry query for unresolved issues over 14 days returned no
  issues.
- `git diff --check`: passed.
- Current Supabase JavaScript documentation confirmed that mutation rows are
  returned only when `.select()` is chained.
- Official Expo SDK 55 SQLite documentation confirmed the prepared-statement
  execute/finalize lifecycle used by the reconciliation updates.
- No remote migration or data change was performed.

### P1.5 Semantic Uniqueness And Reachability

Status: `TODO`

Scope:

- Align remote semantic uniqueness with SQLite case normalization.
- Use reachability-aware network preflight for synchronization.
- Add matching local/remote duplicate and network-state tests.

## Current Resume Point

Wait for the user to commit `P1.4 Sync Metadata Timestamp Integrity` with
`fix: preserve sync timestamp integrity`. After the user confirms the commit
and says to continue, record the commit hash and start
`P1.5 Semantic Uniqueness And Reachability`. Keep the unapplied live Supabase
migrations documented as deployment drift; do not apply them without explicit
user authorization.
