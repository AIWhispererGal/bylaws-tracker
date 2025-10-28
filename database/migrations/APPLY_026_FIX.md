# Apply Migration 026: Fix path_ids Constraint

## Quick Apply

1. Go to Supabase SQL Editor
2. Copy ALL SQL from: `database/migrations/026_fix_path_ids_constraint.sql`
3. Paste and RUN

## What This Fixes

**Problem**: Migration 025 preserved depth from parser, but path_ids still built as root-level
**Result**: Constraint violation `array_length(path_ids) ≠ depth+1`

**Fix**: Build path_ids with correct length based on depth:
- depth=0 → path_ids has 1 element
- depth=1 → path_ids has 2 elements
- depth=2 → path_ids has 3 elements

## After Applying

1. Restart server: `npm start`
2. Try document upload again
3. Should succeed! ✅
