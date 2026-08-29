const { writeFile } = require('node:fs/promises')
const { createHash } = require('node:crypto')
const path = require('node:path')
const dotenv = require('dotenv')
const prettier = require('prettier')

dotenv.config({ quiet: true })

const PAGE_SIZE = 1000
const MAX_TRANSLATIONS_PER_LANGUAGE = 2
const MAX_EXAMPLES = 2
const MAX_RELATED_WORDS = 3
const REVIEWED_AT = '2026-08-29T11:36:37Z'
const SNAPSHOT_AT = REVIEWED_AT
const REVIEWED_ENTRIES_SHA256 =
  '67bce090ae7867a2b039033cd1cae067a2bd545e4fd03cb3959b2318e7a44ece'
const OUTPUT_PATH = path.resolve(
  process.cwd(),
  'src/assets/starter-packs/dutch-a1.json'
)

const SELECTED_CARDS = [
  { entryId: 'a1-001-huis', lemma: 'huis', partOfSpeech: 'noun' },
  { entryId: 'a1-002-boek', lemma: 'boek', partOfSpeech: 'noun' },
  { entryId: 'a1-003-tafel', lemma: 'tafel', partOfSpeech: 'noun' },
  { entryId: 'a1-004-stoel', lemma: 'stoel', partOfSpeech: 'noun' },
  { entryId: 'a1-005-deur', lemma: 'deur', partOfSpeech: 'noun' },
  { entryId: 'a1-006-fiets', lemma: 'fiets', partOfSpeech: 'noun' },
  { entryId: 'a1-007-trein', lemma: 'trein', partOfSpeech: 'noun' },
  { entryId: 'a1-008-auto', lemma: 'auto', partOfSpeech: 'noun' },
  { entryId: 'a1-009-stad', lemma: 'stad', partOfSpeech: 'noun' },
  { entryId: 'a1-010-straat', lemma: 'straat', partOfSpeech: 'noun' },
  { entryId: 'a1-011-winkel', lemma: 'winkel', partOfSpeech: 'noun' },
  { entryId: 'a1-012-school', lemma: 'school', partOfSpeech: 'noun' },
  { entryId: 'a1-013-werk', lemma: 'werk', partOfSpeech: 'noun' },
  { entryId: 'a1-014-familie', lemma: 'familie', partOfSpeech: 'noun' },
  { entryId: 'a1-015-vriend', lemma: 'vriend', partOfSpeech: 'noun' },
  { entryId: 'a1-016-kind', lemma: 'kind', partOfSpeech: 'noun' },
  { entryId: 'a1-017-dag', lemma: 'dag', partOfSpeech: 'noun' },
  { entryId: 'a1-018-tijd', lemma: 'tijd', partOfSpeech: 'noun' },
  { entryId: 'a1-019-water', lemma: 'water', partOfSpeech: 'noun' },
  { entryId: 'a1-020-koffie', lemma: 'koffie', partOfSpeech: 'noun' },
  { entryId: 'a1-054-adres', lemma: 'adres', partOfSpeech: 'noun' },
  { entryId: 'a1-021-zijn', lemma: 'zijn', partOfSpeech: 'verb' },
  { entryId: 'a1-022-hebben', lemma: 'hebben', partOfSpeech: 'verb' },
  { entryId: 'a1-023-gaan', lemma: 'gaan', partOfSpeech: 'verb' },
  { entryId: 'a1-024-komen', lemma: 'komen', partOfSpeech: 'verb' },
  { entryId: 'a1-025-wonen', lemma: 'wonen', partOfSpeech: 'verb' },
  { entryId: 'a1-026-werken', lemma: 'werken', partOfSpeech: 'verb' },
  { entryId: 'a1-027-leren', lemma: 'leren', partOfSpeech: 'verb' },
  { entryId: 'a1-028-spreken', lemma: 'spreken', partOfSpeech: 'verb' },
  { entryId: 'a1-029-eten', lemma: 'eten', partOfSpeech: 'verb' },
  { entryId: 'a1-030-drinken', lemma: 'drinken', partOfSpeech: 'verb' },
  { entryId: 'a1-031-lezen', lemma: 'lezen', partOfSpeech: 'verb' },
  { entryId: 'a1-032-schrijven', lemma: 'schrijven', partOfSpeech: 'verb' },
  { entryId: 'a1-033-kopen', lemma: 'kopen', partOfSpeech: 'verb' },
  { entryId: 'a1-034-betalen', lemma: 'betalen', partOfSpeech: 'verb' },
  { entryId: 'a1-035-opstaan', lemma: 'opstaan', partOfSpeech: 'verb' },
  { entryId: 'a1-036-wachten', lemma: 'wachten', partOfSpeech: 'verb' },
  { entryId: 'a1-037-houden', lemma: 'houden', partOfSpeech: 'verb' },
  { entryId: 'a1-038-luisteren', lemma: 'luisteren', partOfSpeech: 'verb' },
  { entryId: 'a1-055-blijven', lemma: 'blijven', partOfSpeech: 'verb' },
  { entryId: 'a1-056-brengen', lemma: 'brengen', partOfSpeech: 'verb' },
  { entryId: 'a1-057-denken', lemma: 'denken', partOfSpeech: 'verb' },
  { entryId: 'a1-058-koken', lemma: 'koken', partOfSpeech: 'verb' },
  { entryId: 'a1-059-slapen', lemma: 'slapen', partOfSpeech: 'verb' },
  { entryId: 'a1-060-zien', lemma: 'zien', partOfSpeech: 'verb' },
  { entryId: 'a1-039-goed', lemma: 'goed', partOfSpeech: 'adjective' },
  { entryId: 'a1-040-groot', lemma: 'groot', partOfSpeech: 'adjective' },
  { entryId: 'a1-041-klein', lemma: 'klein', partOfSpeech: 'adjective' },
  { entryId: 'a1-042-nieuw', lemma: 'nieuw', partOfSpeech: 'adjective' },
  { entryId: 'a1-043-oud', lemma: 'oud', partOfSpeech: 'adjective' },
  { entryId: 'a1-044-mooi', lemma: 'mooi', partOfSpeech: 'adjective' },
  { entryId: 'a1-045-snel', lemma: 'snel', partOfSpeech: 'adjective' },
  { entryId: 'a1-046-graag', lemma: 'graag', partOfSpeech: 'adverb' },
  {
    entryId: 'a1-047-goedemorgen',
    lemma: 'goedemorgen',
    partOfSpeech: 'interjection',
  },
  {
    entryId: 'a1-048-dank-je-wel',
    lemma: 'dank je wel',
    partOfSpeech: 'expression',
  },
  {
    entryId: 'a1-049-alsjeblieft',
    lemma: 'alsjeblieft',
    partOfSpeech: 'interjection',
  },
  {
    entryId: 'a1-050-tot-ziens',
    lemma: 'tot ziens',
    partOfSpeech: 'expression',
  },
  {
    entryId: 'a1-051-hoe-gaat-het',
    lemma: 'hoe gaat het?',
    partOfSpeech: 'expression',
  },
  {
    entryId: 'a1-052-ik-begrijp-het-niet',
    lemma: 'ik begrijp het niet',
    partOfSpeech: 'expression',
  },
  {
    entryId: 'a1-053-hoeveel-kost-dit',
    lemma: 'hoeveel kost dit?',
    partOfSpeech: 'expression',
  },
]

