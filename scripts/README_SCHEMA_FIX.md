# Organizations Schema Fix Instructions

## Problem
The organizations table in Supabase is missing 7 columns that the application code expects:
- `contact_email`
- `logo_url`
- `website_url`
- `theme_color`
- `custom_footer`
- `analytics_enabled`
- `settings`

## Solution Files

### 1. Migration SQL
**File**: `/database/migrations/FIX_ORGANIZATIONS_SCHEMA.sql`

This file contains safe ALTER TABLE statements that:
- Use `IF NOT EXISTS` to prevent errors if columns already exist
- Add proper data types and defaults
- Include column comments for documentation
- Create an index on contact_email for performance

### 2. Fix Script
**File**: `/scripts/fix-schema.js`

Automated Node.js script that:
- Connects to your Supabase database
- Executes the migration SQL
- Verifies the columns were added
- Reports results with colored output

## How to Run

### Option 1: Automated Script (Recommended)

1. **Ensure environment variables are set**:
   ```bash
   # Check your .env file has:
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

2. **Install dependencies** (if not already installed):
   ```bash
   npm install
   ```

3. **Run the fix script**:
   ```bash
   node scripts/fix-schema.js
   ```

4. **Check the output**:
   - Green checkmarks = Success
   - Red X = Error (see manual option below)
   - Yellow warnings = Non-critical issues

### Option 2: Manual SQL Execution

If the automated script fails or you prefer manual control:

1. **Go to Supabase Dashboard**:
   - Navigate to your project
   - Click on "SQL Editor" in the left sidebar

2. **Copy the migration SQL**:
   - Open `/database/migrations/FIX_ORGANIZATIONS_SCHEMA.sql`
   - Copy the entire contents

3. **Execute in Supabase**:
   - Paste the SQL into the SQL Editor
   - Click "Run" or press Ctrl+Enter
   - Check for success messages

4. **Verify the changes**:
   - Go to "Table Editor" in Supabase
   - Select the "organizations" table
   - Confirm all 7 new columns appear

## Verification

After running either method, verify success by:

1. **Check Supabase Table Editor**:
   - All 7 columns should be visible
   - Default values should be set

2. **Test the application**:
   ```bash
   npm run dev
   ```
   - Navigate to organization settings
   - Try updating organization details
   - Check that no errors occur

3. **Query test** (optional):
   ```sql
   -- Run this in Supabase SQL Editor
   SELECT
     column_name,
     data_type,
     is_nullable,
     column_default
   FROM information_schema.columns
   WHERE table_name = 'organizations'
   AND column_name IN (
     'contact_email', 'logo_url', 'website_url',
     'theme_color', 'custom_footer', 'analytics_enabled', 'settings'
   );
   ```

## Troubleshooting

### Script fails to connect
- Verify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are correct
- Check network connectivity to Supabase

### Columns already exist error
- This is safe - the IF NOT EXISTS clause prevents issues
- Existing columns won't be modified

### Permission denied
- Ensure you're using the service role key, not the anon key
- Service role key has admin privileges needed for ALTER TABLE

### Application still shows errors
- Clear browser cache
- Restart the development server
- Check browser console for specific error messages

## Safety Notes

- The migration is **idempotent** - safe to run multiple times
- Existing data is **not affected** - only adds columns
- Default values are set for new columns
- No data loss will occur

## Post-Migration Tasks

After successfully adding the columns:

1. **Update existing organizations** (optional):
   - Add contact emails
   - Upload logos
   - Set theme colors
   - Configure custom footers

2. **Enable features**:
   - Analytics tracking (set analytics_enabled = true)
   - Custom branding with theme_color
   - Organization-specific settings in the settings JSON

3. **Test thoroughly**:
   - Create new organizations
   - Update existing organizations
   - Verify all features work as expected