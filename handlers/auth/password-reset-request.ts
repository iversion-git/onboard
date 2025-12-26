// POST /auth/password-reset/request handler with token generation and SES integration
import type { RouteHandler } from '../../lib/types.js';
import { dynamoDBHelper } from '../../lib/dynamodb.js';
import { sesHelper } from '../../lib/ses.js';
import { logger } from '../../lib/logging.js';
import { sendError } from '../../lib/response.js';
import { PasswordResetRequestSchema } from '../../lib/data-models.js';
import { randomBytes, createHash } from 'crypto';

export const passwordResetRequestHandler: RouteHandler = async (req, res) => {
  try {
    logger.info('Processing password reset request', {
      correlationId: req.correlationId,
      email: req.body?.email,
    });

    // Validate request body
    const validation = PasswordResetRequestSchema.safeParse(req.body);
    if (!validation.success) {
      logger.warn('Password reset request validation failed', {
        correlationId: req.correlationId,
        errors: validation.error.errors,
      });
      sendError(
        res,
        'ValidationError',
        'Invalid email format',
        req.correlationId,
        { validationErrors: validation.error.errors }
      );
      return;
    }

    const { email } = validation.data;

    // Get staff member by email
    const staffResult = await dynamoDBHelper.getStaffByEmail(email, req.correlationId);
    
    if (!staffResult.found || !staffResult.staff) {
      logger.warn('Password reset request for non-existent email', {
        correlationId: req.correlationId,
        email,
      });
      // Always return success to prevent email enumeration
      // but don't actually send an email
      res.status(200).json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const staff = staffResult.staff;

    // Check if account is enabled
    if (!staff.enabled) {
      logger.warn('Password reset request for disabled account', {
        correlationId: req.correlationId,
        email,
        staffId: staff.staff_id,
      });
      // Still return success to prevent account enumeration
      res.status(200).json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Generate secure reset token (32 bytes = 256 bits)
    const resetToken = randomBytes(32).toString('hex');
    
    // Hash the token for storage (SHA-256)
    const tokenHash = createHash('sha256').update(resetToken).digest('hex');
    
    // Set expiration time (30 minutes from now)
    const expiresAt = Math.floor(Date.now() / 1000) + (30 * 60); // 30 minutes

    // Store the hashed token in DynamoDB
    const tokenResult = await dynamoDBHelper.createPasswordResetToken(
      {
        token_hash: tokenHash,
        staff_id: staff.staff_id,
        expires_at: expiresAt,
      },
      req.correlationId
    );

    if (!tokenResult.success) {
      logger.error('Failed to create password reset token', {
        correlationId: req.correlationId,
        staffId: staff.staff_id,
        error: tokenResult.error,
      });
      sendError(res, 'InternalError', 'Failed to generate reset token', req.correlationId);
      return;
    }

    // Send password reset email
    try {
      await sesHelper.sendPasswordResetEmail(
        staff.email,
        staff.email.split('@')[0] || 'User', // Use email prefix as name fallback
        resetToken, // Send the plain token, not the hash
        req.correlationId
      );

      logger.info('Password reset email sent successfully', {
        correlationId: req.correlationId,
        staffId: staff.staff_id,
        email: staff.email,
        tokenHash, // Log the hash, not the plain token
      });

    } catch (emailError) {
      logger.error('Failed to send password reset email', {
        correlationId: req.correlationId,
        staffId: staff.staff_id,
        email: staff.email,
        error: emailError instanceof Error ? emailError.message : 'Unknown error',
      });

      // Clean up the token since email failed
      try {
        await dynamoDBHelper.deletePasswordResetToken(tokenHash, req.correlationId);
      } catch (cleanupError) {
        logger.error('Failed to cleanup password reset token after email failure', {
          correlationId: req.correlationId,
          tokenHash,
          error: cleanupError instanceof Error ? cleanupError.message : 'Unknown error',
        });
      }

      sendError(res, 'InternalError', 'Failed to send reset email', req.correlationId);
      return;
    }

    // Return success response
    res.status(200).json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Password reset request handler error', {
      correlationId: req.correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    sendError(res, 'InternalError', 'Password reset request failed', req.correlationId);
  }
};