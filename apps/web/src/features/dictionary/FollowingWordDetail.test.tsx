import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'
import type {
  DictionaryAnalysisClientOperation,
  DictionaryAnalysisReceiptV2,
  DictionaryEffectiveBatchV2,
} from '@woordenaar/domain'
import { parseDictionaryEffectiveBatchV2 } from '@woordenaar/domain'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { FollowingWordDetail } from './FollowingWordDetail'
import { refreshPublishedDictionaryAnalysis } from '@/features/words/actions'
import { createWebDictionaryAnalysisService } from './analysis-client'
import { followingBatch } from './__fixtures__/following'
import { createWordRow } from './__fixtures__/cards'
import { buildWordDetail } from '@/features/words/word-detail'
import { applyEffectiveCards } from './content'
import { parseFollowingCards } from './following-content'

jest.mock('@/features/words/actions', () => ({
  refreshPublishedDictionaryAnalysis: jest.fn(async () => {}),
}))
jest.mock('next/navigation', () => ({ useRouter: jest.fn() }))
jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))
jest.mock('./analysis-client', () => ({
  createWebDictionaryAnalysisService: jest.fn(),
}))
jest.mock('@/features/words/WordDetailCard', () => ({
  WordDetailCard: ({
    word,
  }: {
    word: { translations: { en: string[] }; repetitionCount: number }
  }) => (
    <div data-testid="shared-word">
      {word.translations.en.join(',')} / reviews {word.repetitionCount}
    </div>
  ),
}))
const OWNER = '44444444-4444-4444-8444-444444444444'
const FOREIGN = '55555555-5555-4555-8555-555555555555'
const OP = '77777777-7777-4777-8777-777777777777'
const NEXT_OP = '78787878-7878-4787-8787-787878787878'
const REVISION = '66666666-6666-4666-8666-666666666666'
const ANALYZE = 'Analyze again'
const CHECK = 'Check analysis status'
const PUBLISHED = 'Shared analysis published.'
const initial = followingBatch()
const word = buildWordDetail(
  applyEffectiveCards(
    [createWordRow({ user_id: OWNER, repetition_count: 12 })],
    parseFollowingCards(initial).cards
  )[0]
)
const intent = (): DictionaryAnalysisClientOperation => ({
  user_id: OWNER,
  word_id: word.id,
  submitted: false,
  response: null,
  command: {
    protocol_version: 2,
    operation_id: OP,
    entry_id: initial.cards[0].reference.entry_id,
    expected_revision_id: initial.cards[0].reference.revision_id,
    expected_head_sequence: initial.cards[0].head_sequence,
  },
})
const receipt = (): DictionaryAnalysisReceiptV2 => ({
  ...intent().command,
  status: 'published',
  fence: '9007199254740997',
  quota_charged: true,
  result_sha256: 'a'.repeat(64),
  error_code: null,
  published_revision_id: REVISION,
  published_head_sequence: '9007199254740995',
})
const published = () => {
  const batch = followingBatch()
  batch.watermark = '9007199254740995'
  batch.cards[0].head_sequence = batch.watermark
  batch.cards[0].reference.revision_id = REVISION
  batch.revisions[0].revision_id = REVISION
  batch.revisions[0].content.translations.en = ['updated dwelling']
  const parsed = parseDictionaryEffectiveBatchV2(batch)
  if (!parsed.success) throw new Error('Invalid synthetic batch')
  return parsed.data
}
function makeService() {
  const operation = { ...intent(), submitted: true, response: receipt() }
  let saved: DictionaryAnalysisClientOperation | null = null
  const readSaved = jest.fn(
    async (): Promise<DictionaryAnalysisClientOperation | null> => saved
  )
  return {
    isAvailable: jest.fn(async () => true),
    readHistory: jest.fn(
      async (): Promise<DictionaryAnalysisClientOperation[]> => []
    ),
    nextAttempt: jest.fn(
      async (): Promise<{
        result: DictionaryAnalysisClientOperation
        hydrated: DictionaryEffectiveBatchV2 | null
      }> => ({ result: operation, hydrated: published() })
    ),
    readSaved,
    submit: jest.fn(async () => {
      saved = operation
      readSaved.mockResolvedValue(operation)
      return { result: operation, hydrated: published() }
    }),
    loadPublished: jest.fn(async () => ({
      result: operation,
      hydrated: published(),
    })),
    recover: jest.fn(async () => {
      saved = operation
      readSaved.mockResolvedValue(operation)
      return { result: operation, hydrated: published() }
    }),
  }
}

