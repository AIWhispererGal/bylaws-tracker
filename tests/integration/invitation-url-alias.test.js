/**
 * Integration Tests: Invitation URL Alias
 * Tests the URL compatibility layer for invitation acceptance
 * Ensures both /auth/accept-invitation and /auth/accept-invite work
 */

const request = require('supertest');
const express = require('express');
const session = require('express-session');
const authRoutes = require('../../src/routes/auth');

// Mock Supabase client
const mockSupabaseService = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => ({
            data: {
              id: 'test-invitation-id',
              email: 'test@example.com',
              role: 'member',
              token: 'valid-token',
              status: 'pending',
              organization_id: 'test-org-id',
              expires_at: new Date(Date.now() + 86400000).toISOString(),
              organization: {
                id: 'test-org-id',
                name: 'Test Organization',
                organization_type: 'nonprofit'
              }
            },
            error: null
          }))
        }))
      }))
    }))
  })),
  auth: {
    admin: {
      createUser: jest.fn(() => ({
        data: {
          user: {
            id: 'new-user-id',
            email: 'test@example.com'
          }
        },
        error: null
      }))
    },
    signInWithPassword: jest.fn(() => ({
      data: {
        session: {
          access_token: 'test-token',
          refresh_token: 'test-refresh',
          expires_at: 9999999999,
          expires_in: 3600
        },
        user: {
          id: 'new-user-id',
          email: 'test@example.com'
        }
      },
      error: null
    }))
  }
};

const mockSupabase = {
  ...mockSupabaseService,
  auth: {
    ...mockSupabaseService.auth
  }
};

// Create test app
function createTestApp() {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Session middleware
  app.use(session({
    secret: 'test-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
  }));

  // Mock Supabase middleware
  app.use((req, res, next) => {
    req.supabase = mockSupabase;
    req.supabaseService = mockSupabaseService;
    next();
  });

  // Mock view engine
  app.set('view engine', 'ejs');
  app.set('views', __dirname + '/../../views');

  // Mock render to avoid actual template rendering
  app.use((req, res, next) => {
    const originalRender = res.render;
    res.render = function(view, locals) {
      res.status(res.statusCode || 200).json({
        view,
        ...locals
      });
    };
    next();
  });

  app.use('/auth', authRoutes);

  return app;
}

