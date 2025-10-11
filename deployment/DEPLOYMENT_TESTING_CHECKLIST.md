# Deployment Testing Checklist

This checklist ensures the Render deployment with setup wizard works correctly for end users.

## Pre-Deployment Testing (Local Development)

### Environment Setup
- [ ] `.env.example` file is up to date
- [ ] All required environment variables are documented
- [ ] Default values are safe (no production credentials)
- [ ] `SETUP_COMPLETED` defaults to `false`

### First-Run Detection
- [ ] Fresh install (no `.env`) redirects to `/setup`
- [ ] Configured install (`.env` exists) goes to main app
- [ ] Health check endpoint returns correct status
- [ ] Exempt paths (setup, health, static files) work without redirect

### Setup Wizard UI
- [ ] Step 1 (Welcome) displays correctly
- [ ] Step 2 (Supabase) validates URL format
- [ ] Step 2 (Supabase) validates key format
- [ ] Step 3 (Database) shows progress indicators
- [ ] Step 4 (Optional) accepts organization name
- [ ] Step 4 (Optional) accepts Google Doc ID
- [ ] Step 5 (Completion) shows loading state
- [ ] Progress bar updates correctly
- [ ] Back button works between steps
- [ ] Error messages are user-friendly

### Setup Wizard Logic
- [ ] Invalid Supabase URL shows error
- [ ] Invalid Supabase key shows error
- [ ] Valid credentials pass validation
- [ ] Connection test catches auth errors
- [ ] Connection test handles missing tables
- [ ] Schema SQL loads correctly
- [ ] Manual instructions are generated
- [ ] Config save works (local .env)
- [ ] Setup completion flag is set

### Database Operations
- [ ] Schema SQL file is valid
- [ ] Schema creates all required tables
- [ ] Schema creates indexes
- [ ] Schema sets permissions
- [ ] Sample data insert works
- [ ] CRUD operations work
- [ ] Foreign keys are enforced
- [ ] Migrations run in order

---

## Render Deployment Testing

### Blueprint Configuration
- [ ] `render.yaml` has correct service type
- [ ] Build command is specified
- [ ] Start command is specified
- [ ] Health check path is set
- [ ] Environment variables are defined
- [ ] `sync: false` for sensitive vars
- [ ] `generateValue: true` for secrets
- [ ] Free tier plan is specified

### Deploy to Render
- [ ] GitHub repository is public
- [ ] `render.yaml` is in repository root
- [ ] Deploy button URL is correct
- [ ] Clicking deploy button redirects to Render
- [ ] Render dashboard shows service creation
- [ ] Build process completes without errors
- [ ] Service status shows "Live"

### Environment Variables
- [ ] `NODE_ENV` is set to `production`
- [ ] `PORT` is auto-set by Render
- [ ] `APP_URL` is auto-generated
- [ ] `SESSION_SECRET` is auto-generated
- [ ] `SETUP_COMPLETED` defaults to `false`
- [ ] Sensitive vars (`SUPABASE_URL`, etc.) are not pre-filled

### Health Check
- [ ] `/health` endpoint is accessible
- [ ] Health check returns 503 when unconfigured
- [ ] Health check returns 200 when configured
- [ ] Render monitors health correctly
- [ ] Service restarts if unhealthy

---

## Setup Wizard Testing (On Render)

### First Visit
- [ ] Visiting app URL redirects to `/setup`
- [ ] Setup wizard loads without errors
- [ ] CSS styles load correctly
- [ ] JavaScript loads correctly
- [ ] No console errors
- [ ] Mobile-responsive design works

### Supabase Connection Test
- [ ] Enter valid Supabase URL
- [ ] Enter valid Supabase key
- [ ] Click "Validate & Continue"
- [ ] Loading indicator shows
- [ ] Success message appears
- [ ] Advances to next step

### Error Handling
- [ ] Invalid URL format shows error
- [ ] Invalid key format shows error
- [ ] Network errors are caught
- [ ] Error messages are clear
- [ ] User can retry after error

### Database Schema Creation
- [ ] Manual instructions are shown
- [ ] SQL is copy-pasteable
- [ ] SQL Editor link works
- [ ] Instructions are clear
- [ ] User can verify tables exist
- [ ] Checkbox for "I've created the tables"

### Configuration Save
- [ ] Organization name is saved
- [ ] Google Doc ID is saved (if provided)
- [ ] Supabase credentials are saved
- [ ] Setup completion flag is set
- [ ] App restarts automatically (or shows manual restart instructions)

### Post-Setup
- [ ] Redirect to main app works
- [ ] App loads without errors
- [ ] Supabase connection works
- [ ] Health check returns 200
- [ ] `/setup` no longer accessible (or shows "already configured")

---

## Render API Integration Testing

### Prerequisites
- [ ] `RENDER_API_KEY` can be set manually
- [ ] `RENDER_SERVICE_ID` is auto-detected or settable

### Environment Variable Updates
- [ ] Render API client initializes
- [ ] `updateEnvVars()` sends correct payload
- [ ] Environment variables are updated in Render
- [ ] Old values are replaced
- [ ] New values persist after restart

### Service Restart
- [ ] `restartService()` triggers restart
- [ ] Service goes offline briefly
- [ ] Service comes back online
- [ ] New environment variables are active
- [ ] Health check passes after restart

### Error Handling
- [ ] Invalid API key shows error
- [ ] Network errors are caught
- [ ] Timeout errors are handled
- [ ] Rate limiting is handled
- [ ] Fallback to manual config works

---

## End-to-End User Flow Testing

