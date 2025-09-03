import type { SRSAssessment, SRSResult } from '../types/database'

/**
 * Spaced Repetition System (SRS) algorithm based on SM-2
 * 
 * This implements a simplified version of the SuperMemo SM-2 algorithm
 * for optimal spacing of flashcard reviews.
 */

interface SRSInput {
    interval_days: number
    repetition_count: number
    easiness_factor: number
    assessment: SRSAssessment
}

export function calculateNextReview({
    interval_days,
    repetition_count,
    easiness_factor,
    assessment,
}: SRSInput): SRSResult {
    let newEasinessFactor = easiness_factor
    let newRepetitionCount = repetition_count
    let newInterval = interval_days

    // Adjust easiness factor based on assessment
    switch (assessment) {
        case 'again':
            // Reset card to beginning, reduce easiness factor significantly
            newEasinessFactor = Math.max(1.3, easiness_factor - 0.2)
            newRepetitionCount = 0
            newInterval = 1
            break

        case 'hard':
            // Reduce easiness factor, restart repetition sequence
            newEasinessFactor = Math.max(1.3, easiness_factor - 0.15)
            newRepetitionCount = 0
            newInterval = Math.max(1, Math.floor(interval_days * 0.6))
            break

        case 'good':
            // Standard progression
            newEasinessFactor = easiness_factor
            newRepetitionCount = repetition_count + 1

            if (newRepetitionCount === 1) {
                newInterval = 1
            } else if (newRepetitionCount === 2) {
                newInterval = 6
            } else {
                newInterval = Math.round(interval_days * easiness_factor)
            }
            break

        case 'easy':
            // Increase easiness factor, accelerate interval
            newEasinessFactor = Math.min(2.5, easiness_factor + 0.15)
            newRepetitionCount = repetition_count + 1

            if (newRepetitionCount === 1) {
                newInterval = 4
            } else if (newRepetitionCount === 2) {
                newInterval = 10
            } else {
                newInterval = Math.round(interval_days * easiness_factor * 1.3)
            }
            break
    }

    // Calculate next review date
    const nextReviewDate = new Date()
    nextReviewDate.setDate(nextReviewDate.getDate() + newInterval)

    return {
        interval_days: newInterval,
        repetition_count: newRepetitionCount,
        easiness_factor: Number(newEasinessFactor.toFixed(2)),
        next_review_date: nextReviewDate.toISOString().split('T')[0],
    }
}

/**
 * Get the next word from review session, handling the relearning queue
 */
export function getNextReviewWord(
    words: any[],
    currentIndex: number,
    againQueue: any[]
): { word: any | null; isFromAgainQueue: boolean; newIndex: number } {
    // First, check if there are words in the "again" queue
    if (againQueue.length > 0) {
        return {
            word: againQueue[0],
            isFromAgainQueue: true,
            newIndex: currentIndex,
        }
    }

    // Otherwise, get next word from main sequence
    if (currentIndex < words.length) {
        return {
            word: words[currentIndex],
            isFromAgainQueue: false,
            newIndex: currentIndex + 1,
        }
    }

    // No more words
    return {
        word: null,
        isFromAgainQueue: false,
        newIndex: currentIndex,
    }
}

/**
 * Calculate review session statistics
 */
export function calculateSessionStats(
    totalWords: number,
    completedWords: number,
    againQueueSize: number
) {
    const progress = totalWords > 0 ? (completedWords / totalWords) * 100 : 0
    const remaining = totalWords - completedWords + againQueueSize

    return {
        progress: Math.round(progress),
        completed: completedWords,
        remaining,
        total: totalWords,
    }
}
