import { parseAnalysisHistory } from './analysis-history'

describe('analysis history', () => {
  it('accepts valid entries and rejects malformed browser data', () => {
    const history = parseAnalysisHistory(
      JSON.stringify([
        {
          id: 'entry-1',
          input: 'Het huis',
          dutchLemma: 'huis',
          analyzedAt: '2026-08-30T12:00:00.000Z',
          cacheHit: true,
          collectionName: 'Essentials',
          source: 'cache',
        },
        { id: 'invalid' },
      ])
    )

    expect(history).toEqual([
      {
        id: 'entry-1',
        input: 'Het huis',
        dutchLemma: 'huis',
        analyzedAt: '2026-08-30T12:00:00.000Z',
        cacheHit: true,
        collectionName: 'Essentials',
        source: 'cache',
      },
    ])
  })

  it('returns a safe empty snapshot for corrupt JSON', () => {
    expect(parseAnalysisHistory('{')).toEqual([])
  })
})
