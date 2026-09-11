# Official Content Production Release Runbook

Status: locally prepared; no production catalog writes or client deployments have
been performed. External steps require explicit authorization.

## Release identity

- Supabase project: `Dutch Learning App` (`josxavjbcjbcjgulwcyy`).
- Migration: `20260911120000_add_official_content_catalog.sql`.
- Approved private release directory:
  `reports/vocabulary-organization/official-content-release-v4-002-2026-09-11`.
- Release aggregate SHA-256:
  `5e02d4e1e02c1d56222ced6dca23f720a479e991f16c0af13bc124de707ac90b`.
- Review ledger SHA-256:
  `4ef254df1d3459a07cde3b602f6fc75011fd02ea264f7bbe348200245c6b5e08`.
- Content: 21 packs, 2053 entries, versions `1.0.0`.
- Counts: A1 122; A2 5 × 100; B1 4 × 99, 4 × 98, 1 × 97;
  B2 2 × 100, 2 × 101, 1 × 98; C1 46.
- The six explicitly excluded terms are absent from every public manifest field.
- The release has 2053 unique import keys. Eight keys overlap the bundled Dutch A1
  Essentials fallback and are intentionally skipped without changing existing cards.

The release artifacts and detailed review ledger are private ignored files. Do not
commit them or rebuild the approved directory during rollout.

## Code included in the release

The catalog implementation begins at `bbf345f`, shared validation at `d375982`, web
and mobile loading at `3841fbb` and `138898e`, release tooling at `ee06c37`, client
correctness at `16eac17`, `010e5d5`, and `5ea1072`, the approved content record at
`223bdf7`, and cross-platform import verification at `0e8c635`.

The release commit must also contain the service-role-only first-release withdrawal
RPC, anonymous remote verifier, and this runbook. Record the final merged commit in
the release log before applying the migration.

## Local evidence

- Publisher dry-run: 21 packs / 2053 entries / zero writes, exact aggregate hash
  above.
- `supabase migration list --linked`: the local `20260911120000` migration has no
  remote counterpart.
- `supabase db push --linked --dry-run`: exactly
  `20260911120000_add_official_content_catalog.sql` would be applied.
- A later repeat of the same dry-run stopped before connecting because the local CLI
  no longer had a Supabase access token. Restore the intended CLI session and repeat
  both read-only checks before applying anything; do not relink the project.
- Isolated PostgreSQL catalog suite: 15/15, including public-read boundaries,
  immutable versions, version rollback, and first-release withdrawal.
- Official-content tooling: 38/38, including exact anonymous remote verification.
- Cross-platform evidence and full gate results are recorded in
  `docs/plans/official-content-completion-handoff-2026-09-11.md`.
- The local EAS identity guard did not report the required `oldrefery` identity on
  2026-09-11. No build, update, project mutation, or further EAS query was run. OTA
  runtime comparison remains blocked until the user explicitly restores the required
  identity; never switch accounts automatically.

## Required order

Run every command from the repository root with the Node version in `.nvmrc`.
Stop if the worktree or approved release hash differs from this runbook.

1. Record the merged release commit and keep the previous Vercel deployment URL.
2. Confirm the linked Supabase project read-only, then apply only the named pending
   migration:

   ```bash
   supabase migration list --linked
   supabase db push --linked --dry-run
   supabase db push --linked
   ```

3. Regenerate Supabase database types using the repository procedure. Remove only
   the now-redundant official-content table/RPC overlay; preserve the nullable review
   RPC correction. Run typechecks before proceeding.
4. Load the production service-role secret without printing or committing it, then
   publish the exact approved release. The command is idempotent per immutable pack,
   so rerunning the same release safely resumes a partial publication:

   ```bash
   export SUPABASE_URL="https://josxavjbcjbcjgulwcyy.supabase.co"
   export SUPABASE_SERVICE_ROLE_KEY="<load from an approved secret source>"
   npm run official-content:publish -- \
     --release reports/vocabulary-organization/official-content-release-v4-002-2026-09-11 \
     --apply --project-ref josxavjbcjbcjgulwcyy
   ```

