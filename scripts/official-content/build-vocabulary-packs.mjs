import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import {
  canonicalizeOfficialContent,
  validateOfficialContentManifest,
} from '../../packages/content/src/manifest.ts'

const EXPECTED_PLAN_SHA256 =
  '1f1b5a14735aecd3d63ca7da293dddeebf86259accc632977d3863c76f895123'
const PACK_VERSION = '1.0.0'
const FORBIDDEN_PUBLIC_LEMMAS = new Set([
  'hottentot',
  'klit',
  'mongool',
  'piemel',
  'rukken',
  'swaffelen',
])

const sha256 = value => createHash('sha256').update(value).digest('hex')

const optionalText = value => {
  const text = typeof value === 'string' ? value.trim() : ''
  return text === '' ? undefined : text
}

const nullableText = value => optionalText(value) ?? null

const textArray = value =>
  Array.isArray(value) ? value.map(optionalText).filter(Boolean) : []

export const parseSnapshotCsv = raw => {
  const newline = raw.indexOf('\n')
  if (newline < 0 || raw.slice(0, newline).trim() !== 'snapshot') {
    throw new Error('Unexpected vocabulary snapshot CSV header.')
  }
  let cell = raw.slice(newline + 1).trim()
  if (!cell.startsWith('"') || !cell.endsWith('"')) {
    throw new Error('Unexpected vocabulary snapshot CSV payload.')
  }
  cell = cell.slice(1, -1).replaceAll('""', '"')
  return JSON.parse(cell)
}

