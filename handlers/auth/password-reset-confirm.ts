// POST /auth/password-reset/confirm handler with token validation and password update
import type { RouteHandler } from '../../lib/types.js';
import { dynamoDBHelper } from '../../lib/dynamodb.js';
import { hashPassword, validatePasswordStrength } from '../../lib/password.js';
import { logger } from '../../lib/logging.js';
import { sendError } from '../../lib/response.js';
import { PasswordResetConfirmSchema } from '../../lib/data-models.js';
import { createHash } from 'crypto';

export const passwordResetConfirmHandler: RouteHandler = async (req, res) => {
  try {
    logger.info('Processing password reset confirmation', {
      correlationId: req.correlationId,
    });

    // Validate request body
    const validation = PasswordResetConfirmSchema.safeParse(req.body);
    if (!validation.success) {
      logger.warn('Password reset confirmation validation failed', {
        correlationId: req.correlationId,
        errors: validation.error.errors,
      });
      sendError(
        res,
        'ValidationError',
        'Invalid reset token or password format',
        req.correlationId,
        { validationErrors: validation.error.errors }
      );
      return;
    }

    const { token, new_password } = validation.data;

    // Validate password strength
    const passwordValidation = validatePasswordStrength(new_password);
    if (!passwordValidation.isValid) {
      logger.warn('Password reset confirmation with weak password', {
        correlationId: req.correlationId,
        errors: passwordValidation.errors,
      });
      sendError(
        res,
        'ValidationError',
        'Password does not meet security requirements',
        req.correlationId,
        { passwordErrors: passwordValidation.errors }
      );
      return;
    }

    // Hash the token to look it up
    const tokenHash = createHash('sha256').update(token).digest('hex');

    // Get the password reset token
    const tokenResult = await dynamoDBHelper.getPasswordResetToken(tokenHash, req.correlationId);
    
    if (!tokenResult.found || !tokenResult.token) {
      logger.warn('Password reset confirmation with invalid token', {
        correlationId: req.correlationId,
        tokenHash,
      });
      sendError(
        res,
        'Unauthorized',
        'Invalid or expired reset token',
        req.correlationId
      );
      return;
    }

    const resetToken = tokenResult.token;

    // Check if token is expired
    if (tokenResult.expired) {
      logger.warn('Password reset confirmation with expired token', {
        correlationId: req.correlationId,
        tokenHash,
        expiresAt: new Date(resetToken.expires_at * 1000).toISOString(),
      });
      sendError(
        res,
        'Unauthorized',
        'Reset token has expired',
        req.correlationId
      );
      return;
    }

    // Check if token has already been used
    if (resetToken.used_at) {
      logger.warn('Password reset confirmation with already used token', {
        correlationId: req.correlationId,
        tokenHash,
        usedAt: resetToken.used_at,
      });
      sendError(
        res,
        'Unauthorized',
        'Reset token has already been used',
        req.correlationId
      );
      return;
    }

    // Get the staff member
    const staffResult = await dynamoDBHelper.getStaffById(resetToken.staff_id, req.correlationId);
    
    if (!staffResult.found || !staffResult.staff) {
      logger.error('Password reset token references non-existent staff member', {
        correlationId: req.correlationId,
        staffId: resetToken.staff_id,
        tokenHash,
      });
      sendError(
        res,
        'InternalError',
        'Invalid reset token',
        req.correlationId
      );
      return;
    }

    const staff = staffResult.staff;

    // Check if account is still enabled
    if (!staff.enabled) {
      logger.warn('Password reset confirmation for disabled account', {
        correlationId: req.correlationId,
        staffId: staff.staff_id,
        email: staff.email,
      });
      sendError(
        res,
        'Unauthorized',
        'Account is disabled',
        req.correlationId
      );
      return;
    }

    // Hash the new password
    const newPasswordHash = await hashPassword(new_password, req.correlationId);

    // Update the staff member's password
    const updateResult = await dynamoDBHelper.updateStaffPassword(
      staff.staff_id,
      newPasswordHash,
      req.correlationId
    );

    if (!updateResult.success) {
      logger.error('Failed to update staff password', {
        correlationId: req.correlationId,
        staffId: staff.staff_id,
        error: updateResult.error,
      });
      sendError(res, 'InternalError', 'Failed to update password', req.correlationId);
      return;
    }

    // Mark the token as used
    try {
      await dynamoDBHelper.markPasswordResetTokenUsed(tokenHash, req.correlationId);
    } catch (tokenUpdateError) {
      // Log the error but don't fail the request since password was already updated
      logger.error('Failed to mark password reset token as used', {
        correlationId: req.correlationId,
        tokenHash,
        error: tokenUpdateError instanceof Error ? tokenUpdateError.message : 'Unknown error',
      });
    }

    logger.info('Password reset completed successfully', {
      correlationId: req.correlationId,
      staffId: staff.staff_id,
      email: staff.email,
    });

    // Return success response
    res.status(200).json({
      success: true,
      message: 'Password has been reset successfully',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Password reset confirmation handler error', {
      correlationId: req.correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    sendError(res, 'InternalError', 'Password reset confirmation failed', req.correlationId);
  }
};