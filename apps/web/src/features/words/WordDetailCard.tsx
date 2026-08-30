import Image from 'next/image'
import { canRenderWordImage } from './word-detail'
import type { WordConjugation, WordDetail, WordExample } from './word-detail'

const Section = ({
  children,
  title,
}: {
  children: React.ReactNode
  title: string
}) => (
  <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
    <h2 className="text-lg font-semibold">{title}</h2>
    <div className="mt-4">{children}</div>
  </section>
)

const EmptyValue = () => (
  <p className="text-sm text-neutral-500">Not available</p>
)

const Tag = ({ children }: { children: React.ReactNode }) => (
  <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
    {children}
  </span>
)

const TranslationSection = ({ word }: { word: WordDetail }) => {
  const hasTranslations =
    word.translations.en.length > 0 || word.translations.ru.length > 0

  return (
    <Section title="Translations">
      {!hasTranslations ? (
        <EmptyValue />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {word.translations.en.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-neutral-500">English</h3>
              <ul className="mt-2 space-y-1 text-sm">
                {word.translations.en.map(translation => (
                  <li key={translation}>• {translation}</li>
                ))}
              </ul>
            </div>
          )}
          {word.translations.ru.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-neutral-500">Russian</h3>
              <ul className="mt-2 space-y-1 text-sm">
                {word.translations.ru.map(translation => (
                  <li key={translation}>• {translation}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Section>
  )
}

const GrammarSection = ({ word }: { word: WordDetail }) => {
  const tags = [
    word.partOfSpeech,
    word.article,
    word.plural ? `plural: ${word.plural}` : null,
    word.register,
    word.preposition ? `+ ${word.preposition}` : null,
    word.isIrregular ? 'irregular' : null,
    word.isReflexive ? 'reflexive' : null,
    word.isSeparable ? 'separable' : null,
    word.isExpression ? (word.expressionType ?? 'expression') : null,
  ].filter((value): value is string => Boolean(value))

  return (
    <Section title="Grammar">
      {tags.length === 0 ? (
        <EmptyValue />
      ) : (
        <div className="flex flex-wrap gap-2">
          {tags.map(tag => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </div>
      )}
      {word.isSeparable && word.prefixPart && word.rootVerb && (
        <p className="mt-4 text-sm">
          <strong>{word.prefixPart}</strong> + {word.rootVerb}
        </p>
      )}
    </Section>
  )
}

const ConjugationRows = ({ conjugation }: { conjugation: WordConjugation }) => {
  const rows = [
    ['Present (ik)', conjugation.present],
    ['Past (ik)', conjugation.simplePast],
    ['Past (plural)', conjugation.simplePastPlural],
    ['Past participle', conjugation.pastParticiple],
  ].filter((row): row is [string, string] => Boolean(row[1]))

  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div
          className="rounded-xl bg-neutral-50 p-3 dark:bg-neutral-950"
          key={label}
        >
          <dt className="text-xs text-neutral-500">{label}</dt>
          <dd className="mt-1 text-sm font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

const ExamplesSection = ({ examples }: { examples: WordExample[] }) => (
  <Section title="Examples">
    {examples.length === 0 ? (
      <EmptyValue />
    ) : (
      <div className="space-y-3">
        {examples.map(example => (
          <article
            className="rounded-xl bg-neutral-50 p-4 dark:bg-neutral-950"
            key={`${example.nl}-${example.en}`}
          >
            <p className="font-medium">{example.nl}</p>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              {example.en}
            </p>
            {example.ru && (
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                {example.ru}
              </p>
            )}
          </article>
        ))}
      </div>
    )}
  </Section>
)

const UsageSection = ({ word }: { word: WordDetail }) => {
  if (!word.usageNotes) return null

  return (
    <Section title="Usage & nuance">
      {word.usageNotes.summary && (
        <p className="text-sm">{word.usageNotes.summary}</p>
      )}
      {word.usageNotes.contrasts.length > 0 && (
        <div className="mt-4 space-y-3">
          {word.usageNotes.contrasts.map(contrast => (
            <article
              className="rounded-xl bg-neutral-50 p-4 dark:bg-neutral-950"
              key={`${contrast.term}-${contrast.distinction}`}
            >
              <h3 className="font-medium">{contrast.term}</h3>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                {contrast.distinction}
              </p>
              {contrast.example && (
                <div className="mt-3 border-t border-neutral-200 pt-3 text-sm dark:border-neutral-800">
                  <p>{contrast.example.nl}</p>
                  <p className="mt-1 text-neutral-600 dark:text-neutral-400">
                    {contrast.example.en}
                  </p>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      <p className="mt-4 text-xs text-neutral-500">AI-generated guidance</p>
    </Section>
  )
}

const WordRelationsSection = ({ word }: { word: WordDetail }) => {
  if (word.synonyms.length === 0 && word.antonyms.length === 0) return null

  return (
    <Section title="Related words">
      <div className="grid gap-5 sm:grid-cols-2">
        {word.synonyms.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-neutral-500">Synonyms</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {word.synonyms.map(synonym => (
                <Tag key={synonym}>{synonym}</Tag>
              ))}
            </div>
          </div>
        )}
        {word.antonyms.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-neutral-500">Antonyms</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {word.antonyms.map(antonym => (
                <Tag key={antonym}>{antonym}</Tag>
              ))}
            </div>
          </div>
        )}
      </div>
    </Section>
  )
}

const MediaSection = ({ word }: { word: WordDetail }) => {
  const showImage = word.imageUrl && canRenderWordImage(word.imageUrl)

  return (
    <Section title="Media">
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-medium text-neutral-500">Image</h3>
          {showImage && word.imageUrl ? (
            <div className="relative mt-2 aspect-[3/2] overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-800">
              <Image
                alt={`${word.dutchLemma} illustration`}
                className="object-cover"
                fill
                loading="eager"
                sizes="(max-width: 768px) 100vw, 50vw"
                src={word.imageUrl}
              />
            </div>
          ) : word.imageUrl ? (
            <a
              className="mt-2 inline-flex text-sm font-medium underline"
              href={word.imageUrl}
              rel="noreferrer"
              target="_blank"
            >
              Open external image
            </a>
          ) : (
            <div className="mt-2 rounded-xl bg-neutral-50 p-5 text-sm text-neutral-500 dark:bg-neutral-950">
              No image selected
            </div>
          )}
        </div>
        <div>
          <h3 className="text-sm font-medium text-neutral-500">
            Pronunciation
          </h3>
          {word.ttsUrl ? (
            <audio className="mt-2 w-full" controls preload="none">
              <source src={word.ttsUrl} />
              Your browser does not support audio playback.
            </audio>
          ) : (
            <div className="mt-2 rounded-xl bg-neutral-50 p-5 text-sm text-neutral-500 dark:bg-neutral-950">
              No pronunciation available
            </div>
          )}
        </div>
      </div>
    </Section>
  )
}

const ProgressSection = ({ word }: { word: WordDetail }) => (
  <Section title="Learning progress">
    <dl className="grid gap-3 sm:grid-cols-4">
      {[
        ['Interval', `${word.intervalDays} days`],
        ['Repetitions', String(word.repetitionCount)],
        ['Ease factor', word.easinessFactor.toFixed(2)],
        ['Next review', word.nextReviewDate],
      ].map(([label, value]) => (
        <div
          className="rounded-xl bg-neutral-50 p-3 dark:bg-neutral-950"
          key={label}
        >
          <dt className="text-xs text-neutral-500">{label}</dt>
          <dd className="mt-1 text-sm font-medium">{value}</dd>
        </div>
      ))}
    </dl>
    {word.lastReviewedAt && (
      <p className="mt-3 text-xs text-neutral-500">
        Last reviewed: {new Date(word.lastReviewedAt).toLocaleString('en-GB')}
      </p>
    )}
  </Section>
)

export function WordDetailCard({ word }: { word: WordDetail }) {
  return (
    <div className="grid gap-4">
      <MediaSection word={word} />
      <div className="grid gap-4 lg:grid-cols-2">
        <TranslationSection word={word} />
        <GrammarSection word={word} />
      </div>
      {word.conjugation && (
        <Section title="Conjugation">
          <ConjugationRows conjugation={word.conjugation} />
        </Section>
      )}
      <UsageSection word={word} />
      <ExamplesSection examples={word.examples} />
      <WordRelationsSection word={word} />
      {word.analysisNotes && (
        <Section title="Analysis notes">
          <p className="whitespace-pre-wrap text-sm">{word.analysisNotes}</p>
        </Section>
      )}
      <ProgressSection word={word} />
    </div>
  )
}
