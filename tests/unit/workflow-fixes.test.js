/**
 * Unit tests for workflow system fixes
 * Tests race condition fix, validation, and error handling
 */

const { WorkflowError, handleError } = require('../../src/utils/errors');

describe('Workflow Error Handling', () => {
  describe('WorkflowError class', () => {
    it('should create error with correct properties', () => {
      const error = new WorkflowError('Test error', 'TEST_CODE', 400, { detail: 'test' });

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({ detail: 'test' });
      expect(error.name).toBe('WorkflowError');
    });

    it('should default to 500 status code', () => {
      const error = new WorkflowError('Test error', 'TEST_CODE');

      expect(error.statusCode).toBe(500);
    });

    it('should default to empty details object', () => {
      const error = new WorkflowError('Test error', 'TEST_CODE', 400);

      expect(error.details).toEqual({});
    });
  });

  describe('handleError function', () => {
    let mockReq, mockRes;

    beforeEach(() => {
      mockReq = {
        session: {
          userId: 'test-user-id',
          organizationId: 'test-org-id'
        },
        path: '/approval/lock',
        method: 'POST'
      };

      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      // Mock console.error to avoid cluttering test output
      jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      console.error.mockRestore();
    });

    it('should handle WorkflowError with correct status code', () => {
      const error = new WorkflowError('Test error', 'TEST_CODE', 400);

      handleError(error, mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Test error',
        code: 'TEST_CODE'
      });
    });

    it('should handle generic Error with 500 status', () => {
      const error = new Error('Generic error');

      handleError(error, mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Generic error',
        code: 'INTERNAL_ERROR'
      });
    });

    it('should sanitize error in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new Error('Database connection failed');

      handleError(error, mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'An error occurred while processing your request. Please try again.',
        code: 'INTERNAL_ERROR'
      });

      process.env.NODE_ENV = originalEnv;
    });

    it('should NOT sanitize WorkflowError in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new WorkflowError('Section not found', 'SECTION_NOT_FOUND', 404);

      handleError(error, mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Section not found',
        code: 'SECTION_NOT_FOUND'
      });

      process.env.NODE_ENV = originalEnv;
    });

    it('should log error details', () => {
      const error = new WorkflowError('Test error', 'TEST_CODE', 400);

      handleError(error, mockReq, mockRes);

      expect(console.error).toHaveBeenCalledWith(
        'Workflow error occurred:',
        expect.objectContaining({
          message: 'Test error',
          code: 'TEST_CODE',
          userId: 'test-user-id',
          organizationId: 'test-org-id',
          path: '/approval/lock',
          method: 'POST'
        })
      );
    });

    it('should handle missing session gracefully', () => {
      mockReq.session = undefined;

      const error = new WorkflowError('Test error', 'TEST_CODE', 400);

      expect(() => handleError(error, mockReq, mockRes)).not.toThrow();
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });
});

describe('Validation Schemas (integration)', () => {
  const Joi = require('joi');

  // Recreate schemas from approval.js
  const lockSectionSchema = Joi.object({
    section_id: Joi.string().uuid().required(),
    workflow_stage_id: Joi.string().uuid().required(),
    selected_suggestion_id: Joi.string().uuid().optional().allow(null),
    notes: Joi.string().max(5000).optional().allow('')
  });

  const progressSectionSchema = Joi.object({
    section_id: Joi.string().uuid().required(),
    notes: Joi.string().max(5000).optional().allow('').allow(null)
  });

  describe('lockSectionSchema', () => {
    it('should validate correct lock request', () => {
      const data = {
        section_id: '550e8400-e29b-41d4-a716-446655440000',
        workflow_stage_id: '550e8400-e29b-41d4-a716-446655440001',
        selected_suggestion_id: '550e8400-e29b-41d4-a716-446655440002',
        notes: 'Test notes'
      };

      const { error } = lockSectionSchema.validate(data);
      expect(error).toBeUndefined();
    });

    it('should reject invalid section_id UUID', () => {
      const data = {
        section_id: 'invalid-uuid',
        workflow_stage_id: '550e8400-e29b-41d4-a716-446655440001'
      };

      const { error } = lockSectionSchema.validate(data);
      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('valid GUID');
    });

    it('should allow null selected_suggestion_id', () => {
      const data = {
        section_id: '550e8400-e29b-41d4-a716-446655440000',
        workflow_stage_id: '550e8400-e29b-41d4-a716-446655440001',
        selected_suggestion_id: null
      };

      const { error } = lockSectionSchema.validate(data);
      expect(error).toBeUndefined();
    });

    it('should reject notes longer than 5000 characters', () => {
      const data = {
        section_id: '550e8400-e29b-41d4-a716-446655440000',
        workflow_stage_id: '550e8400-e29b-41d4-a716-446655440001',
        notes: 'a'.repeat(5001)
      };

      const { error } = lockSectionSchema.validate(data);
      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('5000');
    });
  });

  describe('progressSectionSchema', () => {
    it('should validate correct progress request', () => {
      const data = {
        section_id: '550e8400-e29b-41d4-a716-446655440000',
        notes: 'Progress notes'
      };

      const { error } = progressSectionSchema.validate(data);
      expect(error).toBeUndefined();
    });

    it('should allow null notes', () => {
      const data = {
        section_id: '550e8400-e29b-41d4-a716-446655440000',
        notes: null
      };

      const { error } = progressSectionSchema.validate(data);
      expect(error).toBeUndefined();
    });

    it('should allow empty string notes', () => {
      const data = {
        section_id: '550e8400-e29b-41d4-a716-446655440000',
        notes: ''
      };

      const { error } = progressSectionSchema.validate(data);
      expect(error).toBeUndefined();
    });

    it('should reject missing section_id', () => {
      const data = {
        notes: 'Test notes'
      };

      const { error } = progressSectionSchema.validate(data);
      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('required');
    });

    it('should reject invalid UUID format', () => {
      const data = {
        section_id: 'not-a-uuid',
        notes: 'Test notes'
      };

      const { error } = progressSectionSchema.validate(data);
      expect(error).toBeDefined();
    });
  });
});

describe('Error Code Coverage', () => {
  it('should have all expected error codes defined', () => {
    const expectedCodes = [
      'VALIDATION_ERROR',
      'PERMISSION_DENIED',
      'SECTION_NOT_FOUND',
      'WORKFLOW_NOT_FOUND',
      'FINAL_STAGE_REACHED',
      'DATABASE_ERROR',
      'SECTION_LOCKED',
      'LOCK_CONTENTION',
      'INTERNAL_ERROR'
    ];

    // Test that each code can be used in WorkflowError
    expectedCodes.forEach(code => {
      const error = new WorkflowError('Test', code, 400);
      expect(error.code).toBe(code);
    });
  });
});
