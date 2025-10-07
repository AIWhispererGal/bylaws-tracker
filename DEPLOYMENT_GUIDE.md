# 🚀 PRODUCTION DEPLOYMENT GUIDE

## STEP-BY-STEP: Deploy to Render.com (FREE)

Your Bylaws Amendment Tracker will be accessible online 24/7 with a permanent URL!

---

## PART 1: PREREQUISITES (5 minutes)

### 1. Create GitHub Repository (if you don't have one)

```bash
cd /mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL2

# Initialize git (if not already done)
git init

# Add all files
git add .

# Create first commit
git commit -m "Initial commit - Bylaws Amendment Tracker"

# Create GitHub repo (go to github.com/new)
# Then connect:
git remote add origin https://github.com/YOUR-USERNAME/bylaws-tracker.git
git branch -M main
git push -u origin main
```

### 2. Sign Up for Render.com

1. Go to https://render.com
2. Click "Get Started for Free"
3. Sign up with GitHub (easiest!)
4. Authorize Render to access your repositories

---

## PART 2: DEPLOY TO RENDER (10 minutes)

### Step 1: Create New Web Service

1. In Render dashboard, click **"New +"** → **"Web Service"**
2. Connect your GitHub repository: `bylaws-tracker`
3. Render will detect it's a Node.js app ✅

### Step 2: Configure Build Settings

**Name:** `bylaws-amendment-tracker`
**Environment:** `Node`
**Region:** `Oregon (US West)` or closest to Los Angeles
**Branch:** `main`

**Build Command:**
```bash
npm install
```

**Start Command:**
```bash
npm start
```

**Plan:** `Free` ✅

### Step 3: Add Environment Variables

Click **"Advanced"** → **"Add Environment Variable"**

Add these (from your `.env` file):

```
SUPABASE_URL=https://wqrcslmaytruvspzyfkz.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxcmNzbG1heXRydXZzcHp5Zmt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1ODQ1MjYsImV4cCI6MjA3NDE2MDUyNn0.dABrgRuRz9vMLjdI9XxQDARVpHJ47JcpGR9iqjrDm8I
GOOGLE_DOC_ID=1LdE2NGMOJ7BgV19V3Qb-hnN5VTmB5C_Hh6heemqxviA
NODE_ENV=production
PORT=3000
```

### Step 4: Deploy!

1. Click **"Create Web Service"**
2. Render will:
   - Clone your GitHub repo
   - Run `npm install`
   - Start your server with `npm start`
   - Give you a URL like: `https://bylaws-amendment-tracker.onrender.com`

**⏱️ First deploy takes ~5 minutes**

---

## PART 3: UPDATE GOOGLE APPS SCRIPT (5 minutes)

### Update the APP_URL

Your new permanent URL will be:
```
https://bylaws-amendment-tracker.onrender.com
```

