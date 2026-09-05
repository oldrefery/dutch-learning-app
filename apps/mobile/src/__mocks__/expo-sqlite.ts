/**
 * Mock expo-sqlite Database
 * Used in tests instead of real database
 */

export const openDatabaseAsync = jest.fn().mockResolvedValue({
  execAsync: jest.fn().mockResolvedValue({
    rowsAffected: 0,
  }),

  getFirstAsync: jest.fn().mockResolvedValue(null),

  getAllAsync: jest.fn().mockResolvedValue([]),

  runAsync: jest.fn().mockResolvedValue({
    lastInsertRowId: 1,
    changes: 1,
  }),

  withTransactionAsync: jest.fn(async (callback: (db: any) => Promise<any>) => {
    return callback(null)
  }),

  prepareAsync: jest.fn().mockResolvedValue({
    executeAsync: jest.fn().mockResolvedValue({
      lastInsertRowId: 1,
      changes: 1,
    }),
    getFirstAsync: jest.fn().mockResolvedValue(null),
    getAllAsync: jest.fn().mockResolvedValue([]),
    executeRawAsync: jest.fn().mockResolvedValue([]),
    finalizeAsync: jest.fn().mockResolvedValue(undefined),
  }),

  closeAsync: jest.fn().mockResolvedValue(undefined),
})
