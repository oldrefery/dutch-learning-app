# D04 shared contracts evidence

Date: 2026-09-21. Model: GPT-5.6 Terra / High. Branch:
`feature/shared-dictionary-schema`; base HEAD: `c5dfb14d49b9`.

## Scope and result

User authorization: explicit instruction, “Разрешаю локальный D04, продолжай”.
This was consumed only for local D04 contracts, tests and documentation. No hosted
schema/data operation, deployment, source publication, paid provider call,
schedule, activation, commit, push or pull request occurred.

`packages/domain/src/shared-dictionary.ts` is now the single, dependency-free
contract used by mobile, web and Edge/Deno tests. It is not yet imported by a
production request path, so existing mobile/web/sync behavior is unchanged.

- Strict parsers reject unknown keys, private fields, unsupported versions, invalid
  UUID/digests, invalid reference pairs, malformed revision/assessment metadata
  and invalid field-level override values. The manual style matches the existing
  content manifest validator and avoids adding a runtime dependency.
- The contract models dictionary entry/revision/reference, private overrides,
  CEFR assessments, capabilities and version-1 command envelopes. No user ID,
  SRS field or capability flag grants mutation authority.
- `resolveEffectiveDictionaryContent` has one precedence order: explicit valid
  override, matching pinned published/retired revision, then private fallback.
  `removed_fields` keeps explicit removal distinct from a missing override and
  from a missing content source.
- `resolveInheritedCefr` returns `unknown`/`null`, never a fabricated B1, when
  the card is unlinked, the revision/input does not match, or a private linguistic
  override applies. Media-only overrides retain a matching inherited assessment.
- `canonicalizeCefrInput` is versioned and omits image/TTS values. It is a
  canonical input representation, not a hash or worker; D05/D11 own command
  validation/hash persistence and enrichment execution respectively.
- `packages/domain/src/index.ts` exports the module. Target/deployed Supabase
  generated contracts remain distinct and no generated file was edited by D04.

The strict-schema choice was checked against current Zod 4 documentation through
Context7. `z.strictObject()`/`safeParse` support the same validation shape, but
the repository already uses manual strict validators in `packages/content`; a
new cross-runtime runtime package was unnecessary. Deno supports local TypeScript
imports, confirmed by the Edge contract test.

## Cross-runtime fixtures

- Mobile: `apps/mobile/src/utils/__tests__/sharedDictionaryContract.test.ts`
  proves strict parsing, explicit set/remove overlay behavior, exact CEFR
  inheritance, no media contribution to CEFR input, and protocol version guards.
- Web: `apps/web/src/features/analysis/shared-dictionary-contract.test.ts`
  imports the same resolver and verifies no web-specific interpretation.
- Edge: `supabase/functions/_shared/sharedDictionaryContract_test.ts` imports the
  identical source from the Deno runtime. It only verifies compatibility; it does
  not create a function, endpoint or server mutation path.

## Verification

All results are local, final-worktree checks.

- Mobile contract suite: 4/4 passed.
- Web contract suite: 1/1 passed.
- Full Edge suite: 74/74 passed, including the new Deno compatibility test.
- `@woordenaar/domain` typecheck, mobile test typecheck and web typecheck passed.
- Explicit lint with `--no-ignore` passed for the new domain/mobile/web files.
  Repository `lint:ci` passed.
- Repository `format:check` and `git diff --check` passed. Root Prettier is the
  repository CI formatter; it differs only in trailing commas from Deno's local
  formatter setting, while the Deno test itself passes with repository formatting.

## D05 boundary

D04 deliberately has no RPC, adapter, production import or legacy-path change.
D05 must consume these parsers in trusted server commands, add owner/version/
receipt semantics and compatibility guards, and prove cursor/transaction behavior.
Do not claim current clients use the resolver until D05–D09 integrate it under the
separate dormant capability and final activation gate.
