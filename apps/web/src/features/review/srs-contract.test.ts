import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  calculateSRSProgress,
  getMasteryProgressPercentage,
  getWordKnowledgeLevel,
  isMasteredWord,
} from '@woordenaar/domain'

const repositoryRoot = resolve(__dirname, '../../../../..')

describe('shared SRS contract', () => {
  it.each([
    [0, 'new', 0, false],
    [1, 'learning', 33, false],
    [2, 'learning', 67, false],
    [3, 'established', 100, true],
    [4, 'established', 100, true],
    [100, 'established', 100, true],
  ] as const)(
    'keeps the label, mastery flag and percentage consistent at %i repetitions',
    (count, level, percentage, mastered) => {
      expect(getWordKnowledgeLevel(count)).toBe(level)
      expect(getMasteryProgressPercentage(count)).toBe(percentage)
      expect(isMasteredWord({ repetition_count: count })).toBe(mastered)
    }
  )

  it('clamps corrupted negative mastery progress at zero', () => {
    expect(getMasteryProgressPercentage(-1)).toBe(0)
  })

  it('demotes a forgotten established word and relearns it from the first interval', () => {
    const established = {
      intervalDays: 15,
      repetitionCount: 3,
      easinessFactor: 2.5,
    }
    const forgotten = calculateSRSProgress(established, 'again')
    expect(forgotten).toEqual({
      intervalDays: 0,
      repetitionCount: 0,
      easinessFactor: 2.3,
    })
    expect(getWordKnowledgeLevel(forgotten.repetitionCount)).toBe('new')
    expect(getMasteryProgressPercentage(forgotten.repetitionCount)).toBe(0)
    expect(calculateSRSProgress(forgotten, 'good')).toEqual({
      intervalDays: 1,
      repetitionCount: 1,
      easinessFactor: 2.3,
    })
    expect(established).toEqual({
      intervalDays: 15,
      repetitionCount: 3,
      easinessFactor: 2.5,
    })
  })

  it.each([
    ['good', 1, 0, 2.5, 1, 1, 2.5],
    ['easy', 4, 1, 2.3, 10, 2, 2.45],
    ['easy', 0, 2, 2.3, 1, 3, 2.45],
    ['good', 0, 2, 2.3, 1, 3, 2.3],
    ['good', 7, 3, 2.35, 16, 4, 2.35],
    ['hard', 1, 1, 1.3, 1, 2, 1.3],
    ['hard', 2, 1, 2.3, 2, 2, 2.15],
    ['hard', 3, 1, 2.3, 4, 2, 2.15],
    ['again', 1, 1, 1.4, 0, 0, 1.3],
  ] as const)(
    'calculates %s from interval %i and repetitions %i',
    (
      assessment,
      intervalDays,
      repetitionCount,
      easinessFactor,
      interval,
      repetitions,
      factor
    ) => {
      expect(
        calculateSRSProgress(
          { intervalDays, repetitionCount, easinessFactor },
          assessment
        )
      ).toEqual({
        intervalDays: interval,
        repetitionCount: repetitions,
        easinessFactor: factor,
      })
    }
  )
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
