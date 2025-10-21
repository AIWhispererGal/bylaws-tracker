# Password Reset - Quick Start Guide

## 🚀 Implementation Complete

The forgot password flow is now fully functional and ready for testing.

---

## 📋 Quick Test (5 minutes)

### 1. Verify Routes
```bash
node -e "const r=require('./src/routes/auth.js');console.log('Routes:',r.stack.filter(l=>l.route&&(l.route.path==='/forgot-password'||l.route.path==='/reset-password')).length);"
```
Expected: `Routes: 4`

### 2. Start Server
```bash
npm start
```

### 3. Test Flow
1. Open browser: `http://localhost:3000/auth/login`
2. Click "Forgot password?" link → Should load `/auth/forgot-password`
3. Enter email → Click "Send Reset Link" → Should show success
4. Check email for reset link (Supabase sends it)
5. Click reset link → Should load `/auth/reset-password`
6. Enter new password → Confirm → Submit
7. Should redirect to login
8. Login with new password → Success!

---

## ⚙️ Supabase Configuration (One-time)

### Step 1: Email Template
1. Go to: https://auuzurghrjokbqzivfca.supabase.co
2. Navigate: **Authentication → Email Templates → Reset Password**
3. Use this template:

```
Subject: Reset Your Password

Body:
<h2>Reset Your Password</h2>
<p>Click the link below to reset your password:</p>
<p><a href="{{ .ConfirmationURL }}">Reset Password</a></p>
<p>This link expires in 24 hours.</p>
```

### Step 2: Redirect URLs
1. Navigate: **Authentication → URL Configuration**
2. Add redirect URLs:
   - Development: `http://localhost:3000/auth/reset-password`
   - Production: `https://your-ngrok-url.ngrok-free.app/auth/reset-password`

### Step 3: Test Email
- Use the form to send a test email
- Check inbox (may take 1-2 minutes)
- Click link to verify redirect works

---

## 🔧 Files Changed

### Created (3 files)
- ✅ `views/auth/forgot-password.ejs` - Email form
- ✅ `views/auth/reset-password.ejs` - Password form
- ✅ `docs/reports/SPRINT0_PASSWORD_RESET.md` - Full docs

### Modified (1 file)
- ✅ `src/routes/auth.js` - Added 4 routes (lines 1255-1408)

---

## 🎯 Routes Added

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/auth/forgot-password` | Show email form |
| POST | `/auth/forgot-password` | Send reset email |
| GET | `/auth/reset-password` | Show password form |
| POST | `/auth/reset-password` | Update password |

---

## 🔐 Security Features

✅ **Email enumeration protection** - Always returns success
✅ **Secure tokens** - Managed by Supabase, auto-expire
✅ **Password validation** - Min 8 chars, confirmed
✅ **Session security** - Token cleared after reset

---

## 🐛 Troubleshooting

### Email Not Received?
- Check Supabase Auth logs
- Verify email template configured
- Check spam folder
- Verify `APP_URL` in `.env`

### Reset Link Broken?
- Verify redirect URL in Supabase
- Check link hasn't expired (24 hours)
- Try incognito mode

### Password Update Fails?
- Verify password is 8+ characters
- Check passwords match
- Verify token hasn't expired
- Check browser console for errors

---

## 📞 Support

**Issue Tracker:** Check `/docs/reports/SPRINT0_PASSWORD_RESET.md` for detailed troubleshooting

**Supabase Dashboard:** https://auuzurghrjokbqzivfca.supabase.co

**Environment Variables:**
```bash
APP_URL=https://3eed1324c595.ngrok-free.app
SUPABASE_URL=https://auuzurghrjokbqzivfca.supabase.co
```

---

## ✅ Checklist

- [ ] Routes verified (run test command)
- [ ] Server started (`npm start`)
- [ ] Supabase email template configured
- [ ] Redirect URLs configured
- [ ] Test email sent
- [ ] Reset link clicked
- [ ] Password updated
- [ ] Login with new password works

---

**Status:** ✅ READY FOR TESTING

**Estimated Time:** 2 hours → **Actual:** ~1.5 hours

**Next:** Configure Supabase email templates, then test the full flow!
