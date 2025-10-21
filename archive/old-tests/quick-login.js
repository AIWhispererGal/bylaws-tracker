/**
 * Quick Login Script
 * Creates a temporary login endpoint to get JWT tokens without re-running setup
 *
 * Usage:
 * 1. node quick-login.js
 * 2. Navigate to: http://localhost:3001/login
 * 3. Enter your email and password
 * 4. You'll be logged in and redirected to dashboard
 */

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = 3001;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SESSION_SECRET = process.env.SESSION_SECRET || 'development-secret';

const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Session middleware
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Login form
app.get('/login', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Quick Login</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 400px; margin: 50px auto; padding: 20px; }
        input { width: 100%; padding: 10px; margin: 10px 0; box-sizing: border-box; }
        button { width: 100%; padding: 10px; background: #4CAF50; color: white; border: none; cursor: pointer; }
        button:hover { background: #45a049; }
        .error { color: red; padding: 10px; background: #ffe6e6; border-radius: 4px; margin: 10px 0; }
        .success { color: green; padding: 10px; background: #e6ffe6; border-radius: 4px; margin: 10px 0; }
      </style>
    </head>
    <body>
      <h2>Quick Login</h2>
      <p>Enter your Supabase Auth credentials:</p>
      <form id="loginForm">
        <input type="email" name="email" placeholder="Email" required>
        <input type="password" name="password" placeholder="Password" required>
        <button type="submit">Login & Get JWT Tokens</button>
      </form>
      <div id="message"></div>

      <script>
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const formData = new FormData(e.target);
          const email = formData.get('email');
          const password = formData.get('password');

          const messageDiv = document.getElementById('message');
          messageDiv.innerHTML = '<div class="success">Logging in...</div>';

          try {
            const response = await fetch('/do-login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password })
            });

            const result = await response.json();

            if (result.success) {
              messageDiv.innerHTML = '<div class="success">✅ Login successful! JWT tokens stored. Redirecting to dashboard...</div>';
              setTimeout(() => {
                window.location.href = 'http://localhost:3000/dashboard';
              }, 2000);
            } else {
              messageDiv.innerHTML = '<div class="error">❌ ' + result.error + '</div>';
            }
          } catch (error) {
            messageDiv.innerHTML = '<div class="error">❌ Login failed: ' + error.message + '</div>';
          }
        });
      </script>
    </body>
    </html>
  `);
});

// Login handler
app.post('/do-login', async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('[QUICK-LOGIN] Attempting login for:', email);

    // Sign in with Supabase Auth
    const { data: authData, error: signInError } = await supabaseService.auth.signInWithPassword({
      email,
      password
    });

    if (signInError) {
      console.error('[QUICK-LOGIN] Sign in error:', signInError);
      return res.json({
        success: false,
        error: signInError.message
      });
    }

    if (!authData || !authData.session) {
      return res.json({
        success: false,
        error: 'No session returned from Supabase'
      });
    }

    console.log('[QUICK-LOGIN] Sign in successful for:', authData.user.email);

    // Get user's organizations
    const { data: userOrgs, error: orgsError } = await supabaseService
      .from('user_organizations')
      .select('organization_id, role')
      .eq('user_id', authData.user.id)
      .eq('is_active', true)
      .limit(1)
      .single();

    if (orgsError) {
      console.error('[QUICK-LOGIN] Error fetching user organizations:', orgsError);
      return res.json({
        success: false,
        error: 'User not linked to any organization. Run: INSERT INTO user_organizations...'
      });
    }

    // Store in session (same as setup wizard does)
    req.session.supabaseJWT = authData.session.access_token;
    req.session.supabaseRefreshToken = authData.session.refresh_token;
    req.session.supabaseUser = authData.user;
    req.session.userId = authData.user.id;
    req.session.userEmail = authData.user.email;
    req.session.organizationId = userOrgs.organization_id;
    req.session.isAuthenticated = true;
    req.session.isConfigured = true;

    console.log('[QUICK-LOGIN] ✅ Session configured:');
    console.log('  - User ID:', authData.user.id);
    console.log('  - Email:', authData.user.email);
    console.log('  - Organization ID:', userOrgs.organization_id);
    console.log('  - Role:', userOrgs.role);
    console.log('  - JWT length:', authData.session.access_token.length);

    // Save session
    req.session.save((err) => {
      if (err) {
        console.error('[QUICK-LOGIN] Session save error:', err);
        return res.json({
          success: false,
          error: 'Failed to save session'
        });
      }

      res.json({
        success: true,
        message: 'Login successful! You can now access the dashboard.',
        user: {
          id: authData.user.id,
          email: authData.user.email,
          organizationId: userOrgs.organization_id,
          role: userOrgs.role
        }
      });
    });

  } catch (error) {
    console.error('[QUICK-LOGIN] Error:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log('\n🔐 Quick Login Server Running');
  console.log('==============================');
  console.log(`Navigate to: http://localhost:${PORT}/login`);
  console.log('\nThis will:');
  console.log('  1. Sign you in with Supabase Auth');
  console.log('  2. Get JWT tokens');
  console.log('  3. Store tokens in session');
  console.log('  4. Redirect you to dashboard');
  console.log('\nMake sure your main server is also running on port 3000!');
  console.log('==============================\n');
});
