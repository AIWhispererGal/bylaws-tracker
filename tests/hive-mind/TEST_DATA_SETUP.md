# 🗂️ TEST DATA SETUP GUIDE
## Creating Test Users, Organizations, and Documents

**Last Updated**: October 28, 2025 (4:09 AM)

---

## 📊 OVERVIEW

This guide helps you create the test data required for comprehensive testing.

**Required Setup**:
- 3 test users (global admin, org owner, org member)
- 2 test organizations
- 3 test documents (varying complexity)

**Estimated Setup Time**: 15 minutes

---

## 👥 TEST USERS

### User 1: Alice Admin (Global Admin)
**Purpose**: Test global admin functionality

**Creation Steps**:
```sql
-- 1. Create user via UI or manually in database
-- Via UI: Navigate to /auth/register
-- Email: alice@test.com
-- Password: AliceAdmin123!
-- Name: Alice Admin

-- 2. Manually set global admin flag in Supabase
UPDATE users
SET is_global_admin = true
WHERE email = 'alice@test.com';
```

**Expected Permissions**:
- ✅ Can see ALL organizations
- ✅ Can upload to any organization
- ✅ Has full admin access everywhere

---

### User 2: Bob Owner (Organization Owner)
**Purpose**: Test organization owner functionality

**Creation Steps**:
```sql
-- 1. Create user via UI
-- Via UI: Navigate to /auth/register
-- Email: bob@org1.com
-- Password: BobOwner123!
-- Name: Bob Owner

-- 2. Make owner of Test Organization 1 (done in org setup below)
```

**Expected Permissions**:
- ✅ Can manage Test Organization 1
- ✅ Can upload to Test Organization 1
- ❌ Cannot see other organizations
- ❌ Cannot access global admin routes

---

### User 3: Charlie Member (Organization Member)
**Purpose**: Test limited member functionality

**Creation Steps**:
```sql
-- 1. Create user via UI
-- Via UI: Navigate to /auth/register
-- Email: charlie@org1.com
-- Password: CharlieMember123!
-- Name: Charlie Member

-- 2. Add as member to Test Organization 1 (done in org setup below)
```

**Expected Permissions**:
- ✅ Can view documents in Test Organization 1
- ✅ Can make suggestions
- ❌ Cannot upload documents
- ❌ Cannot perform section operations
- ❌ Cannot access admin features

---

## 🏢 TEST ORGANIZATIONS

### Organization 1: Test Organization 1
**Purpose**: Primary organization for testing

**Creation Steps**:
```sql
-- Option 1: Via Setup Wizard
-- Navigate to /setup (if fresh database)
-- Follow wizard to create organization

-- Option 2: Manual SQL
INSERT INTO organizations (name, slug, organization_type, created_at)
VALUES (
  'Test Organization 1',
  'test-org-1',
  'nonprofit',
  NOW()
);

-- Get the organization ID
SELECT id FROM organizations WHERE slug = 'test-org-1';

-- Add Bob as owner
INSERT INTO user_organizations (user_id, organization_id, role, is_active)
VALUES (
  (SELECT id FROM users WHERE email = 'bob@org1.com'),
  (SELECT id FROM organizations WHERE slug = 'test-org-1'),
  'owner',
  true
);

-- Add Charlie as member
INSERT INTO user_organizations (user_id, organization_id, role, is_active)
VALUES (
  (SELECT id FROM users WHERE email = 'charlie@org1.com'),
  (SELECT id FROM organizations WHERE slug = 'test-org-1'),
  'member',
  true
);
```

---

### Organization 2: Test Organization 2
**Purpose**: Test global admin cross-organization access

**Creation Steps**:
```sql
-- Manual SQL (no owner needed - for global admin testing)
INSERT INTO organizations (name, slug, organization_type, created_at)
VALUES (
  'Test Organization 2',
  'test-org-2',
  'nonprofit',
  NOW()
);
```

