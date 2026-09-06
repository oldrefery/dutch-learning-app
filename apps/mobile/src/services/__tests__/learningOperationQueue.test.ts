import { createLearningOperationQueue } from '../learningOperationQueue'
const FIRST_START = 'first:start'

it('serializes operations in arrival order and retains their return values', async () => {
  const queue = createLearningOperationQueue()
  const calls: string[] = []
  let release!: () => void
  const gate = new Promise<void>(resolve => {
    release = resolve
  })
  const first = queue.run(async () => {
    calls.push(FIRST_START)
    await gate
    calls.push('first:end')
    return 1
  })
  const second = queue.run(async () => {
    calls.push('second')
    return 2
  })
  const third = queue.run(async () => {
    calls.push('third')
    return 3
  })
  await Promise.resolve()
  const beforeRelease = [...calls]
  release()
  expect(await Promise.all([first, second, third])).toEqual([1, 2, 3])
  expect(beforeRelease).toEqual([FIRST_START])
  expect(calls).toEqual([FIRST_START, 'first:end', 'second', 'third'])
})

it.each([true, false])(
  'releases after failure (synchronous: %s)',
  async synchronous => {
    const queue = createLearningOperationQueue()
    const error = new Error('Operation failed')
    const failed = queue.run(() => {
      if (synchronous) throw error
      return Promise.reject(error)
    })
    const next = queue.run(async () => 'recovered')
    await expect(failed).rejects.toBe(error)
    await expect(next).resolves.toBe('recovered')
  }
)
