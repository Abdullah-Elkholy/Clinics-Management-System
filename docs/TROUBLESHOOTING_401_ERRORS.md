# Troubleshooting: 401 Errors After Fixes

## Issue
Still seeing 401 errors for `GET http://localhost:5000/api/Quotas/me` even though fixes were applied.

## Root Cause Analysis

The fixes are in place in the code, but there are several reasons the 401 errors might still appear:

### 1. **Browser Cache Not Cleared**
The browser may be serving cached JavaScript from before the fixes were applied.

### 2. **Frontend Dev Server Not Fully Recompiled**
Even though the code is updated, the dev server might not have fully recompiled all modules.

### 3. **Token Not Actually Being Sent**
The Authorization header might not be getting set correctly despite the code changes.

### 4. **useAuth Hook Not Working as Expected**
The AuthProvider might not be setting `user` properly.

---

## Solution Steps

### Step 1: Hard Refresh the Browser

**Windows/Linux:**
```
Ctrl + Shift + Delete (or Ctrl + Shift + R)
```

**Mac:**
```
Cmd + Shift + Delete (or Cmd + Shift + R)
```

Or manually:
1. Open Browser DevTools (F12)
2. Go to Application tab
3. Click "Clear site data"
4. Refresh the page

### Step 2: Check Frontend Dev Server Console

Look for these messages in the dev server terminal:
```
✓ Ready in X.Xs
✓ Compiled /dashboard in XXms
```

If you see compilation errors, there's a syntax issue.

### Step 3: Verify Token is Stored

1. Open Browser DevTools (F12)
2. Go to Application → Local Storage
3. Check for `accessToken` key
4. Should contain a long JWT token starting with `eyJ`

**If NOT present:**
- User is not logged in
- Must login first at `/login`

**If PRESENT:**
- Token exists, but might not be sent in requests

### Step 4: Check Authorization Header

1. Open DevTools (F12)
2. Go to Network tab
3. Make a request to any protected endpoint
4. Look at Request Headers
5. Should see: `Authorization: Bearer eyJ...`

**If MISSING:**
- Header is not being set
- Check that `api.setAuth()` is called in `initAuth()`

---

## Debug Checklist

### Backend Status
- [ ] API running on http://localhost:5000
- [ ] Swagger accessible at http://localhost:5000/swagger
- [ ] Can login successfully

### Frontend Status
- [ ] Frontend running on http://localhost:3000
- [ ] Dev server compiled without errors
- [ ] Can navigate to pages

### Token & Auth
- [ ] localStorage has `accessToken` key
- [ ] Token is valid JWT (starts with `eyJ`)
- [ ] Authorization header present in Network tab
- [ ] Header format: `Authorization: Bearer <token>`

### Quota Endpoint
- [ ] User is logged in
- [ ] Quota hook has `enabled: !!user`
- [ ] Network tab shows request to `/api/Quotas/me`
- [ ] Response code is 200 (not 401)

---

## Advanced Troubleshooting

### Check if useAuth Hook is Working

In browser console, run:
```javascript
// Check if token is in storage
console.log('Token in storage:', localStorage.getItem('accessToken'))

// Check if header is set
console.log('API default headers:', axios.defaults.headers)
```

### Check if initAuth() Was Called

In browser console, add this to `_app.js`:
```javascript
console.log('initAuth() called')
initAuth()
console.log('Token after initAuth:', localStorage.getItem('accessToken'))
```

### Verify Quota Hook is Disabled When Not Authenticated

In React DevTools:
1. Install React DevTools Chrome extension
2. Inspect `useMyQuota` hook
3. Check `queryKey`: should be `['quota', 'me']`
4. Check `enabled`: should be `true` if logged in, `false` if not

---

## Common Issues & Solutions

### Issue: "Cannot find module 'useAuth'"
**Solution**: Ensure `import { useAuth } from './auth'` is at top of `hooks.js`

### Issue: "localStorage is not defined"
**Solution**: This is normal on SSR. Code checks `typeof window !== 'undefined'`

### Issue: "Infinite 401 retry loop"
**Solution**: 
- Ensure `enabled: !!user` is in useMyQuota
- Clear localStorage and login again
- Hard refresh browser

### Issue: "Token stored but header not sent"
**Solution**:
- Verify `api.defaults.headers.common['Authorization']` path (not just `api.defaults.headers.Authorization`)
- Check that `api.setAuth()` is actually called
- Restart dev server

---

## Step-by-Step Resolution

### For Logged-In Users Still Seeing 401:

1. **Hard refresh browser** (Ctrl+Shift+Delete or Cmd+Shift+Delete)
2. **Check browser console** for any errors
3. **Verify token in localStorage** (should have `accessToken` key)
4. **Check Network tab** for Authorization header
5. **Restart frontend dev server** if needed:
   ```bash
   cd apps/web
   npm run dev
   ```

### For Fresh Start:

1. **Clear browser cache entirely**
   - DevTools → Application → Clear site data
   
2. **Clear localStorage manually**
   ```javascript
   // In browser console
   localStorage.clear()
   ```
   
3. **Refresh page** (Ctrl+R or Cmd+R)

4. **Login again** at http://localhost:3000/login
   - Username: `admin`
   - Password: `admin`

5. **Navigate to dashboard** and check Network tab for quota requests

---

## Verification Commands

### Check Backend API

```bash
# Test login endpoint
curl -X POST http://localhost:5000/api/Auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'

# Should return:
# {"success":true,"data":{"accessToken":"eyJ..."}}
```

### Check Frontend Webpack Build

```bash
cd apps/web
npm run build
# If build succeeds, code is syntactically correct
```

---

## If All Else Fails

### Nuclear Option: Restart Everything

```bash
# Kill all Node/dotnet processes
taskkill /F /IM node.exe
taskkill /F /IM dotnet.exe

# Clear caches
rm -r apps/web/.next
rm -r apps/web/node_modules/.cache

# Reinstall dependencies
cd apps/web
npm install

# Restart servers
npm run dev

# In another terminal
cd ..
dotnet run --project src/Api
```

---

## Expected Final State

Once fixed, you should see:

1. ✅ **Login works**: Navigate to `/login`, enter credentials, get redirected to `/dashboard`
2. ✅ **No 401 errors**: Console is clean, no 401 errors
3. ✅ **Token persists**: Refresh page, still logged in
4. ✅ **Quota loads**: Dashboard shows quota display
5. ✅ **Network tab clean**: Requests have Authorization header, responses are 200 (not 401)

---

## Files Modified (Reference)

If you need to verify changes were applied:

1. `apps/web/lib/hooks.js` - Line 251-262 (useMyQuota has `enabled: !!user`)
2. `apps/web/lib/auth.js` - Lines 16-25 (loads from `accessToken` key)
3. `apps/web/pages/_app.js` - Line 11 (calls `initAuth()`)
4. `src/Api/Controllers/AuthController.cs` - Line 104 (cookie name is `refreshToken`)

All these changes should be in place for the fix to work.

