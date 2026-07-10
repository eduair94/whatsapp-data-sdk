/**
 * Pagination envelope shared by the database / search endpoints.
 *
 * Mirrors the `mongoose-paginate-v2` shape the API uses. `totalDocs` /
 * `totalPages` are `null` unless the request opted into a count
 * (`includeCount=true`), because counting a 500M-row collection is expensive.
 */
export interface PageInfo<T> {
  docs: T[]
  totalDocs: number | null
  limit: number
  page: number
  totalPages: number | null
  hasNextPage: boolean
  hasPrevPage: boolean
  nextPage: number | null
  prevPage: number | null
  pagingCounter: number
  /** Present on some endpoints — echoes the applied filter/sort. */
  filter?: Record<string, unknown>
  [key: string]: unknown
}

/** Standard `{ success, data }` wrapper around a page of results. */
export interface PaginatedResponse<T> {
  success: boolean
  data: PageInfo<T>
  /** Present with `success:false` when a filtered search has no matches. */
  error?: string
}
