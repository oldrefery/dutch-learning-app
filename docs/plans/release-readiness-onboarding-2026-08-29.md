# Release Readiness And Onboarding Plan

Date: 2026-08-29
Status: `READY FOR EXECUTION`
Planning branch: `feature/memorila-learning-roadmap`
Target release: `2.0.0` with the next verified native build number
Repository: `/Users/devrush/code/pet/DutchLearningApp`
Brainstorm:
`docs/brainstorms/2026-08-29-release-readiness-onboarding-brainstorm.md`

This document is the execution and recovery point for preparing the completed
Memorila-inspired learning work for release. Execute one work package at a
time. Do not build, submit, or publicly release production artifacts before the
corresponding user approval gate.

## Status Legend

- `TODO`: not started.
- `IN PROGRESS`: current package; do not start a later package.
- `READY FOR USER COMMIT`: implementation and verification are complete.
- `COMMITTED`: the user confirmed the package was committed.
- `VALIDATION REQUIRED`: implementation is complete and requires user review.
- `PROCEED`: the user accepted the validation gate.
- `RELEASE AUTHORIZED`: the user explicitly authorized external release work.
- `BLOCKED`: a documented external dependency prevents progress.
- `DONE`: no remaining action for the package.

## Outcome

Release a stable version that:

- explains the new learning workflow at the point of use;
- keeps help permanently accessible;
- requests only capabilities the shipped product actually uses;
- has a clean production error and database baseline;
- preserves existing accounts, local words, SRS progress, and sync state during
  an upgrade;
- produces matching native version, runtime fingerprint, Sentry release, dist,
  and source maps;
- is validated internally before any public promotion;
- has explicit monitoring and stop conditions after release.

## Non-Goals

- New review modes or changes to SM-2.
- Guest mode, social profiles, leaderboards, or Community Journey.
- Background or lock-screen Audio Review.
- Speech recording or speech recognition.
- A mandatory authentication or first-launch wizard.
- Remote behavioral analytics without a separate privacy decision.
- A complete visual redesign.
- Automatic public rollout after a successful build or upload.

## Decisions Already Made

1. Use contextual onboarding in Review, not an auth-blocking wizard.
2. Keep one typed content source for the first-time guide and permanent help.
3. Persist a versioned completion flag locally in `useSettingsStore`; do not
   add a remote table or sync the flag.
4. Allow skip/dismiss and provide permanent reopen actions from Review and
   Settings.
5. Keep the current local EAS version source for this release. Expo/EAS current
   behavior keeps the marketing version local even when remote build numbers
   are used; deterministic local build numbers are retained here because
   Sentry `dist` and source-map validation already depend on them.
6. Treat build, store submission, and public promotion as separate external
   actions with separate approvals.
7. Target `2.0.0`; resolve the next available iOS and Android build numbers
   before changing version files. Build `79` is the expected value only if both
   stores confirm it is unused.
8. Preserve `runtimeVersion.policy: fingerprint` and remove any build-script
   behavior that bypasses or contradicts fingerprint calculation.
9. Audio Review remains foreground-only. Unused recording permissions and
   background audio capabilities must be removed unless implementation scope
   is explicitly expanded.
10. No release package may hide a failing baseline by suppressing lint, tests,
    Sentry, database, or store warnings.

## Documentation Checkpoints

Before implementation, refresh current documentation through Context7 for the
installed Expo/EAS versions.

Already checked during planning:

- Context7 `/expo/eas-cli`: marketing version remains local; build and submit
  profiles are separate; EAS Submit can upload a chosen local or EAS artifact.
- Context7 `/websites/expo_dev_versions_sdk`: `expo-audio` enables background
  playback through config-plugin options, while microphone/background
  recording capabilities are separate and unnecessary for playback-only use.

Refresh before touching:

- Expo Router navigation and modal patterns.
- Zustand persist migration/version behavior.
- EAS app-version, build, submit, TestFlight, and Google Play internal-track
  behavior.
- Expo Audio config-plugin permissions and background capabilities.
- Sentry React Native release, dist, debug ID, and source-map verification.
- Supabase CLI migration and linked database lint behavior.

