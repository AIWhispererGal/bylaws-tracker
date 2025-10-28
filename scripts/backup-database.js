#!/usr/bin/env node
/**
 * Database Backup Script
 * Backs up key tables to local JSON files
 *
 * Usage: node scripts/backup-database.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function backupDatabase() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, '../database/backups', timestamp);

  // Create backup directory
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  console.log(`[BACKUP] Starting database backup to: ${backupDir}`);

  // Tables to backup
  const tables = [
    'organizations',
    'users',
    'organization_members',
    'documents',
    'document_sections',
    'suggestions',
    'workflows',
    'workflow_assignments'
  ];

  for (const table of tables) {
    try {
      console.log(`[BACKUP] Backing up ${table}...`);

      const { data, error } = await supabase
        .from(table)
        .select('*');

      if (error) {
        console.error(`[BACKUP] Error backing up ${table}:`, error.message);
        continue;
      }

      const filename = path.join(backupDir, `${table}.json`);
      fs.writeFileSync(filename, JSON.stringify(data, null, 2));

      console.log(`[BACKUP] ✓ ${table}: ${data.length} rows backed up`);
    } catch (err) {
      console.error(`[BACKUP] Failed to backup ${table}:`, err.message);
    }
  }

  console.log(`[BACKUP] Backup complete! Files saved to: ${backupDir}`);
  console.log(`[BACKUP] To restore, run: node scripts/restore-database.js ${timestamp}`);
}

// Run backup
backupDatabase().catch(console.error);
