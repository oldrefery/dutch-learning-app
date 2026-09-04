import Link from 'next/link'
import { ArrowRight, BookOpen, Volume2 } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { getReviewIntervalLabel } from './review-domain'
import type {
  RecognitionOption,
  ReviewAssessment,
  ReviewMode,
  ReviewWord,
} from './types'
import styles from './Review.module.css'

const ASSESSMENTS: readonly ReviewAssessment[] = [
  'again',
  'hard',
  'good',
  'easy',
]

interface ReviewCardProps {
  adaptiveMessage: string | null
  answer: string
  assessed: boolean
  error: string | null
  mode: ReviewMode
  onAssessment: (assessment: ReviewAssessment) => void
  onPlayPronunciation: () => void
  onReveal: () => void
  onSelectOption: (option: RecognitionOption) => void
  options: RecognitionOption[] | null
  pending: boolean
  revealed: boolean
  selectedOption: RecognitionOption | null
  translation: string | null
  word: ReviewWord
}

function RatingButton({
  assessment,
  disabled,
  onAssessment,
  word,
}: {
  assessment: ReviewAssessment
  disabled: boolean
  onAssessment: (assessment: ReviewAssessment) => void
  word: ReviewWord
}) {
  const index = ASSESSMENTS.indexOf(assessment) + 1
  return (
    <button
      className={`${styles.rating} ${styles[assessment]}`}
      disabled={disabled}
      onClick={() => onAssessment(assessment)}
      type="button"
    >
      <span className={styles.ratingTop}>
        <span className={styles.key}>{index}</span>
        <span>{assessment[0].toUpperCase() + assessment.slice(1)}</span>
      </span>
      <small>{getReviewIntervalLabel(word, assessment)}</small>
    </button>
  )
}

export function ReviewCard({
  adaptiveMessage,
  answer,
  assessed,
  error,
  mode,
  onAssessment,
  onPlayPronunciation,
  onReveal,
  onSelectOption,
  options,
  pending,
  revealed,
  selectedOption,
  translation,
  word,
}: ReviewCardProps) {
  const prompt = mode === 'dutch-production' ? translation : word.dutchLemma
  const recognitionWrong =
    mode === 'recognition' && selectedOption?.isCorrect === false

  return (
    <>
      {adaptiveMessage && (
        <p aria-live="polite" className={styles.adaptiveNotice}>
          {adaptiveMessage}
        </p>
      )}

      <article className={styles.card}>
        <p className={styles.promptLabel}>
          {mode === 'recognition'
            ? 'Choose the meaning'
            : mode === 'dutch-production'
              ? 'Produce the Dutch word'
              : revealed
                ? 'Answer'
                : 'Recall the meaning'}
        </p>

        {mode === 'dutch-production' ? (
          <h1 className={styles.productionPrompt}>
            {prompt ?? 'Translation unavailable'}
          </h1>
        ) : (
          <h1 className={styles.prompt}>{prompt}</h1>
        )}

        {mode !== 'dutch-production' && (
          <>
            <div className={styles.wordMeta}>
              {word.article && <Badge tone="accent">{word.article}</Badge>}
              {word.partOfSpeech && <Badge>{word.partOfSpeech}</Badge>}
            </div>
            <div className={styles.audioCenter}>
              <button
                className={styles.audioButton}
                onClick={onPlayPronunciation}
                type="button"
              >
                <Volume2 aria-hidden="true" size={17} /> Play pronunciation
                <span className={styles.key}>P</span>
              </button>
            </div>
          </>
        )}

        {mode === 'recognition' && options && (
          <div className={styles.optionGrid}>
            {options.map((option, index) => {
              const isSelected = option.id === selectedOption?.id
              const optionClass = revealed
                ? option.isCorrect
                  ? styles.optionCorrect
                  : isSelected
                    ? styles.optionWrong
                    : styles.optionFaded
                : ''
              return (
                <button
                  className={`${styles.option} ${optionClass}`}
                  disabled={revealed}
                  key={option.id}
                  onClick={() => onSelectOption(option)}
                  type="button"
                >
                  <span className={styles.key}>{index + 1}</span>
                  <span>{option.label}</span>
                  {revealed && option.isCorrect && (
                    <span className={styles.optionState}>✓ Correct</span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {mode === 'dutch-production' && !revealed && (
          <div className={styles.hiddenAnswer}>Answer hidden</div>
        )}

        {revealed && mode !== 'recognition' && (
          <div aria-live="polite" className={styles.revealedAnswer}>
            <span className="dw-label">
              {mode === 'dutch-production' ? 'Dutch' : 'Meaning'}
            </span>
            <p>{answer}</p>
          </div>
        )}

        {!revealed && mode !== 'recognition' && !assessed && (
          <Button
            className={styles.revealButton}
            onClick={onReveal}
            type="button"
          >
            {mode === 'dutch-production'
              ? 'Reveal Dutch word'
              : 'Reveal answer'}
            <span className="dw-key">Space</span>
          </Button>
        )}

        {revealed && mode === 'recognition' && !assessed && (
          <div className={styles.continueRow}>
            {word.collectionId && (
              <Link
                className="dw-button dw-button--secondary"
                href={`/app/collections/${word.collectionId}/words/${word.id}`}
              >
                <BookOpen aria-hidden="true" size={16} /> Full details
                <span className="dw-key">D</span>
              </Link>
            )}
            <Button
              disabled={pending}
              onClick={() => onAssessment(recognitionWrong ? 'again' : 'good')}
              type="button"
            >
              Continue <ArrowRight aria-hidden="true" size={16} />
            </Button>
          </div>
        )}

        {pending && <p className="dw-support">Saving…</p>}
        {error && (
          <p aria-live="polite" className={styles.error}>
            {error}
          </p>
        )}
      </article>

      {revealed && mode !== 'recognition' && !assessed && (
        <div className={styles.answerBar}>
          <div className={styles.answerGrid}>
            {ASSESSMENTS.map(assessment => (
              <RatingButton
                assessment={assessment}
                disabled={pending}
                key={assessment}
                onAssessment={onAssessment}
                word={word}
              />
            ))}
          </div>
        </div>
      )}
    </>
  )
}
