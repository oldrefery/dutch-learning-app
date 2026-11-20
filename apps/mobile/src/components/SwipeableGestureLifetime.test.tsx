import React from 'react'
import { Alert } from 'react-native'
import * as Haptics from 'expo-haptics'
import { act, render } from '@testing-library/react-native'
import {
  createMockCollection,
  createMockWord,
} from '@/__tests__/helpers/factories'
import { ToastService } from '@/components/AppToast'
import SwipeableWordItem from './SwipeableWordItem'
import SwipeableCollectionCard from './SwipeableCollectionCard'

type GestureKind = 'tap' | 'pan' | 'long'
type GestureEvent = { translationX: number }
interface RecordedGesture {
  kind: GestureKind
  end?: (event: GestureEvent) => void
  start?: () => void
  update?: (event: GestureEvent) => void
}
const mockGestures: RecordedGesture[] = []
const collection = createMockCollection({ collection_id: 'collection-one' })
const word = createMockWord({ collection_id: collection.collection_id })
const mockStoreState = {
  userAccessLevel: 'full_access',
  collections: [collection],
}

jest.mock('@/stores/useApplicationStore', () => ({
  useApplicationStore: (selector: (state: typeof mockStoreState) => unknown) =>
    selector(mockStoreState),
}))
jest.mock('@/components/CollectionContextMenu', () => () => null)
jest.mock('@/components/AppToast', () => ({
  ToastService: { show: jest.fn() },
}))
jest.mock('@/lib/sentry', () => ({ Sentry: { captureException: jest.fn() } }))
jest.mock('react-native-gesture-handler', () => {
  const createGesture = (kind: GestureKind) => {
    const record: RecordedGesture = { kind }
    mockGestures.push(record)
    const gesture = {
      maxDistance: () => gesture,
      maxDuration: () => gesture,
      minDuration: () => gesture,
      activeOffsetX: () => gesture,
      failOffsetY: () => gesture,
      maxPointers: () => gesture,
      onUpdate: (handler: RecordedGesture['update']) => {
        record.update = handler
        return gesture
      },
      onStart: (handler: RecordedGesture['start']) => {
        record.start = handler
        return gesture
      },
      onEnd: (handler: RecordedGesture['end']) => {
        record.end = handler
        return gesture
      },
    }
    return gesture
  }
  return {
    Gesture: {
      Tap: () => createGesture('tap'),
      Pan: () => createGesture('pan'),
      LongPress: () => createGesture('long'),
      Exclusive: jest.fn(),
    },
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
  }
})
jest.mock('react-native-reanimated', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react')
  const { View } =
    jest.requireActual<typeof import('react-native')>('react-native')
  return {
    __esModule: true,
    default: { View },
    useSharedValue: (initial: number) => {
      const state = ReactActual.useRef(initial)
      const mutable = ReactActual.useRef({
        get: () => state.current,
        set: (next: number) => {
          state.current = next
        },
      })
      return mutable.current
    },
    useAnimatedStyle: () => ({}),
    withTiming: (value: number) => value,
    withSpring: (value: number, _config?: unknown, complete?: () => void) => {
      complete?.()
      return value
    },
  }
})
jest.mock('react-native-worklets', () => ({
  scheduleOnRN: <Args extends unknown[]>(
    callback: (...args: Args) => void,
    ...args: Args
  ) => callback(...args),
}))

const press = async (record: RecordedGesture) =>
  act(() => record.end?.({ translationX: 0 }))
const pan = async (record: RecordedGesture, translationX: number) =>
  act(() => record.end?.({ translationX }))
const first = (kind: GestureKind) =>
  mockGestures.find(record => record.kind === kind)!

beforeEach(() => {
  mockGestures.length = 0
  jest.clearAllMocks()
  mockStoreState.userAccessLevel = 'full_access'
})

it('keeps word gesture registrations stable during equal-data refreshes', async () => {
  const props = {
    word,
    index: 0,
    highlighted: false,
    onPress: jest.fn(),
    onDelete: jest.fn(),
    onMoveToCollection: jest.fn(),
    onLongPress: jest.fn(),
  }
  const { rerender } = await render(<SwipeableWordItem {...props} />)
  for (let index = 0; index < 5; index++) {
    await rerender(
      <SwipeableWordItem
        {...props}
        word={{ ...word }}
        onPress={jest.fn()}
        onDelete={jest.fn()}
        onMoveToCollection={jest.fn()}
        onLongPress={jest.fn()}
      />
    )
  }
  for (const kind of ['tap', 'pan', 'long'])
    expect(mockGestures.filter(record => record.kind === kind)).toHaveLength(1)
})

it('keeps collection gesture registrations stable during equal-data refreshes', async () => {
  const props = {
    collection,
    words: [word],
    onPress: jest.fn(),
    onDelete: jest.fn(),
    onRename: jest.fn().mockResolvedValue(undefined),
  }
  const { rerender } = await render(<SwipeableCollectionCard {...props} />)
  for (let index = 0; index < 5; index++) {
    await rerender(
      <SwipeableCollectionCard
        {...props}
        collection={{ ...collection }}
        words={[{ ...word }]}
        onPress={jest.fn()}
        onDelete={jest.fn()}
        onRename={jest.fn().mockResolvedValue(undefined)}
      />
    )
  }
  for (const kind of ['tap', 'pan', 'long'])
    expect(mockGestures.filter(record => record.kind === kind)).toHaveLength(1)
})