const derivePrefix = card => {
  const lemma = optionalText(card.dutch_lemma)
  const root = optionalText(card.root_verb)
  if (!lemma || !root) {
    throw new Error(`Separable verb ${lemma ?? '(unknown)'} has no root verb.`)
  }
  if (lemma.endsWith(root) && lemma.length > root.length) {
    return lemma.slice(0, -root.length)
  }
  const documentedPrefix = optionalText(card.analysis_notes)?.match(
    /prefix\s+[‘'“"]?([a-zà-ÿ]+)-[’'”"]?/iu
  )?.[1]
  if (documentedPrefix) return documentedPrefix
  throw new Error(`Could not derive a separable prefix for ${lemma}.`)
}

const buildEntryId = (packId, card) => {
  const identity = canonicalizeOfficialContent({
    article: card.article ?? null,
    dutch_lemma: card.dutch_lemma,
    part_of_speech: card.part_of_speech,
    translations: card.translations,
  })
  return `${packId}-${sha256(identity).slice(0, 16)}`
}

export const sanitizeCard = (packId, card) => {
  const dutchLemma = optionalText(card.dutch_lemma)
  const partOfSpeech = optionalText(card.part_of_speech)
  const englishTranslations = textArray(card.translations?.en)
  if (!dutchLemma || !partOfSpeech || englishTranslations.length === 0) {
    throw new Error(`Card ${card.word_id ?? '(unknown)'} is incomplete.`)
  }

  const entry = {
    entry_id: buildEntryId(packId, card),
    dutch_lemma: dutchLemma,
    dutch_original: nullableText(card.dutch_original),
    part_of_speech: partOfSpeech,
    translations: {
      en: englishTranslations,
      ...(textArray(card.translations?.ru).length > 0
        ? { ru: textArray(card.translations.ru) }
        : {}),
    },
    examples: (card.examples ?? []).map(example => ({
      nl: optionalText(example.nl),
      en: optionalText(example.en),
      ...(optionalText(example.ru) ? { ru: optionalText(example.ru) } : {}),
    })),
    is_reflexive: card.is_reflexive === true,
    is_expression: card.is_expression === true,
    expression_type: nullableText(card.expression_type),
    is_separable: card.is_separable === true,
    root_verb: nullableText(card.root_verb),
    article: card.article ?? null,
    register: card.register ?? null,
    preposition: nullableText(card.preposition),
    analysis_notes: nullableText(card.analysis_notes),
  }
  if (entry.is_separable) entry.prefix_part = derivePrefix(card)
  return entry
}

export const buildPackManifest = ({
  collection,
  cards,
  snapshot,
  mappedCardCount,
}) => {
  const packId = `dutch-${collection.targetKey.toLowerCase()}`
  const number = collection.targetKey.split('-')[1]
  const manifest = {
    schema_version: 1,
    pack_id: packId,
    version: PACK_VERSION,
    title: `Dutch ${collection.level} · Pack ${number}`,
    description: `A frequency-ordered Dutch ${collection.level} vocabulary pack with ${cards.length} words.`,
    source_language: 'nl',
    translation_languages: ['en', 'ru'],
    created_at: snapshot.capturedAt,
    license: {
      name: 'Woordenaar official content',
      url: null,
      notes: 'May be imported and studied inside Woordenaar.',
    },
    provenance: {
      origin: 'existing-project-library',
      source_snapshot_at: snapshot.capturedAt,
      source_card_count: snapshot.cards.length,
      source_unique_semantic_count: mappedCardCount,
      selection_method:
        'CEFR classification followed by descending Dutch usage frequency and balanced groups.',
      notes:
        'Generated from reviewed project vocabulary. Personal ownership, collection IDs, progress, SRS state, media, and timestamps are excluded.',
      excluded_sources: [
        'Protected personal expression collections',
        'Owner-excluded sensitive vocabulary',
        'Personal learning and synchronization metadata',
      ],
    },
    content_review: {
      status: 'pending',
      reviewed_by: null,
      reviewed_at: null,
      notes:
        'Automated schema, integrity, exclusion, and deterministic-build checks passed; final editorial approval is pending.',
    },
    entries: cards.map(card => sanitizeCard(packId, card)),
  }
  const validation = validateOfficialContentManifest(manifest)
  if (!validation.success) {
    throw new Error(
      `Invalid ${packId}: ${validation.issues
        .map(issue => `${issue.path} ${issue.message}`)
        .join('; ')}`
    )
  }
  return validation.data
}

const assertSafePublicContent = manifests => {
  const ids = new Set()
  for (const manifest of manifests) {
    for (const entry of manifest.entries) {
      const lemma = entry.dutch_lemma.trim().toLocaleLowerCase('nl')
      if (FORBIDDEN_PUBLIC_LEMMAS.has(lemma)) {
        throw new Error(`Forbidden public lemma found: ${entry.dutch_lemma}`)
      }
      if (ids.has(entry.entry_id)) {
        throw new Error(`Duplicate public entry ID: ${entry.entry_id}`)
      }
      ids.add(entry.entry_id)
    }
  }
}

const argument = (name, fallback) => {
  const index = process.argv.indexOf(name)
  return index < 0 ? fallback : process.argv[index + 1]
}

export const buildVocabularyPacks = async ({
  snapshotPath,
  planPath,
  outDir,
}) => {
  const [snapshotBytes, planBytes] = await Promise.all([
    readFile(snapshotPath, 'utf8'),
    readFile(planPath),
  ])
  const planDigest = sha256(planBytes)
  if (planDigest !== EXPECTED_PLAN_SHA256) {
    throw new Error(`Unexpected collection plan hash: ${planDigest}`)
  }
  const snapshot = parseSnapshotCsv(snapshotBytes)
  const plan = JSON.parse(planBytes)
  if (plan.productionWrites !== 0 || !plan.dryRun) {
    throw new Error('The collection plan is not a verified dry run.')
  }

  const cardById = new Map(snapshot.cards.map(card => [card.word_id, card]))
  const mappingsByTarget = Map.groupBy(
    plan.mappings,
    mapping => mapping.targetKey
  )
  const manifests = plan.targetCollections.map(collection => {
    const mappings = mappingsByTarget.get(collection.targetKey) ?? []
    const cards = mappings.map(mapping => {
      const card = cardById.get(mapping.wordId)
      if (!card) throw new Error(`Missing source card ${mapping.wordId}.`)
      return card
    })
    if (cards.length !== collection.cardCount) {
      throw new Error(`Unexpected card count for ${collection.targetKey}.`)
    }
    return buildPackManifest({
      collection,
      cards,
      snapshot,
      mappedCardCount: plan.mappings.length,
    })
  })
  assertSafePublicContent(manifests)

  await mkdir(outDir, { recursive: true, mode: 0o700 })
  const files = []
  for (const manifest of manifests) {
    const filename = `${manifest.pack_id}-${manifest.version}.json`
    const serialized = `${JSON.stringify(manifest, null, 2)}\n`
    await writeFile(path.join(outDir, filename), serialized, { mode: 0o600 })
    files.push({
      packId: manifest.pack_id,
      version: manifest.version,
      filename,
      entryCount: manifest.entries.length,
      contentSha256: sha256(canonicalizeOfficialContent(manifest)),
      fileSha256: sha256(serialized),
    })
  }

  const catalog = plan.targetCollections.map((collection, index) => {
    const manifest = manifests[index]
    return {
      pack_id: manifest.pack_id,
      slug: manifest.pack_id,
      title: manifest.title,
      description: manifest.description,
      cefr_level: collection.level,
      display_order: index + 1,
      version: manifest.version,
      entry_count: manifest.entries.length,
      content_sha256: files[index].contentSha256,
      review_status: 'draft',
    }
  })
  const indexDocument = {
    schemaVersion: 1,
    generatedFromPlanSha256: planDigest,
    productionWrites: 0,
    packCount: manifests.length,
    entryCount: manifests.reduce((sum, item) => sum + item.entries.length, 0),
    forbiddenPublicLemmas: [...FORBIDDEN_PUBLIC_LEMMAS].sort(),
    catalog,
    files,
  }
  const indexSerialized = `${JSON.stringify(indexDocument, null, 2)}\n`
  await writeFile(path.join(outDir, 'index.json'), indexSerialized, {
    mode: 0o600,
  })
  return indexDocument
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  const root = process.cwd()
  const index = await buildVocabularyPacks({
    snapshotPath: argument(
      '--snapshot',
      path.join(root, 'reports/vocabulary-organization/snapshot-2026-09-07.csv')
    ),
    planPath: argument(
      '--plan',
      path.join(
        root,
        'reports/vocabulary-organization/collection-plan-proposal-003-2026-09-11.json'
      )
    ),
    outDir: argument(
      '--out',
      path.join(
        root,
        'reports/vocabulary-organization/official-content-drafts-2026-09-11'
      )
    ),
  })
  console.log(
    JSON.stringify(
      {
        packCount: index.packCount,
        entryCount: index.entryCount,
        productionWrites: index.productionWrites,
      },
      null,
      2
    )
  )
}
