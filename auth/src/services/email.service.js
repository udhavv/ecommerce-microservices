import nodemailer from 'nodemailer';
import env from '../config/env.js';
import logger from '../utils/logger.js';

let transporter = null;

export function getTransporter() {
  if (transporter) return transporter;

  // In test environment, or if credentials missing, create mock or standard transport
  if (env.nodeEnv === 'test' || !env.smtp.user) {
    transporter = {
      sendMail: async (options) => {
        logger.info({ to: options.to, subject: options.subject }, '[MOCK EMAIL] Message sent');
        return { messageId: 'mock-mail-id-' + Date.now() };
      },
      verify: async () => true,
    };
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    auth: {
      user: env.smtp.user,
      pass: env.smtp.pass,
    },
  });

  return transporter;
}

/**
 * Send email verification link to newly registered user
 */
export async function sendVerificationEmail({ to, displayName, token }) {
  const mailClient = getTransporter();

  // Clicking the button in email performs a GET request in the user's browser
  const verificationUrl = `${env.app.backendUrl}/api/${env.version.ver}/auth/verify-email?token=${encodeURIComponent(token)}`;
  const frontendUrl = `${env.app.frontendUrl}/verify-email?token=${encodeURIComponent(token)}`;

  const subject = 'Verify your email address';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f7f6; margin: 0; padding: 20px; }
        .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
        .header { background: #1a1a2e; color: #ffffff; padding: 24px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
        .content { padding: 32px 24px; color: #333333; line-height: 1.6; }
        .btn-wrapper { text-align: center; margin: 32px 0; }
        .btn { background: #4f46e5; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 600; display: inline-block; }
        .footer { background: #f8fafc; padding: 16px 24px; font-size: 13px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; }
        .link-text { word-break: break-all; color: #4f46e5; font-size: 13px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to E-Commerce</h1>
        </div>
        <div class="content">
          <p>Hi ${displayName || 'there'},</p>
          <p>Thank you for registering. Please click the button below to verify your email address and activate your account:</p>
          <div class="btn-wrapper">
            <a href="${verificationUrl}" class="btn" target="_blank">Verify Email Address</a>
          </div>
          <p>This verification link will expire in 24 hours.</p>
          <p>If the button doesn't work, copy and paste this link into your browser:</p>
          <p><a href="${verificationUrl}" class="link-text">${verificationUrl}</a></p>
        </div>
        <div class="footer">
          <p>If you did not create an account, you can safely ignore this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const info = await mailClient.sendMail({
      from: `"E-Commerce Security" <${env.smtp.from}>`,
      to,
      subject,
      html,
      text: `Hi ${displayName || 'there'},\n\nPlease verify your email by visiting: ${verificationUrl}\n\nThis link will expire in 24 hours.`,
    });

    logger.info({ to, messageId: info.messageId }, 'Verification email sent');
    return info;
  } catch (error) {
    logger.error({ err: error, to }, 'Failed to send verification email');
    throw error;
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail({ to, displayName, token }) {
  const mailClient = getTransporter();

  // Password reset page on frontend (or fallback backend reset link)
  const resetUrl = `${env.app.frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;

  const subject = 'Password Reset Request';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f7f6; margin: 0; padding: 20px; }
        .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
        .header { background: #1a1a2e; color: #ffffff; padding: 24px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
        .content { padding: 32px 24px; color: #333333; line-height: 1.6; }
        .btn-wrapper { text-align: center; margin: 32px 0; }
        .btn { background: #dc2626; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 600; display: inline-block; }
        .footer { background: #f8fafc; padding: 16px 24px; font-size: 13px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; }
        .link-text { word-break: break-all; color: #dc2626; font-size: 13px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Password Reset</h1>
        </div>
        <div class="content">
          <p>Hi ${displayName || 'there'},</p>
          <p>We received a request to reset the password for your account. Click the button below to choose a new password:</p>
          <div class="btn-wrapper">
            <a href="${resetUrl}" class="btn" target="_blank">Reset Password</a>
          </div>
          <p>This password reset link will expire in 1 hour.</p>
          <p>If you didn't request a password reset, you can safely ignore this email; your password will remain unchanged.</p>
          <p>Reset link: <a href="${resetUrl}" class="link-text">${resetUrl}</a></p>
        </div>
        <div class="footer">
          <p>E-Commerce Security Team</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const info = await mailClient.sendMail({
      from: `"E-Commerce Security" <${env.smtp.from}>`,
      to,
      subject,
      html,
      text: `Hi ${displayName || 'there'},\n\nReset your password here: ${resetUrl}\n\nThis link will expire in 1 hour.`,
    });

    logger.info({ to, messageId: info.messageId }, 'Password reset email sent');
    return info;
  } catch (error) {
    logger.error({ err: error, to }, 'Failed to send password reset email');
    throw error;
  }
}
