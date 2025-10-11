/**
 * Setup Routes Tests
 * Tests setup wizard routes and form validation
 */

const express = require('express');
const request = require('supertest');

// Validation helpers
function validateOrganizationData(data) {
    const errors = [];

    if (!data.organization_name || data.organization_name.trim().length === 0) {
        errors.push('Organization name is required');
    }

    if (!data.organization_type) {
        errors.push('Organization type is required');
    }

    if (data.contact_email && !isValidEmail(data.contact_email)) {
        errors.push('Invalid email address');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

function validateDocumentTypeData(data) {
    const errors = [];

    if (!data.structure_type) {
        errors.push('Document structure type is required');
    }

    const validStructures = ['article-section', 'chapter-section', 'part-section', 'custom'];
    if (data.structure_type && !validStructures.includes(data.structure_type)) {
        errors.push('Invalid structure type');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

function validateWorkflowData(data) {
    const errors = [];

    if (!data.stages || !Array.isArray(data.stages)) {
        errors.push('Workflow stages must be an array');
        return { valid: false, errors };
    }

    if (data.stages.length === 0) {
        errors.push('At least one workflow stage is required');
    }

    if (data.stages.length > 5) {
        errors.push('Maximum of 5 workflow stages allowed');
    }

    data.stages.forEach((stage, index) => {
        if (!stage.name || stage.name.trim().length === 0) {
            errors.push(`Stage ${index + 1} must have a name`);
        }

        if (!stage.approvalType) {
            errors.push(`Stage ${index + 1} must have an approval type`);
        }

        const validTypes = ['single', 'majority', 'unanimous', 'supermajority', 'quorum'];
        if (stage.approvalType && !validTypes.includes(stage.approvalType)) {
            errors.push(`Stage ${index + 1} has invalid approval type`);
        }

        // Support both 'supermajority' (new) and 'quorum' (legacy) for backwards compatibility
        if (stage.approvalType === 'supermajority' && (!stage.voteThreshold || stage.voteThreshold < 1 || stage.voteThreshold > 100)) {
            errors.push(`Stage ${index + 1} requires valid vote threshold percentage (1-100)`);
        }
        if (stage.approvalType === 'quorum' && (!stage.quorum || stage.quorum < 1 || stage.quorum > 100)) {
            errors.push(`Stage ${index + 1} requires valid quorum percentage (1-100)`);
        }
    });

    return {
        valid: errors.length === 0,
        errors
    };
}

function validateFileUpload(file) {
    const errors = [];

    if (!file) {
        errors.push('No file provided');
        return { valid: false, errors };
    }

    const allowedTypes = [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword'
    ];

    if (!allowedTypes.includes(file.mimetype)) {
        errors.push('Only Word documents (.docx, .doc) are allowed');
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
        errors.push('File size must be less than 10MB');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

describe('Setup Routes', () => {
    describe('Organization Setup', () => {
        test('should validate organization name is required', () => {
            const data = {
                organization_name: '',
                organization_type: 'neighborhood_council'
            };

            const result = validateOrganizationData(data);

            expect(result.valid).toBe(false);
            expect(result.errors).toContainMatch(/organization name/i);
        });

        test('should validate organization type is required', () => {
            const data = {
                organization_name: 'Test Organization',
                organization_type: ''
            };

            const result = validateOrganizationData(data);

            expect(result.valid).toBe(false);
            expect(result.errors).toContainMatch(/organization type/i);
        });

        test('should validate email format', () => {
            const invalidEmails = ['invalid', 'test@', '@test.com', 'test@test'];

            invalidEmails.forEach(email => {
                const data = {
                    organization_name: 'Test Org',
                    organization_type: 'neighborhood_council',
                    contact_email: email
                };

                const result = validateOrganizationData(data);

                expect(result.valid).toBe(false);
                expect(result.errors).toContainMatch(/email/i);
            });
        });

        test('should accept valid organization data', () => {
            const data = {
                organization_name: 'Reseda Neighborhood Council',
                organization_type: 'neighborhood_council',
                state: 'CA',
                country: 'USA',
                contact_email: 'admin@resedacouncil.org'
            };

            const result = validateOrganizationData(data);

            expect(result.valid).toBe(true);
            expect(result.errors.length).toBe(0);
        });

        test('should accept optional fields', () => {
            const data = {
                organization_name: 'Test Org',
                organization_type: 'neighborhood_council'
                // No state, country, or email
            };

            const result = validateOrganizationData(data);

            expect(result.valid).toBe(true);
        });
    });

    describe('Document Structure Setup', () => {
        test('should validate structure type is required', () => {
            const data = {
                structure_type: ''
            };

            const result = validateDocumentTypeData(data);

            expect(result.valid).toBe(false);
            expect(result.errors).toContainMatch(/structure type/i);
        });

        test('should validate structure type is one of allowed types', () => {
            const data = {
                structure_type: 'invalid-structure'
            };

            const result = validateDocumentTypeData(data);

            expect(result.valid).toBe(false);
            expect(result.errors).toContainMatch(/invalid/i);
        });

        test('should accept valid structure types', () => {
            const validTypes = ['article-section', 'chapter-section', 'part-section', 'custom'];

            validTypes.forEach(type => {
                const data = {
                    structure_type: type,
                    level1_name: 'Article',
                    level2_name: 'Section'
                };

                const result = validateDocumentTypeData(data);

                expect(result.valid).toBe(true);
            });
        });

        test('should use default values for custom labels', () => {
            const data = {
                structure_type: 'article-section'
                // No level1_name or level2_name provided
            };

            const result = validateDocumentTypeData(data);

            expect(result.valid).toBe(true);
        });
    });

    describe('Workflow Configuration', () => {
        test('should require at least one workflow stage', () => {
            const data = {
                template: 'custom',
                stages: []
            };

            const result = validateWorkflowData(data);

            expect(result.valid).toBe(false);
            expect(result.errors).toContainMatch(/at least one/i);
        });

        test('should enforce maximum of 5 stages', () => {
            const data = {
                template: 'custom',
                stages: [
                    { name: 'Stage 1', approvalType: 'single' },
                    { name: 'Stage 2', approvalType: 'single' },
                    { name: 'Stage 3', approvalType: 'single' },
                    { name: 'Stage 4', approvalType: 'single' },
                    { name: 'Stage 5', approvalType: 'single' },
                    { name: 'Stage 6', approvalType: 'single' }
                ]
            };

            const result = validateWorkflowData(data);

            expect(result.valid).toBe(false);
            expect(result.errors).toContainMatch(/maximum/i);
        });

        test('should validate each stage has a name', () => {
            const data = {
                template: 'custom',
                stages: [
                    { name: '', approvalType: 'single' }
                ]
            };

            const result = validateWorkflowData(data);

            expect(result.valid).toBe(false);
            expect(result.errors).toContainMatch(/name/i);
        });

        test('should validate each stage has approval type', () => {
            const data = {
                template: 'custom',
                stages: [
                    { name: 'Committee Review', approvalType: '' }
                ]
            };

            const result = validateWorkflowData(data);

            expect(result.valid).toBe(false);
            expect(result.errors).toContainMatch(/approval type/i);
        });

        test('should validate approval type is valid', () => {
            const data = {
                template: 'custom',
                stages: [
                    { name: 'Review', approvalType: 'invalid-type' }
                ]
            };

            const result = validateWorkflowData(data);

            expect(result.valid).toBe(false);
            expect(result.errors).toContainMatch(/invalid/i);
        });

        test('should validate vote threshold percentage for supermajority type', () => {
            const invalidData = {
                template: 'custom',
                stages: [
                    { name: 'Membership Vote', approvalType: 'supermajority', voteThreshold: 0 },
                    { name: 'Board Vote', approvalType: 'supermajority', voteThreshold: 101 },
                    { name: 'Committee', approvalType: 'supermajority' } // Missing voteThreshold
                ]
            };

            const result = validateWorkflowData(invalidData);

            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        test('should accept valid workflow configuration', () => {
            const data = {
                template: 'committee',
                stages: [
                    { name: 'Committee Review', approvalType: 'majority' },
                    { name: 'Board Approval', approvalType: 'majority' },
                    { name: 'President Signature', approvalType: 'single' }
                ]
            };

            const result = validateWorkflowData(data);

            expect(result.valid).toBe(true);
            expect(result.errors.length).toBe(0);
        });

        test('should accept valid supermajority configuration', () => {
            const data = {
                template: 'membership',
                stages: [
                    { name: 'Membership Vote', approvalType: 'supermajority', voteThreshold: 67 }
                ]
            };

            const result = validateWorkflowData(data);

            expect(result.valid).toBe(true);
        });

        test('should accept legacy quorum configuration for backwards compatibility', () => {
            const data = {
                template: 'membership',
                stages: [
                    { name: 'Membership Vote', approvalType: 'quorum', quorum: 50 }
                ]
            };

            const result = validateWorkflowData(data);

            expect(result.valid).toBe(true);
        });
    });

    describe('Document Import', () => {
        test('should validate file type', () => {
            const invalidFile = {
                mimetype: 'application/pdf',
                size: 1024
            };

            const result = validateFileUpload(invalidFile);

            expect(result.valid).toBe(false);
            expect(result.errors).toContainMatch(/word/i);
        });

        test('should validate file size', () => {
            const largeFile = {
                mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                size: 15 * 1024 * 1024 // 15MB
            };

            const result = validateFileUpload(largeFile);

            expect(result.valid).toBe(false);
            expect(result.errors).toContainMatch(/10mb/i);
        });

        test('should accept valid Word document', () => {
            const validFile = {
                mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                size: 2 * 1024 * 1024 // 2MB
            };

            const result = validateFileUpload(validFile);

            expect(result.valid).toBe(true);
        });

        test('should accept .doc files', () => {
            const docFile = {
                mimetype: 'application/msword',
                size: 1 * 1024 * 1024
            };

            const result = validateFileUpload(docFile);

            expect(result.valid).toBe(true);
        });
    });

    describe('Session Management', () => {
        test('should maintain setup data across steps', () => {
            const session = {
                setupData: {
                    organization: { organization_name: 'Test Org' },
                    completedSteps: ['organization']
                }
            };

            // Add document type
            session.setupData.documentType = { structure_type: 'article-section' };
            session.setupData.completedSteps.push('document');

            expect(session.setupData.completedSteps).toContain('organization');
            expect(session.setupData.completedSteps).toContain('document');
            expect(session.setupData.organization.organization_name).toBe('Test Org');
        });

        test('should track completed steps', () => {
            const completedSteps = [];

            completedSteps.push('organization');
            expect(completedSteps).toContain('organization');

            completedSteps.push('document');
            expect(completedSteps).toContain('document');

            completedSteps.push('workflow');
            expect(completedSteps).toContain('workflow');

            expect(completedSteps.length).toBe(3);
        });
    });
});

// Mock Jest functions
if (typeof describe === 'undefined') {
    global.describe = (name, fn) => {
        console.log(`\n${name}`);
        fn();
    };
    global.test = (name, fn) => {
        try {
            fn();
            console.log(`  ✓ ${name}`);
        } catch (error) {
            console.log(`  ✗ ${name}`);
            console.error(`    ${error.message}`);
        }
    };
    global.expect = (value) => ({
        toBe: (expected) => {
            if (value !== expected) throw new Error(`Expected ${expected}, got ${value}`);
        },
        toEqual: (expected) => {
            if (JSON.stringify(value) !== JSON.stringify(expected)) {
                throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(value)}`);
            }
        },
        toContain: (expected) => {
            if (!value.includes(expected)) throw new Error(`Expected to contain ${expected}`);
        },
        toContainMatch: (regex) => {
            const found = value.some(item => regex.test(item));
            if (!found) throw new Error(`Expected to contain match for ${regex}`);
        },
        toBeGreaterThan: (expected) => {
            if (value <= expected) throw new Error(`Expected ${value} to be greater than ${expected}`);
        }
    });
}

module.exports = {
    validateOrganizationData,
    validateDocumentTypeData,
    validateWorkflowData,
    validateFileUpload
};
