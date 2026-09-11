# Official Content Catalog Implementation Plan

Continue with the [detailed completion plan](official-content-completion-handoff-2026-09-11.md),
which records implementation status, known gaps, work packages, and release gates
at baseline `ee06c37`.

## Goal

Deliver centrally hosted, downloadable official vocabulary packs that can be
updated without an application release and do not increase the application
bundle size. Keep the bundled Dutch A1 Essentials pack as an offline fallback.

## Delivery Order

1. Add the Supabase catalog and immutable manifest-version contract.
2. Prove public-read and trusted-write boundaries with isolated PostgreSQL tests.
3. Extract one shared manifest parser for bundled and remote packs.
4. Add catalog repositories and validated caching to web and mobile.
5. Add catalog discovery and one-pack-at-a-time import flows.
6. Build deterministic private export and editorial validation tooling.
7. Publish the first 21 packs only after an explicit production-write approval.

## Database Contract

- `official_content_packs` stores catalog metadata and the current-version
  pointer.
- `official_content_pack_versions` stores immutable versioned JSON manifests and
  their SHA-256 digests.
- `anon` and `authenticated` may read only published catalog rows and published
  versions.
- Client roles have no insert, update, or delete privileges.
- Publishing creates an approved immutable version, then switches the catalog
  pointer in one trusted transaction per pack. The operation is idempotent, so
  an interrupted multi-pack release can be resumed. Rollback switches the
  pointer back.
- Catalog metadata includes the validated manifest entry count, which web and
  mobile show before download.

## Acceptance Criteria

- Draft packs and versions are invisible to client roles.
- Published manifests are readable before sign-in and after sign-in.
- Invalid identifiers, versions, digests, or manifest metadata are rejected.
- A current-version pointer cannot reference a missing version or another pack.
- A client cannot mutate catalog metadata or content, even if RLS is
  accidentally made permissive later.
- Existing Dutch A1 Essentials import behavior remains unchanged.
- No personal identifiers, collection ownership, timestamps, media, progress,
  review history, or SRS state are published.
- The six owner-selected excluded entries never appear in official manifests.

## Rollout Boundary

Schema, tests, client support, and export validation are safe repository changes.
Uploading manifests or changing production catalog pointers is a separate
production write and requires explicit approval.

## Release Workflow

The generated manifests stay under ignored `reports/`; they are never imported
by application code and therefore never increase either bundle.

1. `npm run official-content:build` deterministically regenerates 21 pending
   manifests from the private snapshot and locked collection plan.
2. Complete the editorial acceptance gate documented in the release index.
3. `npm run official-content:approve -- --reviewed-by <reviewer> --reviewed-at <timestamp>`
   creates a new immutable approved release directory. It refuses to overwrite
   an existing release.
4. `npm run official-content:publish` validates an approved release and performs
   a read-only dry run.
5. Only with explicit production authorization, load the service-role secret and
   add `--apply --project-ref <ref>`. The script verifies that the confirmed
   project reference matches `SUPABASE_URL`, then calls the trusted publication
   RPC. Secrets are never printed or stored in release files.

Future content corrections use a new semantic version. Published JSON cannot be
edited or deleted; promotion and rollback only move `current_version`.
