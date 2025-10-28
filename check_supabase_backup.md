# Supabase Backup Recovery Steps

## 1. Check Supabase Dashboard for Backups

1. Go to https://supabase.com/dashboard
2. Select your project: `auuzurghrjokbqzivfca`
3. Click "Database" → "Backups"
4. Look for the most recent backup before today

## 2. Restore from Backup

If you see a backup from before the data loss:
- Click "Restore" on that backup
- This will restore all tables and data

## 3. Check Supabase Activity Logs

1. In dashboard, go to "Logs" → "Database Logs"
2. Look for DELETE or TRUNCATE commands
3. Check timestamp to see when data was deleted

## 4. If No Backups Available

You'll need to re-run the setup wizard and re-upload documents.

