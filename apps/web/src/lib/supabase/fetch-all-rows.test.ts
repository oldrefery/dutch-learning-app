import { fetchAllRows, SUPABASE_PAGE_SIZE } from './fetch-all-rows'

describe('fetchAllRows', () => {
  it('loads every page beyond the Supabase row limit', async () => {
    const source = Array.from({ length: 2284 }, (_, index) => ({ index }))
    const requestedRanges: Array<[number, number]> = []

    const result = await fetchAllRows(async (from, to) => {
      requestedRanges.push([from, to])
      return { data: source.slice(from, to + 1), error: null }
    })

    expect(result).toEqual({ data: source, error: null })
    expect(requestedRanges).toEqual([
      [0, 499],
      [500, 999],
      [1000, 1499],
      [1500, 1999],
      [2000, 2499],
    ])
  })

  it('stops at an explicit maximum while preserving page boundaries', async () => {
    const source = Array.from({ length: 6000 }, (_, index) => ({ index }))

    const result = await fetchAllRows(
      async (from, to) => ({
        data: source.slice(from, to + 1),
        error: null,
      }),
      { maxRows: 5000 }
    )

    expect(result.data).toHaveLength(5000)
    expect(result.data?.at(-1)).toEqual({ index: 4999 })
  })

  it('returns the first page error without partial data', async () => {
    const error = new Error('Request failed')

    const result = await fetchAllRows(async from => ({
      data:
        from === 0
          ? Array.from({ length: SUPABASE_PAGE_SIZE }, (_, index) => ({
              index,
            }))
          : null,
      error: from === 0 ? null : error,
    }))

    expect(result).toEqual({ data: null, error })
  })
})
