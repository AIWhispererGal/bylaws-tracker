/**
 * Approval Workflow Unit Tests
 * Tests approval state machine and section locking logic
 */

// Approval workflow states
const APPROVAL_STATES = {
  DRAFT: 'draft',
  COMMITTEE_REVIEW: 'committee_review',
  COMMITTEE_APPROVED: 'committee_approved',
  BOARD_REVIEW: 'board_review',
  BOARD_APPROVED: 'board_approved',
  REJECTED: 'rejected'
};

// State transition rules
const STATE_TRANSITIONS = {
  [APPROVAL_STATES.DRAFT]: [APPROVAL_STATES.COMMITTEE_REVIEW],
  [APPROVAL_STATES.COMMITTEE_REVIEW]: [APPROVAL_STATES.COMMITTEE_APPROVED, APPROVAL_STATES.REJECTED],
  [APPROVAL_STATES.COMMITTEE_APPROVED]: [APPROVAL_STATES.BOARD_REVIEW],
  [APPROVAL_STATES.BOARD_REVIEW]: [APPROVAL_STATES.BOARD_APPROVED, APPROVAL_STATES.REJECTED],
  [APPROVAL_STATES.BOARD_APPROVED]: [],
  [APPROVAL_STATES.REJECTED]: []
};

// Workflow state machine
class ApprovalWorkflow {
  constructor(initialState = APPROVAL_STATES.DRAFT) {
    this.currentState = initialState;
    this.history = [{ state: initialState, timestamp: new Date() }];
  }

  canTransitionTo(newState) {
    const allowedTransitions = STATE_TRANSITIONS[this.currentState] || [];
    return allowedTransitions.includes(newState);
  }

  transitionTo(newState, metadata = {}) {
    if (!this.canTransitionTo(newState)) {
      throw new Error(
        `Invalid transition from ${this.currentState} to ${newState}`
      );
    }

    this.currentState = newState;
    this.history.push({
      state: newState,
      timestamp: new Date(),
      ...metadata
    });

    return this.currentState;
  }

  getHistory() {
    return [...this.history];
  }

  isLocked() {
    return [
      APPROVAL_STATES.COMMITTEE_APPROVED,
      APPROVAL_STATES.BOARD_APPROVED
    ].includes(this.currentState);
  }

  canEdit() {
    return [
      APPROVAL_STATES.DRAFT,
      APPROVAL_STATES.COMMITTEE_REVIEW
    ].includes(this.currentState);
  }
}

// Section locking service
class SectionLockingService {
  constructor() {
    this.locks = new Map();
  }

  lockSection(sectionId, suggestionId, metadata = {}) {
    if (this.isLocked(sectionId)) {
      throw new Error(`Section ${sectionId} is already locked`);
    }

    this.locks.set(sectionId, {
      suggestionId,
      lockedAt: new Date(),
      ...metadata
    });

    return true;
  }

  unlockSection(sectionId) {
    if (!this.isLocked(sectionId)) {
      throw new Error(`Section ${sectionId} is not locked`);
    }

    this.locks.delete(sectionId);
    return true;
  }

  isLocked(sectionId) {
    return this.locks.has(sectionId);
  }

  getLockInfo(sectionId) {
    return this.locks.get(sectionId) || null;
  }

  lockMultipleSections(sectionIds, suggestionId, metadata = {}) {
    // Check if any sections are already locked
    const alreadyLocked = sectionIds.filter(id => this.isLocked(id));
    if (alreadyLocked.length > 0) {
      throw new Error(
        `Cannot lock: sections ${alreadyLocked.join(', ')} are already locked`
      );
    }

    // Lock all sections atomically
    const lockData = {
      suggestionId,
      lockedAt: new Date(),
      isMultiSection: true,
      sectionCount: sectionIds.length,
      ...metadata
    };

    sectionIds.forEach(id => {
      this.locks.set(id, { ...lockData, sectionId: id });
    });

    return true;
  }

  unlockMultipleSections(sectionIds) {
    sectionIds.forEach(id => {
      if (this.isLocked(id)) {
        this.locks.delete(id);
      }
    });

    return true;
  }
}

