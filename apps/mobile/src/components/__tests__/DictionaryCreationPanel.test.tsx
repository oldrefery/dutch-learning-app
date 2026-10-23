import { createMobileCreationAdoptionService as adoptionFactory } from '@/services/dictionaryCreationAdoptionService'
import { StrictMode } from 'react'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import type {
  DictionaryCreationService,
  DictionaryCreationJournalRow,
} from '@woordenaar/domain'
import {
  CREATION_OWNER as OWNER,
  CREATION_OTHER as OTHER,
  creationUuid as id,
  creationJournalFixture as initial,
  creationPreparedFixture as prepared,
  creationReceiptFixture as receipt,
  creationPublishedFixture as published,
  creationAdoptionFixture as adoption,
} from '../../../../../packages/domain/src/dictionary-creation-journal.fixture'
import { Text as MockText } from 'react-native'
import * as Crypto from 'expo-crypto'
import { createMobileDictionaryCreationService as factory } from '@/services/dictionaryCreationService'
import { supabase } from '@/lib/supabase'
import {
  isDictionarySharedAnalysisEnabled,
  isDictionaryFollowingImportsEnabled,
} from '@/constants/dictionaryContent'
import { useNormalizedColorScheme } from '@/hooks/useNormalizedColorScheme'
import { DictionaryCreationPanel } from '../DictionaryCreationPanel'
import { PublishedMeaningAddWord } from '../PublishedMeaningAddWord'
import { lookupPublishedMeanings } from '@/services/dictionaryMeaningLookup'

jest.mock('@/services/dictionaryMeaningLookup', () => ({
  lookupPublishedMeanings: jest.fn(),
}))
jest.mock('../DictionaryFollowingTransferPanel', () => ({
  DictionaryFollowingTransferPanel: () => (
    <MockText>Retained adoption</MockText>
  ),
}))
jest.mock('@/services/dictionaryCreationAdoptionService', () => ({
  createMobileCreationAdoptionService: jest.fn(),
}))
jest.mock('@/services/dictionaryCreationService', () => ({
  createMobileDictionaryCreationService: jest.fn(),
}))
jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { onAuthStateChange: jest.fn() } },
}))
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }))
jest.mock('@/constants/dictionaryContent', () => ({
  isDictionarySharedAnalysisEnabled: jest.fn(),
  isDictionaryFollowingImportsEnabled: jest.fn(),
}))
jest.mock('@/hooks/useNormalizedColorScheme', () => ({
  useNormalizedColorScheme: jest.fn(),
}))

const LOAD = 'Load saved requests'
const RESOLVE = 'Resolve intended meaning'
const CREATE = 'Create shared meaning'
const STATUS = 'Check saved request status'
const HINT = 'Meaning hint'
const LOAD_CARD = 'Load added card'
const CONFIRM_IMPORT = 'Confirm saved import'
type Listener = (
  event: string,
  session: { user: { id: string } } | null
) => void
let listeners: Set<Listener>,
  rows: DictionaryCreationJournalRow[],
  guards: { assert: () => void; signal: AbortSignal }[]