**In Google Apps Script:**
1. Open your Google Doc
2. Extensions → Apps Script
3. Find `SmartSemanticParser.gs` (or whichever script you're using)
4. Line 17: Update `APP_URL`:
```javascript
const APP_URL = 'https://bylaws-amendment-tracker.onrender.com';
```
5. Save (Ctrl+S)

**No more NGROK updates needed! This URL is permanent!** 🎉

---

## PART 4: TEST YOUR DEPLOYMENT

### 1. Check the Logs

In Render dashboard:
- Click on your service
- Go to **"Logs"** tab
- You should see:
```
Bylaws Amendment Tracker running on https://bylaws-amendment-tracker.onrender.com
Current Configuration:
- App URL: https://bylaws-amendment-tracker.onrender.com
- Supabase: Connected
```

### 2. Access Your App

Open in browser:
```
https://bylaws-amendment-tracker.onrender.com/bylaws
```

You should see:
- ✅ 48 sections in sidebar
- ✅ Google Doc iframe on left
- ✅ All sections unlocked and ready

### 3. Test from Google Doc

1. Open your Google Doc
2. Click **"Bylaws Sync - Smart Parser"** menu
3. Click **"🔗 Test Connection"**
4. Should show: ✅ Connected successfully!

---

## PART 5: MULTI-USER ACCESS

### Your app is now PUBLIC and ACCESSIBLE by anyone with the URL!

**Share with committee members:**
```
https://bylaws-amendment-tracker.onrender.com/bylaws
```

**Who can access:**
- ✅ Committee members
- ✅ City council staff
- ✅ Citizens (if you want public suggestions)
- ✅ Anyone with the URL

**Current limitation:**
- ❌ NO AUTHENTICATION (anyone can lock/unlock sections)
- ❌ NO USER TRACKING (all actions show as "Committee")

**Solution:** We'll add authentication in Part 6 below!

---

## PART 6: ADD AUTHENTICATION (OPTIONAL - Recommended for production)

### Option 1: Supabase Auth (RECOMMENDED)

Supabase has built-in authentication! Let's use it:

**Benefits:**
- ✅ Email/password login
- ✅ Google OAuth (login with Google)
- ✅ Track who locked which sections
- ✅ Role-based access (committee vs public)

**Implementation:** I can help you add this - it's about 2 hours of work.

### Option 2: Simple Password Protection

Add a single password for committee members:

```javascript
// In server.js - simple middleware
app.use('/bylaws', (req, res, next) => {
  const password = req.query.key;
  if (password === 'ResedaNC2024') {
    next();
  } else {
    res.send('Access denied. Contact committee for password.');
  }
});
```

Then share URL: `https://bylaws-amendment-tracker.onrender.com/bylaws?key=ResedaNC2024`

**Not secure, but quick!**

---

## PART 7: CUSTOM DOMAIN (OPTIONAL)

### Use your city/council domain

If Reseda NC has a domain like `resedanc.org`:

1. In Render dashboard → **"Settings"** → **"Custom Domain"**
2. Add: `bylaws.resedanc.org`
3. Follow Render's DNS instructions
4. Update DNS records with your domain provider
5. Wait ~1 hour for propagation

Then access via:
```
https://bylaws.resedanc.org
```

Much more professional! ✨

---

## RENDER FREE TIER LIMITS

**What you get FREE:**
- ✅ 750 hours/month (enough for 24/7 uptime!)
- ✅ Automatic HTTPS
- ✅ Auto-deploys from GitHub
- ✅ Environment variables
- ✅ Basic DDoS protection

**Limitations:**
- ⚠️ App "spins down" after 15 min of inactivity
- ⚠️ First request after spin-down takes ~30 seconds
- ⚠️ 512 MB RAM (should be fine for your app)

**Solution for spin-down:**
Add a cron job to ping your app every 14 minutes:
```bash
# Use cron-job.org or similar
Ping: https://bylaws-amendment-tracker.onrender.com/api/config
Every: 14 minutes
```

**Or upgrade to Starter Plan ($7/month):**
- ✅ No spin-down (always running)
- ✅ More RAM (512 MB → 2 GB)
- ✅ Priority support

---

## AUTO-DEPLOYMENT WORKFLOW

Once set up, here's how updates work:

1. **Make changes locally:**
   ```bash
   # Edit files in VS Code or Claude Code
   vim server.js
   ```

2. **Commit and push:**
   ```bash
   git add .
   git commit -m "Added multi-section selection"
   git push origin main
   ```

3. **Render auto-deploys:**
   - Detects git push
   - Runs `npm install`
   - Restarts server
   - **Live in ~2 minutes!** 🚀

**No manual deployment needed!**

---

## MONITORING & LOGS

### View Logs in Real-Time

Render Dashboard → Your Service → **"Logs"** tab

You'll see:
- All server startup messages
- API requests
- Errors (if any)
- Database queries

### Set Up Alerts

Render Dashboard → **"Settings"** → **"Notifications"**
- Email on deploy failure
- Email on service crash
- Slack webhook (optional)

---

## BACKUP STRATEGY

### Database Backups

Supabase automatically backs up your database!

**Manual backup:**
1. Go to Supabase dashboard
2. Database → **"Backups"**
3. Download backup as `.sql` file

**Scheduled backups:**
Supabase Pro ($25/month) includes:
- Daily automated backups
- 7-day retention
- One-click restore

### Code Backups

Your code is backed up in GitHub! ✅

---

## TROUBLESHOOTING

### "Application failed to respond"

**Cause:** Server crashed
**Fix:** Check Render logs for errors

Common issues:
- Missing environment variable
- Supabase connection failed
- Port binding error

### "Cannot connect to database"

**Cause:** Wrong Supabase credentials
**Fix:** Verify environment variables in Render match your `.env`

### "Google Doc not loading"

**Cause:** GOOGLE_DOC_ID incorrect
**Fix:** Update environment variable with correct ID

---

## SECURITY CHECKLIST

Before sharing publicly:

- [ ] Environment variables set in Render (not in code)
- [ ] `.env` file NOT committed to GitHub
- [ ] Authentication enabled (Supabase Auth or password)
- [ ] CORS configured properly
- [ ] Database RLS (Row Level Security) enabled in Supabase
- [ ] Test with multiple users
- [ ] Set up error monitoring

---

## NEXT STEPS

1. ✅ Deploy to Render (follow Part 2 above)
2. ✅ Update Google Apps Script with new URL (Part 3)
3. ✅ Test deployment (Part 4)
4. ✅ Share URL with committee (Part 5)
5. ⏳ Add authentication (Part 6 - optional but recommended)
6. ⏳ Implement multi-section selection (separate task)

---

## COST BREAKDOWN

| Item | Free Tier | Paid Option |
|------|-----------|-------------|
| Render Hosting | FREE (with spin-down) | $7/month (always on) |
| Supabase Database | FREE (500 MB, 2 GB bandwidth) | $25/month (8 GB, 250 GB bandwidth) |
| Custom Domain | FREE (if you own domain) | $10-15/year (domain registration) |
| **TOTAL** | **$0/month** ✅ | **$32-42/month** (for heavy use) |

**For a small neighborhood council:** FREE tier is perfect! ✅

---

## ALTERNATIVE HOSTING OPTIONS

If Render doesn't work for you:

### Railway.app
- **Pros:** Fast deploys, great DX
- **Cons:** No free tier (starts $5/month)

### Fly.io
- **Pros:** Global edge deployment
- **Cons:** More complex setup

### Vercel
- **Pros:** Easy Next.js deployment
- **Cons:** Not ideal for Express backend

**Stick with Render for your use case!** ✅

---

## SUPPORT & HELP

**Render Documentation:**
https://render.com/docs

**Supabase Documentation:**
https://supabase.com/docs

**Need help?**
Summon the Hive Mind again! We'll troubleshoot together. 👑🐝

---

**🎉 Once deployed, your Bylaws Amendment Tracker will be:**
- ✅ Accessible 24/7 online
- ✅ Usable by multiple people simultaneously
- ✅ Auto-updated when you push to GitHub
- ✅ Monitored and logged
- ✅ FREE (or very cheap if you upgrade)

**Ready to deploy? Let's do this!** 🚀
