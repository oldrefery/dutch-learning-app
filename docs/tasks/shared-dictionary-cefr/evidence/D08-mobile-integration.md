# D08 mobile synchronization and integration evidence

Date: 2026-09-21\
Branch: `feature/shared-dictionary-schema`\
Starting/current committed HEAD: `c5dfb14d49b9a53521b53e13bdd19991999ede5d`\
Persistence: local working tree only; not committed or pushed

## Scope and safety boundary

D08.1–D08.3 and the local D08.5 invariant were implemented under AUTH-14.
All shared-dictionary capabilities remain disabled by default. No hosted database,
real-user synchronization, device installation, deployment, paid call, production
activation, commit, push or PR was performed. Learning protocol 2 remains the
first SyncManager capability gate and the sole authority for review, reset and
correction queues.

D08.4 is only partially evidenced by synthetic restart and account-isolation
tests. Real iOS, Android, web and returning-old-client convergence remains an
explicit stage exit gate and must not be inferred from this document.

The GPT-6 Astra / High review is now complete. Its fixes, final results and exact
next QA scope are recorded in [D08 review](D08-review.md), which supersedes the
pre-review verification counts below.

## Implemented ordering and recovery contract

- `dictionaryContentMapping.ts` strictly maps a legacy `Word` into validated
  dictionary content instead of sending an unvalidated transport shape.
- Add, reanalysis and image edits use one local SQLite transaction for the legacy
  word, projected private fallback and durable content command. A failed command
  insertion rolls back the legacy mutation.
- New local content is immediately readable while offline. Projected versions
  advance from create version 1 through later private edits, while command
  preconditions retain the server version expected by each operation.
- Dictionary hydration authenticates the requested owner, fetches effective cards
  in bounded chunks, loads exact referenced revisions and CEFR dependencies, and
  validates them before persisting card state.
- Dependencies are cached before cards. Exact commands are acknowledged atomically
  with validated final card-state persistence. Remaining pending edits protect
  local content from incoming state. Multiple offline
  commands for one word are applied as a chain and hydrated once at the end, so
  an intermediate server response cannot overwrite a newer local fallback.
- Authentication and RLS failures, including PostgreSQL `42501`, remain hard
  failures; they are not reclassified as editable content conflicts.
- Initial pull hydrates newly received, locally missing or durably queued refresh
  cards. Refresh debt is recorded before advancing the legacy cursor. Incremental
  refresh uses `get_dictionary_content_changes_v1`; affected cards are hydrated
  before advancing the owner-scoped cursor. Missing dependencies or an incomplete
  response leave the cursor unchanged for an exact retry.
- Logout/account switch is protected by both authenticated-owner verification and
  owner-scoped local cards, commands and cursors. A file-backed restart test proves
  that one owner can resume its fallback/command/cursor while another owner cannot
  observe them.

## Read surfaces and CEFR states

`wordActions.fetchWords` bulk-loads local dictionary materializations and overlays
effective content onto legacy words while retaining word IDs, collections, SRS,
history and progress fields. The same materialized `Word` objects feed list,
detail and review surfaces.

`CefrBadge` uses theme tokens and exposes three distinguishable states:

- unknown: no effective CEFR assessment;
- estimated: machine/imported/unreviewed level;
- reviewed: reviewed level.

The badge is present in `WordItem`, universal word-card headers/details and both
sides of the review card. Snapshot changes are intentional.

## Verification

Pre-review local verification (historical snapshot; see review for final gates):

| Gate                                                                                 | Result                                                        |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| Full mobile Jest (`npx jest --watchman=false`, mobile workspace, repository Node 24) | 140/140 suites, 1,591/1,591 tests, 22/22 snapshots passed     |
| Repository lint (`npm run lint -- --quiet`)                                          | passed                                                        |
| Mobile typecheck (`npm run typecheck --workspace @woordenaar/mobile`)                | passed                                                        |
| Formatting (`npm run format:check`)                                                  | passed                                                        |
| Patch whitespace (`git diff --check`)                                                | passed before final evidence update; rerun at handoff closure |

Focused coverage includes dependency-before-card ordering, missing-dependency
retry, no false cursor acknowledgement, command-chain hydration, authentication
mismatch, RLS failure behavior, transactional add/reanalysis/image mutations,
rollback on command persistence failure, content materialization, CEFR rendering,
file-backed restart and cross-owner isolation.

## Invalid harness invocations

- A root-directory `npx jest` invocation selected the root configuration and
  scanned `.stryker-tmp`, producing duplicate mocks and TypeScript parse errors.
  This did not exercise the mobile test harness. Run Jest from `apps/mobile` with
  `--watchman=false`.
- Watchman socket access is unavailable in the sandbox; `--watchman=false` is the
  supported local invocation used by the passing run.
- The shell defaulted to Node 20 for one post-documentation lint preflight, where
  the resolver could not recognize `node:sqlite`. The repository Node 24 command
  (`PATH=/opt/homebrew/opt/node@24/bin:$PATH`) passed lint, typecheck, formatting
  and diff checks; use that runtime for D08 verification.
- Direct `node --test scripts/local-sync-tests/protocol.test.mjs` stopped in its
  preflight because `WOORDENAAR_LOCAL_QA_DIR=/private/tmp/woordenaar-sync-v2.*`
  and its disposable local stack were absent. It did not reach product assertions.
  Do not repeat the direct invocation; follow `docs/local-sync-qa.md` when a full
  disposable protocol-2 stack is explicitly in scope.

## Remaining D08 exit work

1. Local review/fixes are complete: explicit dormant client gate, transactional
   acknowledgement, hydration debt, conflict UI and old-client fallback capture
   are covered in [D08 review](D08-review.md).
2. Under separately confirmed disposable device/local-stack scope, execute D08.4 on iOS (primary),
   Android, web and a returning supported old mobile client: offline edit/review/
   reset/correction, termination/restart, retry, logout/account switch and
   two-device convergence.
3. Keep all release runtime flags off until the final cutover stage and explicit approval.
