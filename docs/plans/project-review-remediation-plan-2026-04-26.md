# Project Review Remediation Plan

Date: 2026-04-26
Branch created for this document: `feature/project-review-remediation-plan`
Repository: `/Users/devrush/code/pet/DutchLearningApp`

This plan is intended as local project memory. Future sessions should start here before repeating research or triage.

## Review Inputs

- Main review findings from 2026-04-26.
- Independent clean-context subagent reviews:
  - Security and logging.
  - Offline-first sync correctness.
  - Tests, CI, coverage, and local quality gates.
  - Release, observability, and config hygiene.
- Local verification commands:
  - `npm run typecheck`: passed.
  - `npm run lint`: passed with 7 warnings.
  - `npm run format:check`: passed.
  - `npm run test:ci`: passed, 41 suites / 718 tests.
  - `npm run test:edge`: failed because `deno` is not installed.

## Current Risk Summary

The highest-risk issues are not cosmetic. They affect credential handling, sync correctness, user-visible save behavior, and the reliability of release/CI signals.

Priority order:

1. Stop leaking auth/reset credentials and sanitize telemetry.
2. Fix save failure semantics so failed local writes cannot show success.
3. Repair offline sync delta/delete/conflict behavior.
4. Add real PR quality gates and make coverage thresholds meaningful.
5. Stabilize release/source-map/version sources.
6. Reduce complexity in large sync/store/settings modules after correctness is protected.

## Research Cache

### Security And Logging

Sources checked:

- OWASP Logging Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
- OWASP Forgot Password Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html
- Supabase password reset docs: https://supabase.com/docs/guides/auth/passwords
- Supabase Edge Function auth docs: https://supabase.com/docs/guides/functions/auth
- Sentry data collection docs: https://docs.sentry.io/platforms/javascript/guides/react/data-management/data-collected/
- Sentry sensitive data scrubbing docs: https://docs.sentry.dev/platforms/javascript/guides/nextjs/data-management/sensitive-data/

Key conclusions:

- Access tokens, session identifiers, passwords, and sensitive PII must not be logged raw or partially raw.
- Password reset URLs and hash fragments can carry session material in implicit flows; treat the full URL/hash as secret.
- Edge Functions may read the `Authorization` header to verify a user, but that header should never be emitted to logs.
- `sendDefaultPii: true` should be an explicit product/privacy decision and must be paired with `beforeSend` / `beforeBreadcrumb` scrubbing if kept.
- Password reset should not leave the user silently logged into a broad session unless the app intentionally accepts that risk.

### Offline-First Sync

Sources checked:

- Supabase soft delete guide: https://supabase.com/docs/guides/troubleshooting/soft-deletes-with-supabase-js
- Supabase RLS docs: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase upsert docs: https://supabase.com/docs/reference/javascript/upsert
- PostgreSQL `moddatetime`: https://www.postgresql.org/docs/15/contrib-spi.html
- PowerSync Supabase integration: https://docs.powersync.com/integrations/supabase/guide
- PowerSync offline-first article: https://www.powersync.com/blog/bringing-offline-first-to-supabase
- WatermelonDB sync backend guidance: https://watermelondb.dev/docs/Sync/Backend
- RxDB replication notes: https://rxdb.info/replication.html
- NetInfo reachability fields: https://github.com/react-native-netinfo/react-native-netinfo

Key conclusions:

- Incremental sync must use change timestamps or revisions, not `created_at`.
- Deletes need tombstones or deleted-ID streams to avoid resurrection from offline clients.
- Server-issued timestamps/revisions are safer than trusting device clocks.
- Pulling before pushing is valid only if remote apply does not overwrite local `pending` or `deleted` rows.
- Sync cursors should be scoped at least by user and ideally by table/checkpoint tuple.
- Local sync metadata changes should not mutate domain `updated_at`.

### Tests, CI, And Coverage

Sources checked:

- Jest `coverageThreshold`: https://jestjs.io/docs/configuration#coveragethreshold-object
- Jest CLI `--detectOpenHandles`: https://jestjs.io/docs/cli#--detectopenhandles
- GitHub Actions Node.js CI: https://docs.github.com/en/actions/automating-builds-and-tests/building-and-testing-nodejs
- Expo unit testing: https://docs.expo.dev/develop/unit-testing/
- Expo EAS Maestro examples: https://docs.expo.dev/eas/workflows/examples/e2e-tests/
- React `act`: https://react.dev/reference/react/act
- React Native Testing Library `act`: https://oss.callstack.com/react-native-testing-library/docs/advanced/understanding-act
- Maestro React Native testID guidance: https://docs.maestro.dev/get-started/supported-platform/react-native
- Community context for `act` warnings: https://github.com/testing-library/react-testing-library/issues/1051

