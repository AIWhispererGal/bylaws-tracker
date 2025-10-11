# Environment Variables Reference

Complete guide to all environment variables used by the Bylaws Amendment Tracker.

---

## Required Variables

These variables MUST be set for the application to function.

### `NODE_ENV`
- **Description**: Specifies the runtime environment
- **Values**: `development` | `production` | `test`
- **Default**: `development`
- **Required**: Yes (for production)
- **Example**: `NODE_ENV=production`

**Usage:**
- Enables/disables certain security features
- Controls logging verbosity
- Determines session cookie settings

---

### `PORT`
- **Description**: Port number for the web server
- **Values**: Any valid port number (1-65535)
- **Default**: `3000`
- **Required**: Yes (Render sets automatically)
- **Example**: `PORT=3000`

**Usage:**
- Server listens on this port
- Render automatically assigns port for deployment

---

### `SESSION_SECRET`
- **Description**: Secret key for signing session cookies
- **Values**: Random string (32+ characters recommended)
- **Default**: None (must be set)
- **Required**: Yes
- **Example**: `SESSION_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`

**Security:**
- Use a cryptographically random string
- Never commit to Git
- Rotate periodically for security
- Generate with: `openssl rand -hex 32`

---

### `SUPABASE_URL`
- **Description**: Your Supabase project URL
- **Values**: Full Supabase project URL
- **Default**: None
- **Required**: Yes
- **Example**: `SUPABASE_URL=https://abcdefgh.supabase.co`

**How to Get:**
1. Go to Supabase Dashboard
2. Settings → API
3. Copy "Project URL"

**Notes:**
- No trailing slash
- Must be https://

---

### `SUPABASE_ANON_KEY`
- **Description**: Supabase anonymous/public API key
- **Values**: Long JWT token string
- **Default**: None
- **Required**: Yes
- **Example**: `SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

**How to Get:**
1. Go to Supabase Dashboard
2. Settings → API
3. Copy "anon public" key under "Project API keys"

**Security:**
- This key is safe to expose in frontend
- Protected by Row Level Security (RLS) policies
- Do not confuse with `service_role` key (keep that secret!)

---

### `SUPABASE_DB_PASSWORD`
- **Description**: Database password for direct connection (if needed)
- **Values**: Strong password
- **Default**: Set during Supabase project creation
- **Required**: No (only for direct DB connections)
- **Example**: `SUPABASE_DB_PASSWORD=MyStr0ng!Pa$$w0rd`

**How to Get:**
1. Saved during Supabase project creation
2. Or reset: Settings → Database → Reset password

**Usage:**
- Not currently used by app (uses Supabase client)
- Keep for potential future migrations or direct access

---

### `APP_URL`
- **Description**: Full URL where your app is hosted
- **Values**: Full URL with protocol
- **Default**: `http://localhost:3000`
- **Required**: Yes (for production)
- **Example**: `APP_URL=https://bylaws-tracker.onrender.com`

**Usage:**
- Used for OAuth redirects
- Google Apps Script needs this to connect
- CORS configuration
- Email links and notifications

**Important:**
- Must match your actual deployment URL
- Include https:// for production
- No trailing slash

---

## Optional Variables

These variables enhance functionality but aren't required for basic operation.

### `GOOGLE_DOC_ID`
- **Description**: Google Doc ID for bylaws import
- **Values**: Document ID from Google Docs URL
- **Default**: None
- **Required**: No
- **Example**: `GOOGLE_DOC_ID=1LdE2NGMOJ7BgV19V3Qb-hnN5VTmB5C_Hh6heemqxviA`

**How to Get:**
- From Google Docs URL: `docs.google.com/document/d/[THIS_PART]/edit`
- Copy the ID between `/d/` and `/edit`

**Usage:**
- Legacy Google Docs integration
- Setup wizard can import from Google Docs
- Not required if using file upload

---

### `DEFAULT_ORG_ID`
- **Description**: Default organization ID to use
- **Values**: UUID of organization
- **Default**: First organization in database
- **Required**: No
- **Example**: `DEFAULT_ORG_ID=9fe79740-323c-4678-a1e1-b1fee60157c9`

