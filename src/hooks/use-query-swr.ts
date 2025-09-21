/**
 * All hooks inspired from:
 * @see https://github.com/get-convex/convex-helpers/blob/main/src/hooks/useStableQuery.ts
 *
 * Just that rather than `useRef`, we use jotai's atom to store the cache
 * because values from `useRef` is gone when we switch page
 * so we need something that can persist through page switches
 */

import {
  type RequestForQueries,
  usePaginatedQuery,
  useQueries,
  useQuery,
} from 'convex/react'
import {
  type FunctionArgs,
  type FunctionReference,
  getFunctionName,
} from 'convex/server'
import { convexToJson } from 'convex/values'
import { atom, getDefaultStore } from 'jotai'
import React from 'react'

/**
 * Feature flag to quickly enable/disable the SWR feature in case of bug emergencies.
 *
 * If we want to completely remove SWR, just tell this to grok-code-fast-1 or some other LLM to refactor the codebase back to `convex/react`.
 */
const FEATURE_FLAG_USE_QUERY_SWR = true

const store = getDefaultStore()

const cacheAtom = atom<Record<string, unknown>>({})

/**
 * This one is self-made, a missing piece from the Convex team.
 */
export const useQueriesSwr = !FEATURE_FLAG_USE_QUERY_SWR
  ? useQueries
  : (((queries: RequestForQueries) => {
      const result = useQueries(queries)

      const isLoading = Object.values(result ?? { a: undefined }).some(
        (v) => v === undefined,
      )

      const key = React.useMemo(() => {
        const newMap: Record<string, unknown> = {}

        for (const [key, { query, args }] of Object.entries(queries)) {
          newMap[key] = createQueryKey(query, args)
        }

        return JSON.stringify(newMap)
      }, [queries])

      React.useEffect(() => {
        if (!isLoading) {
          log('[useQueriesSwr] update cache', { key, result })

          store.set(cacheAtom, { ...store.get(cacheAtom), [key]: result })
        }

        // `result` is the only thing that matters when updating the `cacheAtom`
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [result])

      const stale = store.get(cacheAtom)[key]

      log('[useQueriesSwr] stale', { key, stale })

      return isLoading ? (stale ?? result) : result
    }) as typeof useQueries)

/**
 * Drop-in replacement for useQuery intended to be used with a parametrized query.
 * Unlike useQuery, useStableQuery does not return undefined while loading new
 * data when the query arguments change, but instead will continue to return
 * the previously loaded data until the new data has finished loading.
 *
 * See https://stack.convex.dev/help-my-app-is-overreacting for details.
 *
 * @param name - string naming the query function
 * @param ...args - arguments to be passed to the query function
 * @returns UseQueryResult
 *
 * @see https://github.com/get-convex/convex-helpers/blob/main/src/hooks/useStableQuery.ts#L16
 */
export const useQuerySwr = !FEATURE_FLAG_USE_QUERY_SWR
  ? useQuery
  : (((name, ...args) => {
      const result = useQuery(name, ...args)

      const key = createQueryKey(name, args)

      React.useEffect(() => {
        if (result !== undefined) {
          log('[useQuerySwr] update cache', { key, result })
          store.set(cacheAtom, { ...store.get(cacheAtom), [key]: result })
        }

        // `result` is the only thing that matters when updating the `cacheAtom`
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [result])

      const stale = store.get(cacheAtom)[key]
      log('[useQuerySwr] stale', { key, stale })
      return result === undefined ? (stale ?? result) : result
    }) as typeof useQuery)

/**
 * Drop-in replacement for usePaginatedQuery for use with a parametrized query.
 * Unlike usePaginatedQuery, when query arguments change useStablePaginatedQuery
 * does not return empty results and 'LoadingMore' status. Instead, it continues
 * to return the previously loaded results until the new results have finished
 * loading.
 *
 * See https://stack.convex.dev/help-my-app-is-overreacting for details.
 *
 * @param name - string naming the query function
 * @param ...args - arguments to be passed to the query function
 * @returns UsePaginatedQueryResult
 *
 * @see https://github.com/get-convex/convex-helpers/blob/main/src/hooks/useStableQuery.ts#L43
 */
export const usePaginatedQuerySwr = !FEATURE_FLAG_USE_QUERY_SWR
  ? usePaginatedQuery
  : (((name, ...args) => {
      const result = usePaginatedQuery(name, ...args)

      // This still works, just typing stuff
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const key = createQueryKey(name, args as any)

      const loadMore: typeof result.loadMore = React.useCallback(
        (numItems) => {
          log('[usePaginatedQuerySwr] loadMore', numItems)

          const originalLoadMore = result.loadMore

          // need to remove the cache so
          // that when new page comes in
          // it does not use the old page and will show the new page
          const cache = { ...store.get(cacheAtom) }
          delete cache[key]
          store.set(cacheAtom, cache)

          originalLoadMore(numItems)
        },
        [key, result.loadMore],
      )

      React.useEffect(() => {
        if (
          result.status !== 'LoadingMore' &&
          result.status !== 'LoadingFirstPage'
        ) {
          log('[usePaginatedQuerySwr] update cache', { key, result })
          store.set(cacheAtom, { ...store.get(cacheAtom), [key]: result })
        }

        // `result.status` is the only thing that matters when updating the `cacheAtom`
        // when `result.status` changes from `LoadingMore` or `LoadingFirstPage` to something else, we know that `result` is not `undefined`
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [result.status])

      const stale = store.get(cacheAtom)[key] as typeof result
      log('[usePaginatedQuerySwr] stale', { key, stale })
      const finalResult =
        result.status === 'LoadingFirstPage' ? (stale ?? result) : result
      return { ...finalResult, loadMore }
    }) as typeof usePaginatedQuery)

/**
 * Generate a query key from a query function and its arguments.
 * @param query Query function reference like api.foo.bar
 * @param args Arguments to the function, like { foo: "bar" }
 * @returns A string key that uniquely identifies the query and its arguments.
 *
 * Stolen from:
 * @see https://github.com/get-convex/convex-helpers/blob/main/packages/convex-helpers/react/cache/hooks.ts#L174
 */
function createQueryKey<Query extends FunctionReference<'query'>>(
  query: Query,
  args: FunctionArgs<Query>,
): string {
  const queryString = getFunctionName(query)
  const key = [queryString, convexToJson(args)]
  const queryKey = JSON.stringify(key)
  return queryKey
}

/**
 * Feature flag to quickly enable/disable the debug mode.
 * It exposes the `__getUseQuerySwrCache__` function in the browser console to inspect the cache object.
 * It also logs the function activities for o11y.
 */
const __DEBUG__ = false

if (typeof window !== 'undefined' && __DEBUG__) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).__getUseQuerySwrCache__ = function () {
    return store.get(cacheAtom)
  }
}

const log: typeof console.log = __DEBUG__ ? console.log : () => {}
