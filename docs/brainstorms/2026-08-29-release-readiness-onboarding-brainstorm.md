---
date: 2026-08-29
topic: release-readiness-onboarding
---

# Release Readiness And Onboarding

## What We're Building

Prepare the completed learning roadmap for a safe public release and make its
new capabilities understandable without forcing every user through a long
first-launch wizard.

The product change is a contextual learning guide: a short, dismissible
introduction when Review is opened for the first time after the update, a
permanent `How Learning Works` entry from Review and Settings, and focused help
for review modes, SRS ratings, Difficult Review, Audio Review, Insights, and
AI-generated Usage & Nuance guidance.

Release work remains a separate gated sequence. Readiness fixes and onboarding
must pass first, followed by an internal release candidate, explicit release
authorization, store submission, and post-release monitoring.

## Approaches Considered

### Mandatory First-Launch Wizard

Show several onboarding pages immediately after authentication.

- Strong discoverability.
- Blocks returning users before they can reach their existing content.
- Couples learning education to authentication and account recovery flows.
- Adds more navigation and persistence edge cases than the problem requires.

### Contextual Guide With Permanent Help Entry

Show a short, versioned guide when the user first reaches Review and keep the
same guide available from Review and Settings.

- Teaches features at the moment they become relevant.
- Is dismissible and does not block authentication or collection browsing.
- Gives returning users a stable way to reopen the material.
- Reuses the existing settings persistence model without remote schema work.

This is the selected approach.

### Help Screen Only

Add documentation to Settings without any proactive introduction.

- Lowest implementation cost.
- Too easy to miss, especially for users who do not know that review modes,
  difficult-word filtering, or adaptive progression exist.

## Key Decisions

- **No authentication wizard:** onboarding starts in the Review context.
- **Dismissible, not mandatory:** users can skip it and keep working.
- **Versioned local state:** store a guide version in the existing persisted
  settings store so materially updated guidance can be shown once in a future
  release.
- **One source of content:** the first-time presentation and permanent guide
  use the same typed content model to avoid copy drift.
- **No behavioral telemetry:** completion remains local unless a separate
  privacy decision authorizes product analytics.
- **No SRS mutation:** opening or completing guidance never changes learning
  progress.
- **Release target:** plan for app version `2.0.0`; resolve the next available
  native build number immediately before the release-candidate bump.
- **Local version source:** retain the current explicit local version strategy
  for this release so native build numbers, Sentry `dist`, and source maps stay
  deterministic.
- **No implicit release:** build, submit, and public promotion are separate
  commands with explicit user approval at each external gate.
- **Permission minimization:** verify and remove unused recording/background
  capabilities before store review. Audio Review currently promises
  foreground playback only.

## Onboarding Content Boundary

The guide explains:

1. Import or add words, then review due cards.
2. Recognition, Meaning Recall, Dutch Production, and Adaptive modes.
3. `Again`, `Hard`, `Good`, and `Easy` as scheduling assessments.
4. Difficult Review and the Insights difficulty heuristic.
5. Audio Review as a foreground, low-visual-attention option with visible
   controls.
6. Usage & Nuance as optional AI-generated guidance, not an answer authority.

It does not teach Dutch grammar, duplicate existing legal pages, introduce a
social feature, add accountless use, or redesign the complete application.

## Release Boundary

Readiness includes production Sentry triage, linked Supabase lint remediation,
permission/capability review, version and source-map consistency, upgrade-path
testing, accessibility checks, release notes, and store metadata review.

The release candidate is distributed internally first. Public rollout requires
an explicit approval after the candidate passes the documented device matrix.
Post-release monitoring has defined stop conditions rather than assuming a
successful upload means a healthy release.

## Open Questions Deferred To Release Gate

- Confirm the final store-facing version and release notes after onboarding QA.
- Confirm whether iOS should use a phased release and the Android production
  rollout percentage after the internal candidate is accepted.
- Confirm store screenshots and localized metadata in App Store Connect and
  Google Play Console before public promotion.

## Next Steps

Execute `docs/plans/release-readiness-onboarding-2026-08-29.md` one work package
at a time and stop at every documented user approval gate.
