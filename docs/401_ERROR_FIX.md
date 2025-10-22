# 401 Unauthorized Error Fix - Complete Solution

## Problem Summary
When authenticated users navigated to the dashboard, they were receiving repeated `401 Unauthorized` errors on the `/api/Quotas/me` endpoint despite being logged in. The browser console showed multiple retry attempts happening in quick succession.

## Root Cause Analysis

The issue was a **race condition** during page load and HMR (Hot Module Replacement) events:

1. **Timing Issue**: When the app loaded or HMR reconnected, `useMyQuota` query would attempt to fetch BEFORE the AuthProvider had completed:
   - Determining if a token existed
   - Setting the Authorization header
   - Fetching the current user

2. **Missing Ready State**: There was no clear signal indicating when auth initialization was complete, causing `useMyQuota` to start fetching too early with no valid token

3. **Retry Loop**: When the first request failed (no auth header yet), TanStack Query's retry mechanism would attempt 3 more times, creating the observed error flood

## Solution Implemented

### 1. **Improved AuthProvider** (`apps/web/lib/auth.js`)

**What Changed:**
- ✅ Token header is set **immediately** when the component initializes (in useState initialization)
- ✅ Added `isReady` state to track when auth initialization is complete
- ✅ Auth is marked ready when:
  - No token exists (unauthenticated user), OR
  - Token exists AND user query has finished loading (authenticated user)
- ✅ Better error handling with console logging
- ✅ Retry limit set to 1 for user query (no retry loop)
- ✅ Safe localStorage access with try-catch

**Key Addition:**
```javascript
// Auth is ready when either:
// 1. If there's a token, the user query has finished loading
// 2. If there's no token, immediately
if (!token || !userLoading) {
  setAuthReady(true)
}
```

### 2. **Improved useMyQuota Hook** (`apps/web/lib/hooks.js`)

**What Changed:**
- ✅ Now checks `authReady` state from context
- ✅ Quota fetch is conditional on ALL three conditions:
  1. `authReady` - Auth initialization is complete
  2. `!!user` - User is authenticated
  3. `!userIsLoading` - User query has finished loading
- ✅ Exponential backoff retry strategy (max 2 retries)

**Key Update:**
```javascript
const shouldFetch = authReady && !!user && !userIsLoading

return useQuery({
  queryKey: ['quota', 'me'],
  queryFn: () => api.get('/api/Quotas/me').then(res => res.data.data),
  enabled: shouldFetch,
  retry: 2, // Retry twice with exponential backoff
  retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
})
```

### 3. **Improved API Interceptor** (`apps/web/lib/api.js`)

**What Changed:**
- ✅ Better error logging for debugging
- ✅ When token refresh fails, immediately clear auth
- ✅ Clean up localStorage on refresh failure

---

## How It Works Now - Step by Step

### On Initial Page Load:

1. **Page loads** → `_app.js` calls `initAuth()`
2. **initAuth()** reads token from localStorage and sets Authorization header immediately
3. **AuthProvider mounts** with token from localStorage
4. **useQuery runs** to fetch current user (because `!!token` is true)
5. **Auth marked ready** once user query completes (either with user data or null on error)
6. **useMyQuota checks** `authReady && !!user && !userIsLoading` → only fetches if all true
7. ✅ Request has Authorization header set

### On Login:

1. User submits credentials
2. Backend returns `{ success: true, data: { accessToken: "..." } }`
3. Login page calls `login(token)` from useAuth hook
4. **login() function:**
   - Stores token in localStorage
   - Sets Authorization header immediately
   - Calls `setToken(newToken)` to update state
   - Invalidates all queries (triggers user query refetch)
5. **AuthProvider:**
   - Detects token change
   - Ensures header is set
   - User query runs immediately
6. **Once user data fetched:**
   - Auth marked as ready
   - useMyQuota enables and fetches quota
7. ✅ Dashboard loads with user data and quota

### On HMR Reconnect:

1. Code changes compile and HMR reconnects
2. Component tree resets but context persists (React 18+)
3. **AuthProvider:**
   - Reinitializes from localStorage
   - Sets header immediately
   - User query re-runs
4. **Once ready:**
   - useMyQuota re-enables and fetches
5. ✅ Updated code is live with no 401 errors

---

## Files Modified

