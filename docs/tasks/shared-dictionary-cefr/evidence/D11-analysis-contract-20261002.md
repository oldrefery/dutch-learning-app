# D11.1 — optional analysis CEFR contract and cache

## Scope and result

2026-10-02, starting `44de0f5`, existing `feature/shared-dictionary-schema`,
user-confirmed GPT-6.1 Sol / High, AUTH-20 and retained AUTH-18 local commit scope.
D11.1 implementation and local verification pass. D11 remains in progress;
D11.2–D11.7 and the separate live quality/cost approval gate remain open.
No independent review is claimed by this implementation session.

The existing analysis path accepts an optional model-only estimate with validated
level, confidence, source, status, method/provider version, input version and
SHA-256. `CEFR_ANALYSIS_ENABLED` is default OFF. With it off, the existing prompt,
response shape and cache mutation omit CEFR. With it on, invalid/missing optional
provider output produces null without invalidating the linguistic analysis.
Explicit unknown is `{level:null, confidence:null, status:"unknown"}`.

Provider source/review/hash claims are ignored. The Edge server stamps `model`,
`estimated`/`unknown`, method/version and the hash of canonicalized linguistic
content. Shared domain code contains pure parsing/canonicalization only; Web
Crypto hashing runs in the server module. Input includes lemma, POS/article,
translations, examples and material grammatical fields; it excludes typed spelling,
media, cache counters and provider provenance claims. The cache read recomputes
the digest and discards stale estimates after material content changes.

`word-analysis-cefr-v1` identifies an analysis candidate, deliberately separate
from the dictionary meaning input namespace. The legacy cache aggregates by
lemma/POS/article and is not a meaning assessment or publishing authority.
These candidates are not calibrated. Keep the feature OFF while D11.2 and the
worker contract are reviewed and tested. Existing corrected-lemma/cache-key
behavior is preserved; if those differ, a later cache read discards the estimate
conservatively instead of relinking or publishing it.

## Persistence and compatibility

- New local target migration `20261002130000_add_analysis_cefr_estimate.sql`
  adds nullable validated JSONB to `word_analysis_cache`, with no default/backfill.
  Legacy rows, cache version 2, TTL and usage fields remain unchanged.
- SQL accepts only valid model `estimated`/`unknown` envelopes. Existing RLS and
  client privileges remain unchanged; ordinary clients cannot write estimates.
  No dictionary assessment/head, personal word, SRS or queue schema is modified.
- Fresh insert and duplicate refresh persist enabled estimates, including explicit
  null to clear malformed provider output. Disabled refresh omits the field;
  stale retained metadata is rejected on the next enabled read by the content hash.
- Duplicate refresh for article-free words now uses `.is('article', null)` instead
  of `.eq('article', null)`. The regression test inspects actual SDK PostgREST
  `article=is.null`; non-null articles retain `.eq()` semantics.
- Web parses/round-trips validated optional metadata and preserves legacy shape.
  Personal word persistence does not promote form CEFR into shared assessments.
  Mobile changes are optional TypeScript contract fields only, with no runtime
  UI, native storage or sync change.
- Official target types regenerated and `--check` passes. Only the new nullable
  column in Row/Insert/Update and the generator header changed.

## Local verification

All commands run from the repository root. Node 24.20.0 is selected through PATH;
Deno 2.7.9 uses the existing frozen root lock. Commands and private logs are under
`reports/shared-dictionary-cefr/d11-analysis-contract-20261002/`.

