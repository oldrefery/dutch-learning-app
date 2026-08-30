export const BATCH_CAPTURE_MAX_ITEMS = 30
export const BATCH_CAPTURE_MAX_DUTCH_LENGTH = 120
export const BATCH_CAPTURE_MAX_HINT_LENGTH = 240

export type BatchCaptureItemStatus =
  | 'queued'
  | 'checking_duplicate'
  | 'possible_duplicate'
  | 'analyzing'
  | 'awaiting_review'
  | 'failed'
  | 'completed'
  | 'skipped'
  | 'cancelled'

export interface BatchCaptureDraftItem {
  dutchText: string
  translationHint: string | null
  sourceLine: number
}

export type BatchCaptureParseIssueCode =
  | 'missing_word'
  | 'word_too_long'
  | 'hint_too_long'
  | 'duplicate'
  | 'limit_exceeded'

export interface BatchCaptureParseIssue {
  line: number
  code: BatchCaptureParseIssueCode
  message: string
  blocking: boolean
}

export interface BatchCaptureParseResult {
  items: BatchCaptureDraftItem[]
  issues: BatchCaptureParseIssue[]
  hasBlockingIssues: boolean
}

export interface BatchCaptureDuplicate {
  wordId: string
  collectionId: string | null
  collectionName: string | null
}

export interface BatchCaptureItem extends BatchCaptureDraftItem {
  id: string
  status: BatchCaptureItemStatus
  error: string | null
  duplicate: BatchCaptureDuplicate | null
  createdAt: string
  updatedAt: string
}

export const normalizeBatchDutchText = (value: string): string =>
  value.trim().replace(/\./g, '').replace(/\s+/g, ' ')

const normalizeHint = (value: string): string | null => {
  const normalized = value.trim().replace(/\s+/g, ' ')
  return normalized === '' ? null : normalized
}

const parseLine = (
  rawLine: string,
  sourceLine: number
): {
  item: BatchCaptureDraftItem | null
  issue: BatchCaptureParseIssue | null
} => {
  const separatorIndex = rawLine.indexOf(';')
  const rawDutch =
    separatorIndex === -1 ? rawLine : rawLine.slice(0, separatorIndex)
  const rawHint = separatorIndex === -1 ? '' : rawLine.slice(separatorIndex + 1)
  const dutchText = normalizeBatchDutchText(rawDutch)
  const translationHint = normalizeHint(rawHint)

  if (dutchText === '') {
    return {
      item: null,
      issue: {
        line: sourceLine,
        code: 'missing_word',
        message: 'Enter a Dutch word before the semicolon.',
        blocking: true,
      },
    }
  }

  if (dutchText.length > BATCH_CAPTURE_MAX_DUTCH_LENGTH) {
    return {
      item: null,
      issue: {
        line: sourceLine,
        code: 'word_too_long',
        message: `Dutch text must be ${BATCH_CAPTURE_MAX_DUTCH_LENGTH} characters or fewer.`,
        blocking: true,
      },
    }
  }

  if (
    translationHint &&
    translationHint.length > BATCH_CAPTURE_MAX_HINT_LENGTH
  ) {
    return {
      item: null,
      issue: {
        line: sourceLine,
        code: 'hint_too_long',
        message: `Translation hint must be ${BATCH_CAPTURE_MAX_HINT_LENGTH} characters or fewer.`,
        blocking: true,
      },
    }
  }

  return {
    item: { dutchText, translationHint, sourceLine },
    issue: null,
  }
}

export const parseBatchCaptureInput = (
  input: string
): BatchCaptureParseResult => {
  const items: BatchCaptureDraftItem[] = []
  const issues: BatchCaptureParseIssue[] = []
  const seenWords = new Set<string>()

  input.split(/\r?\n/).forEach((rawLine, index) => {
    if (rawLine.trim() === '') return

    const sourceLine = index + 1
    const parsed = parseLine(rawLine, sourceLine)
    if (parsed.issue) {
      issues.push(parsed.issue)
      return
    }
    if (!parsed.item) return

    const duplicateKey = parsed.item.dutchText.toLocaleLowerCase('nl-NL')
    if (seenWords.has(duplicateKey)) {
      issues.push({
        line: sourceLine,
        code: 'duplicate',
        message: `Duplicate “${parsed.item.dutchText}” was ignored.`,
        blocking: false,
      })
      return
    }

    if (items.length >= BATCH_CAPTURE_MAX_ITEMS) {
      issues.push({
        line: sourceLine,
        code: 'limit_exceeded',
        message: `A batch can contain at most ${BATCH_CAPTURE_MAX_ITEMS} items.`,
        blocking: true,
      })
      return
    }

    seenWords.add(duplicateKey)
    items.push(parsed.item)
  })

  return {
    items,
    issues,
    hasBlockingIssues: issues.some(issue => issue.blocking),
  }
}

export const getNextBatchCaptureItem = (
  items: BatchCaptureItem[]
): BatchCaptureItem | null =>
  items.find(item => item.status === 'queued') ?? null

export const isBatchCaptureFinished = (items: BatchCaptureItem[]): boolean =>
  items.length > 0 &&
  items.every(item =>
    ['completed', 'skipped', 'cancelled'].includes(item.status)
  )
