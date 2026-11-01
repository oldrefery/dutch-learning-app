import { act, renderHook } from '@testing-library/react-native'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { useCollections } from '@/hooks/useCollections'
import type { Collection } from '@/types/database'
import { useAddWord } from '../useAddWord'

jest.mock('@/components/AppToast', () => ({
  ToastService: { show: jest.fn() },
}))
jest.mock('@/stores/useApplicationStore')
jest.mock('@/hooks/useCollections')

const first: Collection = {
  collection_id: 'first',
  user_id: 'owner',
  name: 'First',
  description: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  is_shared: false,
  shared_with: null,
  share_token: null,
  shared_at: null,
}
const second: Collection = {
  ...first,
  collection_id: 'second',
  name: 'Second',
}

describe('Add Word collection selection with the real settings store', () => {
  beforeEach(async () => {
    jest.clearAllMocks()
    await useSettingsStore.persist.rehydrate()
    useSettingsStore.setState({ lastSelectedCollectionId: null })
    jest.mocked(useApplicationStore).mockReturnValue({
      saveAnalyzedWord: jest.fn(),
      clearError: jest.fn(),
    })
    jest.mocked(useCollections).mockReturnValue({
      collections: [first, second],
      collectionsLoading: false,
      fetchCollections: jest.fn(),
      createNewCollection: jest.fn(),
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('does not overwrite a preference changed by another mounted screen', () => {
    const { result } = renderHook(() => useAddWord(first.collection_id))
    expect(result.current.selectedCollection).toEqual(first)

    act(() => {
      useSettingsStore
        .getState()
        .setLastSelectedCollectionId(second.collection_id)
    })

    expect(result.current.selectedCollection).toEqual(first)
    expect(useSettingsStore.getState().lastSelectedCollectionId).toBe(
      second.collection_id
    )
  })

  it('settles when two mounted selectors have different route destinations', () => {
    const { result } = renderHook(() => ({
      background: useAddWord(first.collection_id),
      foreground: useAddWord(second.collection_id),
    }))

    expect(result.current.background.selectedCollection).toEqual(first)
    expect(result.current.foreground.selectedCollection).toEqual(second)
    act(() => result.current.foreground.selectCollection(first))
    expect(result.current.foreground.selectedCollection).toEqual(first)
    expect(useSettingsStore.getState().lastSelectedCollectionId).toBe(
      first.collection_id
    )
  })

  it('keeps independent retained screens stable while their user selections change', () => {
    const background = renderHook(() => useAddWord(first.collection_id))
    const foreground = renderHook(() => useAddWord(second.collection_id))
    const changes: (string | null)[] = []
    const unsubscribe = useSettingsStore.subscribe(state => {
      changes.push(state.lastSelectedCollectionId)
    })
    try {
      for (const target of [first, second, first, second]) {
        act(() => foreground.result.current.selectCollection(target))
        expect(background.result.current.selectedCollection).toEqual(first)
        expect(foreground.result.current.selectedCollection).toEqual(target)
        expect(useSettingsStore.getState().lastSelectedCollectionId).toBe(
          target.collection_id
        )
      }
      expect(changes).toEqual(['first', 'second', 'first', 'second'])
      foreground.unmount()
      background.rerender({})
      expect(useSettingsStore.getState().lastSelectedCollectionId).toBe(
        'second'
      )
    } finally {
      unsubscribe()
    }
  })

  it('remembers the last selection when reopening without a route destination', () => {
    const screen = renderHook(() => useAddWord())
    act(() => screen.result.current.selectCollection(second))
    screen.unmount()
    const reopened = renderHook(() => useAddWord())
    expect(reopened.result.current.selectedCollection).toEqual(second)
  })

  it('waits for settings hydration and honors route priority', () => {
    let finishHydration: (() => void) | undefined
    jest.spyOn(useSettingsStore.persist, 'hasHydrated').mockReturnValue(false)
    jest
      .spyOn(useSettingsStore.persist, 'onFinishHydration')
      .mockImplementation(callback => {
        finishHydration = () => callback(useSettingsStore.getState())
        return jest.fn()
      })
    useSettingsStore.setState({ lastSelectedCollectionId: first.collection_id })
    const { result } = renderHook(() => useAddWord(second.collection_id))
    expect(result.current.selectedCollection).toBeNull()
    expect(useSettingsStore.getState().lastSelectedCollectionId).toBe('first')
    expect(finishHydration).toBeDefined()
    act(() => finishHydration?.())
    expect(result.current.selectedCollection).toEqual(second)
    expect(useSettingsStore.getState().lastSelectedCollectionId).toBe('second')
  })

  it('restores a saved choice after delayed collections and persists a deletion fallback', () => {
    useSettingsStore.setState({
      lastSelectedCollectionId: second.collection_id,
    })
    const collections = jest.mocked(useCollections)
    const available = collections()
    collections.mockReturnValue({ ...available, collections: [] })
    const screen = renderHook(() => useAddWord())
    expect(screen.result.current.selectedCollection).toBeNull()
    expect(useSettingsStore.getState().lastSelectedCollectionId).toBe('second')
    collections.mockReturnValue(available)
    screen.rerender({})
    expect(screen.result.current.selectedCollection).toEqual(second)
    collections.mockReturnValue({ ...available, collections: [first] })
    screen.rerender({})
    expect(screen.result.current.selectedCollection).toEqual(first)
    expect(useSettingsStore.getState().lastSelectedCollectionId).toBe('first')
    collections.mockReturnValue({ ...available, collections: [] })
    screen.rerender({})
    expect(screen.result.current.selectedCollection).toBeNull()
    expect(useSettingsStore.getState().lastSelectedCollectionId).toBeNull()
  })
})
