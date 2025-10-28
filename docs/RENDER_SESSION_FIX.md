# Render Session Fix - Organization Selection Issue

## Problem Diagnosis

### Symptoms
- App starts successfully on Render
- User can login and see organizations list at `/auth/select`
- **Organization selection fails** - clicking organization does nothing
- Session data not persisting between requests
- Logs show successful setup checks but no organization selection

### Root Cause
The session cookie was not being properly set/sent in production due to:

1. **Missing `proxy: true`** - Required when behind Render's reverse proxy
2. **Missing `sameSite: 'lax'`** - Required for cookies in production
3. **Wrong cookie domain** - Needed `.onrender.com` domain setting
4. **No `trust proxy`** - Express didn't trust Render's proxy for secure cookies

## The Fix

### 1. Added Express Trust Proxy (server.js:13-16)
```javascript
// PRODUCTION FIX: Trust Render's reverse proxy for secure cookies
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1); // Trust first proxy (Render)
}
```

**Why this matters:**
- Render uses a reverse proxy (nginx) in front of your app
- Without `trust proxy`, Express doesn't recognize the connection as secure
- Secure cookies require HTTPS, but Express sees HTTP from the proxy
- This setting tells Express to trust the `X-Forwarded-Proto` header from Render

### 2. Updated Session Configuration (server.js:26-40)
```javascript
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  proxy: process.env.NODE_ENV === 'production', // Trust Render's reverse proxy
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true, // Prevent XSS attacks
    sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'lax', // Required for Render
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    domain: process.env.NODE_ENV === 'production' ? '.onrender.com' : undefined // Render domain
  }
}));
```

**What each setting does:**
- `proxy: true` - Trust the reverse proxy's headers
- `sameSite: 'lax'` - Allow cookies in same-site contexts (required for POST requests)
- `domain: '.onrender.com'` - Set cookie domain for Render's infrastructure
- `secure: true` (production) - Only send cookies over HTTPS

## Testing the Fix

### Before Deploying
```bash
# Test locally (should still work)
npm start
# Visit http://localhost:3000
# Login and select organization - should work
```

### After Deploying to Render
```bash
# Push changes
git add server.js docs/RENDER_SESSION_FIX.md
git commit -m "fix: Configure sessions for Render production environment"
git push origin main

# Render will automatically deploy
# Monitor deployment at: https://dashboard.render.com
```

### Verification Steps
1. Wait for Render deployment to complete
2. Visit: https://bylaws-amendment-tracker.onrender.com
3. Login with test credentials
4. Go to organization selection: https://bylaws-amendment-tracker.onrender.com/auth/select
5. Click on an organization
6. **Should now redirect to dashboard successfully** ✅

## Technical Deep Dive

### Why Sessions Weren't Working

**The Cookie Journey:**
```
Browser -> HTTPS -> Render Proxy -> HTTP -> Your App
                    (nginx)                  (Express)
```

**The Problem:**
1. Browser sends HTTPS request to Render
2. Render's nginx proxy terminates SSL
3. Forwards HTTP request to your app
4. Express sees HTTP (not HTTPS)
5. Express refuses to set secure cookies
6. Session cookie never reaches browser
7. Organization selection fails (no session = no user context)

**The Solution:**
```
Browser -> HTTPS -> Render Proxy -> HTTP -> Your App
                    (nginx)         +      (Express with trust proxy)
                                    |
                            X-Forwarded-Proto: https
                            X-Forwarded-For: <ip>
```

Now:
1. Browser sends HTTPS request to Render
2. Render's nginx adds `X-Forwarded-Proto: https` header
3. Express trusts this header (because of `trust proxy`)
4. Express recognizes connection as secure
5. Sets secure cookie with proper domain/sameSite
6. Browser stores cookie
7. Organization selection works! ✅

### Session Cookie Attributes Explained

```javascript
Set-Cookie: connect.sid=...;
  Path=/;                          // Cookie applies to all paths
  HttpOnly;                        // JavaScript can't access (XSS protection)
  Secure;                          // Only send over HTTPS
  SameSite=Lax;                    // Allow top-level navigation
  Domain=.onrender.com;            // Works across Render subdomains
  Max-Age=86400                    // 24 hours (in seconds)
```

## Environment Variables (Already Set)

Your Render environment variables are correct:
```
NODE_ENV=production                     ✅
APP_URL=https://bylaws-amendment-tracker.onrender.com  ✅
SESSION_SECRET=<secure-random-string>   ✅
SUPABASE_URL=<your-url>                 ✅
SUPABASE_ANON_KEY=<your-key>            ✅
SUPABASE_SERVICE_ROLE_KEY=<your-key>    ✅
```

## Monitoring

### Check Session Cookies in Browser DevTools
```
1. Open DevTools (F12)
2. Go to Application -> Cookies
3. Look for: connect.sid
4. Should see:
   - Domain: .onrender.com
   - Secure: Yes
   - HttpOnly: Yes
   - SameSite: Lax
```

### Check Render Logs
```bash
# After deployment, check logs for:
[SERVER] Setup cache cleared on startup
Bylaws Amendment Tracker running on https://...

# After login:
[Setup Check] Found 1 configured organizations - isConfigured: true

# After organization selection (NEW - should see):
Session saved successfully
Organization selected: <org-id>
```

## Rollback Plan (If Needed)

If something goes wrong, revert with:
```bash
git revert HEAD
git push origin main
```

Then investigate logs:
```bash
# In Render dashboard:
Logs -> Filter for "session" or "cookie"
```

## Additional Notes

### Why MemoryStore is OK for Now
- Render Starter tier has persistent disk
- Single instance means no session sync issues
- For multi-instance deployments, consider Redis session store

### Future Improvements
1. Add Redis session store for scalability
2. Implement session rotation for security
3. Add session activity tracking
4. Consider shorter session expiry

## Success Criteria

✅ User can login
✅ User can see organizations at `/auth/select`
✅ User can click and select an organization
✅ Session persists across requests
✅ User is redirected to dashboard
✅ Organization context is maintained

## References

- [Express behind proxies](https://expressjs.com/en/guide/behind-proxies.html)
- [express-session documentation](https://github.com/expressjs/session)
- [Render deployment guide](https://render.com/docs/deploy-node-express-app)
- [Cookie attributes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies)

---

**Fix applied:** 2025-10-28
**Status:** Ready for deployment
**Expected result:** Organization selection will work correctly on Render