**Usage:**
- For single-tenant deployments
- Skips organization selection
- Auto-loads this organization

---

### `LOG_LEVEL`
- **Description**: Logging verbosity
- **Values**: `error` | `warn` | `info` | `debug` | `verbose`
- **Default**: `info`
- **Required**: No
- **Example**: `LOG_LEVEL=debug`

**Usage:**
- Controls console output verbosity
- `error`: Only errors
- `warn`: Errors and warnings
- `info`: General information (default)
- `debug`: Detailed debugging
- `verbose`: Everything

---

### `ENABLE_SETUP_WIZARD`
- **Description**: Enable/disable setup wizard
- **Values**: `true` | `false`
- **Default**: `true`
- **Required**: No
- **Example**: `ENABLE_SETUP_WIZARD=false`

**Usage:**
- Set to `false` to disable setup wizard redirect
- Useful for pre-configured deployments
- Set to `true` for new installations

---

### `MAX_UPLOAD_SIZE`
- **Description**: Maximum file upload size in MB
- **Values**: Number (in megabytes)
- **Default**: `10`
- **Required**: No
- **Example**: `MAX_UPLOAD_SIZE=25`

**Usage:**
- Limits document upload size
- Affects logo and Word document uploads
- Increase for large documents

---

### `CORS_ORIGIN`
- **Description**: Allowed CORS origins
- **Values**: Comma-separated URLs
- **Default**: `*` (all origins)
- **Required**: No
- **Example**: `CORS_ORIGIN=https://docs.google.com,https://myapp.com`

**Usage:**
- Restricts which domains can access API
- Use `*` for Google Apps Script compatibility
- Specify domains for production security

---

### `RATE_LIMIT_MAX`
- **Description**: Maximum requests per window
- **Values**: Number of requests
- **Default**: `100`
- **Required**: No
- **Example**: `RATE_LIMIT_MAX=500`

**Usage:**
- API rate limiting
- Prevents abuse
- Higher for high-traffic sites

---

### `RATE_LIMIT_WINDOW`
- **Description**: Rate limit time window in minutes
- **Values**: Number of minutes
- **Default**: `15`
- **Required**: No
- **Example**: `RATE_LIMIT_WINDOW=60`

**Usage:**
- Works with RATE_LIMIT_MAX
- Example: 100 requests per 15 minutes

---

## Development-Only Variables

These are only used in development mode.

### `DEBUG`
- **Description**: Enable debug logging for specific modules
- **Values**: Module patterns (e.g., `app:*`, `express:*`)
- **Default**: None
- **Required**: No
- **Example**: `DEBUG=app:*,db:*`

**Usage:**
- Development debugging
- Follows `debug` npm package conventions
- Use `*` for all modules

---

### `NGROK_URL`
- **Description**: ngrok tunnel URL for local development
- **Values**: Full ngrok URL
- **Default**: None
- **Required**: No (development only)
- **Example**: `NGROK_URL=https://abc123.ngrok.io`

**Usage:**
- Local development with Google Apps Script
- Temporary public URL for testing
- Overrides APP_URL in development

---

## Database Variables (Advanced)

For direct database connections (advanced users only).

### `DATABASE_URL`
- **Description**: Full PostgreSQL connection string
- **Values**: PostgreSQL connection URL
- **Default**: Constructed from Supabase variables
- **Required**: No
- **Example**: `DATABASE_URL=postgresql://user:pass@host:5432/db`

**Usage:**
- Direct database connections
- Database migrations
- Advanced querying

---

### `DB_POOL_MIN`
- **Description**: Minimum database connection pool size
- **Values**: Number of connections
- **Default**: `2`
- **Required**: No
- **Example**: `DB_POOL_MIN=5`

---

### `DB_POOL_MAX`
- **Description**: Maximum database connection pool size
- **Values**: Number of connections
- **Default**: `10`
- **Required**: No
- **Example**: `DB_POOL_MAX=20`

---

## Configuration Examples

### Local Development (.env)

