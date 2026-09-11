import { normalize } from './snapshot.mjs'

export const levels = ['A1', 'A2', 'B1', 'B2', 'C1']
const prefixes = {
  noun: 'N',
  verb: 'WW',
  adjective: 'ADJ',
  adverb: 'BW',
  pronoun: 'VNW',
  preposition: 'VZ',
  conjunction: 'VG',
  interjection: 'TSW',
  numeral: 'TW',
  article: 'LID',
}

function numberOrMissing(value) {
  if (value === '-') return null
  if (!value?.trim() || !Number.isFinite(Number(value)) || Number(value) < 0) {
    throw new Error('Invalid frequency in NT2Lex')
  }
  return Number(value)
}

export function parseLexicon(text) {
  const [header, ...lines] = text
    .replace(/^\uFEFF/u, '')
    .trimEnd()
    .split(/\r?\n/u)
  const columns = header.split('\t')
  const required = [
    'word',
    'tag',
    'F@TOTAL',
    ...levels.map(level => `F@${level}`),
  ]
  if (required.some(name => !columns.includes(name)))
    throw new Error('Unsupported NT2Lex header')
  const index = new Map()
  for (const line of lines) {
    const values = line.split('\t')
    if (values.length !== columns.length)
      throw new Error('Invalid NT2Lex row width')
    const row = Object.fromEntries(
      columns.map((key, position) => [key, values[position]])
    )
    const lemma = normalize(row.word)
    if (!lemma || !row.tag) throw new Error('Missing NT2Lex lemma or tag')
    const entry = {
      word: row.word,
      tag: row.tag,
      totalCount: numberOrMissing(row['F@TOTAL']),
      counts: Object.fromEntries(
        levels.map(level => [level, numberOrMissing(row[`F@${level}`])])
      ),
    }
    index.set(lemma, [...(index.get(lemma) ?? []), entry])
  }
  return index
}

export function matchEvidence(card, index) {
  const candidates = index.get(normalize(card.dutch_lemma)) ?? []
  const prefix = prefixes[normalize(card.part_of_speech)]
  // Do not attach one component's POS to a whole multiword expression.
  const matches = candidates.filter(
    row => prefix && row.tag.startsWith(`${prefix}(`) && !row.tag.includes(' ')
  )
  let matchType = 'missing'
  if (candidates.length) matchType = 'lemma-only-review-required'
  if (matches.length) matchType = 'lemma-and-pos'
  return {
    matchType,
    senseVerified: false,
    rows: matches.length ? matches : candidates,
    // Occurrence in a graded text is not a per-sense CEFR assignment.
    estimatedCefr: null,
    frequencyScope: 'graded-reading-corpus; not general everyday frequency',
  }
}