## Current Baseline

- App version: `1.13.0`.
- iOS build number: `78`.
- Android version code: `78`.
- EAS version source: local.
- Runtime version policy: fingerprint.
- Production build profile: native device artifacts, production environment,
  production update channel, no automatic build-number increment.
- Android submission target: internal track with draft status.
- Existing release script builds locally, increments versions, creates a Git
  commit, optionally submits, and handles Sentry source maps.
- Known linked Supabase lint debt: `public.sync_user_access_levels` returns
  `varchar(255)` where its declared result expects `text`.
- iOS currently declares background audio capability although the Audio Review
  MVP is foreground-only.
- Android currently declares `RECORD_AUDIO` although no recording feature is
  shipped.
- Existing Sentry preview smoke instructions are in
  `docs/SENTRY_TELEMETRY_SMOKE_CHECK.md`.
- Existing EAS documentation and changelog are stale relative to version 1.13.

## WP3.0 Production Baseline And Release Blockers

Status: `COMMITTED`
Priority: P0
Estimated size: M
Depends on: completed Memorila-inspired roadmap
Suggested commit: `fix: clear production release blockers`

### Purpose

Establish a trustworthy baseline before adding onboarding or producing a
release candidate.

### Plan

1. Run the project-local read-only Sentry triage workflow:
   - environment `production`;
   - time range `14d`;
   - unresolved issues only;
   - error level before warnings;
   - prioritize auth/session, database/RLS writes, and sync correctness.
2. Record issue IDs, affected releases/dists, counts, user counts, first/last
   seen, and the release-blocking decision without copying user-entered card
   text into documentation.
3. Run linked Supabase migration history and database lint checks.
4. Fix the known `sync_user_access_levels` return-type mismatch through a new,
   reviewable SQL migration. Do not edit production functions manually in the
   dashboard.
5. Apply the migration with the project-approved dry-run/apply/history workflow
   and rerun linked lint until it is clean.
6. Audit Expo/native capabilities against shipped behavior:
   - remove Android recording permission if no code records audio;
   - remove iOS background audio mode if playback is intentionally stopped on
     background/lock;
   - verify no config plugin regenerates either capability;
   - verify store privacy declarations match the resulting binary.
7. Audit release/version tooling:
   - keep version preparation separate from build and submit;
   - remove automatic Git commits from the build path;
   - fail before mutation if the worktree is dirty or versions disagree;
   - keep `app.base.json`, `package.json`, and `package-lock.json` aligned;
   - remove `EAS_SKIP_AUTO_FINGERPRINT=1` if it bypasses the configured
     fingerprint runtime policy;
   - require explicit `--submit` or a separate submit command;
   - preserve build-context-first source-map validation.
8. Add regression tests for version parsing, mutation boundaries, dirty-tree
   refusal, source-map context, and dry-run/help behavior.
9. Update the operational release guide to match the actual scripts and config.

### Required Tests

- The linked Supabase lint command returns no error.
- The new database migration is idempotent in repository tests and appears once
  in local/remote history.
- Expo config output contains no recording or background playback capability
  outside declared product scope.
- `npx expo-doctor` passes after native config changes.
- Release preparation never commits, builds, submits, or uploads implicitly.
- Build refuses mismatched app/package versions and reused native build numbers.
- Source-map release/dist are derived from the exact artifact build context.
- Existing audio playback tests still pass after capability removal.

### Done Criteria

- No unresolved P0/P1 production issue is knowingly carried into the candidate.
- Linked database lint is clean.
- Native permissions and capabilities match foreground playback-only behavior.
- Version, fingerprint, build, submit, and source-map responsibilities are
  explicit and independently testable.
- All quality gates pass.

### Execution Result

- Triaged all unresolved production issues from the 14-day Sentry window and
  recorded their non-blocking disposition in
  `docs/RELEASE_READINESS_2_0_0.md`; the current branch contains regression
  fixes and tests added after build 78.
- Applied linked migration `20260829120000`; local/remote history matches and
  linked database lint reports no schema errors.
- Removed recording/background-audio capabilities from the generated Expo
  configuration while preserving foreground playback.
