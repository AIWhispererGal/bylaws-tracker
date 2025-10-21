# Root-Level Files Archive

This directory contains miscellaneous files from the project root that don't fit other archive categories.

## Archived Files

This directory may contain:
- Temporary configuration files
- One-off scripts
- Notes and scratch files
- Export files
- Coverage reports
- Build artifacts

## Why These Were Archived

- **Temporary files** - Created for one-time use
- **Development artifacts** - Generated during development
- **Organization** - Moving miscellaneous files out of root
- **Build outputs** - Should be in `.gitignore` but archived for reference

## File Organization Best Practices

Going forward, files should be organized as:
- `/scripts` - Utility scripts
- `/config` - Configuration files
- `/.github` - GitHub-specific files
- `/docs` - Documentation
- Root `.txt` files - Only essential config (`.env.example`, etc.)

## Archive Date

Files archived: 2025-10-21

## Cleanup Guidelines

Before adding files to project root:
1. Is this file needed long-term?
2. Does it belong in a specific directory?
3. Should it be in `.gitignore`?
4. Is it documented?

Keep project root clean with only essential files.
