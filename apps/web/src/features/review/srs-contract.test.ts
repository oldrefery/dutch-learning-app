import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  calculateSRSProgress,
  getMasteryProgressPercentage,
  getWordKnowledgeLevel,
} from '@woordenaar/domain'

const repositoryRoot = resolve(__dirname, '../../../../..')

describe('shared SRS contract', () => {
  it.each([
    ['again', 0, 0, 2.3],
    ['hard', 1, 1, 2.35],
    ['good', 1, 1, 2.5],
    ['easy', 4, 1, 2.5],
  ] as const)(
    'applies %s to a new word',
    (assessment, intervalDays, repetitionCount, easinessFactor) => {
      expect(
        calculateSRSProgress(
          { intervalDays: 0, repetitionCount: 0, easinessFactor: 2.5 },
          assessment
        )
      ).toEqual({ intervalDays, repetitionCount, easinessFactor })
    }
  )

  it('follows the standard Good progression into established knowledge', () => {
    const first = calculateSRSProgress(
      { intervalDays: 0, repetitionCount: 0, easinessFactor: 2.5 },
      'good'
    )
    const second = calculateSRSProgress(first, 'good')
    const third = calculateSRSProgress(second, 'good')

    expect([
      first.intervalDays,
      second.intervalDays,
      third.intervalDays,
    ]).toEqual([1, 6, 15])
    expect(getWordKnowledgeLevel(first.repetitionCount)).toBe('learning')
    expect(getWordKnowledgeLevel(second.repetitionCount)).toBe('learning')
    expect(getWordKnowledgeLevel(third.repetitionCount)).toBe('established')
    expect(getMasteryProgressPercentage(third.repetitionCount)).toBe(100)
  })

  it('applies penalties, bonuses, rounding, and easiness bounds', () => {
    expect(
      calculateSRSProgress(
        { intervalDays: 6, repetitionCount: 2, easinessFactor: 2.5 },
        'hard'
      )
    ).toEqual({ intervalDays: 7, repetitionCount: 3, easinessFactor: 2.35 })

    expect(
      calculateSRSProgress(
        { intervalDays: 10, repetitionCount: 2, easinessFactor: 2.3 },
        'easy'
      )
    ).toEqual({ intervalDays: 30, repetitionCount: 3, easinessFactor: 2.45 })

    expect(
      calculateSRSProgress(
        { intervalDays: 20, repetitionCount: 5, easinessFactor: 1.3 },
        'again'
      ).easinessFactor
    ).toBe(1.3)
    expect(
      calculateSRSProgress(
        { intervalDays: 20, repetitionCount: 5, easinessFactor: 2.5 },
        'easy'
      ).easinessFactor
    ).toBe(2.5)
  })

  it('keeps the database RPC coefficients aligned with the shared calculator', () => {
    const migration = readFileSync(
      join(
        repositoryRoot,
        'supabase/migrations/20260830110000_add_atomic_review_assessment_rpc.sql'
      ),
      'utf8'
    )

    expect(migration).toContain('v_word.easiness_factor - 0.2')
    expect(migration).toContain('v_word.easiness_factor - 0.15')
    expect(migration).toContain('v_word.easiness_factor + 0.15')
    expect(migration).toContain('v_word.interval_days * 1.2')
    expect(migration).toContain(
      'v_word.interval_days * v_word.easiness_factor * 1.3'
    )
    expect(migration).toContain('GREATEST(1.3')
    expect(migration).toContain('LEAST(2.5')
  })
})
