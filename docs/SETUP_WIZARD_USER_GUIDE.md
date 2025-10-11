# Setup Wizard User Guide

## Welcome! 🎉

The Bylaws Tool Setup Wizard helps you get your application up and running quickly. This guide will walk you through the entire process, step by step.

## What Does the Setup Wizard Do?

The Setup Wizard automates the initial configuration of your Bylaws Tool application by:
- Testing your database connection
- Creating necessary database tables
- Setting up your administrator account
- Verifying everything works correctly

Think of it as your personal assistant that handles all the technical setup so you don't have to!

---

## Before You Start

### What You'll Need

1. **A Supabase Account** (free tier works fine)
   - Sign up at [supabase.com](https://supabase.com) if you don't have one
   - Create a new project and wait for it to finish setting up (takes 1-2 minutes)

2. **Your Supabase Connection Details**
   You'll find these in your Supabase dashboard:
   - **Project URL**: Found in Settings → API → Project URL
   - **API Key**: Found in Settings → API → `anon` `public` key
   - **Direct Database URL**: Found in Settings → Database → Connection String → URI
     (Choose the one that says "Connection pooling" or "Direct connection")

3. **Your Computer Ready**
   - A modern web browser (Chrome, Firefox, Edge, or Safari)
   - The application files downloaded to your computer

---

## Step-by-Step Setup

### Step 1: Start the Setup Wizard

1. Open your terminal or command prompt
2. Navigate to your application folder
3. Type: `npm start` and press Enter
4. Wait for the message: "Server running on http://localhost:3000"
5. Your web browser should automatically open to the Setup Wizard

> **Tip**: If your browser doesn't open automatically, manually go to `http://localhost:3000`

### Step 2: Database Configuration

You'll see a form asking for your database connection details.

**Fill in the fields:**

1. **Supabase URL**
   - Copy from: Supabase Dashboard → Settings → API → Project URL
   - Example: `https://abcdefghijklmnop.supabase.co`

2. **Supabase API Key (anon/public)**
   - Copy from: Supabase Dashboard → Settings → API → `anon` `public`
   - Example: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (very long string)

3. **Direct Database URL**
   - Copy from: Supabase Dashboard → Settings → Database → Connection String → URI
   - Example: `postgresql://postgres.[project-ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres`
   - **Important**: Make sure to use YOUR password (replace `[password]` with your actual database password)

**Click "Test Connection"**

✅ **Success**: You'll see a green checkmark and can proceed
❌ **Error**: See the [Troubleshooting](#troubleshooting-common-issues) section below

### Step 3: Database Setup

Once your connection test succeeds, click **"Initialize Database"**.

The wizard will:
1. Create all necessary database tables
2. Set up required indexes
3. Configure security policies
4. Prepare storage buckets

This usually takes 10-30 seconds. You'll see a progress indicator.

### Step 4: Create Your Admin Account

Now it's time to create your administrator account!

**Fill in the form:**

1. **Email Address**
   - Use a valid email you have access to
   - Example: `admin@yourorganization.org`

2. **Password**
   - Choose a strong password (at least 8 characters)
   - Mix letters, numbers, and special characters
   - Example: `SecurePass123!`

3. **Confirm Password**
   - Type the same password again to make sure it's correct

**Click "Create Admin Account"**

### Step 5: Verification

The wizard will verify that everything is set up correctly:
- ✅ Database tables created
- ✅ Admin account active
- ✅ Permissions configured
- ✅ Application ready to use

### Step 6: Complete Setup

**Congratulations!** 🎊

Your Bylaws Tool is now ready to use.

Click **"Go to Login"** to access your application.

---

## Troubleshooting Common Issues

### Issue: "Connection Refused" or "Cannot Connect to Database"

**What's happening**: Your computer can't reach the database server.

**Solutions to try**:

1. **Check your internet connection**
   - Make sure you're connected to the internet
   - Try opening another website to verify

2. **Verify your Supabase project is running**
   - Log into Supabase dashboard
   - Check that your project status is "Active" (not paused)

3. **Double-check your connection details**
   - Make sure you copied the FULL URL (nothing cut off)
   - Verify there are no extra spaces before or after
   - Confirm you're using the correct password in the database URL

4. **Use WSL IP Address (Windows users only)**
   - If you're running on Windows with WSL (Windows Subsystem for Linux):
   - Find your WSL IP address: Open WSL terminal and type `ip addr show eth0`
   - Look for the `inet` address (e.g., `172.x.x.x`)
   - Instead of `localhost:3000`, use `http://[WSL-IP]:3000`

### Issue: "CSRF Token Invalid" or "CSRF Error"

**What's happening**: Security tokens got mixed up (usually from browser cookies).

**Solution**:

1. Clear your browser cookies for `localhost`
   - **Chrome**: Settings → Privacy → Cookies → See all cookies → Remove `localhost`
   - **Firefox**: Settings → Privacy → Cookies → Manage Data → Remove `localhost`
   - **Edge**: Settings → Privacy → Cookies → Manage cookies → Remove `localhost`

2. Close all browser tabs showing the application

3. Restart the setup wizard (refresh the page)

### Issue: "Port Already in Use" or "Address Already in Use"

**What's happening**: Another program is using port 3000.

**Solution**:

1. **Find and stop the other program**:
   - **Windows**:
     - Press `Ctrl + Shift + Esc` to open Task Manager
     - Look for `node.exe` processes
     - Right-click and select "End Task"

   - **Mac/Linux**:
     - Open Terminal
     - Type: `lsof -i :3000` to find what's using the port
     - Type: `kill -9 [PID]` (replace [PID] with the number shown)

2. **Or use a different port**:
   - Edit the `.env` file
   - Change `PORT=3000` to `PORT=3001`
   - Restart the application

### Issue: "Database Tables Already Exist"

**What's happening**: The database was previously set up.

**Solution**:

If you want to start fresh:
1. Go to Supabase Dashboard → Table Editor
2. Delete all existing tables (if any)
3. Run the setup wizard again

If you want to keep existing data:
1. Skip the "Initialize Database" step
2. Proceed to create your admin account

### Issue: "Admin Account Creation Failed"

**What's happening**: The email might already be registered, or there's a validation error.

**Solutions**:

1. **Try a different email address**
   - The email might already exist in the system

2. **Check password requirements**
   - Must be at least 8 characters
   - Include uppercase, lowercase, numbers

3. **Verify email format**
   - Must be a valid email address (e.g., `name@domain.com`)

---

## What to Do After Setup

### 1. Log In

- Use the email and password you created during setup
- Click "Login" on the login page

### 2. Explore the Dashboard

You'll see:
- **Documents**: View and manage your bylaws documents
- **Suggestions**: Review proposed changes
- **Users**: Manage user accounts (admin only)
- **Settings**: Configure application preferences

### 3. Upload Your First Document

1. Click "Documents" in the navigation
2. Click "Upload New Document"
3. Select a PDF file of your bylaws
4. Wait for processing to complete

### 4. Invite Team Members (Optional)

1. Go to "Users" section
2. Click "Invite User"
3. Enter their email address
4. Choose their role (Editor, Reviewer, or Admin)
5. They'll receive an invitation email

### 5. Configure Settings

Customize your application:
- **Organization Name**: Set your organization's name
- **Notification Preferences**: Choose when to receive alerts
- **Theme**: Select light or dark mode
- **Language**: Choose your preferred language

---

## Need More Help?

### Documentation

- **Configuration Guide**: See `CONFIGURATION_GUIDE.md` for advanced settings
- **Migration Guide**: See `MIGRATION_GUIDE.md` for upgrading from old versions
- **Architecture Design**: See `database/ARCHITECTURE_DESIGN.md` for technical details

### Getting Support

1. **Check existing documentation** in the `/docs` folder
2. **Review troubleshooting section** above
3. **Contact your system administrator** if you're part of an organization
4. **Open an issue** on the project repository (if applicable)

---

## Quick Reference

### Important URLs

- **Setup Wizard**: `http://localhost:3000` (first run)
- **Login Page**: `http://localhost:3000/login` (after setup)
- **Dashboard**: `http://localhost:3000/dashboard` (after login)

### Important Files

- `.env` - Contains your configuration (keep this secure!)
- `docs/` - All documentation
- `database/migrations/` - Database setup scripts

### Supabase Dashboard Locations

- **Project URL**: Settings → API → Project URL
- **API Key**: Settings → API → `anon` `public`
- **Database URL**: Settings → Database → Connection String → URI
- **Table Editor**: Dashboard → Table Editor
- **Database Logs**: Dashboard → Database → Logs

---

## Security Best Practices

1. **Never share your `.env` file** - It contains sensitive credentials
2. **Use strong passwords** - Mix characters, numbers, and symbols
3. **Keep your Supabase API keys secret** - Don't commit them to version control
4. **Regularly update passwords** - Change admin passwords periodically
5. **Enable two-factor authentication** - In Supabase dashboard when available

---

**You're all set!** Enjoy using your Bylaws Tool! 🚀

If you found this guide helpful, consider sharing it with other users in your organization.
