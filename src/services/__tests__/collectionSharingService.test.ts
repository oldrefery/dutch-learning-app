import {
  collectionSharingService,
  CollectionSharingError,
} from '../collectionSharingService'
import { supabase } from '@/lib/supabase'
import { Sentry } from '@/lib/sentry'
import { logSupabaseError } from '@/utils/logger'

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

describe('collectionSharingService.shareCollection', () => {
  const COLLECTION_ID = 'col-123'
  const USER_ID = 'user-123'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return share_token on success', async () => {
    const mockSingle = jest
      .fn()
      .mockResolvedValue({ data: { share_token: 'token-abc' }, error: null })
    const mockSelect = jest.fn().mockReturnValue({ single: mockSingle })
    const mockEq2 = jest.fn().mockReturnValue({ select: mockSelect })
    const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 })
    const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq1 })
    ;(supabase.from as jest.Mock).mockReturnValue({ update: mockUpdate })

    const result = await collectionSharingService.shareCollection(
      COLLECTION_ID,
      USER_ID
    )

    expect(result).toEqual({ success: true, data: 'token-abc' })
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'collection' })
    )
  })

  it('should return NOT_FOUND when collection not found (PGRST116)', async () => {
    const mockSingle = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'Not found', code: 'PGRST116', details: '', hint: '' },
    })
    const mockSelect = jest.fn().mockReturnValue({ single: mockSingle })
    const mockEq2 = jest.fn().mockReturnValue({ select: mockSelect })
    const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 })
    const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq1 })
    ;(supabase.from as jest.Mock).mockReturnValue({ update: mockUpdate })

    const result = await collectionSharingService.shareCollection(
      COLLECTION_ID,
      USER_ID
    )

    expect(result).toEqual({
      success: false,
      error: CollectionSharingError.NOT_FOUND,
    })
    expect(logSupabaseError).toHaveBeenCalled()
  })

  it('should return DATABASE_ERROR on other Supabase errors', async () => {
    const mockSingle = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'DB err', code: '42000', details: '', hint: '' },
    })
    const mockSelect = jest.fn().mockReturnValue({ single: mockSingle })
    const mockEq2 = jest.fn().mockReturnValue({ select: mockSelect })
    const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 })
    const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq1 })
    ;(supabase.from as jest.Mock).mockReturnValue({ update: mockUpdate })

    const result = await collectionSharingService.shareCollection(
      COLLECTION_ID,
      USER_ID
    )

    expect(result).toEqual({
      success: false,
      error: CollectionSharingError.DATABASE_ERROR,
    })
  })

  it('should return TOKEN_GENERATION_FAILED when share_token is null', async () => {
    const mockSingle = jest
      .fn()
      .mockResolvedValue({ data: { share_token: null }, error: null })
    const mockSelect = jest.fn().mockReturnValue({ single: mockSingle })
    const mockEq2 = jest.fn().mockReturnValue({ select: mockSelect })
    const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 })
    const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq1 })
    ;(supabase.from as jest.Mock).mockReturnValue({ update: mockUpdate })

    const result = await collectionSharingService.shareCollection(
      COLLECTION_ID,
      USER_ID
    )

    expect(result).toEqual({
      success: false,
      error: CollectionSharingError.TOKEN_GENERATION_FAILED,
    })
    expect(Sentry.captureMessage).toHaveBeenCalled()
  })

  it('should return UNKNOWN_ERROR on unexpected exception', async () => {
    ;(supabase.from as jest.Mock).mockImplementation(() => {
      throw new Error('Unexpected')
    })

    const result = await collectionSharingService.shareCollection(
      COLLECTION_ID,
      USER_ID
    )

    expect(result).toEqual({
      success: false,
      error: CollectionSharingError.UNKNOWN_ERROR,
    })
    expect(Sentry.captureException).toHaveBeenCalled()
  })
})

describe('collectionSharingService.unshareCollection', () => {
  const COLLECTION_ID = 'col-123'
  const USER_ID = 'user-123'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return success on successful unshare', async () => {
    const mockEq2 = jest.fn().mockResolvedValue({ error: null })
    const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 })
    const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq1 })
    ;(supabase.from as jest.Mock).mockReturnValue({ update: mockUpdate })

    const result = await collectionSharingService.unshareCollection(
      COLLECTION_ID,
      USER_ID
    )

    expect(result).toEqual({ success: true, data: undefined })
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Collection unshared successfully' })
    )
  })

  it('should return DATABASE_ERROR on Supabase error', async () => {
    const mockEq2 = jest.fn().mockResolvedValue({
      error: { message: 'Error', code: '42000', details: '', hint: '' },
    })
    const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 })
    const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq1 })
    ;(supabase.from as jest.Mock).mockReturnValue({ update: mockUpdate })

    const result = await collectionSharingService.unshareCollection(
      COLLECTION_ID,
      USER_ID
    )

    expect(result).toEqual({
      success: false,
      error: CollectionSharingError.DATABASE_ERROR,
    })
  })

  it('should return UNKNOWN_ERROR on exception', async () => {
    ;(supabase.from as jest.Mock).mockImplementation(() => {
      throw new Error('Crash')
    })

    const result = await collectionSharingService.unshareCollection(
      COLLECTION_ID,
      USER_ID
    )

    expect(result).toEqual({
      success: false,
      error: CollectionSharingError.UNKNOWN_ERROR,
    })
  })
})