### Complete User Journey
1. [ ] User clicks "Deploy to Render" button
2. [ ] User creates Render account (or logs in)
3. [ ] User clicks "Deploy" in Render dashboard
4. [ ] Build completes successfully (2-3 minutes)
5. [ ] Service shows "Live" status
6. [ ] User copies app URL
7. [ ] User visits app URL in browser
8. [ ] Auto-redirects to setup wizard
9. [ ] User creates Supabase account
10. [ ] User creates Supabase project
11. [ ] User copies Supabase URL and key
12. [ ] User pastes credentials in wizard
13. [ ] Wizard validates connection
14. [ ] User follows database setup instructions
15. [ ] User runs SQL in Supabase SQL Editor
16. [ ] User confirms tables created
17. [ ] User enters organization name (optional)
18. [ ] User enters Google Doc ID (optional)
19. [ ] User clicks "Complete Setup"
20. [ ] App saves configuration
21. [ ] App restarts (automatic or manual)
22. [ ] User is redirected to main app
23. [ ] App loads and works correctly
24. [ ] User can create sections, suggestions, etc.

### Time Benchmarks
- [ ] Deploy to Render: < 3 minutes
- [ ] Create Supabase project: < 2 minutes
- [ ] Setup wizard: < 2 minutes
- [ ] **Total time: < 7 minutes**

---

## Edge Cases and Error Scenarios

### Network Issues
- [ ] Setup wizard works on slow connections
- [ ] Timeouts are handled gracefully
- [ ] Retry mechanism works
- [ ] Partial configurations are cleaned up

### Invalid Inputs
- [ ] Empty fields show validation errors
- [ ] Malformed URLs are rejected
- [ ] Short/invalid keys are rejected
- [ ] SQL injection attempts are prevented

### Browser Compatibility
- [ ] Works in Chrome
- [ ] Works in Firefox
- [ ] Works in Safari
- [ ] Works in Edge
- [ ] Works on mobile browsers
- [ ] JavaScript disabled shows fallback

### Render Environment
- [ ] Works in Render's build environment
- [ ] Works with Render's network restrictions
- [ ] Works with Render's file system (ephemeral)
- [ ] Environment variables persist
- [ ] Restarts don't lose configuration

### Supabase Scenarios
- [ ] Wrong credentials show clear error
- [ ] Expired JWT is detected
- [ ] Database quota exceeded is handled
- [ ] Connection timeout is handled
- [ ] Project paused/suspended is detected

---

## Security Testing

### Credential Handling
- [ ] Credentials never appear in logs
- [ ] Credentials never appear in URLs
- [ ] Credentials never appear in error messages
- [ ] Credentials are transmitted over HTTPS only
- [ ] Credentials are not stored in browser localStorage

### Environment Variables
- [ ] Sensitive vars use `sync: false`
- [ ] Secrets use `generateValue: true`
- [ ] `.env` is in `.gitignore`
- [ ] `.env` is never committed
- [ ] `.env.example` contains no real credentials

### SQL Injection
- [ ] User inputs are validated
- [ ] SQL is parameterized
- [ ] No raw SQL execution from user input
- [ ] Supabase client uses prepared statements

### XSS Prevention
- [ ] User inputs are escaped
- [ ] EJS templates escape by default
- [ ] HTML in error messages is sanitized
- [ ] JavaScript in inputs is neutralized

---

## Performance Testing

### Load Times
- [ ] Setup wizard loads in < 2 seconds
- [ ] Step transitions are smooth (< 300ms)
- [ ] API calls respond in < 1 second
- [ ] Database operations complete in < 2 seconds

### Resource Usage
- [ ] Memory usage is reasonable (< 512MB)
- [ ] CPU usage is low during idle
- [ ] No memory leaks during setup
- [ ] No excessive logging

### Cold Starts (Render Free Tier)
- [ ] App wakes from sleep in < 30 seconds
- [ ] Setup wizard works after cold start
- [ ] Database connection works after cold start
- [ ] No stale data after sleep

---

## Documentation Testing

### User Guide
- [ ] Instructions are clear
- [ ] Screenshots are up-to-date
- [ ] Links work correctly
- [ ] Code examples are accurate
- [ ] Troubleshooting section is helpful

### Technical Spec
- [ ] Architecture diagrams are accurate
- [ ] Code samples work
- [ ] API documentation is complete
- [ ] Environment variables are documented

### README
- [ ] Quick start works
- [ ] Prerequisites are listed
- [ ] Installation steps are correct
- [ ] Deploy button works

---

## Post-Launch Monitoring

### Analytics
- [ ] Setup completion rate
- [ ] Average setup time
- [ ] Drop-off points
- [ ] Error frequency
- [ ] Browser/device breakdown

### User Feedback
- [ ] Collect feedback on setup experience
- [ ] Monitor support requests
- [ ] Track common issues
- [ ] Identify improvement areas

### Maintenance
- [ ] Monitor Render service health
- [ ] Monitor Supabase usage
- [ ] Check for API changes
- [ ] Update dependencies regularly

---

## Sign-Off

### Development Team
- [ ] Code reviewed
- [ ] Tests passed
- [ ] Documentation complete
- [ ] Security audit done

### QA Team
- [ ] All checklists completed
- [ ] Edge cases tested
- [ ] Performance benchmarks met
- [ ] User acceptance testing done

### Product Owner
- [ ] User flow approved
- [ ] Documentation approved
- [ ] Ready for launch

---

**Deployment Date:** _______________

**Tested By:** _______________

**Approved By:** _______________

**Notes:**
