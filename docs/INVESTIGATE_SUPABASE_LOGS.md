# 🔍 Supabase Log Investigation Guide

## Where to Look

### 1. Database Logs (Most Important)

**Location:**
```
https://supabase.com/dashboard/project/auuzurghrjokbqzivfca/logs/postgres-logs
```

**What to check:**
- Look for **TRUNCATE**, **DELETE**, **DROP**, or **ALTER** commands
- Check the timestamp (today's date)
- Look for the source (API, Dashboard, Direct SQL)

**How to filter:**
```sql
-- In the search/filter box, try these queries:
TRUNCATE
DELETE FROM organizations
DELETE FROM users
DELETE FROM documents
DELETE FROM document_sections
DROP TABLE
```

**Key fields to note:**
- `timestamp` - When did it happen?
- `event_message` - What command was executed?
- `user_name` - Who executed it? (might be "postgres", "service_role", or a user email)
- `application_name` - Where did it come from? (psql, Supabase Studio, API, etc.)

---

### 2. API Logs

**Location:**
```
https://supabase.com/dashboard/project/auuzurghrjokbqzivfca/logs/edge-logs
```

**What to check:**
- API calls that might have deleted data
- Look for unusual POST/DELETE requests
- Check for 200/204 responses to DELETE operations

**Filter examples:**
```
method: DELETE
status: 200
path: /rest/v1/
```

---

### 3. Auth Logs

**Location:**
```
https://supabase.com/dashboard/project/auuzurghrjokbqzivfca/logs/auth-logs
```

**What to check:**
- Recent logins/logouts
- Any suspicious authentication activity
- Service role usage

---

### 4. Storage Logs (Optional)

**Location:**
```
https://supabase.com/dashboard/project/auuzurghrjokbqzivfca/logs/storage-logs
```

**What to check:**
- File deletions (if any documents were stored)

---

## 🕵️ What to Look For

### Smoking Gun #1: Direct SQL Execution

**Patterns that indicate manual deletion:**

```sql
-- In Database logs, look for:
TRUNCATE TABLE organizations CASCADE;
TRUNCATE TABLE users CASCADE;
TRUNCATE TABLE documents CASCADE;
DELETE FROM organizations;
DELETE FROM users;
DELETE FROM documents;
DELETE FROM document_sections;

-- Also look for:
DROP TABLE organizations;
DROP SCHEMA public CASCADE;
```

**Source indicators:**
- `application_name: "Supabase Studio"` = Dashboard SQL Editor
- `application_name: "psql"` = Direct database connection
- `application_name: "PostgREST"` = API call

---

### Smoking Gun #2: API Mass Deletion

**Look for multiple DELETE requests in API logs:**

```
DELETE /rest/v1/organizations
DELETE /rest/v1/users
DELETE /rest/v1/documents
DELETE /rest/v1/document_sections
```

**Check:**
- Who made the requests? (API key, user JWT)
- From what IP address?
- How many rows were deleted?

---

### Smoking Gun #3: Migration Script

**Look for:**
```sql
-- Migration-style commands
CREATE OR REPLACE FUNCTION
BEGIN;
DROP TABLE IF EXISTS
CREATE TABLE
COMMIT;
```

**Indicators:**
- Multiple DDL statements in sequence
- Timestamps matching migration execution

---

## 📊 Step-by-Step Investigation

### Investigation Checklist:

#### □ Step 1: Check Database Logs (Last 24 Hours)
```
1. Go to: Logs → Postgres Logs
2. Set time range: Last 24 hours
3. Search for: "TRUNCATE"
4. Search for: "DELETE FROM organizations"
5. Search for: "DELETE FROM users"
6. Search for: "DELETE FROM documents"
7. Note: timestamp, user, application
```

#### □ Step 2: Check API Logs (Last 24 Hours)
```
1. Go to: Logs → Edge Logs
2. Filter: method = DELETE
3. Filter: status = 200 or 204
4. Look for bulk deletions
5. Note: timestamp, path, user
```

#### □ Step 3: Check Database Activity (Right Now)
```
1. Go to: Database → Roles
2. Check active connections
3. Look for suspicious sessions
```

#### □ Step 4: Review Recent Changes
```
1. Go to: Database → Migrations
2. Check: Recent migration runs
3. Verify: No unexpected migrations
```

#### □ Step 5: Check Dashboard Activity
```
1. Go to: Settings → Activity
2. Review: Recent dashboard actions
3. Look for: Table operations
```

---

## 🚨 Common Patterns & What They Mean

### Pattern 1: "TRUNCATE TABLE ... CASCADE"
```
Source: Supabase Studio (Dashboard SQL Editor)
Cause: Someone ran a SQL command manually
Who: Check user_name field
When: Check timestamp
```

**Indicates:** Manual action via dashboard

---

### Pattern 2: Multiple "DELETE FROM" with same timestamp
```
Source: PostgREST (API)
Cause: Application code or script
Who: Check API key or JWT
When: Check timestamp
```

**Indicates:** Programmatic deletion (script or app bug)

---

### Pattern 3: "DROP TABLE" or "DROP SCHEMA"
```
Source: Could be psql, Supabase Studio, or migration
Cause: Database reset or migration gone wrong
Who: Check user_name and application_name
When: Check timestamp
```

**Indicates:** Structural change (very serious)

---

### Pattern 4: No logs found
```
Possible causes:
1. Logs retention expired (free tier = 1 day)
2. Different project/environment
3. Database was reset (not just data deleted)
```

**Indicates:** Check if you're looking at correct project

---

## 🔒 Prevention Measures

### Based on What You Find:

#### If Source = Supabase Dashboard SQL Editor
**Prevention:**
1. Enable Row Level Security (RLS) on all tables
2. Limit who has "service_role" key access
3. Use "postgres" role only for critical operations
4. Create read-only dashboard users

**How to implement:**
```sql
-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_sections ENABLE ROW LEVEL SECURITY;

-- Even service role needs explicit policies
-- (prevents accidental dashboard deletions)
```

---

#### If Source = API (PostgREST)
**Prevention:**
1. Add DELETE policies to RLS
2. Require specific conditions for deletions
3. Add soft-delete instead of hard-delete
4. Audit log all DELETE operations

**How to implement:**
```sql
-- Example: Prevent bulk deletes via API
CREATE POLICY "prevent_bulk_delete_organizations"
ON organizations
FOR DELETE
USING (
  -- Only allow if specific ID is provided
  id = current_setting('request.jwt.claims')::json->>'organization_id'
);
```

---

#### If Source = Migration Script
**Prevention:**
1. Review all migrations before running
2. Test migrations on dev database first
3. Never use CASCADE in production
4. Always backup before migrations

**How to implement:**
```bash
# Add to package.json scripts:
"migrate:safe": "echo 'Backup first!' && node scripts/backup-database.js && supabase migration up"
```

---

#### If Source = External Tool (psql, etc.)
**Prevention:**
1. Rotate database passwords
2. Limit direct database access
3. Use connection pooling with restricted permissions
4. Enable connection logging

---

## 📝 Evidence Collection Template

**Copy this and fill in what you find:**

```
=== SUPABASE DATA LOSS INVESTIGATION ===

Date of Investigation: [TODAY'S DATE]
Project ID: auuzurghrjokbqzivfca
Time of Data Loss: [APPROXIMATE TIME]

--- DATABASE LOGS ---
Suspicious Queries Found: YES / NO
Examples:
[paste suspicious queries here]

Timestamp: [when it happened]
User: [who did it - could be "postgres", "service_role", email]
Application: [what tool - Supabase Studio, psql, PostgREST]
Source IP: [if available]

--- API LOGS ---
Suspicious API Calls: YES / NO
Examples:
[paste suspicious API calls]

Endpoint: [which API endpoint]
Method: [GET/POST/DELETE/PATCH]
Status: [response code]
Timestamp: [when it happened]

--- PROBABLE CAUSE ---
[ ] Manual SQL execution via Dashboard
[ ] API script or application bug
[ ] Migration script gone wrong
[ ] Direct database connection (psql)
[ ] Unknown / No logs found

--- ROOT CAUSE ---
[Your conclusion about what happened]

--- PREVENTION PLAN ---
1. [What you'll do to prevent this]
2. [Additional safeguards]
3. [Monitoring to add]

=== END INVESTIGATION ===
```

---

## 🎯 Quick Checklist

**5-Minute Investigation:**

1. ✅ Go to Database Logs
2. ✅ Search for "TRUNCATE" in last 24 hours
3. ✅ Search for "DELETE FROM organizations"
4. ✅ Check timestamp and source
5. ✅ Note findings in Evidence Collection Template

**If you find nothing:**
- Check if you're in the correct project
- Check log retention settings (free tier = 1 day)
- Verify Supabase URL in your .env matches dashboard

---

## 🔗 Quick Links

**Your Project Dashboard:**
```
https://supabase.com/dashboard/project/auuzurghrjokbqzivfca
```

**Direct Log Links:**
```
Postgres Logs: https://supabase.com/dashboard/project/auuzurghrjokbqzivfca/logs/postgres-logs
API Logs: https://supabase.com/dashboard/project/auuzurghrjokbqzivfca/logs/edge-logs
Auth Logs: https://supabase.com/dashboard/project/auuzurghrjokbqzivfca/logs/auth-logs
```

**Settings:**
```
Activity Log: https://supabase.com/dashboard/project/auuzurghrjokbqzivfca/settings/activity
Database Settings: https://supabase.com/dashboard/project/auuzurghrjokbqzivfca/settings/database
```

---

## 📞 Next Steps After Investigation

1. **Document findings** using Evidence Collection Template
2. **Implement prevention** based on root cause
3. **Restore data** using one of the recovery methods
4. **Set up backups** to prevent future loss
5. **Monitor** for similar patterns

---

## ⚠️ Important Notes

- **Free tier** logs are retained for **1 day only**
- **Pro tier** logs are retained for **7 days**
- **Deleted logs cannot be recovered**
- **Act quickly** to capture evidence

---

## 🚨 If You Find Malicious Activity

If logs show unauthorized access:
1. **Immediately rotate** all API keys
2. **Change database password**
3. **Review RLS policies**
4. **Enable 2FA** on Supabase account
5. **Contact Supabase support**

---

Good luck with your investigation! Report back what you find and I can help you implement the right prevention measures.