describe('following word explicit shared analysis UI', () => {
  let service: ReturnType<typeof makeService>,
    refresh: jest.Mock,
    unsubscribe: jest.Mock
  let listener: (event: string, session: Session | null) => void
  beforeEach(() => {
    jest.clearAllMocks()
    refresh = jest.fn()
    unsubscribe = jest.fn()
    service = makeService()
    jest
      .mocked(useRouter)
      .mockReturnValue({ refresh } as unknown as ReturnType<typeof useRouter>)
    jest.mocked(createWebDictionaryAnalysisService).mockReturnValue(service)
    jest.mocked(createClient).mockReturnValue({
      auth: {
        onAuthStateChange: (callback: typeof listener) => {
          listener = callback
          return { data: { subscription: { unsubscribe } } }
        },
      },
    } as unknown as ReturnType<typeof createClient>)
    Object.defineProperty(crypto, 'randomUUID', {
      configurable: true,
      value: () => OP,
    })
  })
  const mount = () =>
    render(<FollowingWordDetail word={word} userId={OWNER} followingEnabled />)
  it('submits only on explicit press, applies validated content and refreshes route after publication', async () => {
    const view = mount()
    await screen.findByText(ANALYZE)
    expect(service.submit).not.toHaveBeenCalled()
    expect(service.recover).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText(ANALYZE))
    await screen.findByText(PUBLISHED)
    expect(screen.getByTestId('shared-word')).toHaveTextContent(
      'updated dwelling / reviews 12'
    )
    expect(service.submit).toHaveBeenCalledWith(intent())
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(ANALYZE)).toBeNull()
    fireEvent.click(screen.getByText(CHECK))
    await waitFor(() => expect(service.recover).toHaveBeenCalledTimes(1))
    view.unmount()
    expect(unsubscribe).toHaveBeenCalledTimes(2)
  })
  it('does not offer denied/default OFF fresh analysis or construct a request', async () => {
    service.isAvailable.mockResolvedValue(false)
    const view = mount()
    await waitFor(() => expect(service.isAvailable).toHaveBeenCalled())
    expect(screen.queryByRole('region', { name: 'Shared analysis' })).toBeNull()
    expect(service.submit).not.toHaveBeenCalled()
    view.unmount()
  })
  it('shows saved unknown state after flag/permission withdrawal and performs only explicit recovery', async () => {
    service.readSaved.mockResolvedValue({ ...intent(), submitted: true })
    const view = mount()
    await screen.findByText(CHECK)
    expect(service.isAvailable).not.toHaveBeenCalled()
    expect(service.recover).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText(CHECK))
    await screen.findByText(PUBLISHED)
    expect(service.submit).not.toHaveBeenCalled()
    view.unmount()
  })
  it.each(['unmount', 'account-change'])(
    'never applies late snapshot or refreshes route after %s',
    async phase => {
      let finish: (
        value: Awaited<ReturnType<typeof service.submit>>
      ) => void = () => {}
      service.submit.mockImplementation(
        () =>
          new Promise(resolve => {
            finish = resolve
          })
      )
      const view = mount()
      await screen.findByText(ANALYZE)
      fireEvent.click(screen.getByText(ANALYZE))
      if (phase === 'unmount') view.unmount()
      await act(async () => {
        if (phase === 'account-change') {
          listener('SIGNED_IN', { user: { id: FOREIGN } } as Session)
          listener('SIGNED_IN', { user: { id: OWNER } } as Session)
        }
        finish({
          result: { ...intent(), submitted: true, response: receipt() },
          hydrated: published(),
        })
      })
      expect(refresh).not.toHaveBeenCalled()
      if (phase === 'account-change') {
        const eligibilityReads = service.isAvailable.mock.calls.length
        view.rerender(
          <FollowingWordDetail
            word={{ ...word, repetitionCount: 28 }}
            userId={OWNER}
            followingEnabled
          />
        )
        expect(service.isAvailable).toHaveBeenCalledTimes(eligibilityReads)
        expect(screen.getByRole('alert')).toHaveTextContent('session changed')
        expect(screen.getByTestId('shared-word')).toHaveTextContent(
          'dwelling / reviews 28'
        )
        view.unmount()
      }
    }
  )
  it('keeps receipt and displayed content when a publication dependency is invalid', async () => {
    const bad = published()
    bad.revisions = []
    service.submit.mockImplementation(async () => {
      const operation = { ...intent(), submitted: true, response: receipt() }
      service.readSaved.mockResolvedValue(operation)
      return { result: operation, hydrated: bad }
    })
    const view = mount()
    await screen.findByText(ANALYZE)
    fireEvent.click(screen.getByText(ANALYZE))
    await screen.findByRole('alert')
    expect(screen.getByTestId('shared-word')).toHaveTextContent(
      'dwelling / reviews 12'
    )
    expect(screen.getByText(CHECK)).toBeTruthy()
    expect(refresh).not.toHaveBeenCalled()
    view.unmount()
  })
  it('preserves newer personal progress props after applying shared content', async () => {
    const view = mount()
    await screen.findByText(ANALYZE)
    fireEvent.click(screen.getByText(ANALYZE))
    await screen.findByText(PUBLISHED)
    view.rerender(
      <FollowingWordDetail
        word={{ ...word, repetitionCount: 28 }}
        userId={OWNER}
        followingEnabled
      />
    )
    expect(screen.getByTestId('shared-word')).toHaveTextContent(
      'updated dwelling / reviews 28'
    )
    view.unmount()
  })
  it('offers an explicit next attempt with the visible published head and local terminal history', async () => {
    const view = mount()
    await screen.findByText(ANALYZE)
    fireEvent.click(screen.getByText(ANALYZE))
    await screen.findByText('Start new analysis')
    expect(service.nextAttempt).not.toHaveBeenCalled()
    const previous = { ...intent(), submitted: true, response: receipt() }
    service.readHistory.mockResolvedValue([previous])
    fireEvent.click(screen.getByText('View analysis history'))
    await screen.findByText('Archived analysis attempts (1)')
    Object.defineProperty(crypto, 'randomUUID', {
      configurable: true,
      value: () => NEXT_OP,
    })
    fireEvent.click(screen.getByText('Start new analysis'))
    await waitFor(() => expect(service.nextAttempt).toHaveBeenCalledTimes(1))
    expect(service.nextAttempt.mock.calls[0]).toEqual([
      previous,
      {
        ...intent(),
        command: {
          ...intent().command,
          operation_id: NEXT_OP,
          expected_revision_id: REVISION,
          expected_head_sequence: receipt().published_head_sequence,
        },
      },
    ])
    expect(service.submit).toHaveBeenCalledTimes(1)
    view.unmount()
  })
  it('keeps a lost response reserved and exposes read-only checking after permission withdrawal', async () => {
    service.readSaved.mockResolvedValue({ ...intent(), submitted: true })
    service.isAvailable.mockResolvedValue(false)
    const view = mount()
    await screen.findByText(/unconfirmed/)
    expect(screen.queryByText('Start new analysis')).toBeNull()
    expect(service.isAvailable).not.toHaveBeenCalled()
    expect(service.nextAttempt).not.toHaveBeenCalled()
    view.unmount()
  })
  it('loads a saved publication explicitly after reload with no new analysis or receipt polling', async () => {
    const operation = { ...intent(), submitted: true, response: receipt() }
    service.readSaved.mockResolvedValue(operation)
    service.isAvailable.mockResolvedValue(false)
    const view = mount()
    await screen.findByText('Load published content')
    expect(service.loadPublished).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Load published content'))
    await waitFor(() =>
      expect(service.loadPublished).toHaveBeenCalledWith(operation)
    )
    expect(service.submit).not.toHaveBeenCalled()
    expect(service.recover).not.toHaveBeenCalled()
    expect(refresh).toHaveBeenCalled()
    expect(refreshPublishedDictionaryAnalysis).toHaveBeenCalledWith(operation)
    view.unmount()
  })

  it('retains a saved publication when loading fails and retries only the load', async () => {
    const operation = { ...intent(), submitted: true, response: receipt() }
    service.readSaved.mockResolvedValue(operation)
    service.loadPublished.mockRejectedValueOnce(new Error('Offline'))
    const view = mount()
    await screen.findByText('Load published content')
    fireEvent.click(screen.getByText('Load published content'))
    await screen.findByRole('alert')
    fireEvent.click(screen.getByText('Load published content'))
    await waitFor(() => expect(service.loadPublished).toHaveBeenCalledTimes(2))
    expect(service.submit).not.toHaveBeenCalled()
    expect(service.recover).not.toHaveBeenCalled()
    view.unmount()
  })

  it('keeps newer personal props when an old publication overlay no longer matches the reference', async () => {
    const view = mount()
    await screen.findByText(ANALYZE)
    fireEvent.click(screen.getByText(ANALYZE))
    await screen.findByText(PUBLISHED)
    view.rerender(
      <FollowingWordDetail
        word={{ ...word, dictionary: { ...word.dictionary!, mode: 'legacy' } }}
        userId={OWNER}
        followingEnabled
      />
    )
    await waitFor(() =>
      expect(screen.getByTestId('shared-word').textContent).toBe(
        'dwelling / reviews 12'
      )
    )
    view.unmount()
  })
  it('retains publication when app cache invalidation fails and retries only content loading', async () => {
    const operation = { ...intent(), submitted: true, response: receipt() }
    service.readSaved.mockResolvedValue(operation)
    jest
      .mocked(refreshPublishedDictionaryAnalysis)
      .mockRejectedValueOnce(new Error('Offline'))
    const view = mount()
    await screen.findByText('Load published content')
    fireEvent.click(screen.getByText('Load published content'))
    await screen.findByRole('alert')
    expect(screen.getByTestId('shared-word').textContent).toBe(
      'dwelling / reviews 12'
    )
    fireEvent.click(screen.getByText('Load published content'))
    await waitFor(() =>
      expect(screen.getByTestId('shared-word').textContent).toContain(
        'updated dwelling'
      )
    )
    expect(service.loadPublished).toHaveBeenCalledTimes(2)
    expect(service.submit).not.toHaveBeenCalled()
    expect(service.recover).not.toHaveBeenCalled()
    view.unmount()
  })
  it('does not apply a late publication after unmount while the app cache is being refreshed', async () => {
    const operation = { ...intent(), submitted: true, response: receipt() }
    service.readSaved.mockResolvedValue(operation)
    let finish!: () => void
    jest.mocked(refreshPublishedDictionaryAnalysis).mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          finish = resolve
        })
    )
    const view = mount()
    await screen.findByText('Load published content')
    fireEvent.click(screen.getByText('Load published content'))
    await waitFor(() =>
      expect(refreshPublishedDictionaryAnalysis).toHaveBeenCalled()
    )
    view.unmount()
    await act(async () => finish())
    expect(refresh).not.toHaveBeenCalled()
    expect(service.submit).not.toHaveBeenCalled()
  })
})
