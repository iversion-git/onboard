import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { createLoggerFromCorrelationId } from '../logging.js';

// Create a logger instance for SES operations
const logger = createLoggerFromCorrelationId('ses-client', 'aws-integration');

/**
 * SES client for templated email sending
 */
export class SESHelpers {
  private static client: SESClient | null = null;

  /**
   * Initialize SES client
   */
  private static getClient(): SESClient {
    if (!this.client) {
      this.client = new SESClient({
        region: process.env['AWS_REGION'] || 'us-east-1',
        maxAttempts: 3,
        retryMode: 'adaptive'
      });
      logger.info('SES client initialized');
    }
    return this.client;
  }

  /**
   * Send password reset email with secure token
   */
  static async sendPasswordResetEmail(
    toEmail: string,
    resetToken: string,
    staffName?: string
  ): Promise<void> {
    const client = this.getClient();
    const fromEmail = process.env['FROM_EMAIL'] || 'noreply@example.com';
    const baseUrl = process.env['RESET_URL_BASE'] || 'https://app.example.com';
    
    const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;
    
    const htmlBody = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Password Reset Request</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2c3e50;">Password Reset Request</h2>
            
            <p>Hello${staffName ? ` ${staffName}` : ''},</p>
            
            <p>We received a request to reset your password for your Control Plane account.</p>
            
            <p>Click the link below to reset your password:</p>
            
            <div style="margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background-color: #3498db; color: white; padding: 12px 24px; 
                        text-decoration: none; border-radius: 4px; display: inline-block;">
                Reset Password
              </a>
            </div>
            
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #7f8c8d;">${resetUrl}</p>
            
            <p><strong>This link will expire in 1 hour.</strong></p>
            
            <p>If you didn't request this password reset, please ignore this email. Your password will remain unchanged.</p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="font-size: 12px; color: #7f8c8d;">
              This is an automated message. Please do not reply to this email.
            </p>
          </div>
        </body>
      </html>
    `;

    const textBody = `
Password Reset Request

Hello${staffName ? ` ${staffName}` : ''},

We received a request to reset your password for your Control Plane account.

Click the link below to reset your password:
${resetUrl}

This link will expire in 1 hour.

If you didn't request this password reset, please ignore this email. Your password will remain unchanged.

This is an automated message. Please do not reply to this email.
    `;

    try {
      const command = new SendEmailCommand({
        Source: fromEmail,
        Destination: {
          ToAddresses: [toEmail]
        },
        Message: {
          Subject: {
            Data: 'Password Reset Request - Control Plane',
            Charset: 'UTF-8'
          },
          Body: {
            Html: {
              Data: htmlBody,
              Charset: 'UTF-8'
            },
            Text: {
              Data: textBody,
              Charset: 'UTF-8'
            }
          }
        }
      });

      await client.send(command);
      
      logger.info('Password reset email sent successfully', { 
        toEmail: toEmail.replace(/(.{2}).*(@.*)/, '$1***$2'), // Mask email for logging
        correlationId: process.env['_X_AMZN_TRACE_ID'] 
      });
    } catch (error) {
      logger.error('Failed to send password reset email', { 
        toEmail: toEmail.replace(/(.{2}).*(@.*)/, '$1***$2'), // Mask email for logging
        error 
      });
      throw error;
    }
  }

  /**
   * Send welcome email for new staff registration
   */
  static async sendWelcomeEmail(
    toEmail: string,
    staffName: string,
    temporaryPassword: string
  ): Promise<void> {
    const client = this.getClient();
    const fromEmail = process.env['FROM_EMAIL'] || 'noreply@example.com';
    const loginUrl = process.env['LOGIN_URL'] || 'https://app.example.com/login';

    const htmlBody = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Welcome to Control Plane</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2c3e50;">Welcome to Control Plane</h2>
            
            <p>Hello ${staffName},</p>
            
            <p>Your Control Plane account has been created successfully!</p>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 4px; margin: 20px 0;">
              <p><strong>Login Details:</strong></p>
              <p>Email: ${toEmail}</p>
              <p>Temporary Password: <code style="background-color: #e9ecef; padding: 2px 4px;">${temporaryPassword}</code></p>
            </div>
            
            <p><strong>Important:</strong> Please change your password after your first login for security.</p>
            
            <div style="margin: 30px 0;">
              <a href="${loginUrl}" 
                 style="background-color: #28a745; color: white; padding: 12px 24px; 
                        text-decoration: none; border-radius: 4px; display: inline-block;">
                Login Now
              </a>
            </div>
            
            <p>If you have any questions, please contact your administrator.</p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="font-size: 12px; color: #7f8c8d;">
              This is an automated message. Please do not reply to this email.
            </p>
          </div>
        </body>
      </html>
    `;

    const textBody = `
Welcome to Control Plane

Hello ${staffName},

Your Control Plane account has been created successfully!

Login Details:
Email: ${toEmail}
Temporary Password: ${temporaryPassword}

Important: Please change your password after your first login for security.

Login at: ${loginUrl}

If you have any questions, please contact your administrator.

This is an automated message. Please do not reply to this email.
    `;

    try {
      const command = new SendEmailCommand({
        Source: fromEmail,
        Destination: {
          ToAddresses: [toEmail]
        },
        Message: {
          Subject: {
            Data: 'Welcome to Control Plane - Account Created',
            Charset: 'UTF-8'
          },
          Body: {
            Html: {
              Data: htmlBody,
              Charset: 'UTF-8'
            },
            Text: {
              Data: textBody,
              Charset: 'UTF-8'
            }
          }
        }
      });

      await client.send(command);
      
      logger.info('Welcome email sent successfully', { 
        toEmail: toEmail.replace(/(.{2}).*(@.*)/, '$1***$2'), // Mask email for logging
        staffName,
        correlationId: process.env['_X_AMZN_TRACE_ID'] 
      });
    } catch (error) {
      logger.error('Failed to send welcome email', { 
        toEmail: toEmail.replace(/(.{2}).*(@.*)/, '$1***$2'), // Mask email for logging
        staffName,
        error 
      });
      throw error;
    }
  }
}