**Note**: No users assigned to this org - used to verify global admin can access orgs they don't belong to.

---

## 📄 TEST DOCUMENTS

### Document 1: test-bylaws.docx
**Purpose**: Standard bylaws document for general testing

**Characteristics**:
- Articles: ~10
- Sections: ~40-50
- Depth levels: 0, 1, 2
- Total sections: ~60

**Structure Example**:
```
Preamble                          (depth 0)
Article I - Name                  (depth 0)
  Section 1: Official Name        (depth 1)
  Section 2: Abbreviation         (depth 1)
Article II - Purpose              (depth 0)
  Section 1: Primary Purpose      (depth 1)
  Section 2: Secondary Purpose    (depth 1)
    Subsection A: Details         (depth 2)
    Subsection B: Specifics       (depth 2)
...
```

**Where to Get**:
- Use existing Reseda NC bylaws
- Or create simple Word doc with above structure

---

### Document 2: simple-document.docx
**Purpose**: Test simple, flat structure

**Characteristics**:
- Only top-level sections
- No articles or subsections
- Depth levels: 0 only
- Total sections: ~10-15

**Structure Example**:
```
Section 1: Introduction     (depth 0)
Section 2: Background       (depth 0)
Section 3: Methodology      (depth 0)
Section 4: Results          (depth 0)
Section 5: Conclusion       (depth 0)
...
```

---

### Document 3: complex-hierarchy.docx
**Purpose**: Test deep nesting and edge cases

**Characteristics**:
- Deep nesting (4-5 levels)
- Unusual numbering patterns
- Mixed section types
- Total sections: ~80-100

**Structure Example**:
```
Preamble                              (depth 0)
Article I                             (depth 0)
  Section 1                           (depth 1)
    Subsection A                      (depth 2)
      Paragraph 1                     (depth 3)
        Subparagraph a                (depth 4)
        Subparagraph b                (depth 4)
      Paragraph 2                     (depth 3)
    Subsection B                      (depth 2)
  Section 2                           (depth 1)
Article II                            (depth 0)
...
```

---

## 🚀 SETUP SCRIPT

### Option 1: SQL Setup Script
Save as `tests/fixtures/setup-test-data.sql`:

```sql
-- ============================================================================
-- TEST DATA SETUP SCRIPT
-- Run this in Supabase SQL Editor
-- ============================================================================

-- 1. SET ALICE AS GLOBAL ADMIN
UPDATE users
SET is_global_admin = true
WHERE email = 'alice@test.com';

-- 2. CREATE TEST ORGANIZATIONS
INSERT INTO organizations (name, slug, organization_type, created_at)
VALUES
  ('Test Organization 1', 'test-org-1', 'nonprofit', NOW()),
  ('Test Organization 2', 'test-org-2', 'nonprofit', NOW())
ON CONFLICT (slug) DO NOTHING;

-- 3. ADD BOB AS OWNER OF ORG 1
INSERT INTO user_organizations (user_id, organization_id, role, is_active)
SELECT
  (SELECT id FROM users WHERE email = 'bob@org1.com'),
  (SELECT id FROM organizations WHERE slug = 'test-org-1'),
  'owner',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM user_organizations
  WHERE user_id = (SELECT id FROM users WHERE email = 'bob@org1.com')
  AND organization_id = (SELECT id FROM organizations WHERE slug = 'test-org-1')
);

-- 4. ADD CHARLIE AS MEMBER OF ORG 1
INSERT INTO user_organizations (user_id, organization_id, role, is_active)
SELECT
  (SELECT id FROM users WHERE email = 'charlie@org1.com'),
  (SELECT id FROM organizations WHERE slug = 'test-org-1'),
  'member',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM user_organizations
  WHERE user_id = (SELECT id FROM users WHERE email = 'charlie@org1.com')
  AND organization_id = (SELECT id FROM organizations WHERE slug = 'test-org-1')
);

-- 5. VERIFY SETUP
SELECT
  u.email,
  u.is_global_admin,
  o.name as organization,
  uo.role
FROM users u
LEFT JOIN user_organizations uo ON u.id = uo.user_id
LEFT JOIN organizations o ON uo.organization_id = o.id
WHERE u.email IN ('alice@test.com', 'bob@org1.com', 'charlie@org1.com')
ORDER BY u.email, o.name;
```