- Split version preparation, native build, and internal submission into
  independently gated scripts with no implicit Git or public-release actions.
- Aligned Expo SDK 55 patch dependencies, cleared all high-severity audit
  findings without `--force`, and passed Expo Doctor 20/20.
- Passed 75 Jest suites (987 tests, 16 snapshots), lint, build/test typechecks,
  formatting, shell syntax, native config introspection, and regression tests.

## WP3.1 Contextual Onboarding And Learning Guide

Status: `COMMITTED`
Priority: P0
Estimated size: M
Depends on: WP3.0
Suggested commit: `feat: add contextual learning guide`

### Purpose

Help new and returning users understand how to use the completed learning
system without delaying authentication or normal app startup.

### Primary Change Surface

- `src/app/learning-guide.tsx` (new)
- `src/components/LearningGuide/` (new)
- `src/components/ReviewModeSelector.tsx`
- `src/app/(tabs)/settings.tsx`
- `src/stores/useSettingsStore.ts`
- `src/constants/Routes.ts`
- related Jest, snapshot, persistence, and Maestro tests

### Content Model

Define typed guide sections rather than embedding unrelated copy across
screens. Each section contains:

- stable identifier;
- title and concise explanation;
- optional bullet points;
- related route/action metadata only when the action is safe and reversible;
- accessibility label where visual text alone is insufficient.

Required sections:

1. **Start Learning:** add a word or import Dutch A1 Essentials, then review due
   cards.
2. **Review Modes:** Recognition, Meaning Recall, Dutch Production, and
   Adaptive selection.
3. **SRS Ratings:** what `Again`, `Hard`, `Good`, and `Easy` mean for scheduling.
4. **Difficult Words:** difficulty heuristic, due-only Difficult Review, and
   Insights access.
5. **Audio Review:** foreground-only behavior, visible controls, gestures as
   optional shortcuts, and safe exit.
6. **Usage & Nuance:** AI-generated, optional guidance that can be refreshed and
   is not the source of review correctness.

### Interaction Plan

1. Add a permanent `How Learning Works` action to Review mode selection.
2. Add a permanent `Learning Guide` row to Settings.
3. On the first Review entry for the current guide version, show a compact,
   dismissible introduction that offers:
   - `Show Guide`;
   - `Not Now`.
4. Do not show the prompt during an active review session, auth recovery,
   collection import, or app initialization.
5. Persist `learningGuideVersionSeen` locally only after explicit dismissal or
   completion.
6. Opening the guide manually never changes the seen version or learning data.
7. Use one full-screen/stack guide route with native scrolling rather than a
   nested sequence of modal pages.
8. Keep actions optional. The guide may navigate to Add Word, Review, or
   Insights, but never imports, saves, starts a review, or mutates SRS by itself.
9. Support light/dark themes, dynamic type, VoiceOver/TalkBack order, reduced
   transparency, and at least 44-point touch targets.

### Required Tests

- Fresh persisted state shows the Review introduction once.
- `Not Now` dismisses it and normal navigation continues.
- `Show Guide` opens the guide and completion persists the current version.
- Existing users with older/missing persisted settings migrate safely.
- Manual Review and Settings entries always reopen the guide.
- Reopening the app does not show a completed guide version again.
- A future higher guide version can be shown once without clearing settings.
- Guide actions never save words, import content, start sessions, or update SRS.
- All sections render in light and dark themes and at large text sizes.
- VoiceOver/TalkBack labels and focus order identify headings and actions.
- Long English copy and smaller Android/iOS screens scroll without clipping.

### Maestro Coverage

Add one deterministic flow per platform that:

1. resets only the guide-seen flag through a test-safe path;
2. opens Review and observes the contextual introduction;
3. opens the guide;
4. verifies Review Modes, Difficult Words, Audio Review, and Usage & Nuance;
5. closes and reopens the app;
6. confirms the automatic introduction does not repeat;
7. reopens the guide from Settings.

### Done Criteria

- Users can understand the learning workflow without leaving the app.
- Onboarding is contextual, dismissible, reversible, and non-mutating.
- Permanent help is discoverable from Review and Settings.
- Existing users and persisted settings remain backward compatible.
- Both platform flows and all quality gates pass.

