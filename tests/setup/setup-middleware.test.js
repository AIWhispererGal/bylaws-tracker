/**
 * Setup Middleware Tests
 * Tests the setup-required middleware and setup guards
 */

const {
    requireSetupComplete,
    preventSetupIfConfigured,
    checkSetupStatus,
    initializeSetupStatus
} = require('../../src/middleware/setup-required');

// Mock Express request/response
function createMockRequest(path = '/', isConfigured = false) {
    return {
        path,
        app: {
            locals: {
                isConfigured
            }
        }
    };
}

function createMockResponse() {
    const res = {
        redirected: false,
        redirectPath: null
    };
    res.redirect = (path) => {
        res.redirected = true;
        res.redirectPath = path;
        return res;
    };
    return res;
}

function createMockNext() {
    let called = false;
    const next = () => { called = true; };
    next.called = () => called;
    return next;
}

describe('Setup Middleware', () => {
    describe('requireSetupComplete', () => {
        test('should redirect to /setup if not configured', () => {
            const req = createMockRequest('/dashboard', false);
            const res = createMockResponse();
            const next = createMockNext();

            requireSetupComplete(req, res, next);

            expect(res.redirected).toBe(true);
            expect(res.redirectPath).toBe('/setup');
            expect(next.called()).toBe(false);
        });

        test('should allow access if configured', () => {
            const req = createMockRequest('/dashboard', true);
            const res = createMockResponse();
            const next = createMockNext();

            requireSetupComplete(req, res, next);

            expect(res.redirected).toBe(false);
            expect(next.called()).toBe(true);
        });

        test('should always allow /setup routes', () => {
            const req = createMockRequest('/setup/organization', false);
            const res = createMockResponse();
            const next = createMockNext();

            requireSetupComplete(req, res, next);

            expect(res.redirected).toBe(false);
            expect(next.called()).toBe(true);
        });

        test('should allow access to public assets', () => {
            const publicPaths = ['/css/style.css', '/js/app.js', '/images/logo.png'];

            publicPaths.forEach(path => {
                const req = createMockRequest(path, false);
                const res = createMockResponse();
                const next = createMockNext();

                requireSetupComplete(req, res, next);

                expect(res.redirected).toBe(false);
                expect(next.called()).toBe(true);
            });
        });

        test('should allow health check endpoint', () => {
            const req = createMockRequest('/api/health', false);
            const res = createMockResponse();
            const next = createMockNext();

            requireSetupComplete(req, res, next);

            expect(res.redirected).toBe(false);
            expect(next.called()).toBe(true);
        });

        test('should protect API routes if not configured', () => {
            const req = createMockRequest('/api/sections', false);
            const res = createMockResponse();
            const next = createMockNext();

            requireSetupComplete(req, res, next);

            expect(res.redirected).toBe(true);
            expect(res.redirectPath).toBe('/setup');
        });
    });

    describe('preventSetupIfConfigured', () => {
        test('should redirect to dashboard if already configured', () => {
            const req = createMockRequest('/setup', true);
            const res = createMockResponse();
            const next = createMockNext();

            preventSetupIfConfigured(req, res, next);

            expect(res.redirected).toBe(true);
            expect(res.redirectPath).toBe('/dashboard');
            expect(next.called()).toBe(false);
        });

        test('should allow setup access if not configured', () => {
            const req = createMockRequest('/setup', false);
            const res = createMockResponse();
            const next = createMockNext();

            preventSetupIfConfigured(req, res, next);

            expect(res.redirected).toBe(false);
            expect(next.called()).toBe(true);
        });

        test('should not affect non-setup routes', () => {
            const req = createMockRequest('/dashboard', true);
            const res = createMockResponse();
            const next = createMockNext();

            preventSetupIfConfigured(req, res, next);

            expect(res.redirected).toBe(false);
            expect(next.called()).toBe(true);
        });
    });

    describe('checkSetupStatus', () => {
        test('should return false if organization table does not exist', async () => {
            const mockDb = {
                get: async (query) => {
                    if (query.includes('sqlite_master')) {
                        return { count: 0 };
                    }
                    return null;
                }
            };

            const result = await checkSetupStatus(mockDb);
            expect(result).toBe(false);
        });

        test('should return false if no organization exists', async () => {
            const mockDb = {
                get: async (query) => {
                    if (query.includes('sqlite_master')) {
                        return { count: 1 };
                    }
                    return null; // No organization
                }
            };

            const result = await checkSetupStatus(mockDb);
            expect(result).toBe(false);
        });

        test('should return true if organization is configured', async () => {
            const mockDb = {
                get: async (query) => {
                    if (query.includes('sqlite_master')) {
                        return { count: 1 };
                    }
                    return { id: 1, organization_name: 'Test Org' };
                }
            };

            const result = await checkSetupStatus(mockDb);
            expect(result).toBe(true);
        });

        test('should handle database errors gracefully', async () => {
            const mockDb = {
                get: async () => {
                    throw new Error('Database connection failed');
                }
            };

            const result = await checkSetupStatus(mockDb);
            expect(result).toBe(false);
        });
    });

    describe('initializeSetupStatus', () => {
        test('should set app.locals.isConfigured to true if configured', async () => {
            const mockApp = { locals: {} };
            const mockDb = {
                get: async (query) => {
                    if (query.includes('sqlite_master')) {
                        return { count: 1 };
                    }
                    return { id: 1 };
                }
            };

            const result = await initializeSetupStatus(mockApp, mockDb);

            expect(result).toBe(true);
            expect(mockApp.locals.isConfigured).toBe(true);
        });

        test('should set app.locals.isConfigured to false if not configured', async () => {
            const mockApp = { locals: {} };
            const mockDb = {
                get: async () => ({ count: 0 })
            };

            const result = await initializeSetupStatus(mockApp, mockDb);

            expect(result).toBe(false);
            expect(mockApp.locals.isConfigured).toBe(false);
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
        (async () => {
            try {
                await fn();
                console.log(`  ✓ ${name}`);
            } catch (error) {
                console.log(`  ✗ ${name}`);
                console.error(`    ${error.message}`);
            }
        })();
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
        toHaveProperty: (prop) => {
            if (!(prop in value)) throw new Error(`Expected to have property ${prop}`);
        }
    });
}

module.exports = { createMockRequest, createMockResponse, createMockNext };