Key conclusions:

- CI should run the same deterministic gates that developers use locally: install, lint, typecheck, tests.
- Jest coverage thresholds fail builds only when configured above current values.
- `act(...)` warnings are test hygiene failures, even when suites pass.
- Maestro tests should rely on stable `testID` selectors for translated/mobile UI.
- Passing Jest with open handles means async cleanup is not reliable enough.

### Release, Sentry, And Config Hygiene

Sources checked:

- Expo app version management: https://docs.expo.dev/build-reference/app-versions/
- Expo app config reference: https://docs.expo.dev/versions/v55.0.0/config/app/
- Expo Sentry guide: https://docs.expo.dev/guides/using-sentry/
- Expo EAS environment variables: https://docs.expo.dev/eas/environment-variables/usage/
- Expo EAS Update deployment/runtime version docs: https://docs.expo.dev/eas-update/deployment/
- Sentry React Native Expo setup: https://docs.sentry.io/platforms/react-native/manual-setup/expo/
- Sentry Debug IDs: https://docs.sentry.io/platforms/javascript/guides/react/sourcemaps/troubleshooting_js/debug-ids/
- Sentry Debug IDs help article: https://sentry.zendesk.com/hc/en-us/articles/18622312947611-Sourcemaps-Debug-Ids

Key conclusions:

- Expo recommends remote EAS build version management for developer-facing build numbers, unless the project deliberately uses local version source.
- User-facing app version remains manually owned.
- Sentry source maps should match the exact build/update artifact; stale app config fallback is risky.
- Sentry auth should be env-first in CI/EAS; `.sentryclirc` can stay only as local fallback.
- `runtimeVersion.policy: "fingerprint"` conflicts operationally with scripts that skip EAS fingerprinting for production builds.

## Work Packages

### WP0: Security Logging And Telemetry Redaction

Priority: P0

Primary files:

- `src/app/(auth)/reset-password.tsx`
- `src/app/_layout.tsx`
- `src/contexts/SimpleAuthProvider.tsx`
- `src/lib/sentry.ts`
- `src/utils/logger.ts`
- `supabase/functions/delete-account/index.ts`

Problems:

- Password reset screen logs full initial URL and hash fragment.
- Delete-account Edge Function logs request headers and bearer-token prefix.
- Delete-account returns internal details to clients.
- Sentry has `sendDefaultPii: true` without project-level scrub hooks.
- Logger forwards arbitrary context to Sentry breadcrumbs/events.
- Password reset leaves the recovery session active and initializes app state as the user.

Plan:

1. Remove reset URL/hash logs entirely. If diagnostics are needed, log only booleans such as `hasAccessToken` and `hasRefreshToken`.
2. Replace delete-account console logs with sanitized structured logs: method, request id, auth-present boolean, result status, and optionally hashed user id.
3. Remove raw `details` from delete-account client responses. Return stable public error codes/messages.
4. Add `sanitizeLogContext()` for recursive redaction of keys and URL fragments:
   - `authorization`
   - `apikey`
   - `access_token`
   - `refresh_token`
   - `token`
   - `password`
   - `email`
   - `userId`
   - `cookie`
5. Apply redaction before `Sentry.addBreadcrumb`, `Sentry.captureException`, `Sentry.captureMessage`, and dev console output.
6. Revisit `sendDefaultPii`. Preferred default: `false`. If kept, document why and add `beforeSend` / `beforeBreadcrumb` scrub hooks.
7. After successful password reset, sign out or invalidate sessions, then route to login with a neutral success message.

Tests:

- Add or update reset password test: mock a URL containing `access_token` and `refresh_token`; assert no logger/console call contains token material.
- Add Deno test for delete-account logging/response behavior.
- Extend `src/lib/__tests__/sentry.test.ts` for PII-safe config and scrub hooks.
- Extend `src/utils/__tests__/logger.test.ts` for recursive redaction and log-injection sanitization.
- Extend `src/contexts/__tests__/SimpleAuthProvider.test.tsx` for reset-session behavior.

Done criteria:

- No auth/reset token or raw auth header appears in app logs, Edge Function logs, Sentry breadcrumbs, or Sentry events.
- Password reset route still works.
- `npm run typecheck`, `npm run lint`, `npm run test:ci` pass.
- `npm run test:edge` is either passing or explicitly documented as blocked by missing Deno until WP4.

