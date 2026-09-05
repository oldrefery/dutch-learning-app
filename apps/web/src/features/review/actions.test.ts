import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const repositoryRoot = resolve(__dirname, '../../../../..')

describe('atomic review assessment contract', () => {
  const action = readFileSync(join(__dirname, 'actions.ts'), 'utf8')
  const migration = readFileSync(
    join(
      repositoryRoot,
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

  it('reports handled RPC failures to Sentry with safe context', () => {
    const captureStart = action.indexOf('Sentry.captureException')
    const captureEnd = action.indexOf('\n\n    return {', captureStart)
    const captureBlock = action.slice(captureStart, captureEnd)

    expect(action).toContain("import * as Sentry from '@sentry/nextjs'")
    expect(captureBlock).toContain('Sentry.captureException(persistenceError')
    expect(captureBlock).toContain("operation: 'record_review_assessment'")
    expect(captureBlock).not.toContain('input.wordId')
    expect(captureBlock).not.toContain('input.eventId')
  })
})