| Gate                                                       | Command                                                                                                                                                                                                                                           | Result                  |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Edge helpers, actual handler, existing utilities           | `/Users/devrush/.deno/bin/deno test --config supabase/functions/deno.json --allow-env supabase/functions/gemini-handler/cefr_test.ts supabase/functions/gemini-handler/cefrHandler_test.ts supabase/functions/gemini-handler/geminiUtils_test.ts` | 45 tests PASS           |
| New cache migration and existing shared schema protections | `WOORDENAAR_PG_BIN=/opt/homebrew/opt/postgresql@15/bin node --test --test-concurrency=1 scripts/postgres-tests/analysis-cefr-cache.test.mjs scripts/postgres-tests/shared-dictionary-schema.test.mjs`                                             | 24 tests PASS           |
| Web contract and personal persistence                      | `npm run web:test -- --runInBand --runTestsByPath src/features/analysis/analysis-contract.test.ts src/features/analysis/word-persistence.test.ts`                                                                                                 | 2 suites /13 tests PASS |
| Domain types                                               | `./node_modules/.bin/tsc --project packages/domain/tsconfig.json --noEmit`                                                                                                                                                                        | PASS                    |
| Web test-inclusive types                                   | `./node_modules/.bin/tsc --project apps/web/tsconfig.json --noEmit`                                                                                                                                                                               | PASS                    |
| Mobile test-inclusive types                                | `npm run mobile:typecheck:test`                                                                                                                                                                                                                   | PASS                    |
| Edge types and locked dependencies                         | `/Users/devrush/.deno/bin/deno check --config supabase/functions/gemini-handler/deno.json supabase/functions/gemini-handler/index.ts`                                                                                                             | PASS                    |
| Target type generation                                     | `node scripts/generate-supabase-target-types.mjs` and the same command with `--check`                                                                                                                                                             | PASS                    |
| Strict scoped lint                                         | web ESLint config for domain/web; root config for mobile/SQL script; `deno lint` for three new Edge files                                                                                                                                         | PASS                    |

The eight new Edge tests cover forged review/source claims, malformed values,
unknown, stale content, legacy payload/cache handling, default-off omission,
enabled fresh persistence/null clearing, cache hits without provider/quota calls,
and duplicate updates with SQL NULL semantics. Handler tests intercept every HTTP
request in memory, use synthetic credentials and do not grant `--allow-net`.
No real listener/provider is used. Four new PostgreSQL tests verify old-row
preservation, metadata round-trip without dictionary publication, invalid envelope
rejection and existing client write denial. Twenty existing schema tests include
reviewed/locked/provenance protections.

Disposable PostgreSQL clusters use private Unix sockets and clean up in finally.
The existing type generator uses its own isolated disposable containers and
cleans them up; retained task backend/data is never started or migrated.

Transient setup issues resolved: the canonical JSON helper needed an export;
status needed explicit narrowing; fake SDK initialization needed one event-loop
turn before leak tracking; domain lint needed the web config instead of ignored
root paths; Deno 2 lint needed a mapped assert import. Per-function checking
initially generated a duplicate lock; it was moved to private reports and the
function now reuses the existing root frozen lock. No dependency was upgraded.
The preexisting unsupported `compilerOptions.allowJs` Deno warning remains.

Current API/configuration verified through Context7: Supabase JSONB mutations and
SQL NULL filters; Deno custom frozen lock path. References:
[Supabase NULL filter](https://supabase.com/docs/reference/javascript/is),
[Deno lock configuration](https://github.com/denoland/docs/blob/main/runtime/reference/deno_json.md).

## Preservation, review boundary and next action

All 140 unaffected hashes from the 143-path D10 manifest match. Three manifest
paths intentionally change (domain exports and target schema/types); 15 additional
D11 source/test/config paths enter the new 158-path
[source inventory](D11-source-sha256.json). The D10 inventory stays historical.
Formatting, diff checks and post-hook source reconciliation are recorded with the
local commit receipt. Preexisting `.playwright-cli/` and ignored reports stay out
of commits.

Assigned resources OFF verified **19:47:41 UTC /21:47:41 Amsterdam**: exact iOS
UUID Shutdown, Android `emulator-5584` absent, four exact retained task containers
exited, ports 55331/55400 closed, no task type-generator container running.
Devices/backend were never started this session. No retained native/server data
write, runtime QA, import replay, hosted migration, scheduler activation, paid
provider call, production/cutover, publication/deployment or push/PR/merge.

Next: user-selected **GPT-6 Astra / High** review of D11.1's optional envelope,
content binding and provenance boundary before D11.2 calibration/worker design.
Confirm how reviewed meaning fixtures and worker requests bind exact published
meaning inputs; do not reuse aggregate analysis candidates as authoritative
dictionary assessments. Continue local fake-provider work only. Current-thread
model picker is unavailable; request a manual switch without claiming one.

## Local commit receipt

Source/evidence commit `a756680` completed with ordinary hooks: lint-staged,
constants/complexity/length checks, mobile 156 suites /1796 tests /22 snapshots,
web 86 suites /780 tests, one preexisting skipped suite/test. All required hooks
PASS; no bypass. All 158 source hashes match after hooks. Only preexisting
`.playwright-cli/` remains untracked. Private `commit.log` retained; no push.
The next documentation-only commit records this receipt and the model handoff.
