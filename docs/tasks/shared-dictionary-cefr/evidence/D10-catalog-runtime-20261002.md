# D10 scoped official/shared runtime acceptance

Starting HEAD `6ca149f`, retained native baseline `c3f9baf`, current web application
`19d98eb`. Astra / High, AUTH-17/18/19. Application unchanged; 137 existing source
fingerprints match. [Sanitized summary](D10-catalog-runtime-summary-20261002.json).
D10.3–D10.5 remain open because of [R3](D10-session-revocation-review-20261002.md)
and the remaining runtime checks below.

## Fresh local synthetic fixture

Only the retained task database was started; a full pre-write dump and eight-table
snapshot were saved before changes. One transaction created a new synthetic pack
`d10-synthetic-navigation-20261002` v1.0.0, three exact approved provenance mappings
(kompas/fiets/zeil), a new `D10 Synthetic Shared` source, linked zeil with a synthetic
private analysis-note override, private getij with owner SRS 34 days/9 repetitions,
and an unshared hidden control. A later new private duin source (21 days/5 repetitions)
exercises the real web shared action. No existing collection/content was published,
no hosted call made, no runtime flag/schema changed, and no data reset/reseed used.
The synthetic local catalog setup is not editorial approval for distribution.

Private seed/receipts are guarded against replay and retained in
`reports/shared-dictionary-cefr/d10-catalog-20261002/`. The manifest digest is
`4af2c12dc42ad4de116e0f885201579b5701e73de6f5e7e558bb93196812b7b9`.
The immutable fixture remains in the task volume. Source sharing is now revoked.

## Passed runtime checks

1. Real iOS official preview loads/verifies v1.0.0, shows kompas/zeil available and
   existing fiets as a duplicate (2/3). Corrected combined accessibility selector
   passes; the initial exact-text selector failure was a QA issue.
2. Real web official UI imports only selected kompas into existing D08 Native QA.
   New personal ID is distinct from the canonical entry and pins the exact mapped
   revision. Existing private fiets is unchanged, including its existing content/SRS.
3. Android supported `dutchlearning://share/<token>` entrypoint previews only zeil
   and getij, then imports both into the same existing primary collection. Linked
   zeil preserves the exact revision and effective private note; private getij is
   an independent private copy. Recipient SRS starts at defaults, not owner progress.
4. Authenticated real HTTP preview excludes SRS, hidden text and private revision
   references. Selecting the outside hidden row is rejected with
   `invalid-shared-word-ids`; direct recipient REST access to that owner row is empty.
   Official mapping response has all three exact references and the manifest hash.
5. Desktop web sees Android's two copies as duplicates (0/2). After one fresh duin
   source is added, web previews 1 selected / 2 duplicates and imports only duin.
6. Revoking only the new source makes real RPC preview null and import fail with
   `shared-collection-unavailable`. With a fresh valid web session, the finished
   page says `Link unavailable` / `This collection is no longer shared`.
7. Recipient collection remains accessible after revocation. Actual web Prepare
   JSON export produces 10 schema-v1 content-only entries, including kompas,
   zeil/private note, getij and duin. No source owner IDs, revision dependency or
   SRS is exported. The hidden control is absent. This adds mapped/shared export
   coverage to the earlier completed generic cross-owner reimport acceptance.
8. All four new primary IDs reach both native clients unchanged. Primary is
   restored on both, ordinary sync shows Up to date, and final snapshots have
   zero import intents/content commands/recovery/refresh/hydration debt.

All 19 old server words, 16 old content states, eight old collections, four access
rows and review tables remain exactly equal. Final server counts: 27 words,
21 content states, nine collections (four source fixture words plus four recipient
imports account for the eight new words). All 15 prior iOS and nine Android local
word rows remain exactly equal; final counts are 19 and 13. Learning projections
are unchanged. Existing review tables are empty, so no new nonempty-history claim.
All IDs and comparisons are in the sanitized summary and private snapshots.

## Limitations and failed attempts

- Android cold start displayed a System UI wait dialog; Wait resolved it. The first
  direct `/import/` deep link did not invoke the supported handler; `/share/` passed.
  Both failed attempts stopped before import. Do not replay successful imports.
- Native primary logout revoked the already-open desktop session and exposed R3.
  This is a genuine application finding, reproduced separately from sharing denial.
- Actual mobile Safari logged in using native clipboard paste and loaded the
  official route. Input automation, password-save overlay and retained login zoom
  prevented a complete duplicate-control acceptance flow. Failed attempts and
  screenshots are preserved privately; do not call full mobile Safari QA passed.
  No synthetic password was saved; simulator clipboard was cleared afterward.
- Android official duplicate preview (0/3) passed while preparing a cached,
  read_only isolated-owner check. Account switch then hit a Maestro gRPC timeout
  while entering email, before isolated login/import. No offline transport block
  was enabled and no official offline import occurred. That runtime check remains.
- Isolated access was temporarily read_only, then restored to the exact original
  row. Partial Android input was cleared; primary login and settled sync passed.
  iOS primary login was also restored after global sign-out, then sync passed.
- Root ESLint ignored the web file; correct web-workspace ESLint passed. The first
  private seed guard expected proxy instead of API port; it failed before mutation,
  was corrected to the verified 55321 API port, and the transaction then succeeded.

## Stop state and continuation

OFF verified **2026-10-02 15:15:36 UTC / 17:15:36 Europe/Amsterdam**: assigned iOS
`DDEDCE4E-153B-48A4-A47C-B4ED0F499F1F` Shutdown, task Android absent, all four exact
containers exited, task browser closed, runner PIDs 30260/30275/30276/30277 absent,
ports 55331/55400 closed. Apps/volumes/private reports retained. Other sessions and
devices untouched. No pending mutation, test on devices, build or uncertain import.

Next: Sol 6.1 / High R3 repair, Astra re-review, then only cached official
read_only/offline runtime and full mobile-browser acceptance. Do not repeat closed
imports, upgrades, recovery or cross-client document transfer; do not start D11.
A future new read_only official import can use isolated owner's kompas (still absent)
into their existing collection; warm/cache under the correct owner before blocking
only task transport. Restore access and primary sessions afterward. The source share
is revoked; existing copies/export need no source access and must remain unchanged.
