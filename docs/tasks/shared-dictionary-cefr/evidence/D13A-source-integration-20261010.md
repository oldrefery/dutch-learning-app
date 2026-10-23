# D13A.2 — Deployed repair source integration

Completed October 10, 2026 (Europe/Amsterdam). GPT-6.1 Sol / High confirmed by the
owner. Local source preparation only; no new commit, remote refresh, PR, merge,
provider call, build, deployment or publication.

## Reconciled source

The committed root `f97a733407a4d2b37e8f9ca030ad9574de85a794` and merged main
`44141e00bddfe00267314374bc33a7a0cf8fb4a2` have identical Git trees. Original build85
`0a3bae137d3e58c406215114cbccadd773f71098` differs by exactly three files:
`apps/mobile/app.config.js`, `apps/mobile/eas.json` and
`apps/mobile/src/__tests__/appConfigOta.test.ts`. Their exact build85 bytes are now
present in the root working tree alongside the ten unchanged AUTH-29 repair files.

The resulting 13-file integration matches every one of the 1210 non-document files
in the sealed AUTH-29 source manifest. Documentation intentionally retains later
DEC-10/D13A decisions. No dependency, migration, backend, web or native-source delta
was introduced. The release profile is opt-in; ordinary production defaults remain
as recorded in main. A later build from this source still needs explicit profile,
environment, runtime and release verification.

- AUTH-28: seven repair files for legacy private-content reads.
- AUTH-29: adds status-read retry and its two tests; exactly three additional files.
- Build85: three configuration/test files missing from main, now integrated exactly.

The parser tolerates historical omissions only at private read boundaries. Canonical
commands/revisions and linked effective responses remain strict. Status retries
repeat reads only, at most three retries, and surface persistent/non-lock failures.
No new automatic shared-update behavior is implemented by this package.

## Portable patch and integrity evidence

[Machine-readable evidence](D13A-source-integration-20261010.json) includes all 13
file hashes and [the source patch](D13A-source-integration-20261010.patch) hash.
Applying that patch to a temporary archive of exact main reproduced all 1210
non-document manifest files. Reverse application restored every changed base file
and removed the single added test. This is a source-patch reversibility check, not
an operational rollback recommendation: reverting a delivered fix restores defects.

Both original sealed archives match their delivery hashes. All 1622 AUTH-28 and
1623 AUTH-29 archived source files match their respective source manifests and
original candidate directories. All 61 exported files per OTA match their sealed
export manifests. No artifact was regenerated or changed.

## Validation

Executed in the root working tree at `f97a733` plus the exact 13-file patch, using
Node 24.20.0 / npm 11.19.0 from the existing nvm installation. System-default Node20
was detected before testing and not used. No runtime or package installation.

| Command                                                                      | Result                                                                   |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `CI=true npm run test:ci`                                                    | PASS: 157 mobile suites, 1808 tests, 22 snapshots; coverage gates passed |
| `CI=true npm run web:test`                                                   | PASS: 86 suites, 780 tests; 1 existing skipped suite/test                |
| `npm run typecheck`                                                          | PASS                                                                     |
| `npm run typecheck:test`                                                     | PASS                                                                     |
| `npm run typecheck --workspace @woordenaar/domain`                           | PASS                                                                     |
| `npm run lint:ci`                                                            | PASS                                                                     |
| `node node_modules/prettier/bin/prettier.cjs --check <13 integration files>` | PASS                                                                     |
| `git diff --check`                                                           | PASS                                                                     |

The two extra mobile tests versus the root's earlier 1806-test result are the
build85 OTA/profile checks now restored with its configuration. The real
SQLite two-connection contention test is included. Raw local logs remain under
`reports/shared-dictionary-cefr/d13a2-integration-20261010/`; portable evidence
records their hashes and aggregate outcomes. Full source formatting passed without
changing sealed repair bytes. Document formatting is recorded separately.

One helper attempt stopped before patch application because system Python does not
support `TarFile.extractall(filter=...)`. The helper then validated archive members
(no absolute/traversal/link members), extracted the locally generated Git archive,
and completed forward/reverse verification. No source/test failure occurred.

No new device acceptance, runtime fingerprints, hosted CI, remote-main freshness,
production health or D13A feature acceptance is claimed. D13 observation remains
open; D14 is pending; CEFR remains OFF.

## Prepared commit and PR scope

Suggested commit/PR title: `fix: reconcile shipped dictionary compatibility repairs`.

Prepared PR description:

> Legacy private cards could fail synchronization when older content omitted nullable
> fields, and transient SQLite locks could fail the sync-status read. Integrate the
> exact shipped AUTH-28/29 repairs, preserving strict canonical validation and bounded
> read-only retry behavior. Include the existing build85 release profile and QA guard
> so source configuration matches the delivered baseline.
>
> Validation: 157 mobile suites / 1808 tests / 22 snapshots, 86 web suites / 780 tests,
> mobile and domain typechecks, lint and source formatting pass. The 13-file patch
> applies cleanly to recorded main, reproduces the sealed source outside docs, and
> reverses cleanly. No backend migration or new shared-update behavior.

Source staging must use the 13 explicit paths in the JSON manifest, including the
currently untracked `syncStatusService.sqlite.test.ts`. Preserve and separately
review the task documentation bundle; never broadly stage private `reports/`,
`.playwright-cli/`, credentials or unrelated changes. Do not cherry-pick only build85
and assume it contains the repairs: those repairs are still uncommitted locally.

A future authorized integration must refresh actual main, preserve this dirty task
bundle, reconcile intervening changes and run the checks required for its final
head. Source push/PR/merge requires its own scope, including automatic Vercel preview
and main production deployment. Prior AUTH-25/27/28/29 are consumed. No integration
command in this packet has been executed against GitHub.

## Next checkpoint

D13A.2 complete. Resume **D13A.3 — GPT-6.1 Sol / High** for additive domain/backend
contracts and tests, keeping new live behavior dormant. Use the root's reconciled
source and D13A technical contract/fixtures. No wait for D13 observation is needed
for local development; no remote integration is required to start that checkpoint.