const REVIEWED_CONTENT_OVERRIDES = {
  'a1-015-vriend': {
    translations: { en: ['friend'] },
  },
  'a1-025-wonen': {
    translations: { en: ['to live'] },
  },
  'a1-054-adres': {
    translations: { en: ['address'] },
    examples: [{ en: 'What is your address?', nl: 'Wat is je adres?' }],
    register: 'neutral',
    synonyms: [],
    antonyms: [],
  },
  'a1-055-blijven': {
    translations: { en: ['to stay', 'to remain'] },
    examples: [
      { en: 'I am staying home today.', nl: 'Ik blijf vandaag thuis.' },
    ],
    is_irregular: true,
    register: 'neutral',
    synonyms: [],
    antonyms: [],
    conjugation: {
      present: 'blijf / blijft / blijven',
      simple_past: 'bleef',
      past_participle: 'gebleven',
      simple_past_plural: 'bleven',
    },
  },
  'a1-056-brengen': {
    translations: { en: ['to bring', 'to take'] },
    examples: [
      {
        en: 'Can you bring the book tomorrow?',
        nl: 'Kun je het boek morgen brengen?',
      },
      {
        en: 'I take my child to school.',
        nl: 'Ik breng mijn kind naar school.',
      },
    ],
    is_irregular: true,
    register: 'neutral',
    synonyms: [],
    antonyms: [],
    conjugation: {
      present: 'breng / brengt / brengen',
      simple_past: 'bracht',
      past_participle: 'gebracht',
      simple_past_plural: 'brachten',
    },
  },
  'a1-057-denken': {
    translations: { en: ['to think'] },
    examples: [
      { en: 'What do you think?', nl: 'Wat denk je?' },
      { en: 'I am thinking about my family.', nl: 'Ik denk aan mijn familie.' },
    ],
    is_irregular: true,
    register: 'neutral',
    synonyms: [],
    antonyms: [],
    conjugation: {
      present: 'denk / denkt / denken',
      simple_past: 'dacht',
      past_participle: 'gedacht',
      simple_past_plural: 'dachten',
    },
  },
  'a1-058-koken': {
    translations: { en: ['to cook', 'to boil'] },
    examples: [
      { en: 'I am cooking tonight.', nl: 'Ik kook vanavond.' },
      { en: 'The water is boiling.', nl: 'Het water kookt.' },
    ],
    register: 'neutral',
    synonyms: [],
    antonyms: [],
    conjugation: {
      present: 'kook / kookt / koken',
      simple_past: 'kookte',
      past_participle: 'gekookt',
      simple_past_plural: 'kookten',
    },
  },
  'a1-059-slapen': {
    translations: { en: ['to sleep'] },
    examples: [{ en: 'The child is sleeping.', nl: 'Het kind slaapt.' }],
    is_irregular: true,
    register: 'neutral',
    synonyms: [],
    antonyms: [],
    conjugation: {
      present: 'slaap / slaapt / slapen',
      simple_past: 'sliep',
      past_participle: 'geslapen',
      simple_past_plural: 'sliepen',
    },
  },
  'a1-060-zien': {
    translations: { en: ['to see'] },
    examples: [{ en: 'I see a bird.', nl: 'Ik zie een vogel.' }],
    is_irregular: true,
    register: 'neutral',
    synonyms: [],
    antonyms: [],
    conjugation: {
      present: 'zie / ziet / zien',
      simple_past: 'zag',
      past_participle: 'gezien',
      simple_past_plural: 'zagen',
    },
  },
  'a1-039-goed': {
    translations: { en: ['good'] },
    examples: [{ en: 'This is a good book.', nl: 'Dit is een goed boek.' }],
  },
  'a1-050-tot-ziens': {
    examples: [
      { en: 'Goodbye! Have a nice day!', nl: 'Tot ziens! Fijne dag!' },
    ],
  },
}

