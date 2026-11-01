# HireMeBot Frontend — API Calls & Caching

Reference for how the student frontend talks to `StudentLambda` and how
responses are cached. Describes only what is actually implemented in the
codebase; anything not implemented is called out explicitly.

- Backend contract: [`API.md`](../API.md) (version dated 2026-10-29)
- Data-fetching library: [TanStack Query v5](https://tanstack.com/query/v5)
- HTTP layer: hand-rolled `fetch` wrapper, no axios

---

## 1. Backend API calls

### Where the GET is actually issued

Only one place in the code calls the backend:

- **`LiveStudentService.getDashboard`** in
  [`src/features/student/data/studentService.ts`](../src/features/student/data/studentService.ts)
  — one line that delegates to the HTTP helper:

  ```ts
  return studentHttpGet<DashboardResponse>('/api/v1/student/applications', opts)
  ```

  It passes **no query params**, matching `API.md`'s hard rejection of
  `date`, `page`, `size`, `week`, `month`.

### The HTTP wrapper

- **`studentHttpGet<T>(path, opts)`** in
  [`src/features/student/data/http.ts`](../src/features/student/data/http.ts).
  - URL built via `joinUrl(apiBaseUrl, path)` — when `apiBaseUrl` is empty
    (the default when `VITE_API_BASE_URL` is unset in `.env.local`), the
    URL is **relative** so the browser hits
    `http://localhost:5173/api/...` and the **Vite dev proxy** (configured
    in [`vite.config.ts`](../vite.config.ts) `server.proxy['/api']`)
    forwards to `http://127.0.0.1:3000`.
  - Headers: `Accept: application/json`,
    `X-Dev-Student-Id: <env.DEV_STUDENT_ID>`.
  - `credentials: 'omit'` — dev auth is header-based.
  - `signal` is the `AbortSignal` TanStack Query supplies, so a navigation
    away cancels the in-flight fetch.
  - On a 2xx with `{ success: true, data: T }` → returns `data`.
  - Else throws **`ApiError`** (defined in the same file) with `status`,
    server `code`, `message`, optional `details`.
  - Network failures become `ApiError({ status: 0 })` with
    `isNetwork === true`.

### Request flow from React to the backend

A component mounts → calls `useStudentDashboard()` → TanStack Query decides
whether to run the `queryFn` → if yes, `queryFn` calls
`studentService.getDashboard(signal)` → the service factory `pickImpl()`
picks `LiveStudentService` based on `env().STUDENT_API_MODE` →
`LiveStudentService.getDashboard` calls `studentHttpGet` → `fetch` → Vite
proxy → StudentLambda. Nothing else touches the backend.

### Loading / error states

Entirely driven by TanStack Query's query state, consumed in the pages:

- **Loading** — `isLoading || !data` → each page renders its own skeleton
  (`DashboardSkeleton` in
  [`StudentDashboardPage.tsx`](../src/features/student/pages/StudentDashboardPage.tsx),
  `ApplicationsSkeleton` in
  [`StudentApplicationsPage.tsx`](../src/features/student/pages/StudentApplicationsPage.tsx),
  `DetailsSkeleton` in
  [`ApplicationDetailsPage.tsx`](../src/features/student/pages/ApplicationDetailsPage.tsx)).
- **Error** — `isError` → an alert card (`DashboardErrorCard` /
  `ApplicationsErrorCard` / `ErrorView`) with the server message and a
  **Retry** button that calls `refetch()`. The dashboard never shows
  cached mock numbers inside its error state (verified by the test
  "shows an error state with a Retry action and no fabricated numbers
  when the API fails" in
  [`StudentDashboardPage.test.tsx`](../src/features/student/__tests__/StudentDashboardPage.test.tsx)).
- **Fetched** — rendered via `DashboardLoaded`, etc.

**Not implemented:** optimistic updates, toasts on error, exponential
backoff beyond TanStack Query's default `retry: 1`.

---

## 2. Frontend caching (TanStack Query)

### Where it's configured

[`src/main.tsx`](../src/main.tsx) creates the shared `QueryClient` once
with these defaults:

```ts
new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 60 * 60 * 1000,   // 1 hour
      gcTime:   2 * 60 * 60 * 1000 // 2 hours
    }
  }
})
```

The dashboard hook in
[`src/features/student/hooks/useStudentDashboard.ts`](../src/features/student/hooks/useStudentDashboard.ts)
**re-states** `staleTime: 1h`, `gcTime: 2h`,
`refetchOnWindowFocus: false`, and additionally sets
`refetchInterval: 1h` with `refetchIntervalInBackground: false`. It
deliberately **omits `retry`** so it inherits the client default (so tests
can override with `retry: false`).

**Hourly refresh while active, no polling when idle.** The 1-hour
`refetchInterval` makes an actively-open dashboard refresh itself every
hour without any user action. Because `refetchIntervalInBackground` is
`false` (and that is the TanStack Query v5 default), the interval timer
**pauses whenever the tab is hidden** — closing the tab, backgrounding
it, or locking the laptop stops the polling. When the tab becomes
visible again, the timer resumes from its next scheduled tick (not
immediately — reporting-date rollover is still handled explicitly, see
"Midnight invalidation" below).

### Cache key

```ts
// studentDashboardKey() in useStudentDashboard.ts
['student-dashboard', String(studentId ?? env().DEV_STUDENT_ID ?? 'unknown')]
```

So in a typical dev session the key is literally
`['student-dashboard', '1000000002']`.

### Hit vs. miss

- **Fresh hit (< 1 h since fetch)** — `useQuery` returns the cached object
  synchronously, no network.
- **Stale hit (> 1 h since fetch)** — cached object returned instantly,
  **and** a background refetch is kicked off; `isFetching` goes true during
  it. Users see the old number until the new one lands.
- **Miss / nothing cached** — spinner path; `queryFn` runs, result cached
  under the key.

### Shared consumers

Four places subscribe to the same key, so TanStack Query dedupes them to
**one** actual fetch:

| File | Why it subscribes |
|---|---|
| [`StudentLayout.tsx`](../src/components/layout/StudentLayout.tsx) | needs `data.statistics.timezone` + `data.date` to drive the midnight-rollover scheduler |
| [`StudentDashboardPage.tsx`](../src/features/student/pages/StudentDashboardPage.tsx) | renders stats + preview tiles |
| [`StudentApplicationsPage.tsx`](../src/features/student/pages/StudentApplicationsPage.tsx) | renders `data.pages` with Prev/Next |
| [`ApplicationDetailsPage.tsx`](../src/features/student/pages/ApplicationDetailsPage.tsx) | scans all `data.pages[*]` for the id |

### Navigating between dashboard pages

Zero new requests. The layout fetches first (because it's mounted at the
`/student` route level); subsequent navigation to `/student/dashboard`,
`/student/applications`, or `/student/applications/:id` is a cache hit for
60 minutes. This is verified by the test "Prev/Next pagination navigates
data.pages without triggering extra service calls" in
[`StudentApplicationsPage.test.tsx`](../src/features/student/__tests__/StudentApplicationsPage.test.tsx)
and "reads from the dashboard cache without triggering a service call" in
[`ApplicationDetailsPage.test.tsx`](../src/features/student/__tests__/ApplicationDetailsPage.test.tsx).

---

## 3. Cache refresh & invalidation

### The 1-hour "refresh"

Two paths:

1. **Automatic (hourly, while active).** `refetchInterval: 1h` in
   `useStudentDashboard` schedules a refetch roughly once an hour while a
   subscriber is mounted AND the tab is visible. The browser pauses the
   timer whenever the tab is hidden, so a backgrounded tab does not
   generate traffic.
2. **On demand.** The dashboard header's **Refresh** button calls
   `refetch()`, which issues one request immediately regardless of stale
   state.

`staleTime: 1h` separately decides when the cached value is considered
*stale* for the purposes of mount-time refetches. Even if the interval
tick is missed (e.g. tab was in background), the next observer mount after
staleness also triggers a refetch.

### When a refetch fails after a prior success

Both `StudentDashboardPage` and `StudentApplicationsPage` detect this via
`useQuery`'s `isRefetchError` + `data` combination and render a small
amber **"Showing previously loaded data. Refresh failed: ..."** banner at
the top of the page with its own Retry button. The underlying cached
numbers continue to render underneath so the user still sees content, but
the banner makes it clear they are not fresh. Verified by
[`StudentDashboardPage.refetchError.test.tsx`](../src/features/student/__tests__/StudentDashboardPage.refetchError.test.tsx).

### Browser refresh (F5 / Ctrl+Shift+R)

Full page reload → `QueryClient` is reconstructed empty (no persistence
configured). First mount of `useStudentDashboard` → **one** Lambda call.

### Close & reopen

Same as browser refresh — in-memory cache evaporates when the tab closes.
No `IndexedDB` / `localStorage` persister is wired up. The service worker
(`vite-plugin-pwa`) explicitly **denylists `/api/*`** so even offline it
will never serve a stale dashboard — see
[`vite.config.ts`](../vite.config.ts) `workbox.navigateFallbackDenylist`.

### Midnight invalidation in `statistics.timezone`

Driven by
[`src/features/student/lib/reportingDate.ts`](../src/features/student/lib/reportingDate.ts),
mounted exactly once at `StudentLayout`:

- `msUntilNextMidnightInZone(timeZone)` computes the real time delta to
  tomorrow 00:00 in the server-reported zone (DST-aware via
  `Intl.DateTimeFormat`).
- `setTimeout(invalidate, delta)` schedules the invalidation —
  `queryClient.invalidateQueries({ queryKey: ['student-dashboard'] })` uses
  the **prefix match**, so it invalidates every entry regardless of
  student id.
- Additionally, `window.addEventListener('focus')` and
  `document.visibilitychange` listeners re-check: if
  `currentDateInZone(timeZone) !== cachedDate`, invalidate immediately.
  This covers the "laptop was asleep past midnight" case where the timer
  may have been throttled.

An invalidated query re-runs the next time an observer looks at it (which
is immediate, since the layout is still mounted). Verified by the
"invalidates the student-dashboard query when the midnight timer fires"
test in
[`reportingDate.test.tsx`](../src/features/student/lib/__tests__/reportingDate.test.tsx).

### Logout

[`src/features/auth/AuthProvider.tsx`](../src/features/auth/AuthProvider.tsx)
in `logout`:

```ts
await authService.logout()
setUserState(null)
queryClient.removeQueries({ queryKey: ['student-dashboard'] })
```

`removeQueries` with a prefix wipes **every**
`['student-dashboard', *]` entry, so the next student who signs in on the
same device cannot read the prior student's data. Verified by
[`AuthProvider.cacheIsolation.test.tsx`](../src/features/auth/__tests__/AuthProvider.cacheIsolation.test.tsx).

### Recruiter creates a new application while the student's cache is still fresh

**The frontend does not know and will not show it until the cache is
invalidated or the user hits Refresh.** There is no polling, no WebSocket,
no SSE, no `refetchInterval`, and no backend push mechanism in the
project. Exactly as documented in the plan under "Not implemented". The
recruiter can POST 20 new applications and the student's dashboard will
keep showing the stale values until one of: midnight rollover, 1-hour
staleness + an observer mount, the Refresh button, or a reload.

---

## 4. Pagination

### How `data.pages` is handled

The backend returns every page inlined under
`data.pages: Record<string, Application[]>`. In
[`StudentApplicationsPage.tsx`](../src/features/student/pages/StudentApplicationsPage.tsx)
the pages are **flattened once** into a single ordered list; search runs
across the flattened list, and the filtered result is re-paginated
locally into chunks of `data.pageSize` for display:

```ts
const allApplications = Object.keys(data.pages)
  .map((k) => ({ key: Number(k), items: data.pages[k] ?? [] }))
  .sort((a, b) => a.key - b.key)
  .flatMap((p) => p.items)

const matched = allApplications.filter(/* query predicate */)

const totalPagesForView = Math.ceil(matched.length / pageSize)
const currentPageItems  = matched.slice((pageNum - 1) * pageSize, pageNum * pageSize)
```

Prev/Next buttons mutate `pageNum` state only. Because `data.pages` lives
entirely in one TanStack Query cache entry, no network call is involved.

```ts
useEffect(() => { setPageNum(1) }, [query, data?.date])   // reset on new search OR reporting-date change
useEffect(() => {                                          // clamp if filtered result shrinks past current pageNum
  if (totalPagesForView > 0 && pageNum > totalPagesForView) setPageNum(1)
}, [totalPagesForView, pageNum])
```

### Does switching pages trigger another backend call?

No. One call for the whole dashboard, repeated local state transitions
for pagination and for search. The spy-count assertion in the pagination
test proves this: `expect(spy).toHaveBeenCalledTimes(1)` after clicking
Next and Prev.

### Search / filter across cached pages

Search spans **every cached application** (all pages, flattened), not
just the active page. Filtering is applied first, then the filtered list
is re-paginated into local chunks of `pageSize`:

```ts
return allApplications.filter(
  (app) =>
    app.companyName.toLowerCase().includes(q) ||
    app.jobTitle.toLowerCase().includes(q)
)
```

Typing a new search term resets the pagination state to Page 1 of the
filtered result. Verified by "search spans every cached page, not just
the current one" and "resets to page 1 when the search query changes" in
[`StudentApplicationsPage.test.tsx`](../src/features/student/__tests__/StudentApplicationsPage.test.tsx).

No cross-day search — the dashboard endpoint only returns today's rows.

---

## 5. Mock vs. live mode

### How the switch works

- [`src/lib/env.ts`](../src/lib/env.ts) exports a lazy `env()` function
  that reads `import.meta.env.VITE_STUDENT_API_MODE` on every call
  (`'live'` → live; anything else, including unset, → `'mock'`). Lazy
  evaluation is important so Vitest can switch modes per test via
  `vi.stubEnv`.
- [`src/features/student/data/studentService.ts`](../src/features/student/data/studentService.ts)
  exposes a thin facade whose `getDashboard` runs `pickImpl()` on every
  call:

  ```ts
  function pickImpl(): StudentService {
    const mode = env().STUDENT_API_MODE
    if (!cachedImpl || cachedMode !== mode) {
      cachedImpl = mode === 'live' ? new LiveStudentService() : new MockStudentService()
      cachedMode = mode
    }
    return cachedImpl
  }
  ```

- `MockStudentService.getDashboard` returns `structuredClone(MOCK_DASHBOARD)`
  from
  [`src/features/student/data/mockApplications.ts`](../src/features/student/data/mockApplications.ts)
  — same shape as the real response, zero network.
- `LiveStudentService.getDashboard` calls the HTTP wrapper.

### How the frontend picks

Only `env().STUDENT_API_MODE`. Nothing else. When `.env.local` sets it to
`live`, data is read from the real backend; when unset or `mock`, the
in-process `MOCK_DASHBOARD` is used.

### Live mode is restricted to local development

Two guards prevent an accidentally-public deployment that would ship with
the dev-only `X-Dev-Student-Id` header:

1. **Build-time** — [`vite.config.ts`](../vite.config.ts) refuses to
   produce a production bundle if `VITE_STUDENT_API_MODE=live` is set.
2. **Runtime** — [`src/lib/env.ts`](../src/lib/env.ts) `assertLiveEnv()`
   throws `InsecureLiveModeError` if a built bundle is running in prod
   (`import.meta.env.DEV === false`) with live mode configured. The
   error surfaces in the Dashboard error card so the mis-config is
   impossible to miss.

Both are verified by [`src/lib/__tests__/env.test.ts`](../src/lib/__tests__/env.test.ts).

### Does an API failure ever cause mock data to appear in live mode?

**No.** `LiveStudentService` throws `ApiError` on any non-success.
TanStack Query flips the hook to `isError`. Pages render the error card
with a Retry button. There is no `try/catch { return MOCK_DASHBOARD }`
anywhere in the live path — grep for `MOCK_DASHBOARD` in `src/`: it is
imported only by `MockStudentService` and by test files.

---

## End-to-end flow diagram

```
UI component mounts
(StudentLayout, StudentDashboardPage, StudentApplicationsPage, or ApplicationDetailsPage)
   │
   │  useStudentDashboard()
   ▼
useQuery({
   queryKey: ['student-dashboard', '1000000002'],
   queryFn:  () => studentService.getDashboard({ signal }),
   staleTime: 1h,  gcTime: 2h,  refetchOnWindowFocus: false
})
   │
   ├── cache has an entry AND it is fresh (< 1h)
   │       → return cached DashboardResponse synchronously
   │       → no queryFn run, no fetch, no Lambda call
   │
   ├── cache has an entry BUT it is stale (> 1h) or has been invalidated
   │       → return cached DashboardResponse immediately
   │       → ALSO run queryFn in the background (one new Lambda call)
   │
   └── cache has NO entry
           → run queryFn (one Lambda call), then populate cache
                │
                ▼
       studentService.getDashboard(signal)
                │
                ▼
       pickImpl()  — reads env().STUDENT_API_MODE
                │
                ├── 'mock' → MockStudentService → structuredClone(MOCK_DASHBOARD)  [no network]
                │
                └── 'live' → LiveStudentService
                                │
                                ▼
                     studentHttpGet<T>('/api/v1/student/applications', {signal})
                                │
                                ▼
                     fetch(url, {
                        method: 'GET',
                        headers: { Accept: 'application/json',
                                   'X-Dev-Student-Id': '1000000002' },
                        credentials: 'omit',
                        signal
                     })
                                │
                                ▼
                     Vite dev proxy /api  →  http://127.0.0.1:3000
                                │
                                ▼
                            StudentLambda  (one invocation)
                                │
                                ├── 200 { success:true, data } → return data
                                └── else → throw ApiError  → isError, show Retry card
```

---

## Scenarios → does it invoke StudentLambda?

| # | Scenario | New Lambda call? | Where in code |
|---|---|---|---|
| 1 | First page load (cache empty) | **Yes — 1** | `useStudentDashboard` miss → `queryFn` |
| 2 | Navigating Dashboard → Applications → Profile → Dashboard within the hour | **No** | shared cache hit on key `['student-dashboard', studentId]` |
| 3 | Clicking Prev or Next on Today's Applications | **No** | `setPageNum` state only; renders `data.pages[String(pageNum)]` |
| 4 | Clicking a card → Application Details | **No** | details page reads from the shared cache |
| 5 | Hard-refresh a details URL in a new tab | **Yes — 1** | fresh `QueryClient`, cold cache; details page triggers one dashboard fetch |
| 6 | Clicking the header Refresh button | **Yes — 1** | `refetch()` call (ignores `staleTime`) |
| 7 | Searching within Today's Applications | **No** | filters `currentPageItems` locally |
| 8 | Browser refresh / page reload | **Yes — 1** | in-memory cache lost; first observer mount re-fetches |
| 9 | Close tab, reopen later same day | **Yes — 1** | no persistence; same as reload |
| 10 | Opening the app at 11:59 PM, still open at 12:01 AM (CT) | **Yes — 1** | `useReportingDateInvalidation` timer fires at midnight → `invalidateQueries` → observer still mounted re-fetches |
| 11 | Laptop asleep past midnight, user clicks back in at 7 AM | **Yes — 1** | `focus`/`visibilitychange` listener compares `currentDateInZone(tz)` to cached `data.date`, invalidates on mismatch |
| 12 | Recruiter creates new applications mid-session | **No** (until one of #6, #8, #10, #11, or stale + new mount) | no polling / push |
| 13 | Student logs out and signs back in as same student | **Yes — 1** | `removeQueries(['student-dashboard'])` on logout clears cache |
| 14 | Student A logs out, Student B logs in on same device | **Yes — 1** (for Student B) | same cache removal, new fetch with Student B's id |
| 15 | API returns 503 / network error | **Yes** (one call that fails) + possibly one retry (`retry: 1` default) | `isError` → red card with Retry button; **no mock fallback** |
| 16 | Clicking Retry after an error | **Yes — 1** | `refetch()` |
| 17 | Visiting Notifications / Profile only | **No** | `useStudentDashboard` is also mounted at `StudentLayout`, so the first entry into `/student` does trigger scenario #1, but staying inside the student shell afterward does not add any calls |
| 18 | `VITE_STUDENT_API_MODE=mock` (default) | **No** | `MockStudentService` returns in-process `MOCK_DASHBOARD` |

### What is **not** implemented (so you don't over-estimate the cost)

- No `persistQueryClient` → cache does not survive a reload.
- No WebSocket / SSE / push to notify the student of recruiter-created rows.
- No shared SW cache for `/api/*` responses — explicitly denylisted AND
  pinned to a `NetworkOnly` runtime caching rule (defense in depth).
- No multi-student concurrency: `env().DEV_STUDENT_ID` is a single string
  from `.env.local` until Cognito replaces it.
- Live mode is intentionally blocked at build-time AND run-time in a
  production bundle until the dev-only `X-Dev-Student-Id` header is
  replaced by Cognito/JWT.

Each of the above is a one-line change in
[`useStudentDashboard.ts`](../src/features/student/hooks/useStudentDashboard.ts),
[`vite.config.ts`](../vite.config.ts), or
[`env.ts`](../src/lib/env.ts) when the time comes to turn it on.

### Service worker — explicit guarantees for `/api/*`

[`vite.config.ts`](../vite.config.ts) `workbox` block:

- `globPatterns` + `globIgnores: ['**/api/**']` → precache never includes
  any API response.
- `navigateFallbackDenylist: [/^\/api/, /^\/auth\/callback/]` → the SPA
  shell fallback never intercepts API requests.
- `runtimeCaching[0]` is a dedicated `NetworkOnly` handler for
  `url.pathname.startsWith('/api/')` → every `/api/*` request is handed
  straight to the network with **no SW caching** whatsoever.
- The image caching rule explicitly excludes `/api/*` for belt-and-suspenders.

Private student data stays only in the in-memory TanStack Query cache,
which evaporates on tab close.
