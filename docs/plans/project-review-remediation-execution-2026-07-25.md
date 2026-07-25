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

Status: `READY FOR USER COMMIT`

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

### P2.2 Persisted Word Contract Test Strengthening

Status: `TODO`

Scope:

- Prove UI success uses the repository-returned word.
- Cover collection creation followed by save failure.
- Cover mapper optional and nullable fields.

## Current Resume Point

Wait for the user to commit `P2.1 Expo Patch Alignment And Dependency Audit`.
After the user confirms the commit and says to continue, mark P2.1 as
`COMMITTED`, record the commit hash, and start P2.2.
