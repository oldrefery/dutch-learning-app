import { analyzeForCollection } from './analyze-for-collection'
import { lookupPublishedMeanings } from './dictionary-meaning-lookup'
import { analyzeWordWithAi } from './analysis-client'
import { transferSession } from '@/features/sharing/__fixtures__/following-transfer'
jest.mock('./dictionary-meaning-lookup', () => ({
  lookupPublishedMeanings: jest.fn(),
}))
jest.mock('./analysis-client', () => ({ analyzeWordWithAi: jest.fn() }))
const original = transferSession().document
const empty = { ...original, entries: [] }
it('uses published meanings without a provider request', async () => {
  jest.mocked(lookupPublishedMeanings).mockResolvedValue(original)
  expect(await analyzeForCollection('owner', 'huis', true)).toEqual({
    kind: 'published',
    document: original,
  })
  expect(analyzeWordWithAi).not.toHaveBeenCalled()
})
it('matches the supplied article and preserves all matching senses', async () => {
  jest
    .mocked(lookupPublishedMeanings)
    .mockResolvedValueOnce(empty)
    .mockResolvedValueOnce(original)
  expect(await analyzeForCollection('owner', 'het huis', true)).toMatchObject({
    kind: 'published',
    document: {
      entries: original.entries.filter(e => e.content.article === 'het'),
    },
  })
  expect(analyzeWordWithAi).not.toHaveBeenCalled()
})
it.each([true, false])(
  'uses ordinary cache-first analysis after a miss (cache hit %s)',
  async cacheHit => {
    jest.mocked(lookupPublishedMeanings).mockResolvedValue(empty)
    jest
      .mocked(analyzeWordWithAi)
      .mockResolvedValue({ metadata: { cacheHit } } as never)
    expect(await analyzeForCollection('owner', 'lopen', true)).toMatchObject({
      kind: 'analysis',
      metadata: { cacheHit },
    })
    expect(analyzeWordWithAi).toHaveBeenCalledWith('owner', 'lopen')
  }
)
it('does not treat a failed lookup as a cache miss', async () => {
  jest.mocked(lookupPublishedMeanings).mockRejectedValue(new Error('offline'))
  await expect(analyzeForCollection('owner', 'huis', true)).rejects.toThrow(
    'offline'
  )
  expect(analyzeWordWithAi).not.toHaveBeenCalled()
})
