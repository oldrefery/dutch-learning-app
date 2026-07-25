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

Status: `READY FOR USER COMMIT`

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

Status: `TODO`

Scope:

- Validate configuration and Bearer headers.
- Normalize request ids.
- Add Deno tests for public responses and safe logs.

### P1.3 Required CI Quality Gates

Status: `TODO`

Scope:

- Use a Node version supported by Expo SDK 55.
- Run install, typecheck, lint, format, Jest, Edge tests, and Expo Doctor.
- Replace the ineffective Maestro YAML validation.
- Add test TypeScript checking.

### P2.1 Expo Patch Alignment And Dependency Audit

Status: `TODO`

Scope:

- Align Expo SDK 55 patch versions.
- Re-run Expo Doctor and dependency audit.
- Assess remaining advisories for runtime reachability.

### P2.2 Persisted Word Contract Test Strengthening

Status: `TODO`

Scope:

- Prove UI success uses the repository-returned word.
- Cover collection creation followed by save failure.
- Cover mapper optional and nullable fields.

## Current Resume Point

Wait for the user to commit
`P1.1 Sentry Environment, Sampling, And Payload Redaction`.

After the user confirms the commit and says to continue:

1. Mark P1.1 as `COMMITTED`.
2. Mark P1.2 as `IN PROGRESS`.
3. Implement `P1.2 Delete Account Edge Function Hardening`.
