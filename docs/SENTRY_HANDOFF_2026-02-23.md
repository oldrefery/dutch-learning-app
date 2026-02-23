# Sentry Handoff (2026-02-23)

## Scope

Prepare a clean restart point for fixing current production Sentry issues in `dutch-learning-app`.

## Current App Version

- `version`: `1.9.4`
- `ios.buildNumber`: `53`
- `android.versionCode`: `53`
- Source: `app.base.json`

## Sentry Access Status

- Access is working.
- Required base URL for this org/project in local setup: `https://us.sentry.io`
- Confirmed that API calls return issues with current token/scopes.

Local env keys expected:

- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG=oldrefery`
- `SENTRY_PROJECT=dutch-learning-app`
- `SENTRY_BASE_URL=https://us.sentry.io`

## Verified Query (Current Release)

Use this exact release filter (important):

- `release:com.oldrefery.dutch-learning-app@1.9.4+53`

Reference command:

```bash
set -a
source ./.env
source ./.env.local
set +a
export SSL_CERT_FILE="$(python3 -c "import certifi; print(certifi.where())")"

python3 "$HOME/.codex/skills/sentry/scripts/sentry_api.py" \
  --org "$SENTRY_ORG" \
  --project "$SENTRY_PROJECT" \
  --base-url "$SENTRY_BASE_URL" \
  list-issues \
  --environment production \
  --time-range 14d \
  --limit 20 \
  --query "is:unresolved release:com.oldrefery.dutch-learning-app@1.9.4+53"
```

## Unresolved Issues (Release `1.9.4+53`)

1. `DUTCH-LEARNING-APP-2G`  
   `Error: Failed to push words: duplicate key value violates unique constraint "idx_words_semantic_unique"`  
   count: `400`, lastSeen: `2026-02-23`

2. `DUTCH-LEARNING-APP-1H`  
   `Error: duplicate key value violates unique constraint "idx_words_semantic_unique"`  
   count: `435`, lastSeen: `2026-02-23`

3. `DUTCH-LEARNING-APP-17`  
   `NetworkError: Edge Function gemini-handler timed out after 15000ms`  
   count: `5`, lastSeen: `2026-02-21`

4. `DUTCH-LEARNING-APP-2N`  
   `Error: Failed to pull words: JWT expired`  
   count: `1`, lastSeen: `2026-02-06`

5. `DUTCH-LEARNING-APP-35` and `DUTCH-LEARNING-APP-34`  
   Import flow errors (`importWordsToCollection` + duplicate key on semantic unique index)  
   count: `2`, lastSeen: `2026-02-02`

## Root-Cause Notes

### A) Semantic duplicate conflicts during sync (highest impact)

- Duplicate pre-check is not fully equivalent to DB semantic unique index behavior.
- Sync upserts on `word_id` only, but DB also enforces semantic uniqueness.
- Relevant files:
  - `src/services/syncManager.ts` (duplicate check + upsert path)
  - `src/lib/supabase.ts` (`checkWordExists`)
  - `supabase/migrations/20250926144829_implement_semantic_word_uniqueness.sql`

### B) Shared import duplicate conflicts

- RPC function `import_words_to_collection` inserts without conflict handling.
- Re-import or semantic duplicate can fail with `23505`.
- Relevant files:
  - `src/lib/supabase.ts` (`importWordsToCollection`)
  - `supabase/migrations/20251002142334_fix_import_conjugation_check.sql`

### C) `gemini-handler` timeout

- Client timeout is `15000ms` per attempt.
- Handler path can exceed this duration in production conditions.
- Relevant files:
  - `supabase/functions/_shared/constants.ts` (`EDGE_FUNCTION_TIMEOUT_MS`)
  - `src/utils/retryUtils.ts`
  - `supabase/functions/gemini-handler/index.ts`

### D) `JWT expired` in sync

- Need auth/session preflight before sync pull/push stages.
- Relevant file:
  - `src/services/syncManager.ts`

## Execution Plan (Next Session)

### Phase 1 (P0): Eliminate duplicate-key noise in sync/import

Status: completed in code/tests on `2026-02-23` (deploy verification pending).

1. [x] Align semantic duplicate detection logic with DB index behavior.
2. [x] In sync path, handle semantic conflict deterministically (skip/mark synced or reconcile).
3. [x] Update import RPC SQL to be conflict-safe (`ON CONFLICT` strategy) for semantic key.
4. [x] Reduce Sentry noise for known duplicate conflicts (log as warning-level message with context).

### Phase 1.5 (P0-cache): Align cache semantics and counters

1. Make cache semantic matching consistent with DB index semantics:
   - normalize `part_of_speech` with `'unknown'`
   - normalize `article` with `''` vs `NULL` handling parity
2. Fix cache usage increment path in Edge Function (`updateCacheUsage`) so `usage_count` is reliably incremented.
3. Align cache TTL behavior between code and DB policy:
   - avoid hardcoded drift (`last_used_at` 180d in code vs DB cache TTL columns/functions)
   - document and enforce one source of truth
4. Add/adjust tests for:
   - semantic cache hit with `NULL`/empty article variants
   - usage counter increment behavior
   - TTL boundary behavior

### Phase 2 (P1): Timeout tuning for `gemini-handler`

1. Increase `EDGE_FUNCTION_TIMEOUT_MS` to `25000-30000`.
2. Keep retries and evaluate impact on UX.
3. Validate no regression in analyze-word flow.

### Phase 3 (P2): Token/session resilience in sync

1. Add auth preflight (get/refresh session) before sync stages.
2. On refresh failure, return controlled error and skip network operations.

## Validation Checklist

1. [x] `npx jest --runInBand --watchman=false src/services/__tests__/syncManager.test.ts src/lib/__tests__/supabase.test.ts`
2. [x] Add/update tests for:
   - Sync duplicate handling.
   - Import duplicate handling.
3. [ ] Timeout/retry behavior.
4. [ ] Re-run Sentry query for release after fix deployment and compare:
   - Duplicate-key issues trend down.
   - No new high-volume regressions.

## Suggested Restart Prompt

Use this in a new session:

```text
Read /Users/devrush/code/pet/DutchLearningApp/docs/SENTRY_HANDOFF_2026-02-23.md and continue from Phase 1 (P0). Implement the duplicate-key fixes first, add tests, and provide a short deployment + verification checklist.
```