it('uses the supplied surface color on the collection row above the swipe actions', async () => {
  const screen = await render(
    <SwipeableCollectionCard
      collection={{ ...collection, name: 'Visible collection' }}
      words={[word]}
      backgroundColor="#FFFFFF"
      onPress={jest.fn()}
      onDelete={jest.fn()}
      onRename={jest.fn()}
    />
  )

  expect(screen.getByTestId('collection-row-visible-collection')).toHaveStyle({
    backgroundColor: '#FFFFFF',
  })
})

it.each(['word', 'collection'] as const)(
  'dispatches a retained %s tap to the latest committed callback',
  async kind => {
    const oldPress = jest.fn(),
      latestPress = jest.fn(),
      onDelete = jest.fn()
    const view = (onPress: () => void) =>
      kind === 'word' ? (
        <SwipeableWordItem
          word={word}
          index={0}
          highlighted={false}
          onPress={onPress}
          onDelete={onDelete}
        />
      ) : (
        <SwipeableCollectionCard
          collection={collection}
          words={[word]}
          onPress={onPress}
          onDelete={onDelete}
          onRename={jest.fn().mockResolvedValue(undefined)}
        />
      )
    const { rerender } = await render(view(oldPress))
    const retainedTap = first('tap')
    await rerender(view(latestPress))
    await press(retainedTap)
    expect(latestPress).toHaveBeenCalledTimes(1)
    expect(oldPress).not.toHaveBeenCalled()
  }
)

it('updates the word pan configuration when move capability changes', async () => {
  const props = {
    word,
    index: 0,
    highlighted: false,
    onPress: jest.fn(),
    onDelete: jest.fn(),
  }
  const { rerender } = await render(<SwipeableWordItem {...props} />)
  await rerender(
    <SwipeableWordItem {...props} onMoveToCollection={jest.fn()} />
  )
  expect(mockGestures.filter(record => record.kind === 'pan')).toHaveLength(2)
})

it('does not delete a word before its confirmation is accepted', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  const onDelete = jest.fn()
  await render(
    <SwipeableWordItem
      word={word}
      index={0}
      highlighted={false}
      onPress={jest.fn()}
      onDelete={onDelete}
    />
  )
  await pan(first('pan'), -170)
  expect(onDelete).not.toHaveBeenCalled()
  await act(() =>
    alert.mock.calls[0][2]
      ?.find(button => button.text === 'Delete')
      ?.onPress?.()
  )
  expect(onDelete).toHaveBeenCalledWith(word.word_id)
  alert.mockRestore()
})

it('preserves the last-collection read-only deletion guard', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  mockStoreState.userAccessLevel = 'read_only'
  const onDelete = jest.fn()
  await render(
    <SwipeableCollectionCard
      collection={collection}
      words={[word]}
      onPress={jest.fn()}
      onDelete={onDelete}
      onRename={jest.fn().mockResolvedValue(undefined)}
    />
  )
  await pan(first('pan'), -170)
  expect(ToastService.show).toHaveBeenCalledTimes(1)
  expect(alert).not.toHaveBeenCalled()
  expect(onDelete).not.toHaveBeenCalled()
  alert.mockRestore()
})

it('keeps confirmation bound to the delete action that opened the dialog', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  const originalDelete = jest.fn(),
    replacementDelete = jest.fn()
  const props = { word, index: 0, highlighted: false, onPress: jest.fn() }
  const { rerender } = await render(
    <SwipeableWordItem {...props} onDelete={originalDelete} />
  )
  await pan(first('pan'), -170)
  await rerender(<SwipeableWordItem {...props} onDelete={replacementDelete} />)
  await act(() =>
    alert.mock.calls[0][2]
      ?.find(button => button.text === 'Delete')
      ?.onPress?.()
  )
  expect(originalDelete).toHaveBeenCalledWith(word.word_id)
  expect(replacementDelete).not.toHaveBeenCalled()
  alert.mockRestore()
})

it('applies the latest deletion permission to a retained collection pan', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  const onDelete = jest.fn()
  const props = {
    collection,
    words: [word],
    onPress: jest.fn(),
    onDelete,
    onRename: jest.fn().mockResolvedValue(undefined),
  }
  const { rerender } = await render(<SwipeableCollectionCard {...props} />)
  const retainedPan = first('pan')
  mockStoreState.userAccessLevel = 'read_only'
  await rerender(<SwipeableCollectionCard {...props} />)
  await pan(retainedPan, -170)
  expect(ToastService.show).toHaveBeenCalledTimes(1)
  expect(alert).not.toHaveBeenCalled()
  expect(onDelete).not.toHaveBeenCalled()
  alert.mockRestore()
})

it.each(['word', 'collection'] as const)(
  'ignores a queued %s long press after the row unmounts',
  async kind => {
    const haptics = jest
      .spyOn(Haptics, 'impactAsync')
      .mockResolvedValue(undefined)
    try {
      const node =
        kind === 'word' ? (
          <SwipeableWordItem
            word={word}
            index={0}
            highlighted={false}
            onPress={jest.fn()}
            onDelete={jest.fn()}
            onLongPress={jest.fn()}
          />
        ) : (
          <SwipeableCollectionCard
            collection={collection}
            words={[word]}
            onPress={jest.fn()}
            onDelete={jest.fn()}
            onRename={jest.fn().mockResolvedValue(undefined)}
          />
        )
      const { unmount } = await render(node)
      const retained = first('long')
      await unmount()
      await act(() => retained.start?.())
      expect(haptics).not.toHaveBeenCalled()
    } finally {
      haptics.mockRestore()
    }
  }
)
