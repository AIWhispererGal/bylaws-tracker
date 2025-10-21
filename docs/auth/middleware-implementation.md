# Authenticated Supabase Middleware Implementation

## Overview

This document describes the implementation of authenticated Supabase clients in the Express middleware layer to properly support Row Level Security (RLS) policies.

## Architecture

### Key Components

1. **Authenticated Supabase Middleware** (`server.js` line 71)
   - Creates per-request Supabase clients with proper auth context
   - Manages JWT tokens stored in Express sessions
   - Implements automatic token refresh
   - Falls back to anonymous client when no JWT is available

2. **Enhanced requireAuth Middleware** (`src/routes/dashboard.js` line 12)
   - Validates both Express session and Supabase JWT
   - Ensures organization context is set
   - Verifies JWT validity and user context
   - Provides graceful fallback for expired/invalid tokens

### Session Storage

JWT tokens and user context are stored in Express session:

```javascript
req.session.supabaseJWT           // Access token (expires in ~1 hour)
req.session.supabaseRefreshToken  // Refresh token (long-lived)
req.session.supabaseUser          // User object from Supabase
req.session.organizationId        // Selected organization for RLS
```

## How It Works

### Request Flow

1. **Request arrives** → Express session middleware loads session data
2. **Supabase middleware executes**:
   - Checks for JWT in session (`req.session.supabaseJWT`)
   - If JWT exists:
     - Creates authenticated Supabase client with JWT in Authorization header
     - Verifies token validity
     - Refreshes token if expired (using refresh_token)
     - Updates session with new tokens
   - If no JWT:
     - Falls back to anonymous Supabase client
3. **Route handler executes** with `req.supabase` (authenticated or anonymous)
4. **RLS policies enforce access control** based on JWT claims

### JWT Token Refresh

Automatic token refresh prevents expired token errors:

```javascript
// Check if token is valid
const { data: { user }, error } = await client.auth.getUser(sessionJWT);

if (error || !user) {
  // Token expired/invalid - refresh it
  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: sessionRefreshToken
  });

  if (!error && data.session) {
    // Update session with new tokens
    req.session.supabaseJWT = data.session.access_token;
    req.session.supabaseRefreshToken = data.session.refresh_token;
  }
}
```

### Creating Authenticated Clients

The middleware uses Supabase's client options to inject the JWT:

```javascript
const authenticatedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,      // Express session handles persistence
    autoRefreshToken: false,    // We handle refresh manually
  },
  global: {
    headers: {
      Authorization: `Bearer ${sessionJWT}`  // Inject JWT for RLS
    }
  }
});
```

## Client Types

### req.supabase
- **Type**: Authenticated or Anonymous Supabase client
- **Usage**: All regular database operations
- **Security**: Enforces RLS based on JWT claims
- **Context**: Uses JWT from session if available, otherwise anonymous

### req.supabaseService
- **Type**: Service role Supabase client
- **Usage**: Admin operations, setup wizard, system tasks
- **Security**: Bypasses RLS (has full database access)
- **Context**: Always uses service_role key

## Security Features

### 1. Automatic Token Validation
- Tokens are validated on each request
- Invalid tokens trigger refresh or fallback to anonymous access
- Expired tokens are automatically refreshed

### 2. Secure Token Storage
- JWTs stored in httpOnly session cookies
- Refresh tokens only used server-side
- Session cookies have secure flag in production

### 3. Defense in Depth
- Even if middleware fails, RLS policies provide protection
- Anonymous access is still subject to RLS restrictions
- Service client only used for specific admin operations

### 4. Clear Error Messages
- Logs token refresh attempts and failures
- Warns when using anonymous access
- Tracks authentication state changes

## Usage Examples

### In Route Handlers

```javascript
// Dashboard route - uses authenticated client
router.get('/overview', requireAuth, async (req, res) => {
  const { supabase } = req; // Authenticated or anonymous client
  const orgId = req.organizationId; // From session

  // This query will be filtered by RLS based on JWT claims
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('organization_id', orgId);

  // RLS ensures user can only see their organization's data
});
```

### Admin Operations

```javascript
// Setup wizard - uses service client to bypass RLS
router.post('/setup/complete', async (req, res) => {
  const { supabaseService } = req; // Service role client

  // This bypasses RLS for initial setup
  const { data, error } = await supabaseService
    .from('organizations')
    .insert({ name: 'New Org' });
});
```

## Integration with RLS Policies

The authenticated client works with RLS policies like:

```sql
-- Example RLS policy that uses JWT claims
CREATE POLICY "Users can view their organization's documents"
  ON documents FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()  -- Uses JWT claim
    )
  );
```

The middleware ensures:
- `auth.uid()` returns the user ID from JWT claims
- RLS policies can trust the JWT is valid
- Expired tokens are refreshed before reaching the database

## Backward Compatibility

