import {
  isMissingCollectionOverviewsRpc,
  mapCollectionOverviewRow,
} from './repository'

describe('collection overview RPC adapter', () => {
  it('maps aggregate rows without changing the UI contract', () => {
    expect(
      mapCollectionOverviewRow({
        collection_id: 'collection-1',
        name: 'Travel',
        is_shared: null,
        created_at: '2026-09-12T12:00:00.000Z',
        updated_at: null,
        total_words: 7,
        mastered_words: 3,
        due_words: 2,
        difficult_words: 1,
        new_words: 4,
      })
    ).toEqual({
      id: 'collection-1',
      name: 'Travel',
      isShared: false,
      createdAt: '2026-09-12T12:00:00.000Z',
      updatedAt: null,
      totalWords: 7,
      masteredWords: 3,
      dueWords: 2,
      difficultWords: 1,
      newWords: 4,
      progressPercentage: 43,
    })
  })

  it('falls back only while the RPC is absent from the deployed schema cache', () => {
    expect(isMissingCollectionOverviewsRpc({ code: 'PGRST202' })).toBe(true)
    expect(isMissingCollectionOverviewsRpc({ code: '42883' })).toBe(true)
    expect(isMissingCollectionOverviewsRpc({ code: '42501' })).toBe(false)
    expect(isMissingCollectionOverviewsRpc(null)).toBe(false)
  })
})
