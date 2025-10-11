# Approval Types Reference Guide

## Available Approval Types

### 1. Single Approver
**Value:** `single`
**Description:** Requires approval from one designated person
**Use Case:** President signature, Executive Director approval
**No additional fields required**

---

### 2. Majority Vote
**Value:** `majority`
**Description:** Requires more than 50% of approvers to vote yes
**Use Case:** Committee votes, Board decisions
**No additional fields required**

---

### 3. Unanimous
**Value:** `unanimous`
**Description:** Requires all approvers to vote yes
**Use Case:** Constitutional amendments, critical decisions
**No additional fields required**

---

### 4. Supermajority/Vote Threshold ⭐ NEW
**Value:** `supermajority`
**Description:** Requires a specific percentage of yes votes
**Use Case:** 2/3 majority (67%), 3/4 majority (75%), custom thresholds
**Additional Field:** `voteThreshold` (1-100)

**Examples:**
- 2/3 majority: `voteThreshold: 67`
- 3/4 majority: `voteThreshold: 75`
- Simple majority: `voteThreshold: 51`
- Near consensus: `voteThreshold: 90`

**JSON Example:**
```json
{
  "name": "Membership Vote",
  "approvalType": "supermajority",
  "voteThreshold": 67,
  "approvers": ["user1@example.com", "user2@example.com"]
}
```

---

### 5. Quorum (Legacy) 🔄
**Value:** `quorum`
**Description:** Legacy term for vote threshold (backwards compatibility)
**Status:** Supported for existing workflows, use `supermajority` for new ones
**Additional Field:** `quorum` (1-100)

**Note:** This is maintained for backwards compatibility. New workflows should use `supermajority` instead.

---

## Field Mapping

| UI Label | Approval Type | Field Name | Example Value |
|----------|---------------|------------|---------------|
| Single Approver | `single` | - | - |
| Majority Vote | `majority` | - | - |
| Unanimous | `unanimous` | - | - |
| Supermajority/Vote Threshold | `supermajority` | `voteThreshold` | 67 |
| Quorum Required (legacy) | `quorum` | `quorum` | 50 |

---

## Common Vote Thresholds

| Threshold | Percentage | Description |
|-----------|------------|-------------|
| Simple Majority | 51% | More than half |
| Three-Fifths | 60% | Common for cloture votes |
| Two-Thirds | 67% | Supermajority (most common) |
| Three-Quarters | 75% | Strong consensus |
| Four-Fifths | 80% | Very strong consensus |
| Nine-Tenths | 90% | Near unanimous |

---

## Migration Guide

### Updating Existing Workflows

**Old Format (still works):**
```javascript
{
  approvalType: 'quorum',
  quorum: 50
}
```

**New Format (recommended):**
```javascript
{
  approvalType: 'supermajority',
  voteThreshold: 67
}
```

### Why the Change?

**Problem with "Quorum":**
- Traditionally means minimum attendance/participation
- Confusing when used for vote percentage requirements
- Unclear to users what percentage to enter

**Benefits of "Supermajority/Vote Threshold":**
- Clear that it's about vote percentage, not attendance
- "Vote Threshold %" label is self-explanatory
- Better placeholder text helps users (e.g., "67 for 2/3 majority")

---

## Validation Rules

### For `supermajority` type:
- `voteThreshold` must be present
- `voteThreshold` must be between 1 and 100 (inclusive)
- Error message: "Stage X requires valid vote threshold percentage (1-100)"

### For `quorum` type (legacy):
- `quorum` must be present
- `quorum` must be between 1 and 100 (inclusive)
- Error message: "Stage X requires valid quorum percentage (1-100)"

---

## Code Examples

### Creating a Workflow Stage

```javascript
// Simple approval (President)
{
  name: 'President Approval',
  approvalType: 'single',
  approvers: ['president@org.com']
}

// Majority vote (Committee)
{
  name: 'Committee Review',
  approvalType: 'majority',
  approvers: ['member1@org.com', 'member2@org.com', 'member3@org.com']
}

// Supermajority (2/3 Board vote)
{
  name: 'Board Vote',
  approvalType: 'supermajority',
  voteThreshold: 67,
  approvers: ['board1@org.com', 'board2@org.com', 'board3@org.com']
}

// Unanimous (Constitutional change)
{
  name: 'Constitutional Amendment',
  approvalType: 'unanimous',
  approvers: ['all-members@org.com']
}
```

