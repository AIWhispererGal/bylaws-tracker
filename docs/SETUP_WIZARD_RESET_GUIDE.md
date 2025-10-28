# Setup Wizard Emergency Reset Guide

## Overview

The `reset-setup-wizard.js` script provides a safe way to reset stuck setup wizard state without affecting configured organizations.

## When to Use

Use this script when:
- Setup wizard is stuck in a loop
- Registration failed partway through
- Testing setup wizard flow
- Need to clear incomplete setup attempts

## What It Does

The script safely:

1. **Clears Sessions**: Removes all active sessions
2. **Deletes Incomplete Organizations**: Removes organizations where `is_configured = false`
3. **Removes Orphaned Users**: Deletes users without an organization
4. **Clears Setup Cache**: Resets in-memory middleware cache

## Safety Features

✅ **Safe to run multiple times** - Idempotent operation
✅ **Protects configured organizations** - Only affects incomplete data
✅ **Requires confirmation** - Interactive prompt before deletion
✅ **Shows impact analysis** - Lists exactly what will be deleted
✅ **Cascade deletion** - Properly removes related data

## Usage

### Interactive Mode (Recommended)

```bash
node scripts/reset-setup-wizard.js
```

This will:
1. Analyze current database state
2. Show what will be deleted
3. Ask for confirmation
4. Execute the reset

### Force Mode (Skip Confirmation)

```bash
node scripts/reset-setup-wizard.js --force
# OR
node scripts/reset-setup-wizard.js -f
```

**⚠️ Warning**: This skips the confirmation prompt. Use with caution!

## Example Output

```
╔════════════════════════════════════════════════════╗
║  🔧 SETUP WIZARD EMERGENCY RESET TOOL 🔧          ║
╚════════════════════════════════════════════════════╝

📊 Analyzing setup wizard state...

📋 IMPACT ANALYSIS:
   • Incomplete organizations:     1
   • Configured organizations:     0 (will NOT be deleted)
   • Orphaned users:               1

📝 Incomplete organizations to be deleted:
   - Test Org (ID: 123..., created: 10/27/2025, 3:45:00 PM)

👥 Orphaned users to be deleted:
   - test@example.com (ID: 456...)

⚠️  WARNING: This will permanently delete the data listed above.
   Configured organizations and their data will NOT be affected.

Do you want to proceed with the reset? (yes/no): yes

🚀 Starting reset process...

🧹 Clearing sessions...
   ✅ Sessions cleared

🗑️  Deleting 1 incomplete organization(s)...
   Processing organization 123...
   ✅ Deleted organization 123

🗑️  Deleting 1 orphaned user(s)...
   ✅ Orphaned users deleted

🧹 Clearing setup middleware cache...
   ℹ️  Cache will be cleared on next server restart
   💡 TIP: Restart your server with: npm run dev

╔════════════════════════════════════════════════════╗
║  ✅ SETUP WIZARD RESET COMPLETE! ✅               ║
╚════════════════════════════════════════════════════╝

📝 Next steps:
   1. Restart your server: npm run dev
   2. Navigate to /setup to start fresh
   3. Complete the setup wizard

💡 All configured organizations and their data remain intact.
```

## After Running the Script

1. **Restart the server** to clear the in-memory cache:
   ```bash
   npm run dev
   ```

2. **Navigate to the setup wizard**:
   ```
   http://localhost:3000/setup
   ```

3. **Complete the setup process** from the beginning

## Technical Details

### Database Tables Affected

- `organizations` - Incomplete records deleted
- `workflow_templates` - Related templates deleted
- `workflow_stages` - Related stages deleted
- `documents` - Related documents deleted
- `document_sections` - Related sections deleted
- `users` - Orphaned users deleted

### What's NOT Affected

✅ Organizations with `is_configured = true`
✅ All data belonging to configured organizations
✅ User accounts linked to configured organizations
✅ Database schema and structure

### Environment Requirements

The script requires these environment variables in `.env`:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Troubleshooting

### "Missing required environment variables"

**Problem**: `.env` file not found or missing keys

**Solution**:
```bash
# Ensure .env exists with required keys
cat .env | grep -E 'SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY'
```

### "Failed to analyze database state"

**Problem**: Cannot connect to Supabase

**Solution**:
1. Check internet connection
2. Verify Supabase URL is correct
3. Verify service role key is valid
4. Check Supabase project status

### Cache Not Clearing

**Problem**: Setup middleware still thinks app is configured

**Solution**:
1. Restart the Node.js server completely
2. Clear browser cache and cookies
3. Try in incognito/private browsing mode

## Development Use

For rapid testing during development:

```bash
# Quick reset and restart
node scripts/reset-setup-wizard.js --force && npm run dev
```

## Related Files

- `/src/services/setupService.js` - Setup wizard business logic
- `/src/middleware/setup-required.js` - Setup middleware with caching
- `/src/routes/setup.js` - Setup wizard routes
- `/scripts/reset-setup-wizard.js` - This reset script

## Support

If issues persist after running the reset:

1. Check the console output for specific error messages
2. Verify database permissions (service role should have full access)
3. Review Supabase logs in the dashboard
4. Check for database migration issues

## Warning

⚠️ **This script permanently deletes data**. While it protects configured organizations, always:
- Review the impact analysis before confirming
- Take database backups if unsure
- Test in a development environment first
- Understand what "incomplete" means for your use case

---

**Last Updated**: October 27, 2025
**Script Version**: 1.0.0
**Maintainer**: Coder Agent
