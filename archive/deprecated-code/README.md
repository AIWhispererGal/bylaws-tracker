# Deprecated Code Archive

This directory contains source code files that have been replaced or are no longer part of the active codebase.

## Archived Files

This directory may contain:
- Deprecated parsers or algorithms
- Old API implementations
- Replaced utility functions
- Superseded middleware
- Legacy route handlers

## Why Code Gets Archived

- **Refactored** - Better implementation now exists
- **Replaced** - Functionality moved to different modules
- **Feature removal** - Feature no longer needed
- **Technical debt cleanup** - Removing obsolete code

## Before Archiving Code

Code should only be archived after:
1. ✅ Functionality is replaced or no longer needed
2. ✅ All references removed from active codebase
3. ✅ Tests updated to use new implementation
4. ✅ Documentation updated
5. ✅ Code reviewed and approved for archival

## Accessing Archived Code

Use git history to understand why code was deprecated:

```bash
git log --follow archive/deprecated-code/<filename>
```

## Restoring Archived Code

If you need to restore archived code:

1. Review the code carefully
2. Check if it's compatible with current architecture
3. Update dependencies and APIs
4. Add comprehensive tests
5. Document the restoration decision

## Archive Date

Code archive created: 2025-10-21

## Related Resources

- Code review process: `/docs/development`
- Refactoring guidelines: `/docs/architecture`
- Deprecation policy: `/docs/policies`
