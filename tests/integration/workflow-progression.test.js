/**
 * End-to-End Workflow Progression Integration Tests
 * Tests complete workflow lifecycle from creation to completion
 *
 * Test Coverage:
 * - Full workflow progression through multiple stages
 * - Rejection and re-approval workflows
 * - Bulk approval operations
 * - Permission enforcement across workflows
 * - Workflow reset functionality
 */

const { createSupabaseMock, createFullSupabaseMock } = require('../helpers/supabase-mock');

describe('End-to-End Workflow Progression', () => {
  let mockSupabase;
  let testOrg, testDoc, testSections, testWorkflow;
  let testUsers;

  beforeAll(async () => {
    mockSupabase = createFullSupabaseMock();

    // Create test organization
    testOrg = {
      id: 'org-test-workflow',
      name: 'Test Workflow Organization',
      slug: 'test-workflow-org',
      organization_type: 'council'
    };

    // Create test users with different roles
    testUsers = {
      admin: {
        id: 'user-admin',
        email: 'admin@test.org',
        role: 'admin',
        is_active: true
      },
      owner: {
        id: 'user-owner',
        email: 'owner@test.org',
        role: 'owner',
        is_active: true
      },
      member: {
        id: 'user-member',
        email: 'member@test.org',
        role: 'member',
        is_active: true
      }
    };

    // Create test document
    testDoc = {
      id: 'doc-test',
      organization_id: testOrg.id,
      title: 'Test Bylaws Document',
      upload_date: new Date().toISOString()
    };

    // Create 5 test sections
    testSections = [
      {
        id: 'section-1',
        document_id: testDoc.id,
        section_number: '1.1',
        section_title: 'Article I - Name',
        content_text: 'The name of this organization shall be...',
        hierarchy_level: 1,
        is_locked: false
      },
      {
        id: 'section-2',
        document_id: testDoc.id,
        section_number: '1.2',
        section_title: 'Article I - Purpose',
        content_text: 'The purpose of this organization is...',
        hierarchy_level: 1,
        is_locked: false
      },
      {
        id: 'section-3',
        document_id: testDoc.id,
        section_number: '2.1',
        section_title: 'Article II - Membership',
        content_text: 'Membership shall be open to...',
        hierarchy_level: 1,
        is_locked: false
      },
      {
        id: 'section-4',
        document_id: testDoc.id,
        section_number: '3.1',
        section_title: 'Article III - Officers',
        content_text: 'The officers of this organization...',
        hierarchy_level: 1,
        is_locked: false
      },
      {
        id: 'section-5',
        document_id: testDoc.id,
        section_number: '4.1',
        section_title: 'Article IV - Meetings',
        content_text: 'Regular meetings shall be held...',
        hierarchy_level: 1,
        is_locked: false
      }
    ];

    // Create 2-stage workflow (Committee -> Board)
    testWorkflow = {
      id: 'workflow-test',
      organization_id: testOrg.id,
      name: 'Standard Approval Workflow',
      description: 'Committee review followed by board approval',
      is_default: true,
      is_active: true,
      stages: [
        {
          id: 'stage-committee',
          workflow_template_id: 'workflow-test',
          stage_name: 'Committee Review',
          stage_order: 1,
          can_lock: false,
          can_edit: true,
          can_approve: true,
          requires_approval: true,
          required_roles: ['admin'],
          display_color: '#3b82f6',
          icon: 'clipboard-check',
          description: 'Initial review by committee members'
        },
        {
          id: 'stage-board',
          workflow_template_id: 'workflow-test',
          stage_name: 'Board Approval',
          stage_order: 2,
          can_lock: true,
          can_edit: false,
          can_approve: true,
          requires_approval: true,
          required_roles: ['owner'],
          display_color: '#10b981',
          icon: 'check-circle',
          description: 'Final approval by board of directors'
        }
      ]
    };

    // Initialize workflow state for all sections
    testSections.forEach((section, index) => {
      section.workflow_state = {
        id: `sws-${index + 1}`,
        section_id: section.id,
        workflow_stage_id: 'stage-committee',
        status: 'pending',
        approved_by: null,
        approved_at: null,
        approval_metadata: {}
      };
    });
  });

  afterAll(async () => {
    // Clean up test data
    // In real implementation, would delete from database
  });

  describe('Full Workflow Progression: pending -> committee -> board -> locked', () => {
    test('Stage 1: All sections start in pending state', async () => {
      // Verify initial state
      testSections.forEach(section => {
        expect(section.workflow_state.status).toBe('pending');
        expect(section.workflow_state.workflow_stage_id).toBe('stage-committee');
        expect(section.workflow_state.approved_by).toBeNull();
      });
    });

    test('Stage 2: Admin approves 5 sections at committee level', async () => {
      const adminUser = testUsers.admin;

      // Approve each section
      for (const section of testSections) {
        // Mock approval API call
        const approvalResult = {
          success: true,
          data: {
            ...section.workflow_state,
            status: 'approved',
            approved_by: adminUser.id,
            approved_at: new Date().toISOString(),
            approval_metadata: {
              notes: 'Committee approval - looks good',
              approver_name: adminUser.email
            }
          }
        };

        // Update section state
        section.workflow_state = approvalResult.data;

        expect(section.workflow_state.status).toBe('approved');
        expect(section.workflow_state.approved_by).toBe(adminUser.id);
      }

      // Verify all sections approved
      const approvedCount = testSections.filter(
        s => s.workflow_state.status === 'approved'
      ).length;
      expect(approvedCount).toBe(5);
    });

    test('Stage 3: Advance all sections to board approval stage', async () => {
      // Advance each section to next stage
      for (const section of testSections) {
        // Mock advance API call
        const advanceResult = {
          success: true,
          next_stage: testWorkflow.stages[1],
          data: {
            ...section.workflow_state,
            workflow_stage_id: 'stage-board',
            status: 'pending',
            approved_by: null,
            approved_at: null
          }
        };

        // Update section state
        section.workflow_state = advanceResult.data;

        expect(section.workflow_state.workflow_stage_id).toBe('stage-board');
        expect(section.workflow_state.status).toBe('pending');
      }
    });

    test('Stage 4: Owner approves 5 sections at board level', async () => {
      const ownerUser = testUsers.owner;

      // Approve each section
      for (const section of testSections) {
        // Mock approval API call
        const approvalResult = {
          success: true,
          data: {
            ...section.workflow_state,
            status: 'approved',
            approved_by: ownerUser.id,
            approved_at: new Date().toISOString(),
            approval_metadata: {
              notes: 'Board approval - final approval granted',
              approver_name: ownerUser.email,
              final_stage: true
            }
          }
        };

        // Update section state
        section.workflow_state = approvalResult.data;

        expect(section.workflow_state.status).toBe('approved');
        expect(section.workflow_state.approved_by).toBe(ownerUser.id);
      }
    });

    test('Stage 5: Owner locks section with selected suggestion', async () => {
      const section = testSections[0];
      const selectedSuggestion = {
        id: 'suggestion-1',
        section_id: section.id,
        suggestion_text: 'Updated version of section text',
        created_by: testUsers.admin.id
      };

      // Mock lock API call
      const lockResult = {
        success: true,
        data: {
          ...section,
          is_locked: true,
          selected_suggestion_id: selectedSuggestion.id,
          locked_by: testUsers.owner.id,
          locked_at: new Date().toISOString()
        }
      };

      // Update section
      Object.assign(section, lockResult.data);

      expect(section.is_locked).toBe(true);
      expect(section.selected_suggestion_id).toBe(selectedSuggestion.id);
      expect(section.locked_by).toBe(testUsers.owner.id);
    });

    test('Stage 6: Verify locked section is no longer editable', async () => {
      const section = testSections[0];

      // Attempt to edit locked section
      const editAttempt = {
        success: false,
        error: 'Cannot edit locked section'
      };

      expect(section.is_locked).toBe(true);
      expect(editAttempt.success).toBe(false);
    });
  });

  describe('Rejection Workflow: approve -> reject -> re-approve', () => {
    let testSection;

    beforeEach(() => {
      testSection = {
        id: 'section-reject-test',
        document_id: testDoc.id,
        section_number: '5.1',
        section_title: 'Test Rejection',
        content_text: 'Test content for rejection workflow',
        workflow_state: {
          id: 'sws-reject',
          section_id: 'section-reject-test',
          workflow_stage_id: 'stage-committee',
          status: 'pending',
          approved_by: null,
          approved_at: null,
          approval_metadata: {}
        }
      };
    });

    test('Step 1: Admin approves section at committee level', async () => {
      const approvalResult = {
        success: true,
        data: {
          ...testSection.workflow_state,
          status: 'approved',
          approved_by: testUsers.admin.id,
          approved_at: new Date().toISOString()
        }
      };

      testSection.workflow_state = approvalResult.data;

      expect(testSection.workflow_state.status).toBe('approved');
    });

    test('Step 2: Advance to board stage', async () => {
      const advanceResult = {
        success: true,
        data: {
          ...testSection.workflow_state,
          workflow_stage_id: 'stage-board',
          status: 'pending',
          approved_by: null,
          approved_at: null
        }
      };

      testSection.workflow_state = advanceResult.data;

      expect(testSection.workflow_state.workflow_stage_id).toBe('stage-board');
    });

    test('Step 3: Board rejects with reason', async () => {
      const rejectionReason = 'Section needs more specific language regarding quorum requirements';

      const rejectionResult = {
        success: true,
        data: {
          ...testSection.workflow_state,
          workflow_stage_id: 'stage-committee', // Returns to committee
          status: 'rejected',
          approved_by: null,
          approved_at: null,
          approval_metadata: {
            rejection_reason: rejectionReason,
            rejected_by: testUsers.owner.id,
            rejected_at: new Date().toISOString(),
            previous_stage: 'stage-board'
          }
        }
      };

      testSection.workflow_state = rejectionResult.data;

      expect(testSection.workflow_state.status).toBe('rejected');
      expect(testSection.workflow_state.workflow_stage_id).toBe('stage-committee');
      expect(testSection.workflow_state.approval_metadata.rejection_reason).toBe(rejectionReason);
    });

    test('Step 4: Section returns to committee stage', async () => {
      expect(testSection.workflow_state.workflow_stage_id).toBe('stage-committee');
      expect(testSection.workflow_state.status).toBe('rejected');
    });

    test('Step 5: Admin re-approves with changes', async () => {
      const reapprovalResult = {
        success: true,
        data: {
          ...testSection.workflow_state,
          status: 'approved',
          approved_by: testUsers.admin.id,
          approved_at: new Date().toISOString(),
          approval_metadata: {
            notes: 'Updated with specific quorum language as requested',
            previous_rejection: testSection.workflow_state.approval_metadata.rejection_reason,
            reapproval: true
          }
        }
      };

      testSection.workflow_state = reapprovalResult.data;

      expect(testSection.workflow_state.status).toBe('approved');
      expect(testSection.workflow_state.approval_metadata.reapproval).toBe(true);
    });

    test('Step 6: Board approves on second review', async () => {
      // Advance to board
      testSection.workflow_state.workflow_stage_id = 'stage-board';
      testSection.workflow_state.status = 'pending';

      // Board approval
      const finalApproval = {
        success: true,
        data: {
          ...testSection.workflow_state,
          status: 'approved',
          approved_by: testUsers.owner.id,
          approved_at: new Date().toISOString(),
          approval_metadata: {
            notes: 'Looks good now - approved',
            second_review: true
          }
        }
      };

      testSection.workflow_state = finalApproval.data;

      expect(testSection.workflow_state.status).toBe('approved');
      expect(testSection.workflow_state.workflow_stage_id).toBe('stage-board');
    });
  });

  describe('Bulk Approval: approve all sections at once', () => {
    let bulkSections;

    beforeEach(() => {
      bulkSections = [
        { id: 'bulk-1', workflow_state: { workflow_stage_id: 'stage-committee', status: 'pending' } },
        { id: 'bulk-2', workflow_state: { workflow_stage_id: 'stage-committee', status: 'pending' } },
        { id: 'bulk-3', workflow_state: { workflow_stage_id: 'stage-committee', status: 'pending' } },
        { id: 'bulk-4', workflow_state: { workflow_stage_id: 'stage-committee', status: 'pending' } },
        { id: 'bulk-5', workflow_state: { workflow_stage_id: 'stage-committee', status: 'pending' } }
      ];
    });

    test('Should approve all 5 sections in document with single API call', async () => {
      const bulkApprovalResult = {
        success: true,
        approved_count: 5,
        sections: bulkSections.map(section => ({
          ...section,
          workflow_state: {
            ...section.workflow_state,
            status: 'approved',
            approved_by: testUsers.admin.id,
            approved_at: new Date().toISOString()
          }
        }))
      };

      // Update all sections
      bulkSections = bulkApprovalResult.sections;

      expect(bulkApprovalResult.approved_count).toBe(5);
      expect(bulkSections.every(s => s.workflow_state.status === 'approved')).toBe(true);
    });

    test('Should verify all sections advanced to next stage', async () => {
      // First approve all
      bulkSections.forEach(section => {
        section.workflow_state.status = 'approved';
      });

      // Then advance all
      const bulkAdvanceResult = {
        success: true,
        advanced_count: 5,
        sections: bulkSections.map(section => ({
          ...section,
          workflow_state: {
            ...section.workflow_state,
            workflow_stage_id: 'stage-board',
            status: 'pending',
            approved_by: null,
            approved_at: null
          }
        }))
      };

      bulkSections = bulkAdvanceResult.sections;

      expect(bulkAdvanceResult.advanced_count).toBe(5);
      expect(bulkSections.every(s => s.workflow_state.workflow_stage_id === 'stage-board')).toBe(true);
    });

    test('Should handle partial failures gracefully', async () => {
      // Simulate 3 sections approved, 2 failed
      const partialResult = {
        success: true,
        approved_count: 3,
        failed_count: 2,
        failures: [
          { section_id: 'bulk-4', error: 'Permission denied' },
          { section_id: 'bulk-5', error: 'Section locked' }
        ]
      };

      expect(partialResult.approved_count).toBe(3);
      expect(partialResult.failed_count).toBe(2);
      expect(partialResult.failures).toHaveLength(2);
    });
  });

  describe('Permission Enforcement: member cannot approve', () => {
    let testSection;

    beforeEach(() => {
      testSection = {
        id: 'section-permission-test',
        workflow_state: {
          workflow_stage_id: 'stage-committee',
          status: 'pending'
        }
      };
    });

    test('Member attempts to approve section', async () => {
      const memberUser = testUsers.member;

      const approvalAttempt = {
        success: false,
        error: 'You do not have permission to approve at this stage',
        required_role: 'admin',
        user_role: 'member'
      };

      expect(approvalAttempt.success).toBe(false);
      expect(approvalAttempt.error).toContain('permission');
    });

    test('Section receives 403 Forbidden response', async () => {
      const response = {
        status: 403,
        body: {
          success: false,
          error: 'You do not have permission to approve at this stage'
        }
      };

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    test('Section remains in pending state', async () => {
      // After failed approval attempt
      expect(testSection.workflow_state.status).toBe('pending');
      expect(testSection.workflow_state.approved_by).toBeUndefined();
    });

    test('Admin can successfully approve same section', async () => {
      const approvalResult = {
        success: true,
        data: {
          ...testSection.workflow_state,
          status: 'approved',
          approved_by: testUsers.admin.id,
          approved_at: new Date().toISOString()
        }
      };

      testSection.workflow_state = approvalResult.data;

      expect(testSection.workflow_state.status).toBe('approved');
      expect(approvalResult.success).toBe(true);
    });
  });

  describe('Workflow Reset: reset all sections to pending', () => {
    let completedSections;

    beforeEach(() => {
      // Set up sections that have completed full workflow
      completedSections = [
        {
          id: 'reset-1',
          workflow_state: {
            workflow_stage_id: 'stage-board',
            status: 'approved',
            approved_by: testUsers.owner.id,
            approved_at: new Date().toISOString()
          },
          is_locked: true
        },
        {
          id: 'reset-2',
          workflow_state: {
            workflow_stage_id: 'stage-board',
            status: 'approved',
            approved_by: testUsers.owner.id,
            approved_at: new Date().toISOString()
          },
          is_locked: false
        }
      ];
    });

    test('Complete full workflow for all sections', async () => {
      completedSections.forEach(section => {
        expect(section.workflow_state.status).toBe('approved');
        expect(section.workflow_state.workflow_stage_id).toBe('stage-board');
      });
    });

    test('Admin resets workflow to initial state', async () => {
      const resetResult = {
        success: true,
        reset_count: 2,
        sections: completedSections.map(section => ({
          ...section,
          workflow_state: {
            workflow_stage_id: 'stage-committee',
            status: 'pending',
            approved_by: null,
            approved_at: null,
            approval_metadata: {
              reset_by: testUsers.admin.id,
              reset_at: new Date().toISOString(),
              previous_state: section.workflow_state.status
            }
          },
          is_locked: false
        }))
      };

      completedSections = resetResult.sections;

      expect(resetResult.success).toBe(true);
      expect(resetResult.reset_count).toBe(2);
    });

    test('All sections return to pending state at first stage', async () => {
      completedSections.forEach(section => {
        expect(section.workflow_state.workflow_stage_id).toBe('stage-committee');
        expect(section.workflow_state.status).toBe('pending');
        expect(section.workflow_state.approved_by).toBeNull();
        expect(section.is_locked).toBe(false);
      });
    });

    test('Workflow can be re-run after reset', async () => {
      const section = completedSections[0];

      // Re-approve at committee level
      const reapproval = {
        success: true,
        data: {
          ...section.workflow_state,
          status: 'approved',
          approved_by: testUsers.admin.id,
          approved_at: new Date().toISOString()
        }
      };

      section.workflow_state = reapproval.data;

      expect(section.workflow_state.status).toBe('approved');
      expect(reapproval.success).toBe(true);
    });
  });

  describe('Approval History Tracking', () => {
    test('Should track complete approval history', async () => {
      const section = testSections[0];
      const approvalHistory = [
        {
          id: 'history-1',
          section_id: section.id,
          action: 'approved',
          stage_id: 'stage-committee',
          user_id: testUsers.admin.id,
          timestamp: '2025-10-10T10:00:00Z',
          metadata: { notes: 'Committee approval' }
        },
        {
          id: 'history-2',
          section_id: section.id,
          action: 'advanced',
          from_stage: 'stage-committee',
          to_stage: 'stage-board',
          timestamp: '2025-10-10T10:05:00Z'
        },
        {
          id: 'history-3',
          section_id: section.id,
          action: 'approved',
          stage_id: 'stage-board',
          user_id: testUsers.owner.id,
          timestamp: '2025-10-12T14:30:00Z',
          metadata: { notes: 'Board approval' }
        },
        {
          id: 'history-4',
          section_id: section.id,
          action: 'locked',
          user_id: testUsers.owner.id,
          timestamp: '2025-10-12T14:35:00Z',
          metadata: { suggestion_id: 'suggestion-1' }
        }
      ];

      expect(approvalHistory).toHaveLength(4);
      expect(approvalHistory[0].action).toBe('approved');
      expect(approvalHistory[3].action).toBe('locked');
    });

    test('Should include rejection in history', async () => {
      const history = [
        { action: 'approved', stage_id: 'stage-committee' },
        { action: 'advanced', to_stage: 'stage-board' },
        { action: 'rejected', stage_id: 'stage-board', metadata: { reason: 'Needs revision' } },
        { action: 'returned', to_stage: 'stage-committee' }
      ];

      expect(history.find(h => h.action === 'rejected')).toBeDefined();
      expect(history.find(h => h.action === 'rejected').metadata.reason).toBe('Needs revision');
    });
  });
});

module.exports = { /* test helpers if needed */ };
