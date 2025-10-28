# ⚡ Render Quick Fix - 5 Minute Deployment

**Get your Render deployment working in 5 minutes**

---

## 🚨 DO THIS FIRST (1 minute)

### Step 1: Trigger Render Redeploy

1. Go to https://dashboard.render.com
2. Click on **"bylaws-amendment-tracker"** service
3. Click **"Manual Deploy"** button (top right, blue button)
4. Select **"Deploy latest commit"**
5. Click **Deploy**

**Wait 2-3 minutes for build to complete before moving to Step 2**

---

## 🔐 Step 2: Set Environment Variables (2 minutes)

In Render Dashboard → Your Service → **Environment** tab:

### Click "Add Environment Variable" and add these 6:

```env
SUPABASE_URL=https://your-project.supabase.co
```
*(Get from: Supabase Dashboard → Project Settings → API → Project URL)*

```env
SUPABASE_ANON_KEY=your-long-anon-key-here
```
*(Get from: Supabase Dashboard → Project Settings → API → Project API keys → anon/public)*

```env
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```
*(Get from: Supabase Dashboard → Project Settings → API → Project API keys → service_role)*

```env
APP_URL=https://bylaws-amendment-tracker.onrender.com
```
*(This is your Render URL)*

```env
NODE_ENV=production
```

```env
SESSION_SECRET=paste-random-string-here
```
*(Generate below)*

### Generate SESSION_SECRET:

Run this in your local terminal:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output and paste as SESSION_SECRET value.

**After adding all 6 variables, click "Save Changes"** - Render will auto-redeploy

---

## 🗄️ Step 3: Fix Database (2 minutes)

### Option A: Use Your Dev Database (FASTEST - 30 seconds)

1. Open your local `.env` file
2. Copy these values to Render Environment Variables:
   - Your local `SUPABASE_URL`
   - Your local `SUPABASE_ANON_KEY`
   - Your local `SUPABASE_SERVICE_ROLE_KEY`

**This makes Render use your dev database temporarily**

✅ Pros: Works instantly, can test deployment right now
❌ Cons: Dev and prod share database (fix later)

---

### Option B: Create New Production Database (BETTER - 2 minutes)

1. Go to https://supabase.com/dashboard
2. Click **"New Project"**
3. Name: "bylaws-tracker-prod"
4. Set password (save it!)
5. Click **Create new project**
6. Wait ~2 minutes for provisioning

Once ready:
7. Go to **SQL Editor** (left sidebar)
8. Click **New Query**
9. Copy ENTIRE contents of: `database/migrations/001_generalized_schema.sql`
10. Paste in SQL Editor
11. Click **Run**
12. Wait for "Success" ✅

Then copy NEW credentials to Render:
- Project Settings → API → Copy URL, anon key, service_role key
- Paste into Render Environment Variables
- Replace your old Supabase credentials

---

## ✅ Step 4: Verify It Works (30 seconds)

1. Wait for Render deployment to finish (watch Logs tab)
2. Visit: https://bylaws-amendment-tracker.onrender.com
3. Should see setup wizard (not 502 error!)
4. Create test organization
5. Done! 🎉

---

## 🚨 If Still Seeing 502 Error

### Check Render Logs:

Go to Render Dashboard → Your Service → **Logs** tab

**Look for:**

### ✅ SUCCESS looks like:
```
Server running on port 3000
Listening on http://0.0.0.0:3000
```

### ❌ FAILURE looks like:
```
Error: Could not find table 'organizations'
PGRST205
```
→ **Fix:** You need to run database migrations (Step 3, Option B)

```
Error: Invalid API key
```
→ **Fix:** Double-check your Supabase credentials in Environment Variables

```
Error: SESSION_SECRET
```
→ **Fix:** Add SESSION_SECRET environment variable

---

## 📊 Expected Timeline

| Step | Time | What Happens |
|------|------|--------------|
| Manual Deploy | 2-3 min | Render rebuilds from latest code |
| Add Environment Variables | 1-2 min | Render auto-redeploys |
| Fix Database (Option A) | 30 sec | Just change env vars |
| Fix Database (Option B) | 2 min | Create new Supabase project |
| **TOTAL (Option A)** | **~5 minutes** | **Fast but temporary** |
| **TOTAL (Option B)** | **~7 minutes** | **Proper production setup** |

---

## 🎯 What You're Fixing

**The Problem:**
- Your code pushed to GitHub successfully ✅
- But Render was using old environment variables ❌
- And your production database had old schema ❌

**The Solution:**
- Manual redeploy picks up new code ✅
- Environment variables connect to correct database ✅
- Running migration creates `organizations` table ✅

---

## 🚀 After It's Working

Once your app loads successfully:

1. **Create your organization** - Setup wizard will guide you
2. **Invite users** - Admin → Users → Invite User
3. **Upload documents** - Dashboard → Upload Document
4. **Set up workflow** - Admin → Workflow Configuration

---

## 📞 Still Broken?

If after completing all steps you still see errors:

1. **Check Render Logs** - What's the FIRST error message?
2. **Verify Supabase connection** - Try query in Supabase SQL Editor:
   ```sql
   SELECT * FROM organizations;
   ```
   Should return empty result (not "table doesn't exist" error)
3. **Test locally with production credentials** - Edit your local `.env` to use production Supabase URL/keys and run `npm start`

---

**Current Status:** Ready to deploy

**Next Action:** Go to Render Dashboard → Click "Manual Deploy" → Watch logs
