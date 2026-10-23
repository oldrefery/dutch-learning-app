import React from 'react'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import * as Crypto from 'expo-crypto'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { DictionaryAnalysisPanel } from '../DictionaryAnalysisPanel'
import { dictionaryAnalysisService as service } from '@/services/dictionaryAnalysisService'
import { refreshDictionaryAnalysisDisplay } from '@/services/dictionaryAnalysisDisplay'
import { supabase } from '@/lib/supabase'
import { useNormalizedColorScheme } from '@/hooks/useNormalizedColorScheme'
import { createMockWord } from '@/__tests__/helpers/factories'
import {
  analysisIntent,
  analysisReceipt,
  NEXT_ANALYSIS_ID,
} from '@/db/__tests__/dictionaryAnalysis.fixture'
import {
  OWNER_A,
  OWNER_B,
  WORD_A,
} from '@/db/__tests__/dictionaryFollowing.fixture'

jest.mock('@/services/dictionaryAnalysisService', () => ({
  dictionaryAnalysisService: {
    readSaved: jest.fn(),
    readHistory: jest.fn(async () => []),
    nextAttempt: jest.fn(),
    isAvailable: jest.fn(),
    submit: jest.fn(),
    recover: jest.fn(),
    loadPublished: jest.fn(),
  },
}))
jest.mock('@/services/dictionaryAnalysisDisplay', () => ({
  refreshDictionaryAnalysisDisplay: jest.fn(async () => {}),
}))
jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { onAuthStateChange: jest.fn() } },
}))
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
}))
jest.mock('@/hooks/useNormalizedColorScheme', () => ({
  useNormalizedColorScheme: jest.fn(() => 'light'),
}))
const ANALYZE = 'Analyze again'
const CHECK = 'Check analysis status'
const LOAD_CONTENT = 'Load published content'
const START_NEW = 'Start new analysis'
const PUBLISHED = 'Shared analysis published.'
const operation = () => ({
  ...analysisIntent(),
  submitted: true,
  response: analysisReceipt(),
})
const word = createMockWord({
  user_id: OWNER_A,
  word_id: WORD_A,
  dictionary_content_state: {
    protocol_version: 2,
    mode: 'follow',
    content_version: '1',
    reference: {
      entry_id: analysisIntent().command.entry_id,
      revision_id: analysisIntent().command.expected_revision_id,
    },
    adopted_revision_id: null,
    head_sequence: analysisIntent().command.expected_head_sequence,
    watermark: analysisIntent().command.expected_head_sequence,
  },
})

