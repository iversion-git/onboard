import { SESClient, SendEmailCommand, type SendEmailCommandInput } from '@aws-sdk/client-ses';
import { getConfig } from './config.js';
import { logger } from './logging.js';

// SES client configuration with retry patterns
const createSESClient = (): SESClient => {
  return new SESClient({
    region: process.env['AWS_REGION'] || 'us-east-1',
    maxAttempts: 3,
    retryMode: 'adaptive',
    requestHandler: {
      requestTimeout: 10000,
    },
  });
};

// Singleton SES client instance
let sesClient: SESClient | null = null;

export const getSESClient = (): SESClient => {
  if (!sesClient) {
    sesClient = createSESClient();
    logger.info('SES client initialized');
  }
  return sesClient;
};

// Email template types
export interface EmailTemplate {
  subject: string;
  htmlBody: string;
  textBody: string;
}

export interface PasswordResetEmailData {
  recipientName: string;
  resetToken: string;
  resetUrl: string;
  expirationMinutes: number;
}

// Email templates
export const emailTemplates = {
  passwordReset: (data: PasswordResetEmailData): EmailTemplate => ({
    subject: 'Password Reset Request - AWS Lambda Control Plane',
    htmlBody: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset Request</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
          .content { padding: 20px 0; }
          .button { display: inline-block; background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
          .warning { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Password Reset Request</h1>
        </div>
        
        <div class="content">
          <p>Hello ${data.recipientName},</p>
          
          <p>We received a request to reset your password for your AWS Lambda Control Plane account. If you made this request, please click the button below to reset your password:</p>
          
          <a href="${data.resetUrl}" class="button">Reset Password</a>
          
          <p>Alternatively, you can copy and paste this link into your browser:</p>
          <p style="word-break: break-all; background-color: #f8f9fa; padding: 10px; border-radius: 3px;">${data.resetUrl}</p>
          
          <div class="warning">
            <strong>Important:</strong> This password reset link will expire in ${data.expirationMinutes} minutes for security reasons.
          </div>
          
          <p>If you did not request a password reset, please ignore this email. Your password will remain unchanged.</p>
          
          <p>For security reasons, please do not share this email or the reset link with anyone.</p>
        </div>
        
        <div class="footer">
          <p>This is an automated message from AWS Lambda Control Plane. Please do not reply to this email.</p>
          <p>If you continue to have problems, please contact your system administrator.</p>
        </div>
      </body>
      </html>
    `,
    textBody: `
Password Reset Request - AWS Lambda Control Plane

Hello ${data.recipientName},

We received a request to reset your password for your AWS Lambda Control Plane account. If you made this request, please use the following link to reset your password:

${data.resetUrl}

IMPORTANT: This password reset link will expire in ${data.expirationMinutes} minutes for security reasons.

If you did not request a password reset, please ignore this email. Your password will remain unchanged.

For security reasons, please do not share this email or the reset link with anyone.

This is an automated message from AWS Lambda Control Plane. Please do not reply to this email.
If you continue to have problems, please contact your system administrator.
    `.trim(),
  }),
};

// SES Helper class for sending templated emails
export class SESHelper {
  private client: SESClient;
  private fromEmail: string;

  constructor() {
    this.client = getSESClient();
    const config = getConfig();
    this.fromEmail = config.ses.fromEmail;
  }

  async sendEmail(
    to: string | string[],
    template: EmailTemplate,
    correlationId?: string
  ): Promise<void> {
    try {
      const recipients = Array.isArray(to) ? to : [to];
      
      logger.info('Sending email via SES', {
        recipients: recipients.length,
        subject: template.subject,
        correlationId,
      });

      const params: SendEmailCommandInput = {
        Source: this.fromEmail,
        Destination: {
          ToAddresses: recipients,
        },
        Message: {
          Subject: {
            Data: template.subject,
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: template.htmlBody,
              Charset: 'UTF-8',
            },
            Text: {
              Data: template.textBody,
              Charset: 'UTF-8',
            },
          },
        },
      };

      const command = new SendEmailCommand(params);
      const result = await this.client.send(command);

      logger.info('Email sent successfully via SES', {
        messageId: result.MessageId,
        recipients: recipients.length,
        correlationId,
      });

    } catch (error) {
      logger.error('Failed to send email via SES', {
        error: error instanceof Error ? error.message : 'Unknown error',
        recipients: Array.isArray(to) ? to.length : 1,
        correlationId,
      });
      throw error;
    }
  }

  async sendPasswordResetEmail(
    recipientEmail: string,
    recipientName: string,
    resetToken: string,
    correlationId?: string
  ): Promise<void> {
    const config = getConfig();
    
    // Construct reset URL (this would typically be your frontend URL)
    const resetUrl = `${config.app.baseUrl}/auth/password-reset/confirm?token=${resetToken}`;
    
    const template = emailTemplates.passwordReset({
      recipientName,
      resetToken,
      resetUrl,
      expirationMinutes: 30, // 30 minutes expiration
    });

    await this.sendEmail(recipientEmail, template, correlationId);
  }

  // Validate email address format
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Normalize email address (lowercase, trim)
  static normalizeEmail(email: string): string {
    return email.toLowerCase().trim();
  }
}

// Export singleton instance (lazy initialization)
let sesHelperInstance: SESHelper | null = null;
export const sesHelper = {
  get instance(): SESHelper {
    if (!sesHelperInstance) {
      sesHelperInstance = new SESHelper();
    }
    return sesHelperInstance;
  },
  
  // Proxy methods for convenience
  sendEmail: (to: string | string[], template: EmailTemplate, correlationId?: string) => 
    sesHelper.instance.sendEmail(to, template, correlationId),
  sendPasswordResetEmail: (recipientEmail: string, recipientName: string, resetToken: string, correlationId?: string) => 
    sesHelper.instance.sendPasswordResetEmail(recipientEmail, recipientName, resetToken, correlationId),
};