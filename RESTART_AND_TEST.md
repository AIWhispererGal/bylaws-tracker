# ⚡ RESTART AND TEST - Section Buttons Fix

## 🚨 CRITICAL: YOU MUST RESTART THE SERVER!

The section buttons fix requires a server restart to take effect.

---

## 🚀 3-STEP QUICK TEST

### Step 1: Restart Server (30 seconds)
```bash
# Stop the server
Ctrl+C

# Start it again
npm start

# Wait for: "Server running on port 3000"
```

---

### Step 2: Clear Session & Login (1 minute)

1. **Clear your browser cache** (Ctrl+Shift+Delete)
   - Or just open an Incognito/Private window

2. **Go to:** http://localhost:3000/auth/select

3. **Login** as organization owner

4. **Select** your organization

---

### Step 3: Verify Buttons Appear (1 minute)

1. **Click on a document** to open document viewer

2. **Click on any section** to expand it

3. **Look for "Edit Section:" toolbar** below the section

4. **Verify you see these buttons:**
   ```
   ✅ 🔄 Rename
   ✅ ⬆️ (Move Up button)
   ✅ ⬇️ (Move Down button)
   ✅ ➡️ Indent
   ✅ ⬅️ Dedent
   ✅ ✂️ Split
   ✅ 🔗 Join
   ```

---

## ✅ SUCCESS = ALL BUTTONS VISIBLE!

If you see all 7 buttons (Rename, Up, Down, Indent, Dedent, Split, Join), the fix worked! 🎉

---

## ❌ IF BUTTONS STILL DON'T SHOW

### Troubleshooting Checklist:

1. **Did you restart the server?**
   - The code change requires a restart!

2. **Did you clear browser cache?**
   - Old session might still have wrong role format

3. **Are you logged in as owner?**
   - Check: Database → user_organizations → your user has role_code = 'owner'

4. **Did you expand the section?**
   - Buttons only appear when section is expanded (clicked)

5. **Check browser console (F12)**
   - Look for errors
   - Should NOT see "userRole is undefined"

---

## 🐛 WHAT WAS FIXED

**Bug:** `getUserRole()` returned object `{role_code: 'owner'}` instead of string `'owner'`

**Result:** View template comparison failed: `object === 'owner'` = false

**Fix:** Now returns `'owner'` string directly

**File Changed:** `src/middleware/permissions.js:161-162`

---

## 📞 REPORT BACK

### If It Works:
```
✅ "Section buttons now visible! Ready to test operations!"
```

### If It Doesn't Work:
```
❌ "Still no buttons. Here's what I checked:
   - [ ] Restarted server
   - [ ] Cleared cache
   - [ ] Logged in as owner
   - [ ] Expanded section
   Console shows: [paste any errors]"
```

---

**Total time: ~2.5 minutes**

**Let's get those buttons showing!** 🚀