### Execution Result

- Added a single typed, versioned Learning Guide covering all six required
  sections, with safe navigation-only actions and permanent entry points from
  Review and Settings.
- Added a hydration-safe first-Review introduction and local Zustand
  persistence/migration; explicit dismissal or `Done` records the current
  guide version, while manual opening does not mutate it.
- Added Jest coverage for rendering, navigation boundaries, persistence,
  migration, future guide versions, light/dark themes, scrolling, and explicit
  completion.
- Added deterministic iOS and Android Maestro flows that reset only the guide
  flag, verify first presentation, exercise the content, relaunch without a
  repeated prompt, and reopen the guide from Settings.
- Passed simulator smoke checks on iPhone 16 Pro (iOS 26.5) and Pixel 8
  (Android API 36), including light/dark visual checks and the corrected iOS
  `Back` title.
- Passed lint, formatting, both TypeScript configurations, and all 77 Jest
  suites (1006 tests, 16 snapshots).

## Validation Gate B: Onboarding Acceptance

Status: `PROCEED`
Depends on: WP3.1

Stop after WP3.1 is committed and present the user with:

- iOS and Android screenshots/video of the first Review introduction;
- guide screens in light and dark themes;
- Settings and Review entry points;
- exact persistence/reopen behavior;
- final English copy for every section.

Exit decisions:

- `PROCEED`: onboarding is accepted; create the release candidate.
- `REVISE`: update the documented copy/interaction and repeat the gate.
- `STOP`: keep the implementation unshipped and do not build a candidate.

## WP3.2 Release Candidate And Upgrade Validation

Status: `IN PROGRESS`
Priority: P0
Estimated size: L
Depends on: Validation Gate B = `PROCEED`
Suggested commit: `chore: prepare 2.0.0 release candidate`

### Purpose

Produce internally distributed, store-shaped artifacts and verify fresh-install
and upgrade behavior before production submission.

### Plan

1. Before creating a pull request or merging to `main`, complete a convergence
   gate:
   - inventory every open pull request and identify overlap, dependency,
     supersession, conflicts, and required checks;
   - close only clearly obsolete PRs with an explicit recorded disposition;
   - preserve or integrate required work without overwriting unrelated changes;
   - rerun the project-local unresolved production Sentry triage and fix or
     document every release-blocking issue.
2. Before every remote Expo/EAS operation, verify that the active identity and
   linked project owner are exactly `oldrefery`; stop if the identity is
   another account, unauthenticated, or ambiguous.
3. Confirm the marketing version and query both stores/EAS for the next unused
   native build number before editing files.
4. Prepare `2.0.0` and the verified native build number in all local version
   sources without committing automatically.
5. Update `CHANGELOG.md` with user-facing changes since the last documented
   release, including review modes, Insights, starter pack, batch capture,
   Audio Review, Usage & Nuance, onboarding, fixes, and privacy/capability
   changes.
6. Update `README.md` only now that the features are release candidates.
7. Add or verify an internal device candidate profile:
   - real-device iOS artifact, not simulator-only;
   - installable Android APK for QA;
   - non-production update channel/environment;
   - production-equivalent minification and native configuration;
   - no automatic store submit.
8. Build both candidate artifacts and verify runtime fingerprint, embedded
   update, release/dist, debug IDs, and source-map upload.
9. Run the documented Sentry preview telemetry smoke check; do not inject test
   events into production.
10. Validate a fresh install and an upgrade from the last public build while
    preserving authentication, SQLite data, review history, starter-pack data,
    settings, and pending sync work.
11. Execute the full device matrix below.
12. Record artifacts, versions, fingerprints, checksums, test devices, dates,
    and results in a release checklist.

### Execution Progress

- Pre-merge convergence completed on 2026-08-29. All eight open PRs were
  Dependabot updates based on the old `main` dependency baseline; each was
  closed with an explicit post-release disposition, and no commits from them
  were merged into the candidate branch. The open PR queue is now empty.