const unsubscribe = jest.fn()
const auth = {
  onAuthStateChange: jest.fn((listener: Listener) => {
    listeners.add(listener)
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            listeners.delete(listener)
            unsubscribe()
          },
        },
      },
    }
  }),
}
const save = (row: DictionaryCreationJournalRow) => {
  rows = [
    ...rows.filter(
      item =>
        item.session.request.resolution_id !== row.session.request.resolution_id
    ),
    row,
  ]
  return row
}
const sdk = {
  list: jest.fn(async () => rows),
  readSaved: jest.fn(async () => null),
  isAvailable: jest.fn(async () => true),
  resolve: jest.fn(async (row: DictionaryCreationJournalRow) =>
    save({
      ...row,
      session: {
        ...row.session,
        resolution: {
          ...row.session.request,
          outcome: 'new-meaning' as const,
          resolved_identity_id: id(3),
          published: null,
          decision_code: null,
        },
      },
    })
  ),
  recoverResolution: jest.fn(
    async (nonce: string) =>
      rows.find(row => row.session.request.resolution_id === nonce) ?? null
  ),
  prepareCommand: jest.fn(
    async (row: DictionaryCreationJournalRow, nonce: string) =>
      save({
        ...row,
        session: {
          ...row.session,
          command: {
            protocol_version: 2 as const,
            resolution_id: row.session.request.resolution_id,
            operation_id: nonce,
          },
        },
      })
  ),
  submit: jest.fn(async (row: DictionaryCreationJournalRow) =>
    save({ ...row, session: { ...row.session, submitted: true } })
  ),
  recover: jest.fn(
    async (nonce: string) =>
      rows.find(row => row.session.request.resolution_id === nonce) ?? null
  ),
} satisfies DictionaryCreationService
const adoptionSdk = {
  prepare: jest.fn(
    async (
      row: DictionaryCreationJournalRow,
      target: { collection_id: string; operation_id: string; word_id: string }
    ) => {
      const draft = adoption(row)
      return save({
        ...draft,
        adoption: {
          ...draft.adoption!,
          request: { ...draft.adoption!.request, ...target },
        },
      })
    }
  ),
  submit: jest.fn(async (row: DictionaryCreationJournalRow) => {
    const request = row.adoption!.request
    return save({
      ...row,
      adoption: {
        ...row.adoption!,
        submitted: true,
        response: {
          protocol_version: 2 as const,
          operation_id: request.operation_id,
          word_id: request.word_id,
          idempotent: false,
          outcome: 'inserted' as const,
          existing_word_id: null,
          reference: request.source.reference,
          applied_reference: request.source.reference,
          applied_head_sequence: '9007199254740995',
        },
      },
    })
  }),
  check: jest.fn(async (row: DictionaryCreationJournalRow) => ({
    row,
    state: {
      protocol_version: 2 as const,
      original_operation_id: row.adoption!.request.operation_id,
      word_id: row.adoption!.request.word_id,
      recovery_version: 0,
      inserted_once: true,
      state: 'active' as const,
      collection_id: row.adoption!.request.collection_id,
    },
  })),
  confirm: jest.fn(
    async (
      row: DictionaryCreationJournalRow
    ): Promise<DictionaryCreationJournalRow> => adoptionSdk.submit(row)
  ),
  load: jest.fn(async (row: DictionaryCreationJournalRow) => row),
} satisfies ReturnType<typeof adoptionFactory>
const connect = (_owner: string, assert: () => void, signal?: AbortSignal) => {
  if (!signal) throw new Error('Expected mounted signal')
  guards.push({ assert, signal })
  return sdk
}
const props = {
  ownerId: OWNER,
  originalQuery: '  BANK  ',
  noMatch: true,
  collections: [{ collection_id: id(9), name: 'Owned' }],
}
const emit = (owner: string | null) =>
  listeners.forEach(listener =>
    listener(
      owner ? 'SIGNED_IN' : 'SIGNED_OUT',
      owner ? { user: { id: owner } } : null
    )
  )