const DATABASE_FIELDS = [
  'dutch_lemma',
  'dutch_original',
  'part_of_speech',
  'is_irregular',
  'is_reflexive',
  'is_expression',
  'expression_type',
  'is_separable',
  'prefix_part',
  'root_verb',
  'article',
  'plural',
  'register',
  'translations',
  'examples',
  'synonyms',
  'antonyms',
  'conjugation',
  'preposition',
].join(',')

const requireEnvironment = (value, name) => {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

const normalize = value =>
  typeof value === 'string' ? value.trim().toLowerCase() : ''

const completenessScore = word => {
  const conjugationFields = word.conjugation
    ? Object.values(word.conjugation).filter(Boolean).length
    : 0

  return (
    Number((word.translations?.en?.length ?? 0) > 0) * 100 +
    Number((word.examples?.length ?? 0) > 0) * 100 +
    conjugationFields * 10 +
    Number(Boolean(word.article)) * 20 +
    Number(Boolean(word.plural)) * 20 +
    Number(Boolean(word.preposition)) * 10 +
    Number(word.is_separable && Boolean(word.prefix_part)) * 10 +
    Number(word.is_separable && Boolean(word.root_verb)) * 10
  )
}

const verbosityScore = word =>
  (word.translations?.en?.length ?? 0) * 10 +
  (word.translations?.ru?.length ?? 0) * 5 +
  (word.examples?.length ?? 0) * 20 +
  (word.synonyms?.length ?? 0) * 2 +
  (word.antonyms?.length ?? 0) * 2 +
  stableRecordKey(word).length / 1000

const stableRecordKey = word => JSON.stringify(word)

const selectBestA1Record = candidates =>
  [...candidates].sort((left, right) => {
    const completenessDifference =
      completenessScore(right) - completenessScore(left)
    if (completenessDifference !== 0) return completenessDifference

    const verbosityDifference = verbosityScore(left) - verbosityScore(right)
    if (verbosityDifference !== 0) return verbosityDifference

    return stableRecordKey(left).localeCompare(stableRecordKey(right))
  })[0]

const addOptional = (target, key, value, fallback) => {
  if (value !== undefined && value !== null && value !== fallback) {
    target[key] = value
  }
}

const buildTranslations = translations => {
  const result = {
    en: translations.en.slice(0, MAX_TRANSLATIONS_PER_LANGUAGE),
  }

  if (translations.ru?.length > 0) {
    result.ru = translations.ru.slice(0, MAX_TRANSLATIONS_PER_LANGUAGE)
  }
  return result
}

const toStarterPackEntry = (selection, word) => {
  const entry = {
    entry_id: selection.entryId,
    dutch_lemma: word.dutch_lemma,
    part_of_speech: word.part_of_speech,
    translations: buildTranslations(word.translations),
    examples: (word.examples ?? []).slice(0, MAX_EXAMPLES),
  }

  addOptional(entry, 'dutch_original', word.dutch_original, word.dutch_lemma)
  addOptional(entry, 'is_irregular', word.is_irregular, false)
  addOptional(entry, 'is_reflexive', word.is_reflexive, false)
  addOptional(entry, 'is_expression', word.is_expression, false)
  addOptional(entry, 'expression_type', word.expression_type, null)
  addOptional(entry, 'is_separable', word.is_separable, false)
  if (word.is_separable) {
    addOptional(entry, 'prefix_part', word.prefix_part, null)
    addOptional(entry, 'root_verb', word.root_verb, null)
  }
  addOptional(entry, 'article', word.article, null)
  addOptional(entry, 'plural', word.plural, null)
  addOptional(entry, 'register', word.register, null)
  addOptional(
    entry,
    'synonyms',
    word.synonyms?.slice(0, MAX_RELATED_WORDS),
    undefined
  )
  addOptional(
    entry,
    'antonyms',
    word.antonyms?.slice(0, MAX_RELATED_WORDS),
    undefined
  )
  addOptional(entry, 'conjugation', word.conjugation, null)
  addOptional(entry, 'preposition', word.preposition, null)

  return entry
}

const authenticate = async (url, anonKey, email, password) => {
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  })

  if (!response.ok) {
    throw new Error(`Supabase authentication failed with ${response.status}`)
  }

  const payload = await response.json()
  if (!payload.access_token) {
    throw new Error('Supabase authentication returned no access token')
  }
  return payload.access_token
}

