# Mobile workspace migration implementation plan

Date: 2026-09-04

## Goal

Move the complete Expo application from the repository root to `apps/mobile` while keeping the repository root as the npm workspace orchestrator. Preserve the existing application behavior, Expo/EAS identity, release safeguards, shared packages, web application, and Supabase tooling.

## File ownership after migration

### `apps/mobile`

- Expo source: `src/`
- Expo and EAS configuration: `app.config.js`, `app.base.json`, `eas.json`
- Bundler and compiler configuration: `metro.config.js`, `babel.config.js`, `tsconfig.json`, `tsconfig.build.json`
- Mobile tests: `jest.config.js`, `jest.setup.ts`
- Maestro flows and helpers: `.maestro/`
- Mobile environment examples: `env.example`, `env.local.example`
- Mobile package manifest: `package.json`
- Generated native projects: `ios/`, `android/` (ignored)
- Supported platforms: iOS and Android; browser delivery belongs to `apps/web`

### Repository root

- npm workspace orchestration and lockfile
- shared linting, formatting, mutation, Supabase, release, and utility scripts
- `apps/web`
- `packages/*`
- `supabase/`
- repository documentation and CI workflows

## Implementation sequence

1. Create `apps/mobile` and move tracked Expo-owned files without touching the ignored root native projects.
2. Split the root package manifest into an orchestration manifest and `@woordenaar/mobile`.
3. Keep compatibility root scripts, add explicit `mobile:*` scripts, and run Expo/Jest commands in the mobile workspace.
4. Update Jest, TypeScript, Metro, ESLint, Prettier, release, Sentry, EAS Update, Maestro, and CI paths.
5. Regenerate the npm lockfile with Node 24 and npm 11.
6. Generate fresh ignored native projects under `apps/mobile` from the current Expo configuration.
7. Update active repository documentation and examples.
8. Run clean install, formatting, lint, type checks, Jest coverage, mutation tests, Edge tests, web build, Expo config, Expo Doctor, native prebuild, Maestro validation, and Git diff validation.

## Native-project policy

The ignored root `ios/` and `android/` directories are not moved or deleted during this migration. The audit found no manual native source changes, while both directories contain stale version/configuration output and generated build artifacts. Fresh native projects are generated in `apps/mobile`; the old root directories remain only as a local rollback until the user explicitly authorizes deletion.

## SDK 57 follow-up

- Align Expo runtime, Babel and Jest presets, React Native 0.86.3, and the
  separate `@react-native/jest-preset` package. Keep `jest-expo` as the app
  preset because it also supplies Expo module mocks.
- Pin React and its test renderer to 19.2.3 for mobile. Web keeps its own
  React 19.2.8 dependency. Root development dependencies pin React and React DOM
  to 19.2.3 so hoisted Expo devtools and the mobile renderer resolve one matching
  pair. They do not replace the web workspace's runtime dependencies.
- Regenerate the lockfile from all workspace manifests after the SDK upgrade;
  the incremental SDK 55 lock retained duplicate native Expo modules that npm
  could not deduplicate. The refresh also updates dependencies within their
  existing manifest ranges; validate both applications after a clean install.
- Import navigation helpers from `expo-router/react-navigation`, replace
  removed `StyleSheet.absoluteFillObject`, and adapt mobile TypeScript 6
  configuration without changing the web compiler.
- Remove the old RCTTurboModule patch and its post-install hook: React Native
  0.86 already handles the void-method exception in its upstream implementation.
- Use Sentry React Native 8.25 with its Expo Metro helper and config plugin.
  This is an explicit exception to Expo's bundled Sentry 7.11 recommendation:
  the older plugin imports `@expo/config-plugins`, while this SDK exposes it
  through `expo/config-plugins`. The exception is recorded in `expo.install.exclude`.
- Keep the existing ESLint configuration for this migration; enabling the new
  React Compiler lint rules is a separate refactor, not an SDK runtime requirement.
- Rebuild native clients after this upgrade. JavaScript export and prebuild
  checks do not substitute for native compilation or device smoke tests.

## Release safety

- Expo owner and EAS project ID remain unchanged.
- EAS commands must be executed from `apps/mobile`.
- Existing identity checks remain mandatory before remote Expo/EAS operations.
- No commit, push, pull request, deployment, build submission, update publication, or account operation is part of this migration.

## Acceptance criteria

- `apps/mobile` is a valid npm workspace and owns the Expo application.
- Root orchestration scripts work from a clean checkout.
- Shared workspace imports resolve from mobile and web.
- Local Expo config and prebuild succeed under Node 24.
- Production Metro exports succeed for both iOS and Android.
- All existing automated quality gates pass.
- CI workflow action references validate with `actionlint`.
- No credentials or generated native artifacts are added to Git.
