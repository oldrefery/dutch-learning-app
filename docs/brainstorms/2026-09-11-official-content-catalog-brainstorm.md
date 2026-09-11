---
date: 2026-09-11
topic: official-content-catalog
---

# Downloadable official content catalog

## What We're Building

Add a centrally hosted catalog of reviewed official vocabulary packs. Web and
mobile clients fetch the catalog and a selected immutable pack version, validate
the manifest, and import it through the existing starter-pack workflow. The
bundled Dutch A1 Essentials pack remains available offline and backward compatible.

The first remote release contains 21 CEFR/frequency-ordered packs derived from the
approved private analysis. It contains linguistic content only. Personal word IDs,
collection IDs, account ownership, timestamps, media URLs, review history and SRS
state never enter the public catalog. The six owner-selected sensitive entries are
not published.

## Why This Approach

A bundled-only catalog would add more than two thousand cards to every application
release and require a new store build for corrections. Directly sharing personal
collections would couple public content to one account and expose mutable personal
records. Versioned Supabase manifests preserve the proven Essential Pack import
model while allowing catalog updates without an application release.

## Key Decisions

- Store lightweight catalog metadata separately from immutable versioned manifest
  JSON. Publishing or rolling back changes one current-version pointer atomically.
- Allow `anon` and `authenticated` roles to select published catalog rows only.
  Revoke all client writes; publishing uses trusted release tooling/service role.
- Reuse one shared manifest parser and import DTO for bundled and remote packs.
- Include reviewed English and Russian translations plus safe linguistic fields;
  omit all personal, progress and media fields.
- Cache downloaded manifests by `pack_id`, version and SHA-256. A failed download
  or validation never replaces a previously validated cache entry.
- Keep personal reorganized collections unshared. Public packs are independent
  snapshots and imports create user-owned copies, as Dutch A1 Essentials does.
- Record content review state and hash per immutable version. Draft versions are
  invisible to clients.

## Remaining Release Gate

- Final editorial validation of every exported public field remains an acceptance
  gate before the first catalog publication.
- Both clients initially use one-pack-at-a-time import. Mobile exposes the catalog
  from the import sheet and caches verified versions for offline reuse; web exposes
  pack selection on the starter-pack page.

## Next Steps

1. Add the database contract and RLS migration with synthetic policy tests.
2. Generalize shared manifest validation without breaking Dutch A1 Essentials.
3. Add catalog repositories, caching, loading/error states and pack selection to
   web and mobile.
4. Complete editorial review and create the approved release artifact.
5. Publish only after an explicit production-write authorization.
