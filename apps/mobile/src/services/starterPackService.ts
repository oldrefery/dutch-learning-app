import dutchA1PackAsset from '@woordenaar/content'
import {
  OfficialContentValidationError,
  validateOfficialContentManifest,
} from '@woordenaar/content/manifest'
import type { Word, WordConjugation, WordExample } from '@/types/database'
import type {
  StarterPackEntry,
  StarterPackManifest,
  StarterPackValidationResult,
} from '@/types/StarterPackTypes'
import type { ImportPreviewData, ImportableWord } from '@/types/ImportTypes'

const OFFICIAL_PACK_MIN_ENTRIES = 50
const OFFICIAL_PACK_MAX_ENTRIES = 100
export const OFFICIAL_DUTCH_A1_PACK_SIZE = dutchA1PackAsset.entries.length

export class StarterPackValidationError extends OfficialContentValidationError {
  constructor(
    issues: ConstructorParameters<typeof OfficialContentValidationError>[0]
  ) {
    super(issues)
    this.name = 'StarterPackValidationError'
  }
}

export const validateStarterPackManifest = (
  value: unknown
): StarterPackValidationResult => {
  const result = validateOfficialContentManifest(value)
  return result.success
    ? { success: true, data: result.data as unknown as StarterPackManifest }
    : result
}

const toPreviewWord = (
  entry: StarterPackEntry,
  createdAt: string
): ImportableWord => ({
  word_id: entry.entry_id,
  collection_id: null,
  dutch_lemma: entry.dutch_lemma,
  dutch_original: entry.dutch_original ?? entry.dutch_lemma,
  part_of_speech: entry.part_of_speech,
  is_irregular: entry.is_irregular ?? false,
  is_reflexive: entry.is_reflexive ?? false,
  is_expression: entry.is_expression ?? false,
  expression_type: entry.expression_type ?? null,
  is_separable: entry.is_separable ?? false,
  prefix_part: entry.prefix_part ?? null,
  root_verb: entry.root_verb ?? null,
  article: entry.article ?? null,
  plural: entry.plural ?? null,
  register: entry.register ?? 'neutral',
  translations: entry.translations,
  examples: (entry.examples ?? []) as WordExample[],
  synonyms: entry.synonyms ?? [],
  antonyms: entry.antonyms ?? [],
  conjugation: (entry.conjugation ?? null) as WordConjugation | null,
  preposition: entry.preposition ?? null,
  image_url: null,
  tts_url: null,
  analysis_notes: entry.analysis_notes ?? null,
  created_at: createdAt,
  updated_at: createdAt,
})

export const loadOfficialDutchA1Pack = (): StarterPackManifest => {
  const result = validateStarterPackManifest(dutchA1PackAsset)
  if (!result.success) {
    throw new StarterPackValidationError(result.issues)
  }

  if (
    result.data.entries.length < OFFICIAL_PACK_MIN_ENTRIES ||
    result.data.entries.length > OFFICIAL_PACK_MAX_ENTRIES
  ) {
    throw new StarterPackValidationError([
      {
        path: 'entries',
        message: `official pack must contain ${OFFICIAL_PACK_MIN_ENTRIES}-${OFFICIAL_PACK_MAX_ENTRIES} entries`,
      },
    ])
  }

  return result.data
}

export const getStarterPackPreview = (
  manifest: StarterPackManifest
): ImportPreviewData => ({
  collection: {
    collection_id: manifest.pack_id,
    name: manifest.title,
    word_count: manifest.entries.length,
  },
  words: manifest.entries.map(entry =>
    toPreviewWord(entry, manifest.created_at)
  ),
})

export const createStarterPackImportWords = (
  manifest: StarterPackManifest,
  entryIds: string[],
  reviewDate: string
): Partial<Word>[] => {
  const selectedIds = new Set(entryIds)

  return manifest.entries
    .filter(entry => selectedIds.has(entry.entry_id))
    .map(entry => {
      const previewWord = toPreviewWord(entry, manifest.created_at)
      const {
        word_id: _packEntryId,
        collection_id: _packCollectionId,
        created_at: _createdAt,
        updated_at: _updatedAt,
        ...content
      } = previewWord

      return {
        ...content,
        interval_days: 0,
        repetition_count: 0,
        easiness_factor: 2.5,
        next_review_date: reviewDate,
        last_reviewed_at: null,
      }
    })
}

export const isStarterPackReleaseReady = (
  manifest: StarterPackManifest
): boolean => manifest.content_review.status === 'approved'

export const starterPackService = {
  loadOfficialDutchA1Pack,
  getStarterPackPreview,
  createStarterPackImportWords,
  isStarterPackReleaseReady,
}
