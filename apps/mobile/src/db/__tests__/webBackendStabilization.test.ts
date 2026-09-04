import fs from 'node:fs'
import path from 'node:path'

const REPOSITORY_ROOT = path.resolve(__dirname, '../../../../..')

const readRepositoryFile = (relativePath: string): string =>
  fs.readFileSync(path.resolve(REPOSITORY_ROOT, relativePath), 'utf8')

describe('web backend stabilization contracts', () => {
  it('increments one cache entry atomically through the UUID RPC', () => {
    const migration = readRepositoryFile(
      'supabase/migrations/20260830100000_fix_cache_usage_increment.sql'
    )
    const cacheUtils = readRepositoryFile(
      'supabase/functions/gemini-handler/cacheUtils.ts'
    )

    expect(migration).toContain(
      'FUNCTION public.increment_cache_usage(p_cache_id UUID)'
    )
    expect(migration).toContain('usage_count = usage_count + 1')
    expect(migration).toContain('WHERE cache_id = p_cache_id')
    expect(migration).toContain('TO service_role')
    expect(migration).toContain('FROM PUBLIC, anon, authenticated')

    expect(cacheUtils).toContain("supabase.rpc('increment_cache_usage'")
    expect(cacheUtils).toContain('p_cache_id: cacheId')
    expect(cacheUtils).not.toContain("supabase.rpc('increment_usage')")
  })

  it('preserves structured usage guidance during shared imports', () => {
    const migration = readRepositoryFile(
      'supabase/migrations/20260830101000_include_usage_notes_in_shared_import.sql'
    )

    expect(migration).toMatch(/analysis_notes,\s+usage_notes,/)
    expect(migration).toContain(
      "WHEN jsonb_typeof(v_word_record->'usage_notes') = 'object'"
    )
    expect(migration).toContain("THEN v_word_record->'usage_notes'")
    expect(migration).toContain('WHERE deleted_at IS NULL')
    expect(migration).toContain('SET search_path = pg_catalog, public, private')
  })

  it('keeps cost-bearing Edge Function quotas service-role only', () => {
    const migration = readRepositoryFile(
      'supabase/migrations/20260830102000_add_edge_function_rate_limits.sql'
    )

    expect(migration).toContain('CREATE TABLE public.edge_function_rate_limits')
    expect(migration).toContain('FUNCTION public.consume_edge_function_quota')
    expect(migration).toContain('FOR UPDATE')
    expect(migration).toContain('FROM PUBLIC, anon, authenticated')
    expect(migration).toContain('TO service_role')
  })

  it('requires full access and durable quotas in both cost-bearing handlers', () => {
    const geminiHandler = readRepositoryFile(
      'supabase/functions/gemini-handler/index.ts'
    )
    const imageHandler = readRepositoryFile(
      'supabase/functions/get-multiple-images/index.ts'
    )

    for (const handler of [geminiHandler, imageHandler]) {
      expect(handler).toContain('authorizeFullAccessRequest(req)')
      expect(handler).toContain('consumeRequestQuotaWithServiceRole(')
      expect(handler).toContain("headers['Retry-After']")
    }

    expect(geminiHandler.indexOf("source: 'cache'")).toBeLessThan(
      geminiHandler.indexOf("'gemini-analysis'")
    )
  })
})
