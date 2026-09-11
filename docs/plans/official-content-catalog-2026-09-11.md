# Official Content Catalog Implementation Plan

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
  pointer in one trusted transaction. Rollback switches the pointer back.

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