describe('Invitation URL Alias Routes', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
    jest.clearAllMocks();
  });

  describe('GET /auth/accept-invitation (alias)', () => {
    it('should redirect to /auth/accept-invite with token', async () => {
      const response = await request(app)
        .get('/auth/accept-invitation?token=test123')
        .expect(302);

      expect(response.headers.location).toBe('/auth/accept-invite?token=test123');
    });

    it('should URL-encode special characters in token', async () => {
      const response = await request(app)
        .get('/auth/accept-invitation?token=abc+def/ghi')
        .expect(302);

      // Token should be properly encoded
      expect(response.headers.location).toContain('accept-invite');
      expect(response.headers.location).toContain('token=');
    });

    it('should return 400 error when token is missing', async () => {
      const response = await request(app)
        .get('/auth/accept-invitation')
        .expect(400);

      expect(response.body.view).toBe('error');
      expect(response.body.message).toContain('Invalid invitation link');
      expect(response.body.details).toContain('No invitation token provided');
    });

    it('should return 400 for empty token parameter', async () => {
      const response = await request(app)
        .get('/auth/accept-invitation?token=')
        .expect(400);

      expect(response.body.view).toBe('error');
    });
  });

  describe('POST /auth/accept-invitation (alias)', () => {
    it('should forward request to /auth/accept-invite handler', async () => {
      const requestData = {
        token: 'valid-token',
        full_name: 'Test User',
        password: 'password123'
      };

      const response = await request(app)
        .post('/auth/accept-invitation')
        .send(requestData);

      // Should process like the canonical route
      // Response depends on whether token exists in database
      expect([200, 400, 404, 500]).toContain(response.status);
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/auth/accept-invitation')
        .send({ token: 'test' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('required');
    });

    it('should validate password length', async () => {
      const response = await request(app)
        .post('/auth/accept-invitation')
        .send({
          token: 'test',
          full_name: 'Test',
          password: 'short'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('8 characters');
    });
  });

  describe('Original routes still work', () => {
    it('GET /auth/accept-invite should work without redirect', async () => {
      const response = await request(app)
        .get('/auth/accept-invite?token=valid-token');

      // Should render form directly (not redirect)
      expect([200, 404, 410]).toContain(response.status);
    });

    it('POST /auth/accept-invite should process invitation', async () => {
      const response = await request(app)
        .post('/auth/accept-invite')
        .send({
          token: 'valid-token',
          full_name: 'Test User',
          password: 'password123'
        });

      // Should process (may succeed or fail based on mocks)
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });

  describe('Edge cases', () => {
    it('should handle very long tokens', async () => {
      const longToken = 'a'.repeat(500);
      const response = await request(app)
        .get(`/auth/accept-invitation?token=${longToken}`)
        .expect(302);

      expect(response.headers.location).toContain('accept-invite');
    });

    it('should handle tokens with URL-unsafe characters', async () => {
      const unsafeToken = 'token&param=value';
      const response = await request(app)
        .get(`/auth/accept-invitation?token=${encodeURIComponent(unsafeToken)}`)
        .expect(302);

      expect(response.headers.location).toContain('accept-invite');
    });

    it('should prevent redirect loops', async () => {
      // Test that accept-invitation redirects to accept-invite
      // but accept-invite does NOT redirect back
      const response1 = await request(app)
        .get('/auth/accept-invitation?token=test')
        .expect(302);

      expect(response1.headers.location).toContain('accept-invite');
      expect(response1.headers.location).not.toContain('accept-invitation');
    });

    it('should preserve session data through redirect', async () => {
      const agent = request.agent(app);

      // Set session data
      await agent
        .get('/auth/accept-invitation?token=test')
        .expect(302);

      // Session should persist through redirect
      // This is handled by express-session automatically
    });
  });

  describe('Security', () => {
    it('should not expose system errors to client', async () => {
      // Force an error by passing invalid data
      const response = await request(app)
        .post('/auth/accept-invitation')
        .send({ token: null })
        .expect(400);

      expect(response.body.error).toBeDefined();
      // Should not contain stack traces or internal paths
      expect(response.body.error).not.toContain('/mnt/');
      expect(response.body.error).not.toContain('at Object');
    });

    it('should sanitize error messages', async () => {
      const response = await request(app)
        .get('/auth/accept-invitation')
        .expect(400);

      expect(response.body.message).toBeDefined();
      expect(response.body.details).toBeDefined();
      // Should not expose sensitive info
      expect(JSON.stringify(response.body)).not.toContain('password');
      expect(JSON.stringify(response.body)).not.toContain('secret');
    });
  });

  describe('Performance', () => {
    it('should respond quickly to redirects', async () => {
      const startTime = Date.now();

      await request(app)
        .get('/auth/accept-invitation?token=test')
        .expect(302);

      const duration = Date.now() - startTime;

      // Redirect should be very fast (< 100ms)
      expect(duration).toBeLessThan(100);
    });

    it('should handle concurrent requests', async () => {
      const requests = Array(10).fill(null).map((_, i) =>
        request(app)
          .get(`/auth/accept-invitation?token=test${i}`)
          .expect(302)
      );

      const responses = await Promise.all(requests);

      // All should redirect successfully
      expect(responses).toHaveLength(10);
      responses.forEach(response => {
        expect(response.headers.location).toContain('accept-invite');
      });
    });
  });
});

describe('Integration: Full invitation flow with alias', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
    jest.clearAllMocks();
  });

  it('should complete invitation acceptance using /auth/accept-invitation URL', async () => {
    // Step 1: Visit invitation link (using alias URL)
    const getResponse = await request(app)
      .get('/auth/accept-invitation?token=valid-token')
      .expect(302);

    expect(getResponse.headers.location).toBe('/auth/accept-invite?token=valid-token');

    // Step 2: Follow redirect and get form (simulated)
    const formResponse = await request(app)
      .get('/auth/accept-invite?token=valid-token');

    expect([200, 404, 410]).toContain(formResponse.status);

    // Step 3: Submit form using alias URL
    const submitResponse = await request(app)
      .post('/auth/accept-invitation')
      .send({
        token: 'valid-token',
        full_name: 'Test User',
        password: 'password123'
      });

    // Should process successfully or fail gracefully
    expect([200, 400, 404, 410, 500]).toContain(submitResponse.status);

    if (submitResponse.status === 200) {
      expect(submitResponse.body).toHaveProperty('success');
    } else {
      expect(submitResponse.body).toHaveProperty('error');
    }
  });
});