### Template Workflows

**Simple (2 stages):**
```javascript
{
  template: 'simple',
  stages: [
    { name: 'Board Review', approvalType: 'single' },
    { name: 'President Approval', approvalType: 'single' }
  ]
}
```

**Committee (3 stages):**
```javascript
{
  template: 'committee',
  stages: [
    { name: 'Committee Review', approvalType: 'majority' },
    { name: 'Board Approval', approvalType: 'majority' },
    { name: 'President Signature', approvalType: 'single' }
  ]
}
```

**Membership (3 stages with supermajority):**
```javascript
{
  template: 'membership',
  stages: [
    { name: 'Committee Review', approvalType: 'majority' },
    { name: 'Board Approval', approvalType: 'majority' },
    {
      name: 'Membership Vote',
      approvalType: 'supermajority',
      voteThreshold: 67  // 2/3 majority
    }
  ]
}
```

---

## UI Components

### Dropdown Options (EJS)

```html
<select class="form-select stage-approval-type">
  <option value="single">Single Approver</option>
  <option value="majority">Majority Vote</option>
  <option value="unanimous">Unanimous</option>
  <option value="supermajority">Supermajority/Vote Threshold</option>
</select>
```

### Conditional Threshold Field

```html
<div class="supermajority-field" style="display: none;">
  <label>Vote Threshold (%)</label>
  <input type="number"
         class="form-control stage-supermajority"
         placeholder="e.g., 67 for 2/3 majority"
         min="1"
         max="100">
</div>
```

### JavaScript Toggle

```javascript
approvalType.addEventListener('change', (e) => {
  const field = e.target.closest('.stage-content')
    .querySelector('.supermajority-field');
  field.style.display = e.target.value === 'supermajority' ? 'block' : 'none';
});
```

---

## Testing

### Valid Configurations

```javascript
// Valid supermajority
{ approvalType: 'supermajority', voteThreshold: 67 } // ✅

// Valid legacy quorum
{ approvalType: 'quorum', quorum: 50 } // ✅

// Valid without threshold
{ approvalType: 'majority' } // ✅
{ approvalType: 'unanimous' } // ✅
```

### Invalid Configurations

```javascript
// Missing threshold
{ approvalType: 'supermajority' } // ❌

// Invalid threshold values
{ approvalType: 'supermajority', voteThreshold: 0 } // ❌
{ approvalType: 'supermajority', voteThreshold: 101 } // ❌
{ approvalType: 'supermajority', voteThreshold: -10 } // ❌
```

---

## Best Practices

1. **Use descriptive stage names**
   - ✅ "Board Vote (2/3 required)"
   - ❌ "Stage 3"

2. **Set appropriate thresholds**
   - Simple majority: 51%
   - Supermajority: 60-67%
   - Strong consensus: 75-80%
   - Near unanimous: 90%+

3. **Consider your organization's needs**
   - Neighborhood councils: Often use 50-67%
   - Corporations: Often use 51-75%
   - Constitutions: Often use 67-75%

4. **Use templates as starting points**
   - Modify template workflows rather than building from scratch
   - Templates provide tested, logical approval flows

5. **Test your workflow**
   - Run through approval process before deploying
   - Verify all approvers can access the system
   - Confirm threshold calculations are correct

---

## Troubleshooting

### Issue: Vote threshold field not showing
**Solution:** Ensure approval type is set to `supermajority`

### Issue: Legacy quorum data not loading
**Solution:** Backwards compatibility is built-in, check JavaScript console for errors

### Issue: Validation fails on submit
**Solution:** Ensure `voteThreshold` is between 1-100 for supermajority type

### Issue: Confusion about percentage
**Solution:** Use the placeholder text as a guide (e.g., "67 for 2/3 majority")

---

## Related Documentation

- [Setup Wizard Implementation](./SETUP_WIZARD_IMPLEMENTATION.md)
- [Terminology Update Summary](./TERMINOLOGY_UPDATE_SUMMARY.md)
- [Configuration Guide](../CONFIGURATION_GUIDE.md)
