import { Volume2 } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { RecognitionOption, ReviewMode, ReviewWord } from './types'
import styles from './Review.module.css'

interface ReviewCardProps {
  interactionBlocked?: boolean
  adaptiveMessage: string | null
  answer: string
  assessed: boolean
  mode: ReviewMode
  onPlayPronunciation: () => void
  onReveal: () => void
  onSelectOption: (option: RecognitionOption) => void
  options: RecognitionOption[] | null
  revealed: boolean
  selectedOption: RecognitionOption | null
  translation: string | null
  russianTranslation: string | null
  word: ReviewWord
}

export function ReviewCard({
  interactionBlocked = false,
  adaptiveMessage,
  answer,
  assessed,
  mode,
  onPlayPronunciation,
  onReveal,
  onSelectOption,
  options,
  revealed,
  selectedOption,
  translation,
  russianTranslation,
  word,
}: ReviewCardProps) {
  const prompt = mode === 'dutch-production' ? translation : word.dutchLemma

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
          <div>
            <h1 className={styles.productionPrompt}>
              {prompt ?? 'Translation unavailable'}
            </h1>
            {russianTranslation && russianTranslation !== prompt && (
              <p className={styles.promptTranslation}>{russianTranslation}</p>
            )}
          </div>
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
                  disabled={revealed || interactionBlocked}
                  key={option.id}
                  onClick={() => onSelectOption(option)}
                  type="button"
                >
                  <span className={styles.key}>{index + 1}</span>
                  <span className={styles.optionCopy}>
                    <span>{option.label}</span>
                    {option.secondaryLabel && (
                      <span className={styles.optionTranslation}>
                        {option.secondaryLabel}
                      </span>
                    )}
                  </span>
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
            {mode === 'meaning-recall' &&
              russianTranslation &&
              russianTranslation !== answer && (
                <p className={styles.revealedTranslation}>
                  {russianTranslation}
                </p>
              )}
          </div>
        )}

        {!revealed && mode !== 'recognition' && !assessed && (
          <Button
            className={styles.revealButton}
            disabled={interactionBlocked}
            onClick={onReveal}
            type="button"
          >
            {mode === 'dutch-production'
              ? 'Reveal Dutch word'
              : 'Reveal answer'}
            <span className="dw-key">Space</span>
          </Button>
        )}
      </article>
    </>
  )
}