---

### Option 2: Manual Setup Checklist

#### Step 1: Create Users (via UI)
- [ ] Navigate to `/auth/register`
- [ ] Create Alice Admin (alice@test.com / AliceAdmin123!)
- [ ] Create Bob Owner (bob@org1.com / BobOwner123!)
- [ ] Create Charlie Member (charlie@org1.com / CharlieMember123!)

#### Step 2: Set Alice as Global Admin (via Supabase)
- [ ] Open Supabase Dashboard
- [ ] Navigate to Table Editor → users
- [ ] Find alice@test.com
- [ ] Set `is_global_admin = true`

#### Step 3: Create Organizations (via SQL or UI)
- [ ] Create "Test Organization 1"
- [ ] Create "Test Organization 2"

#### Step 4: Assign User Roles (via SQL)
- [ ] Make Bob owner of Test Organization 1
- [ ] Make Charlie member of Test Organization 1

#### Step 5: Verify Setup
- [ ] Login as Alice → see all orgs
- [ ] Login as Bob → see only Test Organization 1
- [ ] Login as Charlie → see only Test Organization 1

---

## ✅ VERIFICATION

### Check Users
```sql
SELECT email, is_global_admin, name
FROM users
WHERE email IN ('alice@test.com', 'bob@org1.com', 'charlie@org1.com');

-- Expected:
-- alice@test.com   | true  | Alice Admin
-- bob@org1.com     | false | Bob Owner
-- charlie@org1.com | false | Charlie Member
```

### Check Organizations
```sql
SELECT name, slug, organization_type
FROM organizations
WHERE slug IN ('test-org-1', 'test-org-2');

-- Expected:
-- Test Organization 1 | test-org-1 | nonprofit
-- Test Organization 2 | test-org-2 | nonprofit
```

### Check User-Organization Assignments
```sql
SELECT
  u.email,
  o.name as organization,
  uo.role,
  uo.is_active
FROM user_organizations uo
JOIN users u ON uo.user_id = u.id
JOIN organizations o ON uo.organization_id = o.id
WHERE u.email IN ('bob@org1.com', 'charlie@org1.com');

-- Expected:
-- bob@org1.com     | Test Organization 1 | owner  | true
-- charlie@org1.com | Test Organization 1 | member | true
```

---

## 🧹 CLEANUP (After Testing)

### Remove Test Data
```sql
-- 1. Delete user-organization assignments
DELETE FROM user_organizations
WHERE user_id IN (
  SELECT id FROM users
  WHERE email IN ('alice@test.com', 'bob@org1.com', 'charlie@org1.com')
);

-- 2. Delete test documents (if uploaded)
DELETE FROM document_sections
WHERE organization_id IN (
  SELECT id FROM organizations
  WHERE slug IN ('test-org-1', 'test-org-2')
);

-- 3. Delete test organizations
DELETE FROM organizations
WHERE slug IN ('test-org-1', 'test-org-2');

-- 4. Delete test users
DELETE FROM users
WHERE email IN ('alice@test.com', 'bob@org1.com', 'charlie@org1.com');
```

---

## 🎯 READY TO TEST

Once setup is complete:
1. ✅ 3 test users exist
2. ✅ 2 test organizations exist
3. ✅ User-org relationships assigned
4. ✅ Alice is global admin

**Next Step**: Run tests from `/tests/hive-mind/QUICK_TEST_EXECUTION_GUIDE.md`

---

**Setup complete! Ready for testing!** 🚀✨
