# QUICK FIX SUMMARY 🚀

## The Problem
Your setup wizard fails with:
```
Error: Could not find the table 'public.documents' in the schema cache
```

## The Cause
- ✅ You have `organizations` table
- ❌ You're MISSING `documents` and `document_sections` tables
- The code expects the full v2.0 generalized schema

## The Solution (3 Simple Steps)

### Step 1: Run Diagnostic (2 minutes)

1. Open **Supabase Dashboard** → **SQL Editor**
2. Copy/paste contents of: `/database/diagnostic_check.sql`
3. Click **"Run"**
4. Read the diagnosis at the bottom

### Step 2: Run Migration (30 seconds)

1. Open **Supabase Dashboard** → **SQL Editor** → **New Query**
2. Copy/paste **ALL** contents of: `/database/migrations/001_generalized_schema.sql`
3. Click **"Run"**
4. Wait for success message:
   ```
   ========================================
   Generalized Schema Created Successfully
   ========================================
   ```

### Step 3: Re-run Setup (3 minutes)

1. Restart your app: `npm start`
2. Go to: `http://localhost:8080/setup`
3. Complete the wizard (most info should be saved)
4. Upload your document
5. SUCCESS! 🎉

---

## Detailed Guide
See: `/docs/DATABASE_FIX_GUIDE.md` for comprehensive troubleshooting

---

## SQL Files Reference

| File | Purpose | When to Use |
|------|---------|-------------|
| `/database/diagnostic_check.sql` | Check database state | Always run first |
| `/database/migrations/001_generalized_schema.sql` | Full v2.0 schema | If missing tables |
| `/database/schema.sql` | Legacy schema | DON'T USE (outdated) |

---

## Expected Results

After migration:
- ✅ 15+ tables created
- ✅ Triggers and functions installed
- ✅ RLS policies enabled
- ✅ Setup wizard completes successfully
- ✅ Document sections imported correctly

---

## Verification

Run this in Supabase SQL Editor:
```sql
SELECT COUNT(*) as organizations FROM organizations
UNION ALL
SELECT COUNT(*) FROM documents
UNION ALL
SELECT COUNT(*) FROM document_sections;
```

Expected:
- 1 organization (yours)
- 0-1 documents (after setup completes)
- N sections (depending on your bylaws)

---

## Need Help?

1. Check server logs for `[SETUP-DEBUG]` messages
2. Re-run diagnostic: `/database/diagnostic_check.sql`
3. See full guide: `/docs/DATABASE_FIX_GUIDE.md`
