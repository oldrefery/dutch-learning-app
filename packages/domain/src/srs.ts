export const SRS_ASSESSMENT = {
  AGAIN: 'again',
  HARD: 'hard',
  GOOD: 'good',
  EASY: 'easy',
} as const

export type SRSAssessmentType =
  (typeof SRS_ASSESSMENT)[keyof typeof SRS_ASSESSMENT]

export const SRS_PARAMS = {
  INITIAL: {
    INTERVAL_DAYS: 0,
    REPETITION_COUNT: 0,
    EASINESS_FACTOR: 2.5,
  },
  EASINESS_ADJUSTMENT: {
    AGAIN: -0.2,
    HARD: -0.15,
    GOOD: 0,
    EASY: 0.15,
  },
  EASINESS_BOUNDS: {
    MIN: 1.3,
    MAX: 2.5,
  },
  FIRST_INTERVALS: {
    GOOD: {
      FIRST: 1,
      SECOND: 6,
    },
    EASY: {
      FIRST: 4,
      SECOND: 10,
    },
  },
  MULTIPLIERS: {
    HARD: 1.2,
    EASY: 1.3,
  },
} as const

export const MASTERED_MIN_REPETITIONS = 3

export interface SRSProgress {
  easinessFactor: number
  intervalDays: number
  repetitionCount: number
}

export type WordKnowledgeLevel = 'new' | 'learning' | 'established'

const roundEasinessFactor = (value: number): number => Number(value.toFixed(2))

export function calculateSRSProgress(
  progress: SRSProgress,
  assessment: SRSAssessmentType
): SRSProgress {
  const { easinessFactor, intervalDays, repetitionCount } = progress

  if (assessment === SRS_ASSESSMENT.AGAIN) {
    return {
      easinessFactor: roundEasinessFactor(
        Math.max(
          SRS_PARAMS.EASINESS_BOUNDS.MIN,
          easinessFactor + SRS_PARAMS.EASINESS_ADJUSTMENT.AGAIN
        )
      ),
      intervalDays: SRS_PARAMS.INITIAL.INTERVAL_DAYS,
      repetitionCount: SRS_PARAMS.INITIAL.REPETITION_COUNT,
    }
  }

  const nextRepetitionCount = repetitionCount + 1

  if (assessment === SRS_ASSESSMENT.HARD) {
    return {
      easinessFactor: roundEasinessFactor(
        Math.max(
          SRS_PARAMS.EASINESS_BOUNDS.MIN,
          easinessFactor + SRS_PARAMS.EASINESS_ADJUSTMENT.HARD
        )
      ),
      intervalDays:
        intervalDays === 0
          ? 1
          : Math.max(1, Math.round(intervalDays * SRS_PARAMS.MULTIPLIERS.HARD)),
      repetitionCount: nextRepetitionCount,
    }
  }

  if (assessment === SRS_ASSESSMENT.GOOD) {
    const nextInterval =
      nextRepetitionCount === 1
        ? SRS_PARAMS.FIRST_INTERVALS.GOOD.FIRST
        : nextRepetitionCount === 2
          ? SRS_PARAMS.FIRST_INTERVALS.GOOD.SECOND
          : Math.max(1, Math.round(intervalDays * easinessFactor))

    return {
      easinessFactor: roundEasinessFactor(
        easinessFactor + SRS_PARAMS.EASINESS_ADJUSTMENT.GOOD
      ),
      intervalDays: nextInterval,
      repetitionCount: nextRepetitionCount,
    }
  }

  const nextInterval =
    nextRepetitionCount === 1
      ? SRS_PARAMS.FIRST_INTERVALS.EASY.FIRST
      : nextRepetitionCount === 2
        ? SRS_PARAMS.FIRST_INTERVALS.EASY.SECOND
        : Math.max(
            1,
            Math.round(
              intervalDays * easinessFactor * SRS_PARAMS.MULTIPLIERS.EASY
            )
          )

  return {
    easinessFactor: roundEasinessFactor(
      Math.min(
        SRS_PARAMS.EASINESS_BOUNDS.MAX,
        easinessFactor + SRS_PARAMS.EASINESS_ADJUSTMENT.EASY
      )
    ),
    intervalDays: nextInterval,
    repetitionCount: nextRepetitionCount,
  }
}

export const getWordKnowledgeLevel = (
  repetitionCount: number
): WordKnowledgeLevel => {
  if (repetitionCount === 0) return 'new'
  if (repetitionCount >= MASTERED_MIN_REPETITIONS) return 'established'
  return 'learning'
}

export const getMasteryProgressPercentage = (repetitionCount: number): number =>
  Math.min(
    100,
    Math.max(0, Math.round((repetitionCount / MASTERED_MIN_REPETITIONS) * 100))
  )

export const isMasteredWord = <T extends { repetition_count: number }>(
  word: T
): boolean => word.repetition_count >= MASTERED_MIN_REPETITIONS