describe('Approval Workflow Unit Tests', () => {
  describe('Approval State Machine', () => {
    test('should initialize in draft state', () => {
      const workflow = new ApprovalWorkflow();
      expect(workflow.currentState).toBe(APPROVAL_STATES.DRAFT);
    });

    test('should allow transition from draft to committee review', () => {
      const workflow = new ApprovalWorkflow();
      const newState = workflow.transitionTo(APPROVAL_STATES.COMMITTEE_REVIEW);
      expect(newState).toBe(APPROVAL_STATES.COMMITTEE_REVIEW);
    });

    test('should allow committee approval', () => {
      const workflow = new ApprovalWorkflow(APPROVAL_STATES.COMMITTEE_REVIEW);
      const newState = workflow.transitionTo(APPROVAL_STATES.COMMITTEE_APPROVED, {
        approvedBy: 'Committee Chair'
      });
      expect(newState).toBe(APPROVAL_STATES.COMMITTEE_APPROVED);
    });

    test('should allow transition to board review after committee approval', () => {
      const workflow = new ApprovalWorkflow(APPROVAL_STATES.COMMITTEE_APPROVED);
      const newState = workflow.transitionTo(APPROVAL_STATES.BOARD_REVIEW);
      expect(newState).toBe(APPROVAL_STATES.BOARD_REVIEW);
    });

    test('should allow board approval', () => {
      const workflow = new ApprovalWorkflow(APPROVAL_STATES.BOARD_REVIEW);
      const newState = workflow.transitionTo(APPROVAL_STATES.BOARD_APPROVED, {
        approvedBy: 'Board President'
      });
      expect(newState).toBe(APPROVAL_STATES.BOARD_APPROVED);
    });

    test('should prevent invalid state transitions', () => {
      const workflow = new ApprovalWorkflow();

      expect(() => {
        workflow.transitionTo(APPROVAL_STATES.BOARD_APPROVED);
      }).toThrow('Invalid transition from draft to board_approved');
    });

    test('should prevent transitions from final states', () => {
      const workflow = new ApprovalWorkflow(APPROVAL_STATES.BOARD_APPROVED);

      expect(() => {
        workflow.transitionTo(APPROVAL_STATES.DRAFT);
      }).toThrow();
    });

    test('should maintain transition history', () => {
      const workflow = new ApprovalWorkflow();

      workflow.transitionTo(APPROVAL_STATES.COMMITTEE_REVIEW);
      workflow.transitionTo(APPROVAL_STATES.COMMITTEE_APPROVED);

      const history = workflow.getHistory();

      expect(history).toHaveLength(3); // Initial + 2 transitions
      expect(history[0].state).toBe(APPROVAL_STATES.DRAFT);
      expect(history[1].state).toBe(APPROVAL_STATES.COMMITTEE_REVIEW);
      expect(history[2].state).toBe(APPROVAL_STATES.COMMITTEE_APPROVED);
    });

    test('should allow rejection from review states', () => {
      const workflow = new ApprovalWorkflow(APPROVAL_STATES.COMMITTEE_REVIEW);
      const newState = workflow.transitionTo(APPROVAL_STATES.REJECTED, {
        reason: 'Requires revision'
      });
      expect(newState).toBe(APPROVAL_STATES.REJECTED);
    });

    test('should track metadata in transition history', () => {
      const workflow = new ApprovalWorkflow();

      workflow.transitionTo(APPROVAL_STATES.COMMITTEE_REVIEW, {
        submittedBy: 'User 123',
        notes: 'Ready for review'
      });

      const history = workflow.getHistory();
      const lastTransition = history[history.length - 1];

      expect(lastTransition.submittedBy).toBe('User 123');
      expect(lastTransition.notes).toBe('Ready for review');
    });
  });

  describe('Section Locking', () => {
    let lockingService;

    beforeEach(() => {
      lockingService = new SectionLockingService();
    });

    test('should lock a section successfully', () => {
      const result = lockingService.lockSection('sec-1', 'sug-1', {
        lockedBy: 'Committee Chair'
      });

      expect(result).toBe(true);
      expect(lockingService.isLocked('sec-1')).toBe(true);
    });

    test('should prevent locking already locked sections', () => {
      lockingService.lockSection('sec-1', 'sug-1');

      expect(() => {
        lockingService.lockSection('sec-1', 'sug-2');
      }).toThrow('Section sec-1 is already locked');
    });

    test('should unlock a section successfully', () => {
      lockingService.lockSection('sec-1', 'sug-1');
      const result = lockingService.unlockSection('sec-1');

      expect(result).toBe(true);
      expect(lockingService.isLocked('sec-1')).toBe(false);
    });

    test('should prevent unlocking non-locked sections', () => {
      expect(() => {
        lockingService.unlockSection('sec-999');
      }).toThrow('Section sec-999 is not locked');
    });

    test('should retrieve lock information', () => {
      lockingService.lockSection('sec-1', 'sug-1', {
        lockedBy: 'Committee Chair',
        notes: 'Approved'
      });

      const lockInfo = lockingService.getLockInfo('sec-1');

      expect(lockInfo.suggestionId).toBe('sug-1');
      expect(lockInfo.lockedBy).toBe('Committee Chair');
      expect(lockInfo.notes).toBe('Approved');
      expect(lockInfo.lockedAt).toBeInstanceOf(Date);
    });

    test('should return null for non-locked sections', () => {
      const lockInfo = lockingService.getLockInfo('sec-999');
      expect(lockInfo).toBeNull();
    });
  });

  describe('Multi-Section Locking', () => {
    let lockingService;

    beforeEach(() => {
      lockingService = new SectionLockingService();
    });

    test('should lock multiple sections atomically', () => {
      const sectionIds = ['sec-1', 'sec-2', 'sec-3'];
      const result = lockingService.lockMultipleSections(sectionIds, 'multi-sug-1', {
        lockedBy: 'Committee'
      });

      expect(result).toBe(true);
      expect(lockingService.isLocked('sec-1')).toBe(true);
      expect(lockingService.isLocked('sec-2')).toBe(true);
      expect(lockingService.isLocked('sec-3')).toBe(true);
    });

    test('should fail if any section is already locked', () => {
      lockingService.lockSection('sec-2', 'other-sug');

      const sectionIds = ['sec-1', 'sec-2', 'sec-3'];

      expect(() => {
        lockingService.lockMultipleSections(sectionIds, 'multi-sug-1');
      }).toThrow('Cannot lock: sections sec-2 are already locked');
    });

    test('should maintain multi-section flag in lock info', () => {
      const sectionIds = ['sec-1', 'sec-2'];
      lockingService.lockMultipleSections(sectionIds, 'multi-sug-1');

      const lock1 = lockingService.getLockInfo('sec-1');
      const lock2 = lockingService.getLockInfo('sec-2');

      expect(lock1.isMultiSection).toBe(true);
      expect(lock1.sectionCount).toBe(2);
      expect(lock2.isMultiSection).toBe(true);
      expect(lock2.sectionCount).toBe(2);
    });

    test('should unlock multiple sections', () => {
      const sectionIds = ['sec-1', 'sec-2', 'sec-3'];
      lockingService.lockMultipleSections(sectionIds, 'multi-sug-1');

      lockingService.unlockMultipleSections(sectionIds);

      expect(lockingService.isLocked('sec-1')).toBe(false);
      expect(lockingService.isLocked('sec-2')).toBe(false);
      expect(lockingService.isLocked('sec-3')).toBe(false);
    });

    test('should handle partial unlocking gracefully', () => {
      lockingService.lockSection('sec-1', 'sug-1');

      // Try to unlock multiple sections, some not locked
      lockingService.unlockMultipleSections(['sec-1', 'sec-999']);

      expect(lockingService.isLocked('sec-1')).toBe(false);
    });
  });

  describe('Workflow and Locking Integration', () => {
    test('should lock section when committee approves', () => {
      const workflow = new ApprovalWorkflow(APPROVAL_STATES.COMMITTEE_REVIEW);
      const lockingService = new SectionLockingService();

      // Approve and lock
      workflow.transitionTo(APPROVAL_STATES.COMMITTEE_APPROVED);
      lockingService.lockSection('sec-1', 'sug-1', {
        approvalState: APPROVAL_STATES.COMMITTEE_APPROVED
      });

      expect(workflow.isLocked()).toBe(true);
      expect(lockingService.isLocked('sec-1')).toBe(true);
    });

    test('should determine edit permissions based on state', () => {
      const draftWorkflow = new ApprovalWorkflow(APPROVAL_STATES.DRAFT);
      const approvedWorkflow = new ApprovalWorkflow(APPROVAL_STATES.COMMITTEE_APPROVED);

      expect(draftWorkflow.canEdit()).toBe(true);
      expect(approvedWorkflow.canEdit()).toBe(false);
    });

    test('should prevent editing locked sections', () => {
      const workflow = new ApprovalWorkflow(APPROVAL_STATES.COMMITTEE_APPROVED);
      const lockingService = new SectionLockingService();

      lockingService.lockSection('sec-1', 'sug-1');

      const canEdit = workflow.canEdit() && !lockingService.isLocked('sec-1');

      expect(canEdit).toBe(false);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle rapid state transitions', () => {
      const workflow = new ApprovalWorkflow();

      workflow.transitionTo(APPROVAL_STATES.COMMITTEE_REVIEW);
      workflow.transitionTo(APPROVAL_STATES.COMMITTEE_APPROVED);
      workflow.transitionTo(APPROVAL_STATES.BOARD_REVIEW);
      workflow.transitionTo(APPROVAL_STATES.BOARD_APPROVED);

      expect(workflow.currentState).toBe(APPROVAL_STATES.BOARD_APPROVED);
      expect(workflow.getHistory()).toHaveLength(5);
    });

    test('should handle empty section IDs in multi-lock', () => {
      const lockingService = new SectionLockingService();

      const result = lockingService.lockMultipleSections([], 'sug-1');
      expect(result).toBe(true);
    });

    test('should validate state transition permissions', () => {
      const workflow = new ApprovalWorkflow(APPROVAL_STATES.COMMITTEE_REVIEW);

      const canApprove = workflow.canTransitionTo(APPROVAL_STATES.COMMITTEE_APPROVED);
      const canSkipToBoard = workflow.canTransitionTo(APPROVAL_STATES.BOARD_APPROVED);

      expect(canApprove).toBe(true);
      expect(canSkipToBoard).toBe(false);
    });
  });
});

// Mock functions for testing
if (typeof describe === 'undefined') {
  global.describe = (name, fn) => fn();
  global.test = (name, fn) => fn();
  global.beforeEach = (fn) => fn();
}

module.exports = {
  APPROVAL_STATES,
  STATE_TRANSITIONS,
  ApprovalWorkflow,
  SectionLockingService
};