- The production Sentry query still contains four handled events from native
  build 78 and no newer issue. Current-branch fixes are covered by 3 targeted
  suites and 78 passing tests. The issues stay open until the candidate
  validates word re-analysis and session refresh; none is a current release
  blocker.
- The remote Expo/EAS identity gate passed read-only validation for account and
  project owner `oldrefery`; it must be repeated before every subsequent remote
  Expo/EAS operation.
- EAS, App Store Connect, and Google Play Console confirm `78` as their latest
  native production build. Candidate build `79` is unused on both platforms
  and approved for version preparation. The verified De Woordenaar App Store
  Connect ID is `6752469146`.
- Candidate version `2.0.0 (79)` is aligned locally. TypeScript, lint, format,
  Maestro validation, 77 Jest suites with 1,006 tests, 63 Edge Function tests,
  and all 20 Expo Doctor checks pass. Build and submission remain blocked until
  this version is committed, reviewed through a PR, and merged to `main`.

### Device Matrix

Required on both iOS and Android:

- cold launch, warm launch, background/foreground, and offline launch;
- email login, social login where available, logout, and session restore;
- password recovery/deep-link sanity check;
- empty account, existing account, and large existing collection;
- add word, Usage & Nuance, save, force refresh, and duplicate handling;
- starter-pack preview/import without duplicate pollution;
- batch capture pause/retry/cancel/save;
- Recognition, Meaning Recall, Dutch Production, Adaptive, and Difficult
  Review;
- Insights refresh and detail modal;
- Audio Review speaker, wired/Bluetooth route, interruption, lock/background
  stop behavior, pause/resume, and exit;
- offline review followed by online synchronization;
- collection share/import and delete/tombstone synchronization;
- light/dark themes, large text, VoiceOver/TalkBack, and reduced transparency;
- onboarding first display, dismissal, persistence, and manual reopening.

### Automated Gates

```bash
npm run typecheck
npm run typecheck:test
npm run lint:ci
npm run format:check
npm run validate:maestro
npm run test:ci
npm run test:edge
npx expo-doctor
git diff --check
```

Also require:

- linked Supabase migration history and lint are clean;
- production Sentry baseline has no unresolved release blocker;
- all targeted Maestro flows pass against embedded candidate bundles;
- build/source-map verification scripts pass for both artifacts;
- no secrets, build artifacts, screenshots, or test credentials are staged.

### Done Criteria

- Candidate artifacts install on physical iOS and Android devices.
- Fresh install and upgrade paths preserve user-owned learning data.
- No P0/P1 functional, sync, auth, migration, privacy, or accessibility defect
  remains open.
- Store metadata and privacy declarations match the binary.
- Release checklist is complete and ready for explicit authorization.

## Validation Gate C: Release Authorization

Status: `TODO`
Depends on: WP3.2

Stop and provide:

- final version/build and commit SHA;
- candidate artifact identifiers and checksums;
- complete automated and manual QA results;
- linked migration and Edge Function state;
- Sentry baseline and source-map verification;
- proposed App Store and Google Play release notes;
- proposed iOS phased-release and Android rollout settings;
- known limitations and rollback plan.

No production build, store upload, public rollout, EAS production update, or
release tag is authorized by `PROCEED` from the onboarding gate.

Exit decisions:

- `RELEASE`: authorize WP3.3 production build and store submission only.
- `REVISE`: return to the affected package and repeat candidate validation.
- `STOP`: do not mutate store or production release state.

## WP3.3 Production Build, Submission, And Promotion

Status: `TODO`
Priority: P0
Estimated size: M
Depends on: Validation Gate C = `RELEASE`
Suggested commit: `chore: release version 2.0.0`

### External-Action Boundary

This package contains external state changes. Resolve exact artifact, version,
build, track, and phased-rollout targets with read-only checks immediately
before every mutation.

### Plan

1. Confirm HEAD, clean worktree, signed tag plan, store credentials, version,
   build numbers, runtime fingerprint, and applied migrations.
2. Build signed production IPA and AAB artifacts without automatic public
   promotion.
3. Verify artifact identifiers, checksums, signing, release/dist/debug IDs, and
   source-map availability before submission.
