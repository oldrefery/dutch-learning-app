/**
 * Serialize complete learning operations, including reads used to prepare writes.
 * This is an in-process boundary, not a replacement for SQLite transactions or
 * server revision checks. Call only at entry points: nested acquisition deadlocks.
 */
export function createLearningOperationQueue() {
  let tail: Promise<void> = Promise.resolve()
  return {
    run<T>(operation: () => Promise<T>): Promise<T> {
      const result = tail.then(operation)
      // A failed operation must not poison the queue or lose its caller's error.
      tail = result.then(
        () => undefined,
        () => undefined
      )
      return result
    },
  }
}

// The database and authenticated transport are shared across accounts and routes.
// Recheck ownership inside each queued operation, after waiting for its turn.
export const learningOperationQueue = createLearningOperationQueue()
