# Protocol 2 Release — 2026-09-06

Status: hosted migration and custom-domain promotion completed; both native builds
and their internal-store submissions finished. Public store release is not performed.

## Authorization And Source

- Work stays on `codex/app-quality-session-sync-tests`; local commits only.
  No push, PR, merge or public store promotion was performed.
- The owner confirmed all protected-account devices were synchronized, had no
  pending changes and would remain unused on the old client during cutover.
- Existing legacy-client limitations are accepted for this coordinated release;
  no global minimum-version enforcement has been added.
- Release source: `4f0bec9dc47f5f42aa24752296138c6e2f4a5c95`, version **2.2.1 (82)**.
- The unrelated staged-only native plugin was rescued byte-for-byte to an ignored
  local recovery file and unstaged with explicit permission; it is not in the release.

## Preservation Evidence

A fresh private logical backup was taken after the synchronization confirmation:
roles, application/managed schema, data and migration history. It is kept under
ignored `builds/`, with restrictive permissions, and excluded from EAS/Vercel
uploads. An earlier backup is also retained. The project currently has no listed
hosted backups and PITR is disabled; recovery must not assume otherwise.

The fresh snapshot was restored into isolated PostgreSQL 17.4 without network or
published ports. All **40 tables / 12,460 rows** matched sorted COPY row-content
SHA-256 values. Applying the three pending migrations to this restored copy left
the original-column contents of all **nine public tables identical**.

The protected account baseline contains 12 collections, 2,288 word rows and 144
review events, including any stored tombstones. It was inspected only for data
preservation: no application login, review, reset or deletion used that account.
External media contents, device-only data and provider secrets are not covered by
the logical database backup; no such resources are changed by this rollout.

The post-migration hosted snapshot was compared against the fresh baseline.
All original fields of the protected account's rows in seven public tables match:
profile, collections, rate-limit rows, words, review events, access level and
legacy user progress. The Auth identity remains present. New protocol columns and
cutover-marker rows are intentional schema additions, not lost/replayed history.

## Release Artifacts

| Artifact           | Identifier                             | Status                                                   |
| ------------------ | -------------------------------------- | -------------------------------------------------------- |
| iOS build          | `51723375-1d24-4ead-91fc-4640e01b9795` | Finished                                                 |
| iOS submission     | `59d7e821-c6ee-448e-a9e9-6bf92f17d507` | Finished; App Store Connect, not public App Store        |
| Android build      | `490c0109-231d-4fbf-8cfc-c6da5fd2fcc7` | Finished                                                 |
| Android submission | `03a8e926-89f5-428f-adfa-97b9b9abd734` | Finished; Play internal draft                            |
| Production web     | `dpl_3imnK1oK1ZcHiiugA4YxDmsJYJDx`     | Ready; promoted to `woordenaar.app` after backend checks |

Expo identity and project ownership were verified as `oldrefery` before remote
commands. Both native build logs confirm Sentry source-map upload. The staged web
build also uploaded client/server source maps; some generated wrapper chunks
reported missing maps, so this is not a claim that every chunk was symbolicated.

The custom domain was verified to still reference the previous deployment
`dpl_1m2J5ivHadH6VN1xLNb723rojdm5` while backend cutover was pending.
After migration and hosted RPC checks, `vercel promote` completed successfully;
CLI inspection of `woordenaar.app` resolved to the new deployment. This confirms
routing/build state, not an authenticated production-browser smoke test.

## Gates And Remaining Checks

- Release commit hooks: 105 mobile suites / 1,245 tests / 18 snapshots;
  46 web suites / 319 tests. Clean-release metadata check passed.
- The rounding, authoritative-review and `analysis_notes` migrations were applied
  successfully in order. The final hosted dry run reports the database up to date.
- Dedicated test-account RPC smoke passed: Good/Easy coefficients and intervals,
  retry idempotency, stale snapshot protection, tomorrow scheduling after reset,
  retrying a reset after a new review, and preserved canonical history. A second
  run confirmed nullable recognition answer/timing arguments. Only fresh fixture
  collections/words were created and removed; existing application rows were not
  changed. This is API-level verification, not physical-device or browser QA.
- Supabase contracts were regenerated from the hosted schema. The forward
  protocol overlay was removed. A narrow nullable review-argument correction is
  kept outside generated code because function metadata omits that nullability.
  Web and mobile typechecks passed. These type-only/documentation follow-ups do
  not change the runtime source of the artifacts built from `4f0bec9`.
- Physical-device upgrade/network behavior, real-provider session expiry and
  multi-day soak remain unverified; build/submission success does not replace them.
- Do not resume the protected account on a legacy client. Do not clear app data or
  restore the backup blindly: accepted post-cutover commands require preservation.