### WP1: Save Failure Contract

Priority: P0

Primary files:

- `src/stores/actions/wordActions.ts`
- `src/components/AddWordScreen/hooks/useAddWord.ts`
- `src/stores/__tests__/wordActions.test.ts`
- `src/components/AddWordScreen/**/__tests__` if added

Problem:

- `saveAnalyzedWord` catches repository errors, sets store error, then resolves without throwing despite `Promise<Word>`.
- `useAddWord` awaits it and immediately shows a success toast.
- A failed local save can be presented as successfully added.

Plan:

1. Choose one contract:
   - Preferred: `saveAnalyzedWord` throws on failure and resolves only with `Word`.
   - Alternative: return `Result<Word, AppError>` and update all callers.
2. Keep duplicate detection behavior consistent and typed.
3. Update `useAddWord` to show success only after a real `Word` is returned.
4. Avoid `as any` casts around constructed words; add a mapper that creates a complete `Word`.

Tests:

- Repository failure does not show success toast.
- Store action rejects or returns a failed result on repository error.
- Duplicate word flow still shows duplicate message, not generic failure.
- Successful save returns a complete `Word`.

Done criteria:

- No code path can show `"added to"` when `wordRepository.addWord` failed.
- TypeScript contract matches runtime behavior.

### WP2: Offline-First Sync Correctness

Priority: P0/P1

Primary files:

- `src/services/syncManager.ts`
- `src/db/schema.ts`
- `src/db/wordRepository.ts`
- `src/db/collectionRepository.ts`
- `src/db/progressRepository.ts`
- `src/utils/network.ts`
- `supabase/migrations/*`

Problems:

- Incremental pull uses `created_at > lastSync`, missing remote updates.
- Sync cursor is global, not user/table scoped.
- Word and progress deletes are hard deletes with no tombstones.
- Pull happens before push and can overwrite local `pending` rows.
- `user_progress` is synced in app code but is missing from Supabase migrations.
- Marking local rows synced mutates domain `updated_at`.
- Local and remote semantic uniqueness differ in case normalization.
- Sync uses `checkNetworkConnection()` instead of reachability-aware `isNetworkAvailable()`.

Plan:

1. Introduce a sync metadata model:
   - Per-user cursor.
   - Prefer per-table cursor: `words`, `collections`, `user_progress`.
   - Cursor should use server `updated_at` plus stable id tiebreaker, or a server-issued revision.
2. Change pull queries to `updated_at > cursor` or equivalent checkpoint.
3. Add delete tracking:
   - Preferred: `deleted_at` on local and remote tables.
   - Alternative: deleted-ID/tombstone tables.
   - Treat tombstones as first-class changes.
4. Make remote apply conflict-aware:
   - Do not overwrite local `pending` or `deleted` rows during pull.
   - Mark explicit `conflict` when local and remote changed the same row.
   - Define per-field conflict rules for progress/image/metadata.
5. Decide whether `user_progress` is real:
   - If yes, add Supabase migration with RLS, indexes, `updated_at`, `deleted_at`.
   - If no, remove sync path and local table.
6. Stop mutating domain `updated_at` for local sync status changes.
   - Add `synced_at` / `last_pushed_at` / `last_pulled_at`.
   - After Supabase upsert, use `.select()` or RPC to return server timestamps.
7. Align semantic uniqueness:
   - Remote index should normalize `LOWER(dutch_lemma)` like local SQLite.
   - Duplicate checks should match remote index semantics.
8. Use `isNetworkAvailable()` for sync preflight.

Tests:

- Remote word created before last sync but updated after cursor is pulled.
- Pending local row is not overwritten by remote pull.
- Offline word delete creates tombstone and pushes remote delete.
- Deleted remote word/collection removes or tombstones local active row.
- Tombstone prevents resurrection from stale offline upsert.
- `markWordsSynced` and `markProgressSynced` do not mutate domain `updated_at`.
- `user_progress` migration exists and clean reset can run Stage 5.
- Mixed-case lemma duplicate behavior is identical local/remote.

Done criteria:

- Multi-device edits are pulled.
- Offline deletes are not resurrected.
- Sync metadata is separate from domain timestamps.
- Clean Supabase migration reset supports every table the app syncs.

### WP3: CI, Tests, Coverage, And Test Hygiene

Priority: P1

Primary files:

