import {
  getNextBatchCaptureItem,
  isBatchCaptureFinished,
  normalizeBatchDutchText,
  parseBatchCaptureInput,
} from '@/utils/batchCapture'
import type { BatchCaptureItem } from '@/types/BatchCaptureTypes'

const createItem = (
  id: string,
  status: BatchCaptureItem['status']
): BatchCaptureItem => ({
  id,
  dutchText: id,
  translationHint: null,
  sourceLine: 1,
  status,
  error: null,
  duplicate: null,
  createdAt: '2026-08-29T00:00:00.000Z',
  updatedAt: '2026-08-29T00:00:00.000Z',
})

describe('batchCapture', () => {
  it('parses words and optional translation hints', () => {
    const result = parseBatchCaptureInput(
      ` huis. ; home\n\nGoedemorgen\n  tot   ziens ; see you `
    )

    expect(result).toEqual({
      items: [
        { dutchText: 'huis', translationHint: 'home', sourceLine: 1 },
        {
          dutchText: 'Goedemorgen',
          translationHint: null,
          sourceLine: 3,
        },
        {
          dutchText: 'tot ziens',
          translationHint: 'see you',
          sourceLine: 4,
        },
      ],
      issues: [],
      hasBlockingIssues: false,
    })
  })

  it('ignores case-insensitive duplicates and reports their source line', () => {
    const result = parseBatchCaptureInput('Huis\nhuis. ; house\nboek')

    expect(result.items.map(item => item.dutchText)).toEqual(['Huis', 'boek'])
    expect(result.issues).toEqual([
      expect.objectContaining({
        line: 2,
        code: 'duplicate',
        blocking: false,
      }),
    ])
    expect(result.hasBlockingIssues).toBe(false)
  })

  it('rejects malformed rows and enforces the limit before processing', () => {
    const tooMany = Array.from({ length: 31 }, (_, index) => `woord ${index}`)
    const result = parseBatchCaptureInput(`; missing\n${tooMany.join('\n')}`)

    expect(result.items).toHaveLength(30)
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'missing_word', blocking: true }),
        expect.objectContaining({ code: 'limit_exceeded', blocking: true }),
      ])
    )
    expect(result.hasBlockingIssues).toBe(true)
  })

  it('normalizes Dutch input consistently with single-word analysis', () => {
    expect(normalizeBatchDutchText('  hoe   gaat het?.  ')).toBe(
      'hoe gaat het?'
    )
  })

  it('selects only queued work and recognizes terminal queues', () => {
    const items = [
      createItem('one', 'completed'),
      createItem('two', 'possible_duplicate'),
      createItem('three', 'queued'),
    ]

    expect(getNextBatchCaptureItem(items)?.id).toBe('three')
    expect(isBatchCaptureFinished(items)).toBe(false)
    expect(
      isBatchCaptureFinished([
        createItem('one', 'completed'),
        createItem('two', 'skipped'),
        createItem('three', 'cancelled'),
      ])
    ).toBe(true)
  })
})
