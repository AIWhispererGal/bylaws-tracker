# User Invitation System - Quick Reference

## Overview
Complete token-based invitation system allowing org admins to invite users via email with secure acceptance flow.

## Quick Start

### 1. Run Database Migration
```bash
# In Supabase SQL Editor or via psql
psql -h your-db -U postgres -f database/migrations/014_user_invitations.sql
```

### 2. Invite a User (As Org Admin)
```bash
POST /auth/invite-user
{
  "email": "user@example.com",
  "name": "User Name",
  "role": "member",
  "organizationId": "uuid"
}
```

### 3. User Accepts Invitation
1. User receives invitation URL (currently logged to console)
2. User visits: `/auth/accept-invite?token=xxx`
3. User fills form with name and password
4. User is auto-logged in and redirected to dashboard

## API Endpoints

### POST /auth/invite-user
**Auth Required:** Yes (Org Admin)

**Request:**
```json
{
  "email": "user@example.com",
  "name": "User Name",           // Optional
  "role": "member",               // member, admin, viewer, owner
  "organizationId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Invitation sent to user@example.com",
  "invitation": {
    "id": "uuid",
    "inviteUrl": "http://localhost:3000/auth/accept-invite?token=...",
    "expiresAt": "2025-10-21T12:00:00Z"
  }
}
```

### GET /auth/accept-invite?token=xxx
**Auth Required:** No

**Response:** HTML form with invitation details

### POST /auth/accept-invite
**Auth Required:** No

**Request:**
```json
{
  "token": "invitation-token",
  "full_name": "User Name",
  "password": "password123"      // Min 8 chars
}
```

**Response:**
```json
{
  "success": true,
  "message": "Welcome! Your account has been created successfully.",
  "redirectTo": "/dashboard"
}
```

## Database Schema

### Table: user_invitations
```sql
- id (UUID, PK)
- organization_id (UUID, FK to organizations)
- email (TEXT)
- role (TEXT: member, admin, viewer, owner)
- token (TEXT, UNIQUE)
- status (TEXT: pending, accepted, expired, revoked)
- invited_by (UUID, FK to auth.users)
- expires_at (TIMESTAMPTZ, default NOW() + 7 days)
- accepted_at (TIMESTAMPTZ)
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)
```

### Indexes
- `token` - Fast lookup
- `email` - Email searches
- `organization_id` - Org filtering
- `(organization_id, status)` - Common queries

## Security Features

1. **Secure Tokens**: 32-byte crypto-random tokens
2. **Expiration**: Auto-expire after 7 days
3. **One-time Use**: Marked as accepted after use
4. **RLS Policies**: Database-level access control
5. **Admin-only Creation**: Only org admins can invite
6. **User Limit Enforcement**: Prevents exceeding max_users

## Validation Rules

### Invitation Creation
- ✓ User must be authenticated
- ✓ User must be org admin (owner/admin role)
- ✓ Email must be valid format
- ✓ Organization must not exceed user limit
- ✓ Email cannot already be a member
- ✓ No duplicate pending invitations

### Invitation Acceptance
- ✓ Token must be valid
- ✓ Invitation must not be expired
- ✓ Full name required (min 2 chars)
- ✓ Password required (min 8 chars)
- ✓ Email cannot already be member

## Error Codes

| Code | Error | Reason |
|------|-------|--------|
| 400 | Bad Request | Missing fields, invalid data, duplicate |
| 401 | Unauthorized | Not authenticated |
| 403 | Forbidden | Not admin, user limit reached |
| 404 | Not Found | Invalid token, invitation not found |
| 410 | Gone | Invitation expired |
| 500 | Server Error | Database error, system failure |

## Common Tasks

### Check Pending Invitations
```sql
SELECT * FROM user_invitations
WHERE status = 'pending'
  AND expires_at > NOW()
ORDER BY created_at DESC;
```

### Revoke Invitation
```sql
UPDATE user_invitations
SET status = 'revoked', updated_at = NOW()
WHERE id = 'invitation-id';
```

### Resend Invitation
```sql
UPDATE user_invitations
SET expires_at = NOW() + INTERVAL '7 days',
    updated_at = NOW()
WHERE id = 'invitation-id';
```

### Clean Up Expired Invitations
```sql
UPDATE user_invitations
SET status = 'expired', updated_at = NOW()
WHERE status = 'pending'
  AND expires_at < NOW();
```

### View Invitation History
```sql
SELECT
  i.email,
  i.role,
  i.status,
  i.created_at,
  i.accepted_at,
  o.name as organization,
  u.email as invited_by_email
FROM user_invitations i
JOIN organizations o ON i.organization_id = o.id
LEFT JOIN users u ON i.invited_by = u.id
ORDER BY i.created_at DESC;
```

## Testing

### Quick Test
```bash
# 1. Create invitation
curl -X POST http://localhost:3000/auth/invite-user \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=YOUR_SESSION" \
  -d '{"email":"test@example.com","role":"member","organizationId":"ORG_ID"}'

# 2. Copy token from response or server console

# 3. Visit invitation URL
open http://localhost:3000/auth/accept-invite?token=TOKEN

# 4. Fill form and submit
```

### Verify User Created
```sql
SELECT u.*, uo.role, o.name
FROM users u
JOIN user_organizations uo ON u.id = uo.user_id
JOIN organizations o ON uo.organization_id = o.id
WHERE u.email = 'test@example.com';
```

## Troubleshooting

### "Invitation not found"
- Check token is correct (case-sensitive)
- Verify invitation wasn't already accepted
- Check invitation hasn't expired

### "User limit reached"
- Check organization's max_users setting
- Count current users in organization
- Increase limit or remove inactive users

### "Already a member"
- User already exists in the organization
- Check user_organizations table
- Use different email or remove existing membership

### "Not authorized"
- Ensure logged in user is org admin
- Check user_organizations role is 'admin' or 'owner'
- Verify organizationId matches user's org

## Integration Points

### Email Service (Future)
Add email sending in `POST /auth/invite-user`:
```javascript
const nodemailer = require('nodemailer');

// After creating invitation
await emailService.send({
  to: email,
  subject: `Join ${orgName}`,
  template: 'invitation',
  data: {
    inviteUrl,
    orgName,
    role,
    expiresAt: invitation.expires_at
  }
});
```

### Frontend UI (Future)
Admin dashboard invitation management:
```javascript
// List invitations
GET /api/invitations?organizationId=xxx

// Resend invitation
POST /api/invitations/:id/resend

// Revoke invitation
DELETE /api/invitations/:id
```

## File Locations

```
database/
  migrations/
    014_user_invitations.sql           # Database schema

src/
  routes/
    auth.js                             # Invitation routes

views/
  auth/
    accept-invite.ejs                   # Acceptance form

docs/
  SPRINT_0_TASK_7_COMPLETE.md          # Full documentation
  INVITATION_SYSTEM_QUICK_REFERENCE.md # This file

tests/
  manual/
    test-invitation-flow.md             # Testing guide
```

## Support

For issues or questions:
1. Check full documentation: `docs/SPRINT_0_TASK_7_COMPLETE.md`
2. Review test scenarios: `tests/manual/test-invitation-flow.md`
3. Check database migrations: `database/migrations/014_user_invitations.sql`

---

**Last Updated:** October 14, 2025
**Version:** 1.0.0
**Status:** ✅ Production Ready