const sent = () => {
  const row = prepared(initial())
  return { ...row, session: { ...row.session, submitted: true } }
}
beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(adoptionFactory).mockReturnValue(adoptionSdk)
  adoptionSdk.load.mockImplementation(async row => row)
  rows = []
  guards = []
  listeners = new Set()
  sdk.list.mockImplementation(async () => rows)
  sdk.resolve.mockImplementation(async row =>
    save({
      ...row,
      session: {
        ...row.session,
        resolution: {
          ...row.session.request,
          outcome: 'new-meaning',
          resolved_identity_id: id(3),
          published: null,
          decision_code: null,
        },
      },
    })
  )
  sdk.submit.mockImplementation(async row =>
    save({ ...row, session: { ...row.session, submitted: true } })
  )
  sdk.prepareCommand.mockImplementation(async (row, nonce) =>
    save({
      ...row,
      session: {
        ...row.session,
        command: {
          protocol_version: 2,
          resolution_id: row.session.request.resolution_id,
          operation_id: nonce,
        },
      },
    })
  )
  jest.mocked(isDictionarySharedAnalysisEnabled).mockReturnValue(true)
  jest.mocked(isDictionaryFollowingImportsEnabled).mockReturnValue(true)
  jest.mocked(useNormalizedColorScheme).mockReturnValue('light')
  let n = 200
  jest.mocked(Crypto.randomUUID).mockImplementation(() => id(++n))
  jest
    .mocked(factory)
    .mockImplementation((owner, assert, signal) =>
      connect(owner, assert, signal)
    )
  const mockAuth = supabase.auth as unknown as {
    onAuthStateChange: jest.Mock<
      ReturnType<typeof auth.onAuthStateChange>,
      [Listener]
    >
  }
  mockAuth.onAuthStateChange.mockImplementation(auth.onAuthStateChange)
  jest.mocked(lookupPublishedMeanings).mockResolvedValue({
    format: 'woordenaar.dictionary.collection',
    protocol_version: 2,
    entries: [],
  } as never)
})

const button = (view: ReturnType<typeof render>, name: string) =>
  view.getByLabelText(name)
const press = (view: ReturnType<typeof render>, name: string) =>
  fireEvent.press(button(view, name))
const type = (view: ReturnType<typeof render>, label: string, value: string) =>
  fireEvent.changeText(view.getByLabelText(label), value)
const disabled = (view: ReturnType<typeof render>, name: string) =>
  button(view, name).props.accessibilityState.disabled

const ready = (view: ReturnType<typeof render>) =>
  waitFor(() => expect(button(view, LOAD)).toBeTruthy())