const fetchLibraryWords = async (url, anonKey, accessToken) => {
  const words = []
  let offset = 0

  while (true) {
    const endpoint = new URL(`${url}/rest/v1/words`)
    endpoint.searchParams.set('select', DATABASE_FIELDS)
    endpoint.searchParams.set('order', 'dutch_lemma.asc')

    const response = await fetch(endpoint, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        Range: `${offset}-${offset + PAGE_SIZE - 1}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Words query failed with ${response.status}`)
    }

    const page = await response.json()
    words.push(...page)
    if (page.length < PAGE_SIZE) return words
    offset += PAGE_SIZE
  }
}

const getSemanticKey = word =>
  [word.dutch_lemma, word.part_of_speech, word.article].map(normalize).join('|')

const buildEntries = words =>
  SELECTED_CARDS.map(selection => {
    const candidates = words.filter(
      word =>
        normalize(word.dutch_lemma) === normalize(selection.lemma) &&
        normalize(word.part_of_speech) === normalize(selection.partOfSpeech)
    )

    if (candidates.length === 0) {
      throw new Error(
        `No database card found for ${selection.lemma} (${selection.partOfSpeech})`
      )
    }

    return {
      ...toStarterPackEntry(selection, selectBestA1Record(candidates)),
      ...REVIEWED_CONTENT_OVERRIDES[selection.entryId],
    }
  })

