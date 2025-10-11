# Render Deployment Guide for Users

## Quick Start: Deploy Your Own Bylaws Tracker in 5 Minutes

This guide will help you deploy your own instance of the Bylaws Amendment Tracker to Render.com **without any coding or technical knowledge**.

---

## Prerequisites

You'll need:

1. ✅ A free **Render account** (create at [render.com](https://render.com))
2. ✅ A free **Supabase account** (create at [supabase.com](https://supabase.com))
3. ⏱️ **5 minutes** of your time

**No credit card required!** Both platforms offer generous free tiers.

---

## Step 1: Deploy to Render (2 minutes)

### 1.1 Click the Deploy Button

Click this button to start the deployment:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/YOUR_USERNAME/bylaws-tracker)

### 1.2 Create a Render Account

If you don't have a Render account yet:

1. Click **"Sign Up"**
2. Use your email or GitHub account
3. Verify your email address

### 1.3 Deploy the Service

1. You'll see a deployment page with the service name: `bylaws-amendment-tracker`
2. **Choose your region** (select the one closest to your users)
3. Click **"Deploy"** (the big blue button)

### 1.4 Wait for Build

The build process takes about **2-3 minutes**. You'll see:

- ✅ "Build successful"
- ✅ "Deploy live"

### 1.5 Get Your App URL

Once deployed, you'll see your app URL:

```
https://bylaws-amendment-tracker-abc123.onrender.com
```

**Copy this URL!** You'll need it in the next step.

---

## Step 2: Create Supabase Database (2 minutes)

### 2.1 Create a Supabase Account

1. Go to [supabase.com](https://supabase.com)
2. Click **"Start your project"**
3. Sign up with GitHub or email

### 2.2 Create a New Project

1. Click **"New Project"**
2. Choose an **organization** (or create one)
3. Fill in the project details:
   - **Name:** `bylaws-tracker` (or any name you like)
   - **Database Password:** Create a strong password (save it somewhere safe!)
   - **Region:** Choose the same region as your Render service
4. Click **"Create new project"**

⏱️ **Wait 1-2 minutes** for Supabase to provision your database.

### 2.3 Get Your Supabase Credentials

Once your project is ready:

1. Go to **Settings** (gear icon in left sidebar)
2. Click **"API"** in the Settings menu
3. You'll see two important values:

   **Project URL:**
   ```
   https://abcdefghijk.supabase.co
   ```

   **Anon Key (Public):**
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS...
   ```

4. **Copy both of these values** - you'll paste them in the setup wizard!

---

## Step 3: Complete Setup Wizard (1 minute)

### 3.1 Visit Your App

Open your Render app URL in a browser:

```
https://bylaws-amendment-tracker-abc123.onrender.com
```

You'll automatically be redirected to the **Setup Wizard** 🎉

### 3.2 Follow the Wizard

The setup wizard will guide you through 4 easy steps:

#### **Step 1: Welcome**
- Read the welcome message
- Click **"Get Started →"**

#### **Step 2: Supabase Configuration**
- **Paste your Supabase URL** (from Step 2.3)
- **Paste your Supabase Anon Key** (from Step 2.3)
- Click **"Validate & Continue →"**

The wizard will test your connection to make sure it works!

#### **Step 3: Database Setup**
- Click **"Create Database →"**
- The wizard will automatically create the necessary tables

You'll see checkmarks as each step completes:
- ✅ Testing database connection...
- ✅ Creating database tables...
- ✅ Setting up permissions...

#### **Step 4: Additional Configuration**
- **Organization Name** (optional): Enter your organization's name
  - Example: "Reseda Neighborhood Council"
- **Google Doc ID** (optional): If you have a Google Doc with your bylaws, paste the ID here
  - Extract from URL: `docs.google.com/document/d/[THIS_PART]/edit`
- Click **"Complete Setup →"**

### 3.3 Setup Complete!

The wizard will:
1. Save your configuration
2. Restart your application
3. Redirect you to the main app

**You'll see a countdown**: "Redirecting in 5... 4... 3..."

---

## Step 4: Start Using Your Tracker! 🎉

Your Bylaws Amendment Tracker is now **live and ready to use**!

### What You Can Do Now:

1. **Import Your Bylaws** (if you have a Google Doc)
   - Click "Import from Google Docs"
   - Follow the instructions

2. **Manually Add Sections**
   - Click "Add Section"
   - Enter Article/Section information

3. **Collect Suggestions**
   - Share your app URL with members
   - They can view bylaws and submit suggestions

4. **Review and Approve**
   - Committee members can review suggestions
   - Lock in approved amendments

---

## Troubleshooting

### "Cannot connect to Supabase"

**Problem:** The wizard can't connect to your database.

**Solutions:**
1. Double-check your **Supabase URL** - it should end with `.supabase.co`
2. Double-check your **Anon Key** - it should be a long string starting with `eyJ`
3. Make sure you copied the **entire key** (it's very long!)
4. Try refreshing the Supabase dashboard to ensure your project is fully ready

### "App won't load after setup"

**Problem:** The app shows an error after completing setup.

**Solutions:**
1. Wait 30 seconds and refresh the page (Render needs time to restart)
2. Check your Render dashboard - make sure the service is "Live"
3. If still not working, go to Render dashboard → Your Service → "Manual Deploy" → Deploy

### "Setup wizard won't appear"

**Problem:** You see an error instead of the setup wizard.

**Solutions:**
1. Make sure you're visiting the correct app URL
2. Clear your browser cache and cookies
3. Try accessing the setup wizard directly: `https://your-app.onrender.com/setup`

---

## Advanced Configuration

### Adding a Custom Domain

Want to use your own domain like `bylaws.yourorg.com`?

1. Go to your Render dashboard
2. Select your service
3. Click **"Settings"** → **"Custom Domain"**
4. Follow Render's instructions to add your domain

### Upgrading to Paid Plan

The free tier is great for small organizations, but you can upgrade for:

- ✅ No auto-sleep (instant response times)
- ✅ More resources (faster performance)
- ✅ Priority support

**Render Plans:** Starting at $7/month
**Supabase Plans:** Starting at $25/month

### Enabling Google Docs Integration

To enable automatic import from Google Docs:

1. Create a Google Apps Script (see documentation)
2. Get your Google Doc ID
3. Add it in the setup wizard or in Render environment variables

---

## Getting Help

### Documentation
- 📚 [Full Documentation](../README.md)
- 🏗️ [Architecture Guide](../database/ARCHITECTURE_DESIGN.md)
- ⚙️ [Configuration Guide](../CONFIGURATION_GUIDE.md)

### Support
- 💬 [GitHub Issues](https://github.com/YOUR_USERNAME/bylaws-tracker/issues)
- 📧 Email: support@yourproject.com

### Community
- 💡 [Feature Requests](https://github.com/YOUR_USERNAME/bylaws-tracker/discussions)
- 🐛 [Bug Reports](https://github.com/YOUR_USERNAME/bylaws-tracker/issues/new)

---

## Next Steps

Now that your tracker is deployed, here's what to do next:

1. ✅ **Customize branding** - Update organization name and logo
2. ✅ **Import bylaws** - Add your existing bylaws documents
3. ✅ **Invite members** - Share the URL with your organization
4. ✅ **Set up notifications** - Configure email alerts for new suggestions
5. ✅ **Train committee members** - Show them how to review and approve changes

**Congratulations!** 🎉 You've successfully deployed your own Bylaws Amendment Tracker!

---

## Security Best Practices

### Keep Your Credentials Safe

- ❌ **Never share** your Supabase credentials publicly
- ❌ **Never commit** credentials to GitHub
- ✅ **Use environment variables** (handled automatically by the setup wizard)

### Regular Backups

- ✅ Supabase automatically backs up your database
- ✅ Export committee decisions regularly (use the Export button)
- ✅ Download JSON backups monthly for your records

### User Management

- ✅ Review who has access to your Supabase project
- ✅ Use strong passwords
- ✅ Enable two-factor authentication on your Render and Supabase accounts

---

**Enjoy your new Bylaws Amendment Tracker!** 🚀
