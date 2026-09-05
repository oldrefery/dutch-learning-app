---
date: 2026-09-04
topic: mobile-workspace-migration
---

# Mobile Workspace Migration

## What We're Building

Move the Expo application from the repository root to `apps/mobile` so the
repository has explicit `mobile` and `web` application workspaces. Keep shared
domain, content, and Supabase contracts in `packages/*`, and keep backend,
documentation, and repository-level orchestration at the root.

## Why This Approach

The web application is now stable enough that the deferred migration described
in the web implementation plan can begin. A complete Expo workspace is clearer
than moving only `src`, because Expo Router, Metro, Babel, Jest, EAS, assets, and
the mobile dependency graph share one project root.

A source-only move was rejected because it would leave the repository root as
an implicit Expo application and preserve the current configuration ambiguity.
Moving everything in one unchecked filesystem operation was also rejected
because local `ios` and `android` directories are ignored by Git and may contain
uncommitted native changes.

## Key Decisions

- Application boundary: `apps/mobile` owns the Expo source, assets, application
  configuration, Metro, Babel, mobile Jest configuration, and mobile package.
- Repository root: owns npm workspace orchestration, shared quality commands,
  Git hooks, backend code, shared packages, and release entry-point scripts.
- Commands: add explicit `mobile:*` scripts at the root; retain compatibility
  aliases only where they prevent unnecessary developer disruption.
- EAS safety: run EAS commands from `apps/mobile` and preserve the existing
  project ID and owner checks.
- CI: set the Expo working directory explicitly and keep web jobs rooted at
  `apps/web`.
- Maestro: keep repository-level launch commands, but relocate flows and local
  mobile test configuration with the mobile workspace or reference their new
  paths explicitly.
- Local secrets: never commit or print them; relocate ignored mobile env files
  only after their exact ownership is confirmed.
- Native projects: do not automatically move or delete ignored root `ios` and
  `android` directories. Audit for manual changes, then regenerate under
  `apps/mobile` or move them with explicit approval.
- Verification: require install, mobile Jest coverage, TypeScript, ESLint,
  Expo Doctor, Expo config inspection, iOS/Android prebuild comparison, Maestro
  validation, web Jest/E2E, and web production build before removing migration
  compatibility paths.

## Migration Sequence

1. Create `apps/mobile/package.json` and move tracked Expo project files without
   changing application identifiers or versions.
2. Convert the root package into a workspace orchestrator and regenerate the
   npm lockfile.
3. Update aliases, Jest, ESLint, Prettier, Husky, scripts, CI, Sentry source-map
   paths, release tooling, and documentation references.
4. Move or redirect Maestro flows and ignored local mobile environment files.
5. Verify mobile and web quality gates from a clean install.
6. Audit ignored native projects, regenerate or move them, and compare native
   configuration before deleting the old local directories.

## Open Question

- Confirm whether ignored local `ios` and `android` projects contain manual
  changes that must be preserved, or whether they may be regenerated from Expo
  configuration after the tracked workspace migration.

## Next Steps

Create a file-by-file implementation plan, checkpoint the current testing work,
then execute the workspace migration as a separate reviewable change on the
current branch.