describe('collectionSharingService.getSharedCollection', () => {
  const SHARE_TOKEN = 'token-abc'

  beforeEach(() => {
    jest.restoreAllMocks()
    jest.clearAllMocks()
  })

  it('should return shared collection data with word count', async () => {
    // First query: collection
    const mockMaybeSingle = jest.fn().mockResolvedValue({
      data: {
        collection_id: 'col-1',
        name: 'Shared',
        is_shared: true,
        share_token: SHARE_TOKEN,
        shared_at: '2025-01-01',
      },
      error: null,
    })
    const mockEq2 = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
    const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 })
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq1 })

    // Second query: word count
    const mockCountEq = jest.fn().mockResolvedValue({ count: 5, error: null })
    const mockCountSelect = jest.fn().mockReturnValue({ eq: mockCountEq })

    let callCount = 0
    ;(supabase.from as jest.Mock).mockImplementation(() => {
      callCount++
      if (callCount === 1) return { select: mockSelect }
      return { select: mockCountSelect }
    })

    const result =
      await collectionSharingService.getSharedCollection(SHARE_TOKEN)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('Shared')
      expect(result.data.word_count).toBe(5)
    }
  })

  it('should return NOT_FOUND when collection not found', async () => {
    const mockMaybeSingle = jest
      .fn()
      .mockResolvedValue({ data: null, error: null })
    const mockEq2 = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
    const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 })
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq1 })
    ;(supabase.from as jest.Mock).mockReturnValue({ select: mockSelect })

    const result =
      await collectionSharingService.getSharedCollection(SHARE_TOKEN)

    expect(result).toEqual({
      success: false,
      error: CollectionSharingError.NOT_FOUND,
    })
  })

  it('should return DATABASE_ERROR on query error', async () => {
    const mockMaybeSingle = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'Error', code: '500', details: '', hint: '' },
    })
    const mockEq2 = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
    const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 })
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq1 })
    ;(supabase.from as jest.Mock).mockReturnValue({ select: mockSelect })

    const result =
      await collectionSharingService.getSharedCollection(SHARE_TOKEN)

    expect(result).toEqual({
      success: false,
      error: CollectionSharingError.DATABASE_ERROR,
    })
  })

  it('should return UNKNOWN_ERROR on exception', async () => {
    ;(supabase.from as jest.Mock).mockImplementation(() => {
      throw new Error('Crash')
    })

    const result =
      await collectionSharingService.getSharedCollection(SHARE_TOKEN)

    expect(result).toEqual({
      success: false,
      error: CollectionSharingError.UNKNOWN_ERROR,
    })
  })
})

describe('collectionSharingService.getCollectionShareStatus', () => {
  const COLLECTION_ID = 'col-123'
  const USER_ID = 'user-123'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return share status on success', async () => {
    const mockMaybeSingle = jest.fn().mockResolvedValue({
      data: {
        is_shared: true,
        share_token: 'token-xyz',
        shared_at: '2025-01-01',
      },
      error: null,
    })
    const mockEq2 = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
    const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 })
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq1 })
    ;(supabase.from as jest.Mock).mockReturnValue({ select: mockSelect })

    const result = await collectionSharingService.getCollectionShareStatus(
      COLLECTION_ID,
      USER_ID
    )

    expect(result).toEqual({
      success: true,
      data: {
        is_shared: true,
        share_token: 'token-xyz',
        shared_at: '2025-01-01',
      },
    })
  })

  it('should return NOT_FOUND when collection not found', async () => {
    const mockMaybeSingle = jest
      .fn()
      .mockResolvedValue({ data: null, error: null })
    const mockEq2 = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
    const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 })
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq1 })
    ;(supabase.from as jest.Mock).mockReturnValue({ select: mockSelect })

    const result = await collectionSharingService.getCollectionShareStatus(
      COLLECTION_ID,
      USER_ID
    )

    expect(result).toEqual({
      success: false,
      error: CollectionSharingError.NOT_FOUND,
    })
  })

  it('should return DATABASE_ERROR on query error', async () => {
    const mockMaybeSingle = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'Error', code: '500', details: '', hint: '' },
    })
    const mockEq2 = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
    const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 })
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq1 })
    ;(supabase.from as jest.Mock).mockReturnValue({ select: mockSelect })

    const result = await collectionSharingService.getCollectionShareStatus(
      COLLECTION_ID,
      USER_ID
    )

    expect(result).toEqual({
      success: false,
      error: CollectionSharingError.DATABASE_ERROR,
    })
  })

  it('should default is_shared to false when null', async () => {
    const mockMaybeSingle = jest.fn().mockResolvedValue({
      data: { is_shared: null, share_token: null, shared_at: null },
      error: null,
    })
    const mockEq2 = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
    const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 })
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq1 })
    ;(supabase.from as jest.Mock).mockReturnValue({ select: mockSelect })

    const result = await collectionSharingService.getCollectionShareStatus(
      COLLECTION_ID,
      USER_ID
    )

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.is_shared).toBe(false)
    }
  })
})

describe('collectionSharingService URL generators', () => {
  it('should generate deep link share URL', () => {
    const url = collectionSharingService.generateShareUrl('abc123')

    expect(url).toBe('dutchlearning://share/abc123')
  })

  it('should generate web share URL', () => {
    const url = collectionSharingService.generateWebShareUrl('abc123')

    expect(url).toBe('https://dutch-learning-app.vercel.app/share/abc123')
  })
})
