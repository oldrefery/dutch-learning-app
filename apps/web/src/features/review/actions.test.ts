import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('atomic review assessment contract', () => {
  const migration = readFileSync(
    join(
      process.cwd(),
      'supabase/migrations/20260830110000_add_atomic_review_assessment_rpc.sql'
    ),
    'utf8'
  )

  it('locks the owned word and writes progress with its event in one function', () => {
    expect(migration).toContain('FOR UPDATE')
    expect(migration).toContain('UPDATE public.words')
    expect(migration).toContain('INSERT INTO public.review_events')
    expect(migration).toContain('words.user_id = v_user_id')
  })

  it('keeps the mobile SRS constants and idempotent event handling', () => {
    expect(migration).toContain("WHEN 'again' THEN")
    expect(migration).toContain('GREATEST(1.3')
    expect(migration).toContain('WHEN 2 THEN 6')
    expect(migration).toContain('WHEN 2 THEN 10')
    expect(migration).toContain('event_id = p_event_id')
  })

  it('grants the RPC only to authenticated users', () => {
    expect(migration).toContain('FROM PUBLIC')
    expect(migration).toContain('TO authenticated')
  })
})