it.each(['light', 'dark'] as const)(
  'restores before offering an explicit meaning hint in %s theme',
  async theme => {
    jest.mocked(useNormalizedColorScheme).mockReturnValue(theme)
    const view = render(<DictionaryCreationPanel {...props} />)
    await ready(view)
    await waitFor(() => expect(view.getByLabelText(HINT)).toBeTruthy())
    expect(sdk.list).toHaveBeenCalledTimes(1)
    expect(sdk.resolve).not.toHaveBeenCalled()
    expect(sdk.submit).not.toHaveBeenCalled()
    type(view, HINT, '  Original intended meaning.  ')
    press(view, RESOLVE)
    await ready(view)
    await waitFor(() => expect(button(view, CREATE)).toBeTruthy())
    expect(sdk.resolve.mock.calls[0][0].session.request).toMatchObject({
      original_query: '  BANK  ',
      meaning_hint: '  Original intended meaning.  ',
    })
    expect(sdk.submit).not.toHaveBeenCalled()
    press(view, CREATE)
    await ready(view)
    await waitFor(() => expect(button(view, STATUS)).toBeTruthy())
    await ready(view)
    await waitFor(() => expect(view.queryByText(CREATE)).toBeNull())
    expect(sdk.submit).toHaveBeenCalledTimes(1)
    expect(rows[0].adoption).toBeNull()
  }
)
it('keeps new creation behind explicit no-match while retained recovery remains visible', async () => {
  rows = [sent()]
  const view = render(<DictionaryCreationPanel {...props} noMatch={false} />)
  await ready(view)
  await waitFor(() => expect(button(view, STATUS)).toBeTruthy())
  expect(view.queryByLabelText(HINT)).toBeNull()
  press(view, STATUS)
  await ready(view)
  await waitFor(() => expect(sdk.recover).toHaveBeenCalledTimes(1))
  expect(sdk.resolve).not.toHaveBeenCalled()
  expect(sdk.submit).not.toHaveBeenCalled()
})
it.each([
  'provider-outcome-unknown',
  'provider-failed',
  'review-required',
  'rejected',
  'identity-conflict',
  'authorization-revoked',
] as const)(
  'restores %s with status only and the original private hint',
  async status => {
    const row = sent()
    row.session.response = receipt(row, {
      status,
      error_code: status,
      result_sha256: status === 'review-required' ? 'a'.repeat(64) : null,
    })
    rows = [row]
    const view = render(<DictionaryCreationPanel {...props} />)
    await ready(view)
    await waitFor(() => expect(button(view, STATUS)).toBeTruthy())
    expect(
      view.getByText('Meaning hint: A financial institution.')
    ).toBeTruthy()
    expect(view.queryByLabelText(HINT)).toBeNull()
    expect(view.queryByText(CREATE)).toBeNull()
    press(view, STATUS)
    await ready(view)
    await waitFor(() => expect(sdk.recover).toHaveBeenCalledTimes(1))
    expect(sdk.submit).not.toHaveBeenCalled()
  }
)
it('uses saved unresolved intent, status reads and explicit same-request resolution', async () => {
  rows = [initial()]
  const view = render(<DictionaryCreationPanel {...props} />)
  await ready(view)
  await waitFor(() =>
    expect(button(view, 'Resolve saved meaning')).toBeTruthy()
  )
  press(view, STATUS)
  await ready(view)
  await waitFor(() => expect(sdk.recoverResolution).toHaveBeenCalledTimes(1))
  press(view, 'Resolve saved meaning')
  await ready(view)
  await waitFor(() => expect(sdk.resolve).toHaveBeenCalledWith(initial()))
  expect(view.queryByLabelText(HINT)).toBeNull()
})
it('does not pretend that a published result is a personal card', async () => {
  rows = [published(sent())]
  const view = render(<DictionaryCreationPanel {...props} />)
  await ready(view)
  await waitFor(() =>
    expect(
      view.getByText(/Adding it to your collection is a separate action/)
    ).toBeTruthy()
  )
  expect(sdk.submit).not.toHaveBeenCalled()
  expect(rows[0].adoption).toBeNull()
})
it('disables new creation when the local opt-in is OFF, keeping status available', async () => {
  jest.mocked(isDictionarySharedAnalysisEnabled).mockReturnValue(false)
  rows = [prepared(initial())]
  const view = render(<DictionaryCreationPanel {...props} />)
  await ready(view)
  await waitFor(() => expect(button(view, CREATE)).toBeTruthy())
  expect(disabled(view, CREATE)).toBe(true)
  press(view, STATUS)
  await ready(view)
  await waitFor(() => expect(sdk.recoverResolution).toHaveBeenCalledTimes(1))
  expect(sdk.submit).not.toHaveBeenCalled()
})
it('retains a submitted claim after a lost reply and exposes no send-again action', async () => {
  rows = [prepared(initial())]
  sdk.submit.mockImplementation(async row => {
    save({ ...row, session: { ...row.session, submitted: true } })
    throw new Error('Lost reply')
  })
  const view = render(<DictionaryCreationPanel {...props} />)
  await ready(view)
  await waitFor(() => expect(button(view, CREATE)).toBeTruthy())
  press(view, CREATE)
  await ready(view)
  await waitFor(() =>
    expect(view.getByText(/Saved requests are retained/)).toBeTruthy()
  )
  expect(view.queryByText(CREATE)).toBeNull()
  expect(view.queryByLabelText(HINT)).toBeNull()
  press(view, STATUS)
  await ready(view)
  await waitFor(() => expect(sdk.recover).toHaveBeenCalledTimes(1))
  expect(sdk.submit).toHaveBeenCalledTimes(1)
})
it('fails closed on storage failure and restores explicitly without a network submit', async () => {
  sdk.list.mockRejectedValue(new Error('Storage blocked'))
  const view = render(<DictionaryCreationPanel {...props} />)
  await ready(view)
  await waitFor(() =>
    expect(view.getByText(/Saved requests are retained/)).toBeTruthy()
  )
  expect(view.queryByLabelText(HINT)).toBeNull()
  sdk.list.mockResolvedValue([])
  press(view, LOAD)
  await ready(view)
  await waitFor(() => expect(view.getByLabelText(HINT)).toBeTruthy())
  expect(sdk.submit).not.toHaveBeenCalled()
})
it('aborts stale UI work and latches A-B-A before exposing any retained request', async () => {
  rows = [prepared(initial())]
  const view = render(<DictionaryCreationPanel {...props} />)
  await ready(view)
  await waitFor(() => expect(button(view, CREATE)).toBeTruthy())
  const guard = guards.at(-1)!
  act(() => {
    emit(OTHER)
    emit(OWNER)
  })
  expect(guard.signal.aborted).toBe(true)
  expect(guard.assert).toThrow()
  expect(view.queryByText('Meaning hint: A financial institution.')).toBeNull()
  expect(view.getByText(/Your session changed/)).toBeTruthy()
  expect(disabled(view, LOAD)).toBe(true)
  expect(sdk.submit).not.toHaveBeenCalled()
})
it('cancels on unmount and renews lifecycle guards under Strict Mode', async () => {
  const view = render(
    <StrictMode>
      <DictionaryCreationPanel {...props} />
    </StrictMode>
  )
  await ready(view)
  await waitFor(() => expect(view.getByLabelText(HINT)).toBeTruthy())
  const guard = guards.at(-1)!
  expect(guard.signal.aborted).toBe(false)
  view.unmount()
  expect(guard.signal.aborted).toBe(true)
  expect(guard.assert).toThrow()
  expect(listeners.size).toBe(0)
  expect(unsubscribe).toHaveBeenCalled()
})
it('pages retained requests and lets the owner explicitly open an older word', async () => {
  rows = Array.from({ length: 11 }, (_, n) => initial(n + 1))
  const view = render(
    <DictionaryCreationPanel {...props} originalQuery="huis" />
  )
  await ready(view)
  await waitFor(() => expect(button(view, 'More saved requests')).toBeTruthy())
  press(view, 'More saved requests')
  press(view, 'Open saved request 11:   BANK  ')
  await ready(view)
  await waitFor(() => expect(button(view, STATUS)).toBeTruthy())
  press(view, STATUS)
  await ready(view)
  await waitFor(() =>
    expect(sdk.recoverResolution).toHaveBeenCalledWith(
      initial(11).session.request.resolution_id
    )
  )
})
it('mounts forms in published lookup, then cancels the old creation lifecycle when the word changes', async () => {
  const view = render(
    <PublishedMeaningAddWord
      ownerId={OWNER}
      collections={[]}
      onClose={() => {}}
    />
  )
  await ready(view)
  await waitFor(() => expect(sdk.list).toHaveBeenCalled())
  expect(view.queryByLabelText(HINT)).toBeNull()
  type(view, 'Dutch word or expression', 'bank')
  press(view, 'Find published meanings')
  await ready(view)
  await waitFor(() => expect(view.getByLabelText(HINT)).toBeTruthy())
  const old = guards.at(-1)!
  type(view, 'Dutch word or expression', 'huis')
  await ready(view)
  expect(old.signal.aborted).toBe(true)
  expect(old.assert).toThrow()
  expect(view.queryByLabelText(HINT)).toBeNull()
  expect(sdk.submit).not.toHaveBeenCalled()
})