| File | Changes | Reason |
|------|---------|--------|
| `apps/web/lib/auth.js` | Added `isReady` state, better error handling, improved user query logic | Properly track auth initialization completion |
| `apps/web/lib/hooks.js` | Added `authReady` check to `useMyQuota`, exponential backoff retry | Prevent premature quota fetching |
| `apps/web/lib/api.js` | Enhanced error logging, clear auth on refresh failure | Better debugging and error recovery |

---

## Testing the Fix

### Test 1: Fresh Login Flow
1. Open browser to `http://localhost:3000/login`
2. Enter credentials (admin/admin)
3. Click login
4. ✅ Should redirect to dashboard WITHOUT any 401 errors
5. Open DevTools Console → should be clean
6. Open Network tab → requests should have `Authorization: Bearer ...` header

### Test 2: Page Reload While Logged In
1. Navigate to dashboard
2. Press F5 to reload page
3. ✅ Should stay logged in WITHOUT 401 errors
4. Quota should load immediately
5. Check localStorage: should have `accessToken` key

### Test 3: HMR Rebuild
1. Make a small code change (e.g., add a console.log)
2. Save file → watch for "[Fast Refresh] rebuilding" in console
3. Wait for "[Fast Refresh] done"
4. ✅ Dashboard should still work WITHOUT 401 errors
5. No refresh needed

### Test 4: Token Expiration
1. Manually delete `accessToken` from localStorage in DevTools
2. Refresh page
3. ✅ Should redirect to login (not stuck on 401 errors)
4. Can login again normally

### Test 5: Invalid Token Recovery
1. Modify token in localStorage to something invalid
2. Refresh page
3. ✅ Should receive 401 but NOT retry infinitely
4. Should redirect to login cleanly

---

## Expected Behavior - Console Output

### On Fresh Page Load (Logged In):
```
[HMR] connected
[HMR] compiled successfully
// No 401 errors
// Quota data loads successfully
```

### On Login Page:
```
[HMR] connected
// No errors until login attempted
// After login: redirects to dashboard
```

### On Error Recovery:
```
[API] Refresh token failed: 401
// (one error, then cleanup and redirect)
```

---

## Troubleshooting

### If Still Seeing 401 Errors:

1. **Hard refresh browser** (Ctrl+Shift+Delete or Cmd+Shift+Delete)
   - Clears all cached JavaScript

2. **Check localStorage** in DevTools:
   - Should have `accessToken` key with JWT value
   - Should start with `eyJ...`

3. **Check Network tab** before making request:
   - Request should have `Authorization: Bearer eyJ...` header
   - NOT `Authorization: Bearer undefined`
   - NOT missing the header entirely

4. **Check auth context values**:
   - Open React DevTools
   - Find AuthProvider in component tree
   - Check context value: `{ user: {...}, isReady: true, isAuthenticated: true, ... }`

5. **Check dev server logs**:
   - Should see `[HMR] compiled successfully`
   - Should NOT see compilation errors

### If Backend Receiving 401:

1. Check JWT token is valid:
   - Copy token from localStorage
   - Decode at jwt.io
   - Should have `userId`, `username`, `role` claims
   - Should NOT be expired

2. Check backend is validating correctly:
   - Server should check for `Authorization: Bearer ...` header
   - Server should extract token from header (not cookie for JWT)
   - Server should validate token signature

3. Check CORS and cookies:
   - Axios is configured with `withCredentials: true`
   - Refresh token cookie should be sent automatically
   - Check backend allows credentials

---

## Performance Improvements

These changes also improve performance:

1. **Fewer API calls**: useMyQuota only fetches when truly authenticated
2. **No retry storms**: Limited retries with exponential backoff
3. **Better caching**: User query is cached with `staleTime: Infinity`
4. **Faster initial load**: Auth header set synchronously on app mount

---

## Summary of Fixes

| Issue | Before | After |
|-------|--------|-------|
| **Auth header timing** | Set asynchronously in effect | Set synchronously on mount |
| **Quota fetch timing** | Could fetch before auth ready | Waits for `authReady` flag |
| **Retry behavior** | Unlimited retries | 2 retries with backoff |
| **Error handling** | Silent failures | Console logging for debugging |
| **HMR stability** | Could cause 401 loops | Handles state cleanup properly |
| **localStorage** | Unprotected access | Wrapped in try-catch |

All these fixes combine to prevent the race condition and create a robust authentication flow that works reliably across page loads, logins, and HMR rebuilds.
