# Shared dictionary transition: integration and operational handoff

## Scope and status

This change integrates the shared dictionary reader, recovery, writer-retirement
and SQLite contention work completed in November 2026. It also includes the
Russian-script validation fix and the corresponding regression tests.

The accepted primary-account transition is complete. The historical usage total
cannot be reconstructed; its accounting checkpoint was closed by an explicit
owner-accepted exception, not by a successful measurement. Other accounts,
protected legacy exceptions, automatic CEFR enrichment and broader distribution
remain outside this acceptance.

Source integration is separate from release publication. The two additive SQL
migrations and the web/mobile changes have prior deployment evidence. Do not
blindly replay migrations, publish another OTA, or enable dormant features when
merging this work. Reconcile the target migration ledger before any future
database deployment.

## Implementation map

| Area                                  | Entry points and behavior                                                                                                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Personal metadata and shared analysis | `20261112170000_add_dictionary_personal_metadata_reads.sql`; mobile `dictionaryPersonalMetadataSync.ts`, `dictionaryFollowingSync.ts`; web `owned-display-repository.ts`. |
| Offline storage and recovery          | Mobile `dictionaryFollowingRepository.ts`, `dictionaryPersonalMetadata.ts`, both `dictionaryManagedRecovery.ts` modules and `dictionaryPersonalStateSchema.ts`.           |
| Learning delivery                     | Mobile `syncManager.ts`, `reviewEventRepository.ts` and `reviewCorrectionSync.ts`; content availability must not prevent early learning upload.                           |
| Sparse following writers              | `20261113190000_retire_following_compatibility_writes.sql`; private/legacy writes remain supported.                                                                       |
| Russian text                          | Edge shared `russianText.ts`, analysis prompts and cache acceptance; transliteration is not accepted as a Russian translation.                                            |

The source retains feature gates and fallback readers. A missing revision must
not silently erase cached analysis or acknowledge an unsent learning event.
Both learning and content queues, cursors, personal metadata and history must
survive failed refreshes and restart.

## Deployment references and source differences

- Android 91 final contention update group:
  `a02dfa1b-cce3-4368-8de5-a62bc829e5da`; update
  `01a1d698-a35e-727a-9540-a2415ae3b24c`.
- iOS 91 final contention update group:
  `0e45b355-2cb7-4e3f-b63d-5e383cae98c8`; update
  `01a1d6a1-daa4-7c78-bddd-88633d5b3c52`.
- Prior web reader release: `dpl_4qXAmb5YKod1gVQK3QtvXDuBHmic`.

These references identify previously published artifacts; this document does not
claim a fresh production or device check. Final Android adoption, ordinary sync
and offline restart were verified on Huawei. Final iOS publication and asset
integrity were verified; adoption of that newest update on iPhone was excluded.
Earlier iPhone/web acceptance is retained as dated evidence.

The integrated source is not byte-identical to the frozen OTA export: it removes
eight unused mobile service helpers and adds tests. Release exports also carried
native build 91 metadata and generated native projects. The tracked base app
configuration still declares build 86. Do not use this integration as authority
for a new native build or infer OTA compatibility from that number; qualify
version, runtime fingerprints, environment flags and bundle hashes separately.

The managed-recovery client consumes `get_dictionary_managed_recoveries_v1`.
Its owner-bound receipt implementation and before-images belong to the private
operator deployment, not the general migration set. A missing RPC is not proof
of a completed restore. Preserve that capability and the protected recovery
material; do not copy private operator data into Git or install it on a new
environment without a separately reviewed scope.

## Recovery and rollback constraints

1. Preserve canonical published analysis, personal identity, learning state,
   history, queue state and the private operation receipts/before-images.
2. Do not globally return sparse following cards to raw `words` readers. Restore
   the affected copies with a guarded selective operation first, preserving any
   learning since the snapshot, then verify recovery-capable clients consumed it.
3. `scripts/shared-dictionary/d143-writer-rollback.sql` restores writer functions
   only. It does not restore retired card copies or authorize a reader rollback.
4. Local storage rehearsal SQL is synthetic test tooling, not a production
   migration. A future live rollback needs fresh preconditions and explicit scope.
5. Do not delete recovery reports, namespaces or receipts as ordinary Git cleanup.

Current feature enablement is not changed here. Automatic CEFR and following
imports remain disabled in the accepted operational scope. The protected legacy
exceptions remain intentionally unchanged.

## Verification boundaries and maintenance

Regression coverage includes ordinary synchronization, both queues, cursor/cache
reuse, unavailable revisions, rollback recovery, SQLite restart/contention,
server authorization and preservation of learning history. The local integration
report records exact commands, candidate hashes, results and remaining CI gates.
Do not treat a prior green release test as a green CI run for a new commit.

The remaining iOS watchdog reports correlate with controlled force relaunches;
their exact OS termination cause is unproven. Keep reporting enabled. Inspect
routine state without force-stopping the app. When a cold restart is a deliberate
test, record its start/end and compare receipt times and OS diagnostics before
attributing a later watchdog event to a release regression.

Not established by this handoff: exhaustive Huawei local-history export, a live
production rollback, fleet-wide or long-duration health, the unavailable old
physical installation with a pending queue, exact remaining Disk IO credits,
or other-account acceptance. These limits do not reopen accepted exclusions.

## Integration procedure

Use a separate feature branch from the verified main revision, apply the exact
reviewed source and documentation patches, and run the repository checks. Keep
the original dirty checkout and private evidence intact. Do not stage the root
task archive, screenshots, environment files, generated native projects, bundles,
or credentials with the application source.

Commit, remote push/PR publication, merge and deployment are separate operations.
A PR can run CI and a preview deployment; a merge can trigger a production web
deployment. Verify the current integration settings before approving either.
This handoff does not authorize those actions or reuse any prior one-off grant.
