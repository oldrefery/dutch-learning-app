---
date: 2026-09-12
topic: shared-dictionary-and-cefr
status: proposed-for-review
---

# Shared dictionary and CEFR

## What We Are Building

A durable, meaning-aware dictionary shared by web and mobile. Personal cards refer
to dictionary entries while retaining their identity, collection membership,
personal content changes, learning progress, and review history. CEFR assessments
belong to the shared meaning and are reused rather than recomputed per account.

This is a proposed design and execution plan, not an approved production migration.
No database writes, public content publication, paid enrichment, or releases are
authorized by this document.

## Approaches Considered

1. **CEFR sidecar only:** link shared classifications without moving linguistic
   content. Lowest initial risk, but does not remove duplicated content.
2. **Incremental dictionary references (recommended):** add durable entries and
   references, retain compatibility projections, migrate both clients, then retire
   redundant server content after the old-client support gate.
3. **Immediate normalization:** replace personal content rows and all contracts at
   once. Cleaner intermediate schema, but unnecessarily couples mobile upgrades,
   offline queues, web deployment, and irreversible data changes.

## Key Decisions Proposed

- Preserve `words.word_id` and the existing server-authoritative learning protocol.
  A card identity is not a dictionary identity. Do not move SRS ownership merely
  to implement shared content.
- A dictionary entry represents a meaning, not just lemma + part of speech +
  article. Ambiguous matches remain private/unlinked until resolved.
- Shared content has durable identity, revisions, provenance, and controlled
  publication. The existing replaceable analysis cache is not its authority.
- A reference pins a content revision initially. Personal changes take precedence;
  adopt new content explicitly. CEFR may refresh independently for the same stable
  meaning. Never change an active review question underneath the learner.
- Keep private originals and overrides owner-only. Do not publish user examples,
  names, media links, or historical inventories through a bulk deduplication job.
- Mobile keeps a local read model for offline learning. Local materialization is
  compatible with eliminating redundant canonical content on the server.
- A daily bounded CEFR worker is the proposed default, with retries, provenance,
  spending caps, and no overwriting reviewed classifications. It remains disabled
  until operational approval.

## Decisions Required Before Implementation

- Approve revision adoption, private-content fallback, and the supported old-client
  window. Clarify whether multiple meanings of the same lemma should be selectable
  in this release; the schema must support them regardless.
- Approve source licensing/publication policy, enrichment provider budget, and
  what happens when a previous private assessment cannot safely be shared.
- Establish which native versions are actually in users' hands. Historical release
  documents are not evidence of the currently installed production population.

## Next Step

Execute the audit and architecture gates in
[the implementation plan](../plans/shared-dictionary-cefr-2026-09-12.md), then obtain
the required decisions before implementing schema changes.
