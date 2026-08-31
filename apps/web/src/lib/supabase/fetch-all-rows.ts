export const SUPABASE_PAGE_SIZE = 500

interface SupabasePage<T> {
  data: T[] | null
  error: unknown
}

interface FetchAllRowsOptions {
  maxRows?: number
  pageSize?: number
}

export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<SupabasePage<T>>,
  options: FetchAllRowsOptions = {}
): Promise<SupabasePage<T>> {
  const pageSize = options.pageSize ?? SUPABASE_PAGE_SIZE
  const maxRows = options.maxRows ?? Number.POSITIVE_INFINITY
  const rows: T[] = []

  while (rows.length < maxRows) {
    const requestedRows = Math.min(pageSize, maxRows - rows.length)
    const from = rows.length
    const result = await fetchPage(from, from + requestedRows - 1)

    if (result.error) {
      return { data: null, error: result.error }
    }

    const page = result.data ?? []
    rows.push(...page)

    if (page.length < requestedRows) {
      break
    }
  }

  return { data: rows, error: null }
}