4. Submit iOS to App Store Connect/TestFlight and Android to the configured
   internal draft track.
5. Verify processing, compliance questions, privacy declarations, release
   notes, screenshots, tester availability, and installability.
6. Present processed store state to the user before public promotion.
7. Promote only after an additional explicit `PUBLISH` instruction:
   - use iOS phased release if accepted at Gate C;
   - use the accepted Android staged rollout percentage;
   - do not publish an OTA update in parallel unless separately required and
     runtime-compatible.
8. Create and push the release tag only after the exact shipped artifacts are
   known.
9. Record store version IDs, release timestamps, rollout settings, artifact
   checksums, tag, and rollback notes.

### Stop Conditions

Stop submission or promotion if any of these occurs:

- version/build already exists or differs between artifact and checklist;
- missing or mismatched source maps/debug IDs;
- store privacy declaration conflicts with binary permissions;
- migration/Edge Function state differs from the candidate baseline;
- candidate and production fingerprints differ unexpectedly;
- store validation, signing, or compliance error;
- a new production P0/P1 issue appears before promotion.

### Done Criteria

- The approved artifacts are processed in both stores.
- Public promotion matches the user-approved rollout settings.
- Release tag and documentation identify the exact shipped artifacts.
- Monitoring automation/manual checkpoints are active.

## WP3.4 Post-Release Monitoring And Closure

Status: `TODO`
Priority: P0
Estimated size: S
Depends on: WP3.3 public promotion
Suggested commit: `docs: close 2.0.0 release`

### Monitoring Windows

Check at approximately:

- 1 hour after rollout begins;
- 24 hours after rollout begins;
- 72 hours after rollout begins;
- 7 days after rollout begins.

### Monitor

- unresolved Sentry errors by release, dist, platform, count, and affected
  users;
- auth/session restoration and OAuth/password-recovery failures;
- SQLite migration, Supabase RLS/write, sync, and tombstone failures;
- Edge Function analysis failures and malformed-response fallbacks;
- Audio Review lifecycle/native crashes;
- store crash/ANR and rollout health signals;
- support feedback about onboarding clarity and AI-guidance expectations.

Do not add remote behavioral telemetry during monitoring. Use existing
operational health sources and direct user feedback.

### Pause/Rollback Conditions

Pause rollout when:

- authentication or sync is broadly unavailable;
- user data is lost, duplicated, or assigned to the wrong account;
- a migration blocks launch or normal review;
- crash/ANR health materially regresses from the accepted baseline;
- store or privacy compliance information is incorrect.

Use an EAS Update only for a runtime-compatible JavaScript/assets fix with
matching source maps. Native permission, capability, signing, or migration
issues require the appropriate native/store response rather than an unsafe OTA
workaround.

### Closure

1. Record monitoring results and any incident links.
2. Mark all packages and gates with final statuses.
3. Update release documentation with the shipped version/build/tag.
4. Separate non-blocking follow-ups into a new roadmap; do not reopen this plan
   for unrelated feature ideas.
5. Mark the plan `DONE` only after the seven-day checkpoint or an explicitly
   documented earlier closure decision.

## Work Package Protocol

1. Start from the first package marked `TODO`.
2. Mark only one package `IN PROGRESS` at a time.
3. Keep work on the current branch only when the user explicitly requests it;
   otherwise follow Git Flow and begin from updated `main` on a compliant
   feature branch.
4. The user owns commits unless they explicitly request otherwise.
5. Every implementation defect found during QA receives a regression test.
6. Never combine readiness fixes, onboarding acceptance, candidate production,
   and public release into one approval.
7. Stop at Validation Gate B and Validation Gate C.
8. Treat `RELEASE` as authorization for production build/submission, not public
   promotion. Require `PUBLISH` for rollout.
9. Preserve exact commands, artifacts, IDs, and verification results in the
   release checklist without recording secrets.

## Immediate Next Action

Continue WP3.2 by verifying the next unused native build number in EAS and both
stores, while repeating the `oldrefery` identity gate before every remote
Expo/EAS operation. Do not edit version files or start a build until the store
and EAS checks agree.