- `.github/workflows/e2e-tests-local.yml`
- `.github/workflows/e2e-tests.yml`
- New `.github/workflows/quality.yml`
- `jest.config.js`
- `jest.setup.ts`
- `src/utils/retryUtils.ts`
- `src/components/__tests__/StyledText-test.js`
- `TESTING.md`

Problems:

- Active PR/push workflow does not run `npm ci`, lint, typecheck, or Jest.
- Current Maestro YAML validation compiles YAML as Python and swallows failures.
- Coverage thresholds are effectively disabled.
- `src/app/**` is excluded from coverage without a compensating integration/E2E gate.
- `StyledText-test.js` is tracked but not discovered by Jest naming rules.
- `withTimeout` leaves open handles.
- Jest output has `act(...)` warnings and expected `console.error` noise.

Plan:

1. Add `.github/workflows/quality.yml`:
   - `npm ci`
   - `npm run lint`
   - `npm run typecheck`
   - `npm run format:check`
   - `npm run test:ci`
   - upload coverage artifact.
2. Decide warning policy:
   - Either `npm run lint -- --max-warnings=0`
   - Or a documented warning budget with tracked cleanup.
3. Repair `retryUtils.withTimeout` so timers clear on resolve/reject.
4. Fix `act(...)` warnings in hook tests using awaited `act`, `waitFor`, or `findBy` patterns.
5. Replace broad console suppression with scoped spies in tests that intentionally exercise errors.
6. Rename `StyledText-test.js` to `StyledText.test.js` or remove it if obsolete.
7. Make coverage meaningful:
   - Add `coverageReporters: ['text', 'lcov', 'json-summary']`.
   - Raise global thresholds incrementally from current measured baseline.
   - Add thresholds for `src/components`.
   - Decide and document whether `src/app` is covered by tests or E2E-only.
8. Replace fake Maestro validation:
   - Use a real YAML parser/validator.
   - Use Maestro dry-run or Maestro Cloud/EAS Workflow if feasible.
   - Keep quota-heavy full E2E manual or scheduled.

Tests:

- CI workflow should pass on PR branch.
- `npx jest --listTests --watchman=false` includes intended component tests.
- `npm run test:ci -- --detectOpenHandles` has no open handle from `retryUtils`.
- Coverage thresholds fail if coverage drops below the agreed baseline.

Done criteria:

- PR cannot merge with type errors, lint errors, formatting drift, or broken Jest tests.
- Coverage gate is visible and intentionally calibrated.
- Jest output is materially quiet except for real failures.

### WP4: Edge Function Test Runtime

Priority: P1

Primary files:

- `package.json`
- `supabase/functions/**`
- `.github/workflows/quality.yml`
- `docs/SETUP_INSTRUCTIONS.md`

Problem:

- `npm run test:edge` exists but fails locally because `deno` is not installed.

Plan:

1. Decide how Deno is provisioned:
   - Document local installation.
   - Add CI setup step for Deno.
   - Or run function tests through Supabase CLI if that becomes the project standard.
2. Add `test:edge` to CI after runtime is available.
3. Add security tests for `delete-account`.
4. Add function tests for `gemini-handler` validation and expected 400 vs server failure categories.

Done criteria:

- `npm run test:edge` passes locally and in CI, or the command is removed until supported.

### WP5: Release, Source Maps, And Config Hygiene

Priority: P1

Primary files:

- `app.base.json`
- `app.config.js`
- `eas.json`
- `package.json`
- `package-lock.json`
- `scripts/build-and-submit.sh`
- `scripts/upload-sourcemaps.sh`
- `docs/CURRENT_STATUS.md`
- `docs/SENTRY_HANDOFF_2026-04-25.md`

Problems:

- `app.base.json` version is `1.12.2`; `package.json` version is `1.12.1`.
- `packageManager` says Yarn 1, but repo has `package-lock.json` and uses `npm ci`.
- Sentry scripts are `.sentryclirc`-first and hard-fail without it.
- Native source-map upload can fall back to stale app config if build context is missing.
- Production build script sets `EAS_SKIP_AUTO_FINGERPRINT=1` while runtime policy is `fingerprint`.
- Operational docs are stale relative to build/version state.

Plan:

1. Decide release version source:
   - Option A: Expo app config is the only release version source.
   - Option B: release bump updates `app.base.json`, `package.json`, and `package-lock.json`.
2. Align package manager metadata:
   - Preferred for current repo: npm metadata, because `package-lock.json` and `npm ci` are used.
   - Alternative: commit `yarn.lock` and update workflows to Yarn.