### Existing Code
All existing code using `req.supabase` continues to work:
- No breaking changes to route handlers
- Anonymous access still available when no JWT exists
- Service client unchanged for admin operations

### Migration Path
To add authentication to existing routes:

1. **Store JWT after login**:
   ```javascript
   req.session.supabaseJWT = session.access_token;
   req.session.supabaseRefreshToken = session.refresh_token;
   ```

2. **Use requireAuth middleware**:
   ```javascript
   router.get('/protected', requireAuth, async (req, res) => {
     // req.supabase is now authenticated
   });
   ```

3. **Update RLS policies** to use `auth.uid()`

## Configuration

### Environment Variables
```bash
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJxxx...           # For authenticated clients
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...  # For service client
SESSION_SECRET=your-secret-key        # For Express sessions
```

### Session Configuration
```javascript
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',  // HTTPS only
    httpOnly: true,                                  // No JS access
    maxAge: 24 * 60 * 60 * 1000                     // 24 hours
  }
}));
```

## Error Handling

### Token Refresh Failure
```javascript
if (refreshError || !refreshData.session) {
  console.error('Token refresh failed:', refreshError?.message);
  // Clear invalid tokens
  delete req.session.supabaseJWT;
  delete req.session.supabaseRefreshToken;
  // Fall back to anonymous access
  req.supabase = supabase;
}
```

### Invalid JWT
```javascript
const { data: { user }, error } = await req.supabase.auth.getUser(JWT);
if (error || !user) {
  console.warn('Invalid JWT in session, clearing auth tokens');
  delete req.session.supabaseJWT;
  // Continue with anonymous access
}
```

## Testing

### Manual Testing

1. **Without Authentication**:
   ```bash
   curl http://localhost:3000/dashboard/overview
   # Should use anonymous access, restricted by RLS
   ```

2. **With Authentication**:
   ```javascript
   // After login, session should contain JWT
   console.log(req.session.supabaseJWT);
   // Client should be authenticated
   const { data: { user } } = await req.supabase.auth.getUser();
   ```

3. **Token Refresh**:
   - Wait for token to expire (~1 hour)
   - Make request to dashboard
   - Check logs for "JWT refreshed successfully"

### Automated Testing

```javascript
describe('Authenticated Supabase Middleware', () => {
  it('should create authenticated client with JWT', async () => {
    // Mock session with JWT
    req.session.supabaseJWT = 'valid-jwt-token';

    await authenticatedSupabaseMiddleware(req, res, next);

    expect(req.supabase).toBeDefined();
    expect(next).toHaveBeenCalled();
  });

  it('should refresh expired token', async () => {
    // Mock expired JWT
    req.session.supabaseJWT = 'expired-jwt';
    req.session.supabaseRefreshToken = 'refresh-token';

    await authenticatedSupabaseMiddleware(req, res, next);

    expect(req.session.supabaseJWT).not.toBe('expired-jwt');
  });
});
```

## Performance Considerations

### Token Validation
- Token validation adds ~50-100ms per request
- Cached after first validation (within request lifecycle)
- Only happens when JWT exists in session

### Token Refresh
- Only triggered when token is expired
- Refresh token call takes ~200-500ms
- Happens at most once per hour per session

### Optimization Tips
1. Use appropriate session maxAge (don't make too long)
2. Consider Redis session store for multi-server deployments
3. Cache user data to avoid repeated getUser() calls
4. Use connection pooling for Supabase client

## Future Enhancements

### Planned Improvements
1. **User login/registration routes**
   - Email/password authentication
   - OAuth providers (Google, GitHub, etc.)
   - Password reset flow

2. **Role-based access control (RBAC)**
   - Store user roles in JWT claims
   - Middleware to check roles
   - RLS policies based on roles

3. **Multi-factor authentication (MFA)**
   - TOTP support
   - SMS verification
   - Backup codes

4. **Session management**
   - List active sessions
   - Revoke sessions
   - Device tracking

5. **Audit logging**
   - Track authentication events
   - Log token refreshes
   - Monitor failed auth attempts

## Troubleshooting

### JWT Not Being Set
- Check that login route sets `req.session.supabaseJWT`
- Verify session middleware is before routes
- Check session cookie is being sent by client

### Token Refresh Failing
- Verify refresh_token is stored in session
- Check Supabase project settings (JWT expiration)
- Look for expired refresh tokens (need re-authentication)

### RLS Not Working
- Verify JWT is in Authorization header
- Check RLS policies use `auth.uid()`
- Test with service client to verify query works
- Enable Supabase logs to see RLS evaluation

### Performance Issues
- Check for repeated token validation
- Consider caching user data
- Use Redis for session storage
- Monitor Supabase API rate limits

## References

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Supabase Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Express Session Documentation](https://github.com/expressjs/session)
- [JWT Best Practices](https://datatracker.ietf.org/doc/html/rfc8725)