describe.each(['light', 'dark'] as const)('%s shared analysis panel', theme => {
  let listener: (event: AuthChangeEvent, session: Session | null) => void
  let unsubscribe: jest.Mock
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(useNormalizedColorScheme).mockReturnValue(theme)
    jest.mocked(service.readSaved).mockResolvedValue(null)
    jest.mocked(service.isAvailable).mockResolvedValue(true)
    jest.mocked(service.submit).mockResolvedValue(operation())
    jest.mocked(service.recover).mockResolvedValue(operation())
    jest.mocked(service.loadPublished).mockResolvedValue(operation())
    unsubscribe = jest.fn()
    jest
      .mocked(supabase.auth.onAuthStateChange)
      .mockImplementation(callback => {
        listener = callback
        return {
          data: { subscription: { id: 'synthetic-ui', callback, unsubscribe } },
        }
      })
  })
  it('dispatches from explicit press only, refreshes shared display and switches to read-only status', async () => {
    const view = render(<DictionaryAnalysisPanel word={word} />)
    await waitFor(() => expect(view.getByText(ANALYZE)).toBeTruthy())
    expect(service.submit).not.toHaveBeenCalled()
    expect(service.recover).not.toHaveBeenCalled()
    fireEvent.press(view.getByText(ANALYZE))
    await waitFor(() => expect(view.getByText(PUBLISHED)).toBeTruthy())
    expect(service.submit).toHaveBeenCalledTimes(1)
    expect(service.submit).toHaveBeenCalledWith(
      analysisIntent(),
      expect.any(Function)
    )
    expect(refreshDictionaryAnalysisDisplay).toHaveBeenCalledWith(
      OWNER_A,
      expect.any(Function)
    )
    expect(view.queryByText(ANALYZE)).toBeNull()
    fireEvent.press(view.getByText(CHECK))
    await waitFor(() => expect(service.recover).toHaveBeenCalledTimes(1))
    view.unmount()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })
  it('hides denied/default-OFF action without starting an analysis', async () => {
    jest.mocked(service.isAvailable).mockResolvedValue(false)
    const view = render(<DictionaryAnalysisPanel word={word} />)
    await waitFor(() => expect(service.isAvailable).toHaveBeenCalled())
    expect(view.queryByText('Shared analysis')).toBeNull()
    expect(service.submit).not.toHaveBeenCalled()
    expect(service.recover).not.toHaveBeenCalled()
    view.unmount()
  })
  it('exposes retained submitted status after permission withdrawal without probing eligibility', async () => {
    jest
      .mocked(service.readSaved)
      .mockResolvedValue({ ...analysisIntent(), submitted: true })
    const view = render(<DictionaryAnalysisPanel word={word} />)
    await waitFor(() => expect(view.getByText(CHECK)).toBeTruthy())
    expect(service.isAvailable).not.toHaveBeenCalled()
    expect(service.recover).not.toHaveBeenCalled()
    fireEvent.press(view.getByText(CHECK))
    await waitFor(() => expect(view.getByText(PUBLISHED)).toBeTruthy())
    expect(service.submit).not.toHaveBeenCalled()
    view.unmount()
  })
  it('ignores late reply after A-to-B-to-A and never applies another owner result', async () => {
    let finish = (_value: ReturnType<typeof operation>) => {}
    jest.mocked(service.submit).mockImplementation(
      () =>
        new Promise(resolve => {
          finish = resolve
        })
    )
    const view = render(<DictionaryAnalysisPanel word={word} />)
    await waitFor(() => expect(view.getByText(ANALYZE)).toBeTruthy())
    fireEvent.press(view.getByText(ANALYZE))
    await act(async () => {
      listener('SIGNED_IN', { user: { id: OWNER_B } } as Session)
      listener('SIGNED_IN', { user: { id: OWNER_A } } as Session)
      finish(operation())
    })
    const eligibilityReads = jest.mocked(service.isAvailable).mock.calls.length
    view.rerender(
      <DictionaryAnalysisPanel
        word={{
          ...word,
          dictionary_content_state: {
            ...word.dictionary_content_state!,
            head_sequence: '9007199254740997',
          },
        }}
      />
    )
    expect(service.isAvailable).toHaveBeenCalledTimes(eligibilityReads)
    expect(view.getByText(/session changed/)).toBeTruthy()
    expect(view.queryByText(PUBLISHED)).toBeNull()
    expect(refreshDictionaryAnalysisDisplay).not.toHaveBeenCalled()
    view.unmount()
  })
  it('does not apply display or report success after unmount', async () => {
    let finish = (_value: ReturnType<typeof operation>) => {}
    jest.mocked(service.submit).mockImplementation(
      () =>
        new Promise(resolve => {
          finish = resolve
        })
    )
    const view = render(<DictionaryAnalysisPanel word={word} />)
    await waitFor(() => expect(view.getByText(ANALYZE)).toBeTruthy())
    fireEvent.press(view.getByText(ANALYZE))
    view.unmount()
    await act(async () => {
      finish(operation())
    })
    expect(refreshDictionaryAnalysisDisplay).not.toHaveBeenCalled()
  })
  it('starts a distinct explicit attempt after a finished receipt and reads its retained history locally', async () => {
    const previous = operation()
    jest.mocked(Crypto.randomUUID).mockReturnValueOnce(NEXT_ANALYSIS_ID)
    jest.mocked(service.readSaved).mockResolvedValue(previous)
    jest.mocked(service.readHistory).mockResolvedValue([previous])
    jest
      .mocked(service.nextAttempt)
      .mockResolvedValue({ ...previous, response: analysisReceipt('accepted') })
    const view = render(<DictionaryAnalysisPanel word={word} />)
    await waitFor(() => expect(view.getByText(START_NEW)).toBeTruthy())
    expect(service.nextAttempt).not.toHaveBeenCalled()
    expect(service.readHistory).not.toHaveBeenCalled()
    fireEvent.press(view.getByText('View analysis history'))
    await waitFor(() =>
      expect(view.getByText('Archived analysis attempts (1)')).toBeTruthy()
    )
    fireEvent.press(view.getByText(START_NEW))
    await waitFor(() => expect(service.nextAttempt).toHaveBeenCalledTimes(1))
    expect(service.nextAttempt).toHaveBeenCalledWith(
      previous,
      {
        ...analysisIntent(),
        command: {
          ...analysisIntent().command,
          operation_id: NEXT_ANALYSIS_ID,
        },
      },
      expect.any(Function)
    )
    expect(service.submit).not.toHaveBeenCalled()
    view.unmount()
  })
  it('keeps quarantined outcomes blocked and shows the reconciliation explanation', async () => {
    jest.mocked(service.readSaved).mockResolvedValue({
      ...operation(),
      response: analysisReceipt('provider-outcome-unknown'),
    })
    const view = render(<DictionaryAnalysisPanel word={word} />)
    await waitFor(() =>
      expect(view.getByText(/until server reconciliation/)).toBeTruthy()
    )
    expect(view.queryByText(START_NEW)).toBeNull()
    expect(service.isAvailable).not.toHaveBeenCalled()
    expect(service.nextAttempt).not.toHaveBeenCalled()
    view.unmount()
  })
  it('retains published receipt when display update fails and offers only checking', async () => {
    jest
      .mocked(refreshDictionaryAnalysisDisplay)
      .mockRejectedValueOnce(new Error('synthetic render failure'))
    jest.mocked(service.submit).mockImplementation(async () => {
      jest.mocked(service.readSaved).mockResolvedValue(operation())
      return operation()
    })
    const view = render(<DictionaryAnalysisPanel word={word} />)
    await waitFor(() => expect(view.getByText(ANALYZE)).toBeTruthy())
    fireEvent.press(view.getByText(ANALYZE))
    await waitFor(() =>
      expect(view.getByText(/saved request is retained/)).toBeTruthy()
    )
    expect(view.queryByText(ANALYZE)).toBeNull()
    expect(view.getByText(CHECK)).toBeTruthy()
    expect(service.submit).toHaveBeenCalledTimes(1)
    view.unmount()
  })
  it('exposes cache-only loading after remount or hydration failure, without submitting or checking status', async () => {
    jest.mocked(service.readSaved).mockResolvedValue(operation())
    jest.mocked(service.isAvailable).mockResolvedValue(false)
    const view = render(<DictionaryAnalysisPanel word={word} />)
    await waitFor(() => expect(view.getByText(LOAD_CONTENT)).toBeTruthy())
    expect(service.loadPublished).not.toHaveBeenCalled()
    fireEvent.press(view.getByText(LOAD_CONTENT))
    await waitFor(() =>
      expect(service.loadPublished).toHaveBeenCalledWith(
        operation(),
        expect.any(Function)
      )
    )
    expect(service.submit).not.toHaveBeenCalled()
    expect(service.recover).not.toHaveBeenCalled()
    expect(refreshDictionaryAnalysisDisplay).toHaveBeenCalled()
    view.unmount()
  })

  it('retains cache-only loading after a failed load and never creates a new intent', async () => {
    jest.mocked(service.readSaved).mockResolvedValue(operation())
    jest
      .mocked(service.loadPublished)
      .mockRejectedValueOnce(new Error('Offline'))
    const view = render(<DictionaryAnalysisPanel word={word} />)
    await waitFor(() => expect(view.getByText(LOAD_CONTENT)).toBeTruthy())
    fireEvent.press(view.getByText(LOAD_CONTENT))
    await waitFor(() => expect(view.getByRole('alert')).toBeTruthy())
    fireEvent.press(view.getByText(LOAD_CONTENT))
    await waitFor(() => expect(service.loadPublished).toHaveBeenCalledTimes(2))
    expect(service.submit).not.toHaveBeenCalled()
    expect(Crypto.randomUUID).not.toHaveBeenCalled()
    view.unmount()
  })

  it('recognizes already-loaded shared content after a head-driven controller remount', async () => {
    jest.mocked(service.readSaved).mockResolvedValue(operation())
    const view = render(
      <DictionaryAnalysisPanel
        word={{
          ...word,
          dictionary_content_state: {
            ...word.dictionary_content_state!,
            reference: {
              entry_id: analysisIntent().command.entry_id,
              revision_id: analysisReceipt().published_revision_id!,
            },
            head_sequence: analysisReceipt().published_head_sequence!,
          },
        }}
      />
    )
    await waitFor(() => expect(view.getByText(PUBLISHED)).toBeTruthy())
    expect(view.queryByText(LOAD_CONTENT)).toBeNull()
    expect(service.loadPublished).not.toHaveBeenCalled()
    view.unmount()
  })
})