3. Make Sentry scripts env-first:
   - Prefer `SENTRY_AUTH_TOKEN`.
   - Fall back to `.sentryclirc` only for local convenience.
4. Make native sourcemap upload build-context-first:
   - Require `builds/build-context.json` by default.
   - Keep app-config fallback behind explicit override.
5. Resolve `runtimeVersion` policy:
   - Remove `EAS_SKIP_AUTO_FINGERPRINT=1` for production if keeping `fingerprint`.
   - Or switch to `appVersion` and enforce app version bumps.
6. Update docs:
   - Refresh `docs/CURRENT_STATUS.md`.
   - Mark Sentry handoffs as historical, or update them to current branch/build state.

Tests:

- Script dry run or unit/script tests for version bump behavior.
- Sourcemap script refuses native upload without matching build context unless override is explicit.
- Release script reads `SENTRY_AUTH_TOKEN` without requiring `.sentryclirc`.

Done criteria:

- One source of truth for package manager and versioning is documented and enforced.
- Sentry source maps match the exact build/update artifact.
- Status docs do not contradict current build/version state.

### WP6: Complexity, Type Safety, And Maintainability

Priority: P2

Primary files:

- `src/services/syncManager.ts`
- `src/app/(tabs)/settings.tsx`
- `src/lib/supabase.ts`
- `src/stores/actions/wordActions.ts`
- `src/db/wordRepository.ts`
- `src/db/initDB.ts`
- `supabase/functions/gemini-handler/geminiUtils.ts`
- `supabase/functions/get-multiple-images/index.ts`

Problems:

- Several production files exceed the project 250-line guideline by a wide margin.
- Lint shows production complexity warnings:
  - `src/db/initDB.ts`: cognitive complexity 30.
  - `src/db/wordRepository.ts`: cognitive complexity 44.
- `any` exists in production code and Edge Functions.
- Direct `console.*` usage is widespread despite `src/utils/logger.ts`.
- Hardcoded colors still exist in UI components outside central constants.

Plan:

1. Do correctness fixes first, then refactor around covered behavior.
2. Split `syncManager.ts` by responsibility:
   - Session/auth preflight.
   - Pull pipeline.
   - Push pipeline.
   - Conflict/delete handling.
   - Mapping/serialization.
3. Split `settings.tsx` into screen, sections, hooks, and action handlers.
4. Replace production `any` with typed API response shapes and validation helpers.
5. Route production logging through sanitized logger.
6. Replace hardcoded non-brand colors with theme constants, except where third-party brand guidelines require fixed colors.

Tests:

- Preserve existing tests before refactor.
- Add focused regression tests for each extracted module.
- Run `npm run complexity:strict` after high-risk refactors.

Done criteria:

- No new `any` in production code.
- Complexity warnings are reduced or have documented follow-up.
- Large files are decomposed without changing user behavior.

## Suggested Execution Sequence

1. WP0 Security Logging And Telemetry Redaction.
2. WP1 Save Failure Contract.
3. WP2 Offline-First Sync Correctness, split into sub-PRs if needed.
4. WP3 CI, Tests, Coverage, And Test Hygiene.
5. WP4 Edge Function Test Runtime.
6. WP5 Release, Source Maps, And Config Hygiene.
7. WP6 Complexity, Type Safety, And Maintainability.

## Commands To Re-run After Each Work Package

```bash
npm run typecheck
npm run lint
npm run format:check
npm run test:ci
```

When Deno is available:

```bash
npm run test:edge
```

For sync or migration work:

```bash
supabase db lint
npm run test:ci -- syncManager
```

For release/source-map work:

```bash
npm run sourcemaps:build -- --help
```

## Open Decisions

1. Should `sendDefaultPii` be disabled, or retained with strict scrubbing?
2. Should password reset sign out globally after password update?
3. Is `user_progress` an intended remote table, or should progress live only on `words`?
4. Should sync use timestamp cursor, revision cursor, or a dedicated sync log?
5. Should Expo release versioning move to EAS remote source, or remain local?
6. Should `src/app/**` be covered by Jest integration tests, Maestro E2E, or both?

## Do Not Re-Research Unless Context Changes

The sources above were checked on 2026-04-26. Re-check only when:

- Upgrading Expo, React Native, Sentry, Supabase, Jest, Maestro, or NetInfo.
- Changing auth/reset/session behavior.
- Changing sync protocol or database migration strategy.
- Changing EAS build/update/source-map flow.
- Creating a public release or app-store submission.
