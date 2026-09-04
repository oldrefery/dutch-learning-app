import Image from 'next/image'
import {
  getMasteryProgressPercentage,
  getWordKnowledgeLevel,
  MASTERED_MIN_REPETITIONS,
} from '@woordenaar/domain'
import { Badge } from '@/components/ui/Badge'
import { AudioButton } from './AudioButton'
import { canRenderWordImage } from './word-detail'
import type { WordDetail, WordExample } from './word-detail'
import styles from './WordDetailCard.module.css'

function CardSection({
  children,
  className = '',
  title,
}: {
  children: React.ReactNode
  className?: string
  title: string
}) {
  return (
    <section className={`${styles.section} ${className}`}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {children}
    </section>
  )
}

function TranslationBlock({
  language,
  translations,
}: {
  language: 'English' | 'Russian'
  translations: string[]
}) {
  if (translations.length === 0) return null
  const [primary, ...alternates] = translations

  return (
    <div className={styles.languageBlock}>
      <span className="dw-label">{language}</span>
      <span
        className={
          language === 'English'
            ? styles.primaryTranslation
            : styles.russianTranslation
        }
      >
        {primary}
      </span>
      {alternates.length > 0 && (
        <div className={styles.alternates}>
          {alternates.slice(0, 5).map(translation => (
            <span className={styles.alternate} key={translation}>
              {translation}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function Examples({ examples }: { examples: WordExample[] }) {
  if (examples.length === 0) return null

  return (
    <CardSection title="Examples">
      <div className={styles.examples}>
        {examples.map(example => (
          <article
            className={styles.example}
            key={`${example.nl}-${example.en}`}
          >
            <p className={styles.exampleDutch}>{example.nl}</p>
            <p className={styles.exampleEnglish}>{example.en}</p>
            {example.ru && (
              <p className={styles.exampleRussian}>{example.ru}</p>
            )}
          </article>
        ))}
      </div>
    </CardSection>
  )
}

function Grammar({ word }: { word: WordDetail }) {
  const rows = [
    ['Present', word.conjugation?.present],
    ['Past sg', word.conjugation?.simplePast],
    ['Past pl', word.conjugation?.simplePastPlural],
    ['Participle', word.conjugation?.pastParticiple],
    ['Plural', word.plural],
    ['Prefix', word.prefixPart],
    ['Root', word.rootVerb],
  ].filter((row): row is [string, string] => Boolean(row[1]))

  if (rows.length === 0) return null

  return (
    <CardSection title="Grammar">
      <dl className={styles.definitionGrid}>
        {rows.map(([label, value]) => (
          <div className="contents" key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </CardSection>
  )
}

function Relations({ word }: { word: WordDetail }) {
  if (word.synonyms.length === 0 && word.antonyms.length === 0) return null

  return (
    <div className={styles.section}>
      {word.synonyms.length > 0 && (
        <CardSection title="Synonyms">
          <div className={styles.relations}>
            {word.synonyms.map(synonym => (
              <span className={styles.relation} key={synonym}>
                {synonym}
              </span>
            ))}
          </div>
        </CardSection>
      )}
      {word.antonyms.length > 0 && (
        <CardSection title="Antonyms">
          <div className={styles.relations}>
            {word.antonyms.map(antonym => (
              <span
                className={`${styles.relation} ${styles.relationAntonym}`}
                key={antonym}
              >
                {antonym}
              </span>
            ))}
          </div>
        </CardSection>
      )}
    </div>
  )
}

function Usage({ word }: { word: WordDetail }) {
  if (!word.usageNotes) return null

  return (
    <CardSection title="Usage guidance">
      {word.usageNotes.summary && (
        <p className={styles.usageSummary}>{word.usageNotes.summary}</p>
      )}
      {word.usageNotes.contrasts.length > 0 && (
        <div className={styles.contrasts}>
          {word.usageNotes.contrasts.map(contrast => (
            <article className={styles.contrast} key={contrast.term}>
              <div>
                <span className={styles.contrastTitle}>{contrast.term}</span>
                <span className={styles.contrastLabel}>Confused with</span>
              </div>
              <p className={styles.contrastText}>{contrast.distinction}</p>
              {contrast.example && (
                <p className={styles.contrastExample}>
                  {contrast.example.nl} — {contrast.example.en}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </CardSection>
  )
}

function formatDate(value: string | null): string {
  if (!value) return 'NEVER'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'UNSCHEDULED'
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
  })
    .format(date)
    .toUpperCase()
}

function Progress({ word }: { word: WordDetail }) {
  const progress = getMasteryProgressPercentage(word.repetitionCount)
  const knowledgeLevel = getWordKnowledgeLevel(word.repetitionCount)
  const status =
    knowledgeLevel === 'new'
      ? 'New'
      : knowledgeLevel === 'established'
        ? 'Established'
        : 'Learning'

  return (
    <CardSection className={styles.progressSection} title="Progress">
      <div className={styles.progressRow}>
        <div className={styles.progressTrack}>
          <span style={{ width: `${progress}%` }} />
        </div>
        <div className={styles.progressFacts}>
          <span>EF {word.easinessFactor.toFixed(2)}</span>
          <span>Interval {word.intervalDays} d</span>
          <span>Next {formatDate(word.nextReviewDate)}</span>
          <span>Last {formatDate(word.lastReviewedAt)}</span>
        </div>
        <Badge
          tone={
            status === 'Established'
              ? 'success'
              : status === 'Learning'
                ? 'warning'
                : 'neutral'
          }
        >
          {status}
        </Badge>
      </div>
      <span className="dw-support">
        Repetition {word.repetitionCount} of {MASTERED_MIN_REPETITIONS} to
        established
      </span>
    </CardSection>
  )
}

export function WordDetailCard({
  headingLevel = 'h2',
  showProgress = true,
  word,
}: {
  headingLevel?: 'h1' | 'h2'
  showProgress?: boolean
  word: WordDetail
}) {
  const Heading = headingLevel
  const grammarBadges = [
    word.partOfSpeech,
    word.isReflexive ? 'Reflexive' : null,
    word.isSeparable && word.prefixPart && word.rootVerb
      ? `Separable · ${word.prefixPart} + ${word.rootVerb}`
      : null,
    word.preposition ? `Fixed prep · ${word.preposition}` : null,
    word.register ? `${word.register} register` : null,
    word.isIrregular ? 'Irregular' : null,
    word.isExpression ? (word.expressionType ?? 'Expression') : null,
  ].filter((value): value is string => Boolean(value))
  const displayImage = word.imageUrl && canRenderWordImage(word.imageUrl)

  return (
    <article className={styles.card}>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <div className={styles.lemmaRow}>
            <Heading className={styles.lemma}>
              {word.article && (
                <span className={styles.article}>{word.article} </span>
              )}
              {word.dutchLemma}
              {word.preposition && (
                <span className={styles.preposition}> {word.preposition}</span>
              )}
            </Heading>
            {word.ttsUrl && (
              <AudioButton label={word.dutchLemma} source={word.ttsUrl} />
            )}
          </div>

          {grammarBadges.length > 0 && (
            <div className={styles.badges}>
              {grammarBadges.map(badge => (
                <Badge
                  key={badge}
                  tone={badge.startsWith('Fixed prep') ? 'accent' : 'neutral'}
                >
                  {badge}
                </Badge>
              ))}
            </div>
          )}

          <TranslationBlock
            language="English"
            translations={word.translations.en}
          />
          <TranslationBlock
            language="Russian"
            translations={word.translations.ru}
          />
        </div>

        <div className={styles.imageColumn}>
          {displayImage && word.imageUrl ? (
            <Image
              alt={`${word.dutchLemma} — ${word.translations.en[0] ?? 'Dutch word'}`}
              className={styles.image}
              height={152}
              loading="eager"
              src={word.imageUrl}
              width={152}
            />
          ) : (
            <div className={styles.imagePlaceholder}>No image selected</div>
          )}
          {word.imageUrl && !displayImage && (
            <a
              className="dw-button dw-button--secondary"
              href={word.imageUrl}
              rel="noreferrer"
              target="_blank"
            >
              Open image
            </a>
          )}
        </div>
      </header>

      <div className={styles.body}>
        <Examples examples={word.examples} />
        <div className={styles.twoColumn}>
          <Grammar word={word} />
          <Relations word={word} />
        </div>
        <Usage word={word} />
        {word.analysisNotes && (
          <CardSection title="Analysis notes">
            <p className={styles.analysisText}>{word.analysisNotes}</p>
            <span className="dw-chip self-start">
              Cached · {formatDate(word.updatedAt ?? word.createdAt)}
            </span>
          </CardSection>
        )}
        {showProgress && <Progress word={word} />}
      </div>
    </article>
  )
}