```env
# Node Environment
NODE_ENV=development
PORT=3000

# Session
SESSION_SECRET=dev-secret-key-change-in-production

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_DB_PASSWORD=YourPassword123

# App
APP_URL=http://localhost:3000

# Optional
GOOGLE_DOC_ID=1LdE2NGMOJ7BgV19V3Qb-hnN5VTmB5C_Hh6heemqxviA
LOG_LEVEL=debug
```

### Production (Render)

```env
# Node Environment
NODE_ENV=production
PORT=10000

# Session (Auto-generated by Render)
SESSION_SECRET=[auto-generated-by-render]

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_DB_PASSWORD=YourStrongPassword

# App URL (Set after first deployment)
APP_URL=https://bylaws-tracker.onrender.com

# Optional
LOG_LEVEL=warn
CORS_ORIGIN=https://docs.google.com
RATE_LIMIT_MAX=500
RATE_LIMIT_WINDOW=15
```

### Docker Deployment

```env
# Node Environment
NODE_ENV=production
PORT=3000

# Session
SESSION_SECRET=docker-generated-secret-key

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_DB_PASSWORD=YourPassword

# App
APP_URL=https://your-domain.com

# Docker-specific
ENABLE_SETUP_WIZARD=false
DEFAULT_ORG_ID=9fe79740-323c-4678-a1e1-b1fee60157c9
```

---

## Setting Variables by Platform

### Render.com

1. Dashboard → Your Service
2. Environment tab
3. Click "Add Environment Variable"
4. Enter Key and Value
5. Click "Save Changes"
6. Service auto-redeploys

### Heroku

```bash
heroku config:set VARIABLE_NAME=value
```

### Docker

```bash
docker run -e VARIABLE_NAME=value your-image
```

Or use `.env` file:
```bash
docker run --env-file .env your-image
```

### Local Development

Create `.env` file in project root:
```env
VARIABLE_NAME=value
```

**Never commit `.env` to Git!**

---

## Security Checklist

- [ ] `SESSION_SECRET` is random and 32+ characters
- [ ] `SUPABASE_ANON_KEY` is the anon key, not service_role key
- [ ] `.env` file is in `.gitignore`
- [ ] Production uses `NODE_ENV=production`
- [ ] `APP_URL` matches actual deployment URL
- [ ] Database password is strong (20+ characters)
- [ ] CORS is restricted in production (not `*`)
- [ ] Rate limiting is enabled for production

---

## Troubleshooting

### Variable Not Loading

**Check:**
1. Variable name is exact (case-sensitive)
2. No spaces around `=` in `.env` file
3. `.env` file is in project root
4. Server was restarted after changes
5. No quotes unless value contains spaces

### Supabase Connection Fails

**Check:**
1. `SUPABASE_URL` has no trailing slash
2. `SUPABASE_ANON_KEY` is complete (very long)
3. Project is active in Supabase dashboard
4. Correct key (anon, not service_role)

### Session Not Persisting

**Check:**
1. `SESSION_SECRET` is set
2. `NODE_ENV=production` has `secure: true` cookies
3. Using HTTPS in production
4. Cookies not blocked by browser

---

## Quick Reference Table

| Variable | Required | Default | Example |
|----------|----------|---------|---------|
| `NODE_ENV` | Yes (prod) | `development` | `production` |
| `PORT` | Yes | `3000` | `3000` |
| `SESSION_SECRET` | Yes | None | `random-32-char-string` |
| `SUPABASE_URL` | Yes | None | `https://abc.supabase.co` |
| `SUPABASE_ANON_KEY` | Yes | None | `eyJhbG...` |
| `SUPABASE_DB_PASSWORD` | No | None | `StrongPass123` |
| `APP_URL` | Yes (prod) | `http://localhost:3000` | `https://app.onrender.com` |
| `GOOGLE_DOC_ID` | No | None | `1LdE2N...` |
| `LOG_LEVEL` | No | `info` | `debug` |
| `ENABLE_SETUP_WIZARD` | No | `true` | `false` |

---

**Last Updated**: 2025-10-09
**Version**: 1.0.0
