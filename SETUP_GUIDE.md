# Bylaws Amendment Tracker: Deployment Guide

## Prerequisites

### Software Requirements
- Node.js (v16+ recommended)
- npm (v8+)
- Git
- Web Browser (Chrome/Firefox/Safari)

### Services Required
- Supabase Account
- Google Workspace (optional, for Google Docs integration)
- Cloud Hosting (optional, for production deployment)

## Step-by-Step Deployment

### 1. Repository Setup
```bash
# Clone the repository
git clone https://github.com/your-org/bylaws-amendment-tracker.git
cd bylaws-amendment-tracker

# Verify installation
node --version
npm --version
```

### 2. Dependency Installation
```bash
# Install project dependencies
npm install

# Verify installations
npm list express @supabase/supabase-js
```

### 3. Database Configuration
1. Create Supabase Project
   - Visit https://supabase.com
   - Create New Project
   - Note Project URL and Anon Key

2. Initialize Database Schema
```bash
# Run database initialization
npm run db:init
```

### 4. Environment Configuration
Create `.env` file in project root:
```env
# Supabase Credentials
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Application Settings
APP_URL=http://localhost:3000
DEFAULT_ORG_ID=your-org-identifier

# Optional: Google Integration
GOOGLE_DOC_ID=your-document-id
```

### 5. Google Apps Script Integration
1. Open your Google Doc
2. Tools → Script Editor
3. Paste contents from `google-apps-script/Code.gs`
4. Save and authorize

### 6. Local Development
```bash
# Start development server
npm run dev

# Open http://localhost:3000
```

## Deployment Scenarios

### A. Local Development
- Perfect for testing and customization
- Uses localhost for access
- Recommended for initial setup

### B. Cloud Hosting
Supported Platforms:
- Heroku
- DigitalOcean
- AWS Elastic Beanstalk
- Vercel

Deployment Steps:
1. Create account on chosen platform
2. Set environment variables
3. Connect GitHub repository
4. Deploy main branch

### C. Organizational Intranet
- Requires internal network configuration
- Firewall and VPN considerations
- Recommended: Reverse proxy setup

## Post-Deployment Checklist
- [ ] Verify database connection
- [ ] Test Google Docs sync
- [ ] Configure user roles
- [ ] Set up backup strategy

## Troubleshooting

### Common Issues
1. **Database Connection Errors**
   - Verify Supabase credentials
   - Check network connectivity
   - Ensure IP whitelisting

2. **Google Apps Script Problems**
   - Reauthorize script permissions
   - Verify document sharing settings
   - Check Apps Script logs

3. **Performance Concerns**
   - Monitor server resources
   - Optimize database queries
   - Implement caching strategies

## Support Resources
- GitHub Issues: Report bugs
- Community Forum: Ask questions
- Documentation: Comprehensive guides

## Security Recommendations
- Use strong, unique passwords
- Enable two-factor authentication
- Regularly update dependencies
- Implement least-privilege access

## Next Steps
1. Customize workflow
2. Add organization-specific configurations
3. Integrate with existing systems
4. Train team members

**Happy Governance Tracking!** 🏛️