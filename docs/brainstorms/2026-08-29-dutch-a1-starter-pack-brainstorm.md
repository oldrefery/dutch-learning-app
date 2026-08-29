# Dutch A1 Starter Pack

Date: 2026-08-29

## Context

The roadmap requires an offline starter pack that gives a new user an
immediate review queue while preserving the existing rich Dutch word model,
semantic duplicate handling, selective import, and explicit user consent.

The content is original project material. It must not be presented as
language-reviewed until a human reviewer has checked every entry.

## Decision

- Ship one versioned JSON manifest as a bundled application asset.
- Validate the complete manifest at runtime before showing or importing it.
- Reuse the existing import preview, target selector, selection list, and a
  shared pure semantic-duplicate utility.
- Import through the regular offline-first store action. Do not use the
  shared-collection RPC because the bundled pack has no network dependency.
- Strip pack identifiers and reset ownership, timestamps, and all SRS fields
  when converting entries into importable words.
- Let users import a subset and create a dedicated collection only when they
  confirm the import.
- Show a first-review action after a successful import.
- Keep the manifest review status `pending` until a human reviewer supplies
  their name and review date. Pending content may be imported in development
  builds for QA, but production import remains disabled.

## Alternatives Considered

### Route the bundled pack through collection sharing

This would reuse the current hook directly, but it would turn an offline asset
into a network-dependent feature and incorrectly use a SECURITY DEFINER RPC
for locally owned content.

### Build a separate import screen from scratch

This would be quicker initially, but selection, duplicate behavior, and theme
handling would drift from the existing collection importer.

### Auto-import for new accounts

This would shorten onboarding, but it would mutate the user's library without
an explicit choice and make removal or ownership expectations unclear.

## Release Gate

Before changing the manifest review status to `approved`, a human Dutch
language reviewer must verify all lemmas, translations, articles, plurals,
conjugations, separable parts, fixed prepositions, examples, and register
labels. The reviewer name and review date must be recorded in the manifest.
