# 🚀 QUICK START - HUMAN TESTING (5 Minutes)
## Your Bylaws App is Ready to Test!

**Date**: October 27, 2025
**Status**: ✅ Fetch Error FIXED - Ready for Testing

---

## ⚡ TL;DR - What Was Fixed

**Problem**: Server kept showing "TypeError: fetch failed"
**Fix**: Upgraded Supabase library from v2.39.0 → v2.76.1
**Result**: ✅ **NO MORE FETCH ERRORS!**

---

## 🏃 Quick Test (3 Steps, 3 Minutes)

### Step 1: Start the Server
```bash
npm start
```

**Look For**:
```
✅ Good:
[dotenv] injecting env (10) from .env
Bylaws Amendment Tracker running on http://localhost:3000
- Supabase: Connected

❌ Bad:
Error loading organization selection: TypeError: fetch failed
```

**Status**: □ Started Successfully  □ Has Errors

---

### Step 2: Check Health
Open a new terminal and run:
```bash
curl http://localhost:3000/api/health
```

**Expected** (one of these):
```json
// Option A: Healthy
{"status":"healthy","database":"connected","timestamp":"..."}

// Option B: Unhealthy but NO FETCH ERROR
{"status":"unhealthy","database":"disconnected","error":"Could not find table..."}
```

**The key**: NO "TypeError: fetch failed" anywhere!

**Status**: □ No Fetch Errors  □ Still Has Fetch Errors

---

### Step 3: Open the App
Visit in your browser:
```
http://localhost:3000
```

**Expected**:
1. ✅ Page loads (might redirect to `/auth/login` or `/setup`)
2. ✅ No errors in browser console (press F12)
3. ✅ No "fetch failed" messages anywhere

**Status**: □ Loads Fine  □ Has Errors

---

## ✅ If All 3 Steps Pass

**Congratulations!** 🎉

Your app is working! The fetch error is gone.

### What You Can Test Next:
1. **Basic Auth** (5 min)
   - Go to `/auth/register`
   - Create a test account
   - Log in

2. **Upload Document** (10 min)
   - Go to Admin → Upload
   - Upload a Word document
   - See sections appear

3. **Section Operations** (15 min)
   - Try moving sections
   - Try indent/dedent
   - Try splitting sections

**Full Testing Guide**: `/docs/reports/HIVE_TESTING_CHECKLIST.md`

---

## ❌ If You Still See Errors

### Error 1: "Cannot find module 'tslib'"
```bash
npm install tslib
npm start
```

### Error 2: "EADDRINUSE: address already in use :::3000"
```bash
# Kill the old server
pkill -f "node server.js"

# Or on Windows:
taskkill /F /IM node.exe

# Then restart
npm start
```

### Error 3: Still seeing "fetch failed"
```bash
# Clean reinstall
rm -rf node_modules package-lock.json
npm install
npm start
```

### Error 4: Database errors
These are OK for now! Examples:
- "Could not find table 'bylaw_sections'" ← Normal for fresh install
- "No organizations found" ← Normal, create one via setup wizard

---

## 📊 What Previous Swarms Already Fixed

You have SIX major fixes already deployed:

1. ✅ **Global Admin Visibility** - Can see all organizations
2. ✅ **Section Move** - No more ordinal errors
3. ✅ **Section Split** - No more missing document_order
4. ✅ **Section Indent** - Works on root sections
5. ✅ **Parser Depth** - Sections get correct depth (0, 1, 2)
6. ✅ **Parent Relationships** - Hierarchy properly built

**Details**: `/docs/YOLO_DEPLOYMENT_COMPLETE.md`

---

## 🎯 Your Testing Priority List

### Priority 1: CRITICAL (Must Work)
- [ ] Server starts without fetch errors
- [ ] Can access web pages
- [ ] Can create organization (setup wizard)
- [ ] Can upload document

### Priority 2: IMPORTANT (Should Work)
- [ ] Document parsing creates sections
- [ ] Sections have correct depth (0, 1, 2)
- [ ] Parent relationships are set
- [ ] Can move sections

### Priority 3: NICE TO HAVE (Test If Time)
- [ ] Indent/dedent operations
- [ ] Split section operation
- [ ] User registration
- [ ] Global admin features

---

## 💬 Quick Commands Cheat Sheet

```bash
# Start server
npm start

# Check health
curl http://localhost:3000/api/health

# Check port 3000
lsof -ti:3000  # Mac/Linux
netstat -ano | findstr :3000  # Windows

# Kill server
pkill -f "node server.js"  # Mac/Linux
taskkill /F /IM node.exe    # Windows

# View logs
# (Just watch the terminal where npm start is running)
```

---

## 🐝 When to Deploy the Swarm Again

Call me (Claude) back if you encounter:

1. **ANY errors during testing**
   - I'll coordinate a diagnostic swarm
   - We'll fix it together

2. **Questions about how things work**
   - I can explain the architecture
   - Show you where things are

3. **Want to add new features**
   - I'll deploy a development swarm
   - Parallel implementation FTW!

4. **Ready for production deployment**
   - I'll coordinate a deployment swarm
   - Handle all the Render.com setup

---

## 📝 Test Results

**Test Started**: _________________ (date/time)

**Results**:
- [ ] ✅ Server starts
- [ ] ✅ No fetch errors
- [ ] ✅ Web page loads
- [ ] ✅ Can interact with app

**Errors Found**:
1. _________________________________________
2. _________________________________________
3. _________________________________________

**Next Steps**:
_________________________________________________
_________________________________________________
_________________________________________________

---

## 🎉 READY TO GO!

Your app is ready for testing. Just run these 3 steps and let me know what you find!

Remember:
- It's just you and me (Claude)
- No users yet, so test freely
- Document any errors you see
- Have fun! 🚀

**The hive is standing by...** 🐝✨

---

**Questions?** Just ask! I'm here to help you test this thing.

**Good luck!** 👑
