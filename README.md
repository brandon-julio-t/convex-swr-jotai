## convex-swr-jotai

Stale-While-Revalidate (SWR-like) behavior for Convex React hooks, backed by a Jotai store so data persists across route changes.

![demo](https://github.com/user-attachments/assets/bc0ae50e-df77-4388-9b74-68f57078db6a)

### What is this?

- **Problem**: `useQuery`, `useQueries`, and `usePaginatedQuery` from `convex/react` return `undefined` during refetches (e.g., when query args change). This often causes UI flicker and lost state between route changes.
- **Solution**: `src/hooks/use-query-swr.ts` provides drop-in replacements that return the last known value while new data loads:
  - **`useQuerySwr`**: SWR for a single query
  - **`useQueriesSwr`**: SWR for multiple queries
  - **`usePaginatedQuerySwr`**: SWR for paginated queries

Under the hood, results are cached in a global Jotai store keyed by the Convex function reference and its arguments. This cache survives route changes, avoiding flicker.

### Quick start

Import from `src/hooks/use-query-swr` (adjust the path/alias to your setup):

```ts
import {
  useQuerySwr,
  useQueriesSwr,
  usePaginatedQuerySwr,
} from 'src/hooks/use-query-swr'
import { api } from './convex/_generated/api'

// Single query
const messages = useQuerySwr(api.messages.list, { channelId })

// Multiple queries
const result = useQueriesSwr({
  channel: { query: api.channels.get, args: { id: channelId } },
  messages: { query: api.messages.list, args: { channelId } },
})

// Paginated query
const { results, status, loadMore } = usePaginatedQuerySwr(
  api.messages.listPaginated,
  { channelId },
  { initialNumItems: 25 },
)
```

These functions behave like their Convex counterparts, except they keep returning the last non-`undefined` value while the next result is loading.

### Feature flags

The hook file includes lightweight feature switches:

```ts
// Toggle SWR behavior on/off globally
const FEATURE_FLAG_USE_QUERY_SWR = true

// Optional verbose logging and cache inspector (see Debugging)
const __DEBUG__ = false
```

When `FEATURE_FLAG_USE_QUERY_SWR` is `false`, the exports become pass-throughs to the official Convex hooks.

### Debugging

Enable `__DEBUG__ = true` to:

- Log cache activity to the console
- Expose a helper in the browser console:

```ts
// In DevTools, inspect the in-memory SWR cache
window.__getUseQuerySwrCache__()
```

### How it works (high level)

- Results are stored in a global Jotai atom keyed by a stable query key.
- The key is computed from the Convex function reference and its arguments using `getFunctionName` and `convexToJson`.
- While a new fetch is in-flight, the hook returns the cached value instead of `undefined`.
- For `usePaginatedQuerySwr`, calling `loadMore` intentionally clears the relevant cache entry before fetching the next page to ensure new pages render fresh data.
- For `usePaginatedQuerySwr`, the first page returns a stale value if available while loading; during `loadMore` it follows Convex defaults (keeps prior items with `status: 'LoadingMore'`) without wrapping `loadMore`.

### Caveats

- You will still want to show loading indicators for background refetches; the hook prevents `undefined` flicker but does not hide ongoing network activity.
- Cache lives in-memory (Jotai default store). It resets on full page reloads.
- Designed for client usage with Convex React hooks; not a general-purpose SWR library.

### Credits

- Inspired by Convex Helpers' stable query patterns and cache key approach. See `convex-helpers` for prior art.
