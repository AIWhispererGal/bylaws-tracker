/**
 * Email Service
 * Handles sending emails using Resend
 */

const { Resend } = require('resend');

// Initialize Resend client
let resend = null;
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
}

/**
 * Send invitation email to user
 * @param {Object} params - Email parameters
 * @param {string} params.to - Recipient email
 * @param {string} params.inviteUrl - Invitation acceptance URL
 * @param {string} params.organizationName - Name of organization
 * @param {string} params.invitedBy - Name of person who sent invitation
 * @param {string} params.role - User's role (member, admin, etc.)
 */
async function sendInvitationEmail({ to, inviteUrl, organizationName, invitedBy, role }) {
  // If no API key configured, log to console (development mode)
  if (!resend || !process.env.RESEND_API_KEY) {
    console.log('\n═══════════════════════════════════════════════════');
    console.log('📧 INVITATION EMAIL (Development Mode)');
    console.log('═══════════════════════════════════════════════════');
    console.log(`To: ${to}`);
    console.log(`Organization: ${organizationName}`);
    console.log(`Role: ${role}`);
    console.log(`Invited by: ${invitedBy}`);
    console.log(`\n🔗 Invitation URL:\n${inviteUrl}`);
    console.log('═══════════════════════════════════════════════════\n');
    return { success: true, mode: 'development' };
  }

  try {
    const fromEmail = process.env.FROM_EMAIL || 'noreply@yourdomain.com';
    const appName = 'Bylaws Amendment Tracker';

    const { data, error } = await resend.emails.send({
      from: `${appName} <${fromEmail}>`,
      to: [to],
      subject: `You've been invited to join ${organizationName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              background-color: #f4f4f4;
              margin: 0;
              padding: 0;
            }
            .email-container {
              max-width: 600px;
              margin: 40px auto;
              background: white;
              border-radius: 8px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              overflow: hidden;
            }
            .email-header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 40px 30px;
              text-align: center;
            }
            .email-header h1 {
              margin: 0;
              font-size: 28px;
              font-weight: 600;
            }
            .email-body {
              padding: 40px 30px;
            }
            .email-body p {
              margin: 0 0 16px 0;
              font-size: 16px;
            }
            .invitation-box {
              background: #f8f9fa;
              border-left: 4px solid #667eea;
              padding: 20px;
              margin: 24px 0;
            }
            .invitation-box p {
              margin: 8px 0;
            }
            .invitation-box strong {
              color: #667eea;
            }
            .cta-button {
              display: inline-block;
              background: linear-gradient(135deg, #667eea, #764ba2);
              color: white;
              text-decoration: none;
              padding: 14px 32px;
              border-radius: 6px;
              font-weight: 600;
              font-size: 16px;
              margin: 24px 0;
            }
            .email-footer {
              background: #f8f9fa;
              padding: 30px;
              text-align: center;
              color: #6c757d;
              font-size: 14px;
              border-top: 1px solid #e9ecef;
            }
            .email-footer p {
              margin: 8px 0;
            }
            .security-notice {
              background: #fff3cd;
              border: 1px solid #ffc107;
              border-radius: 4px;
              padding: 16px;
              margin-top: 24px;
              font-size: 14px;
            }
            @media only screen and (max-width: 600px) {
              .email-container {
                margin: 0;
                border-radius: 0;
              }
              .email-header, .email-body, .email-footer {
                padding: 24px 20px;
              }
            }
          </style>
        </head>
        <body>
          <div class="email-container">
            <div class="email-header">
              <h1>📋 You're Invited!</h1>
            </div>

            <div class="email-body">
              <p>Hello,</p>

              <p><strong>${invitedBy}</strong> has invited you to join <strong>${organizationName}</strong> on ${appName}.</p>

              <div class="invitation-box">
                <p><strong>Organization:</strong> ${organizationName}</p>
                <p><strong>Role:</strong> ${role.charAt(0).toUpperCase() + role.slice(1)}</p>
                <p><strong>Invited by:</strong> ${invitedBy}</p>
              </div>

              <p>Click the button below to accept your invitation and create your account:</p>

              <center>
                <a href="${inviteUrl}" class="cta-button">Accept Invitation</a>
              </center>

              <p style="color: #6c757d; font-size: 14px; margin-top: 24px;">
                Or copy and paste this link into your browser:<br>
                <a href="${inviteUrl}" style="color: #667eea; word-break: break-all;">${inviteUrl}</a>
              </p>

              <div class="security-notice">
                <strong>⚠️ Security Notice:</strong><br>
                This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
              </div>
            </div>

            <div class="email-footer">
              <p><strong>${appName}</strong></p>
              <p>This is an automated message, please do not reply to this email.</p>
              <p style="margin-top: 16px; font-size: 12px; color: #999;">
                If you're having trouble clicking the button, copy and paste the URL above into your web browser.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error('Resend email error:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Invitation email sent:', data.id);
    return { success: true, messageId: data.id };
  } catch (error) {
    console.error('Email service error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send password reset confirmation email
 * (Optional - Supabase already handles this, but we can add custom emails)
 */
async function sendPasswordResetConfirmation({ to, userName }) {
  if (!resend || !process.env.RESEND_API_KEY) {
    console.log('📧 Password reset confirmation (skipped - development mode)');
    return { success: true, mode: 'development' };
  }

  // Implementation similar to invitation email
  // Can be added later if needed
  return { success: true };
}

module.exports = {
  sendInvitationEmail,
  sendPasswordResetConfirmation,
};