it('keeps adoption and cache loading explicit after publication', async () => {
  rows = [published(sent())]
  const view = render(<DictionaryCreationPanel {...props} />)
  await ready(view)
  await waitFor(() =>
    expect(button(view, 'Add published meaning')).toBeTruthy()
  )
  expect(adoptionSdk.submit).not.toHaveBeenCalled()
  expect(adoptionSdk.load).not.toHaveBeenCalled()
  press(view, 'Add published meaning')
  await ready(view)
  await waitFor(() => expect(button(view, LOAD_CARD)).toBeTruthy())
  expect(adoptionSdk.prepare).toHaveBeenCalledTimes(1)
  expect(rows[0].adoption!.request.operation_id).not.toBe(
    rows[0].session.command!.operation_id
  )
  expect(adoptionSdk.load).not.toHaveBeenCalled()
  press(view, LOAD_CARD)
  await ready(view)
  await waitFor(() =>
    expect(
      view.getByText(/personal card and shared content.*loaded/i)
    ).toBeTruthy()
  )
  expect(adoptionSdk.load).toHaveBeenCalledTimes(1)
  expect(sdk.submit).not.toHaveBeenCalled()
})
it('retains the import receipt across a cache failure and retries loading only', async () => {
  rows = [await adoptionSdk.submit(adoption(published(sent())))]
  adoptionSdk.submit.mockClear()
  adoptionSdk.load.mockRejectedValueOnce(new Error('Cache offline'))
  const view = render(<DictionaryCreationPanel {...props} />)
  await ready(view)
  await waitFor(() => expect(button(view, LOAD_CARD)).toBeTruthy())
  press(view, LOAD_CARD)
  await ready(view)
  await waitFor(() =>
    expect(view.getByText(/Saved requests are retained/)).toBeTruthy()
  )
  expect(
    view.queryByText(/personal card and shared content.*loaded/i)
  ).toBeNull()
  press(view, LOAD_CARD)
  await ready(view)
  await waitFor(() =>
    expect(
      view.getByText(/personal card and shared content.*loaded/i)
    ).toBeTruthy()
  )
  expect(adoptionSdk.load).toHaveBeenCalledTimes(2)
  expect(adoptionSdk.submit).not.toHaveBeenCalled()
  expect(sdk.submit).not.toHaveBeenCalled()
})
it('offers read-only status before confirming a retained uncertain import with new-work disabled', async () => {
  const row = adoption(published(sent()))
  rows = [{ ...row, adoption: { ...row.adoption!, submitted: true } }]
  jest.mocked(isDictionaryFollowingImportsEnabled).mockReturnValue(false)
  const view = render(<DictionaryCreationPanel {...props} />)
  await ready(view)
  await waitFor(() => expect(button(view, 'Check saved import')).toBeTruthy())
  expect(disabled(view, CONFIRM_IMPORT)).toBe(true)
  expect(adoptionSdk.confirm).not.toHaveBeenCalled()
  press(view, 'Check saved import')
  await ready(view)
  await waitFor(() => expect(disabled(view, CONFIRM_IMPORT)).toBe(false))
  expect(adoptionSdk.confirm).not.toHaveBeenCalled()
  press(view, CONFIRM_IMPORT)
  await ready(view)
  await waitFor(() => expect(button(view, LOAD_CARD)).toBeTruthy())
  expect(adoptionSdk.confirm).toHaveBeenCalledTimes(1)
  expect(adoptionSdk.load).not.toHaveBeenCalled()
  expect(sdk.submit).not.toHaveBeenCalled()
})
it('calls batch completion only after an explicit successful imported-card load', async () => {
  rows = [await adoptionSdk.submit(adoption(published(sent())))]
  const onLoaded = jest.fn()
  const view = render(
    <DictionaryCreationPanel {...props} onLoaded={onLoaded} />
  )
  await ready(view)
  expect(onLoaded).not.toHaveBeenCalled()
  press(view, LOAD_CARD)
  await ready(view)
  await waitFor(() => expect(onLoaded).toHaveBeenCalledTimes(1))
  expect(onLoaded.mock.calls[0][0]).toEqual(rows[0])
})

it('awaits batch completion and retains the receipt when its persisted-card check fails', async () => {
  rows = [await adoptionSdk.submit(adoption(published(sent())))]
  const onLoaded = jest
    .fn()
    .mockRejectedValue(new Error('Batch card unavailable'))
  const view = render(
    <DictionaryCreationPanel {...props} onLoaded={onLoaded} />
  )
  await ready(view)
  press(view, LOAD_CARD)
  await ready(view)
  await waitFor(() =>
    expect(view.getByText(/Saved requests are retained/)).toBeTruthy()
  )
  expect(
    view.queryByText(/personal card and shared content.*loaded/i)
  ).toBeNull()
  expect(rows[0].adoption!.response?.outcome).toBe('inserted')
  expect(onLoaded).toHaveBeenCalledTimes(1)
})
