import Link from 'next/link'
import Image from 'next/image'
import type {
  RecognitionOption,
  ReviewAssessment,
  ReviewMode,
  ReviewWord,
} from './types'

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

const RatingButton = ({
  assessment,
  disabled,
  onAssessment,
}: {
  assessment: ReviewAssessment
  disabled: boolean
  onAssessment: (assessment: ReviewAssessment) => void
}) => (
  <button
    className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium capitalize disabled:opacity-40 dark:border-neutral-700"
    disabled={disabled}
    onClick={() => onAssessment(assessment)}
    type="button"
  >
    {assessment}
  </button>
)

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
    <article className="mx-auto max-w-3xl rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-8">
      {adaptiveMessage && (
        <p className="mb-4 text-xs font-medium text-indigo-700 dark:text-indigo-300">
          {adaptiveMessage}
        </p>
      )}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        {word.imageUrl && (
          <Image
            alt=""
            className="h-40 w-full rounded-2xl object-cover sm:w-52"
            height={160}
            src={word.imageUrl}
            unoptimized
            width={208}
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm text-neutral-500">
            {mode === 'recognition'
              ? 'Choose the meaning'
              : mode === 'dutch-production'
                ? 'Produce the Dutch word'
                : 'Recall the meaning'}
          </p>
          <h2 className="mt-2 break-words text-4xl font-semibold tracking-tight">
            {prompt ?? 'Translation unavailable'}
          </h2>
          {mode !== 'dutch-production' && (
            <button
              className="mt-4 text-sm font-medium text-neutral-600 hover:underline dark:text-neutral-300"
              onClick={onPlayPronunciation}
              type="button"
            >
              Play pronunciation
            </button>
          )}
        </div>
      </div>

      {mode === 'recognition' && options && !revealed && (
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {options.map(option => (
            <button
              className="rounded-xl border border-neutral-300 px-4 py-3 text-left hover:border-neutral-500 dark:border-neutral-700"
              key={option.id}
              onClick={() => onSelectOption(option)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {revealed && (
        <div
          aria-live="polite"
          className={`mt-8 rounded-2xl p-5 ${
            recognitionWrong
              ? 'bg-rose-50 text-rose-950 dark:bg-rose-950 dark:text-rose-100'
              : 'bg-emerald-50 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100'
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide">
            Answer
          </p>
          <p className="mt-2 text-2xl font-semibold">{answer}</p>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {!revealed && mode !== 'recognition' && !assessed && (
          <button
            className="rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-950"
            onClick={onReveal}
            type="button"
          >
            Show answer
          </button>
        )}
        {revealed && !assessed && recognitionWrong && (
          <RatingButton
            assessment="again"
            disabled={pending}
            onAssessment={onAssessment}
          />
        )}
        {revealed && !assessed && !recognitionWrong && (
          <>
            {mode !== 'recognition' && (
              <RatingButton
                assessment="again"
                disabled={pending}
                onAssessment={onAssessment}
              />
            )}
            {(['hard', 'good', 'easy'] as const).map(assessment => (
              <RatingButton
                assessment={assessment}
                disabled={pending}
                key={assessment}
                onAssessment={onAssessment}
              />
            ))}
          </>
        )}
        {assessed && (
          <p className="text-sm text-emerald-700 dark:text-emerald-300">
            This card is complete for the current session.
          </p>
        )}
        {word.collectionId && (
          <Link
            className="ml-auto text-sm text-neutral-600 hover:underline dark:text-neutral-400"
            href={`/app/collections/${word.collectionId}/words/${word.id}`}
          >
            Word details
          </Link>
        )}
      </div>
      {pending && <p className="mt-4 text-sm text-neutral-500">Saving…</p>}
      {error && (
        <p aria-live="polite" className="mt-4 text-sm text-rose-700">
          {error}
        </p>
      )}
    </article>
  )
}
