import { collectionSharingService } from '../collectionSharingService'
import { supabase } from '@/lib/supabase'

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}))

jest.mock('@/lib/sentry', () => ({
  Sentry: {
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    addBreadcrumb: jest.fn(),
  },
}))

jest.mock('@/utils/logger', () => ({
  logSupabaseError: jest.fn(),
}))

describe('collectionSharingService.getSharedCollectionWords', () => {
  const SHARE_TOKEN = 'share-token'
  const COLLECTION_ID = 'collection-id'
  const CREATED_AT = '2026-02-24T10:00:00.000Z'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('fills updated_at from created_at when database row does not include updated_at', async () => {
    jest
      .spyOn(collectionSharingService, 'getSharedCollection')
      .mockResolvedValue({
        success: true,
        data: {
          collection_id: COLLECTION_ID,
          name: 'Shared Collection',
          is_shared: true,
          share_token: SHARE_TOKEN,
          shared_at: CREATED_AT,
          word_count: 1,
        },
      })

    const order = jest.fn().mockResolvedValue({
      data: [
        {
          word_id: 'word-1',
          collection_id: COLLECTION_ID,
          dutch_lemma: 'huis',
          dutch_original: 'huis',
          part_of_speech: 'noun',
          is_irregular: false,
          is_reflexive: false,
          is_expression: false,
          expression_type: null,
          is_separable: false,
          prefix_part: null,
          root_verb: null,
          article: 'het',
          plural: 'huizen',
          translations: { en: ['house'] },
          examples: [],
          synonyms: [],
          antonyms: [],
          conjugation: null,
          preposition: null,
          image_url: null,
          tts_url: null,
          analysis_notes: null,
          created_at: CREATED_AT,
        },
      ],
      error: null,
    })
    const eq = jest.fn().mockReturnValue({ order })
    const select = jest.fn().mockReturnValue({ eq })

    ;(supabase.from as jest.Mock).mockReturnValue({ select })

    const result =
      await collectionSharingService.getSharedCollectionWords(SHARE_TOKEN)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.words).toHaveLength(1)
      expect(result.data.words[0].updated_at).toBe(CREATED_AT)
    }
  })
})