const assertReviewedEntriesIntegrity = entries => {
  const digest = createHash('sha256')
    .update(JSON.stringify(entries))
    .digest('hex')

  if (digest !== REVIEWED_ENTRIES_SHA256) {
    throw new Error(
      'Generated entries differ from the reviewed release. Restore the reviewed source data or complete a new content review before updating the digest.'
    )
  }
}

const buildManifest = (words, entries) => ({
  schema_version: 1,
  pack_id: 'official-dutch-a1-essentials',
  version: '0.2.0',
  title: 'Dutch A1 Essentials',
  description:
    'A curated offline starter set of 60 high-value cards selected from the existing project word library.',
  source_language: 'nl',
  translation_languages: [
    'en',
    ...(entries.some(entry => entry.translations.ru?.length > 0) ? ['ru'] : []),
  ],
  created_at: SNAPSHOT_AT,
  license: {
    name: 'Existing project library content — all rights reserved',
    url: null,
    notes:
      'Linguistic card fields were selected from the project word library. Distribution is limited to the application and its source repository unless the project owner grants additional permission.',
  },
  provenance: {
    origin: 'existing-project-library',
    source_snapshot_at: SNAPSHOT_AT,
    source_card_count: words.length,
    source_unique_semantic_count: new Set(words.map(getSemanticKey)).size,
    selection_method:
      'Manual A1 utility curation followed by deterministic selection of the most complete and concise matching database record for each lemma and part of speech. Reviewed overrides simplify ambiguous records, and a SHA-256 integrity gate prevents database changes from silently altering the approved release.',
    notes:
      'Only linguistic fields were copied into this bundled snapshot. User identifiers, collection ownership, timestamps, media URLs, and learner progression were excluded.',
    excluded_sources: [
      'Memorila decks',
      'Memrise courses',
      'Anki community decks',
      'other proprietary flashcard decks',
    ],
  },
  content_review: {
    status: 'approved',
    reviewed_by: 'internal-dutch-content-review',
    reviewed_at: REVIEWED_AT,
    notes:
      'Project-owner-authorized internal editorial review checked all 60 entries for spelling, grammar, A1 utility, translation accuracy, examples, metadata, and duplicate scope. Misleading secondary senses and advanced examples were removed or simplified.',
  },
  entries,
})

const main = async () => {
  const url = requireEnvironment(
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    'EXPO_PUBLIC_SUPABASE_URL'
  )
  const anonKey = requireEnvironment(
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    'EXPO_PUBLIC_SUPABASE_ANON_KEY'
  )
  const email = requireEnvironment(
    process.env.EXPO_PUBLIC_DEV_USER_EMAIL,
    'EXPO_PUBLIC_DEV_USER_EMAIL'
  )
  const password = requireEnvironment(
    process.env.EXPO_PUBLIC_DEV_USER_PASSWORD,
    'EXPO_PUBLIC_DEV_USER_PASSWORD'
  )
  const accessToken = await authenticate(url, anonKey, email, password)
  const words = await fetchLibraryWords(url, anonKey, accessToken)
  const entries = buildEntries(words)
  assertReviewedEntriesIntegrity(entries)
  const manifest = buildManifest(words, entries)
  const output = await prettier.format(JSON.stringify(manifest), {
    parser: 'json',
  })

  await writeFile(OUTPUT_PATH, output)
  console.log(
    `Generated ${entries.length} starter cards from ${words.length} database cards.`
  )
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Generation failed')
  process.exitCode = 1
})