5. Verify all 21 catalog rows and manifests through the anonymous API. The verifier
   compares IDs, versions, metadata, entry counts, complete manifests, and content
   hashes with the approved local release:

   ```bash
   export SUPABASE_ANON_KEY="$EXPO_PUBLIC_SUPABASE_ANON_KEY"
   npm run official-content:verify -- \
     --release reports/vocabulary-organization/official-content-release-v4-002-2026-09-11 \
     --project-ref josxavjbcjbcjgulwcyy
   ```

6. Deploy the merged `main` commit to Vercel and verify the production alias before
   promoting or removing the previous deployment. The Vercel project root is
   `apps/web`; production branch is `main`.
7. Determine mobile compatibility from the actual EAS runtime fingerprint. The
   content work changes JavaScript only, but that observation is not a substitute
   for comparing the installed production build runtime with the update runtime.
   With `runtimeVersion.policy: fingerprint`, an OTA is delivered only to matching
   native runtimes. Use the guarded production OTA command only after compatibility
   and identity checks; otherwise create new native binaries:

   ```bash
   npm run update:production -- --message "Add downloadable official vocabulary packs"
   ```

8. On released web and mobile clients, use a disposable test account to import a
   small pack and the 122-entry A1 pack. Verify new/existing collections, duplicate
   skips, preserved SRS, offline cached reopening on mobile, and cross-device sync.
   Never use the personal application account `oldrefery` for testing.
9. Check production Sentry after release. Store submissions and public store rollout
   remain separate approvals and are not required for a compatible OTA.

## Resume and rollback

Publication is atomic per pack, not across all 21 packs. If it stops, keep the exact
approved directory, run the anonymous verifier to identify the mismatch, inspect the
immutable rows, and rerun the same publisher command. Never edit an already published
`1.0.0` manifest.

For a later version rollback, atomically restore the previously published version and
its version-specific metadata:

```sql
SELECT public.promote_official_content_pack_version(
  'dutch-a1-01',
  '<previous-version>',
  NOW()
);
```

The first release has no previous version. To withdraw one affected current pack,
use the tested service-role-only operation:

```sql
SELECT public.withdraw_official_content_pack('dutch-a1-01');
```

To withdraw every currently published pack from this release in one transaction,
run the following as a trusted database operator:

```sql
BEGIN;

SELECT public.withdraw_official_content_pack(release.pack_id)
FROM unnest(ARRAY[
  'dutch-a1-01',
  'dutch-a2-01', 'dutch-a2-02', 'dutch-a2-03', 'dutch-a2-04', 'dutch-a2-05',
  'dutch-b1-01', 'dutch-b1-02', 'dutch-b1-03', 'dutch-b1-04', 'dutch-b1-05',
  'dutch-b1-06', 'dutch-b1-07', 'dutch-b1-08', 'dutch-b1-09',
  'dutch-b2-01', 'dutch-b2-02', 'dutch-b2-03', 'dutch-b2-04', 'dutch-b2-05',
  'dutch-c1-01'
]::text[]) AS release(pack_id)
JOIN public.official_content_packs AS packs
  ON packs.pack_id = release.pack_id
WHERE packs.current_version = '1.0.0';

COMMIT;
```

Withdrawal hides catalog and version rows from anonymous/authenticated reads and
retires the immutable current version. It does not delete manifests, cached packs,
or user-owned imported cards. A corrected release must use a new semantic version.
Client rollback is independent: restore the previous Vercel deployment for web, and
use EAS Update rollback/republish only when its runtime and source-map evidence are
known. Do not destructively roll back the shared database migration after clients can
depend on it; use a reviewed forward migration for schema defects.

## Known limitations

- Web remains online-first; it does not persist official manifests for offline import.
- Mobile offline import requires a previously verified cached pack. Essentials remains
  the bundled no-network fallback.
- Catalog updates never modify existing imported copies or their SRS/history.
- First-release withdrawal cannot erase already cached content or imported cards.
- Native device and authenticated production smoke evidence can exist only after the
  central catalog and released clients are available.
- Personal collection reorganization is a separate operation and is not part of this
  public catalog release.
