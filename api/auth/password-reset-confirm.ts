/**
 * POST /auth/password-reset/confirm - Confirm password reset
 * Validates token and updates password
 */

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { z } from 'zod';
import { parseRequestBody, buildResponse, buildErrorResponse, getCorrelationId } from '../../layers/shared-core/src/http.js';
import { createError, errorToResponse } from '../../layers/shared-core/src/errors.js';
import { PasswordAuth } from '../../layers/shared-core/src/auth.js';
import { StaffRepository } from '../../layers/shared-core/src/models/staff.js';
import { PasswordResetTokenRepository } from '../../layers/shared-core/src/models/password-reset-tokens.js';
import { createLoggerFromCorrelationId } from '../../layers/shared-core/src/logging.js';

// Request validation schema
const PasswordResetConfirmSchema = z.object({
  token: z.string().min(1),
  new_password: z.string().min(8)
});

type PasswordResetConfirmRequest = z.infer<typeof PasswordResetConfirmSchema>;

// Response schema
interface PasswordResetConfirmResponse {
  message: string;
}

/**
 * Lambda handler for password reset confirmation
 */
export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  const correlationId = getCorrelationId(event);
  const logger = createLoggerFromCorrelationId('auth-password-reset-confirm', correlationId);

  try {
    logger.info('Processing password reset confirmation');

    // Parse and validate request body
    const requestData = parseRequestBody(event, PasswordResetConfirmSchema);
    const { token, new_password } = requestData;

    // Validate token format
    if (!PasswordResetTokenRepository.isValidTokenFormat(token)) {
      logger.warn('Invalid token format provided');
      throw createError('ValidationError', 'Invalid reset token format');
    }

    // Validate password strength
    const passwordValidation = PasswordAuth.validatePasswordStrength(new_password);
    if (!passwordValidation.isValid) {
      logger.warn('Weak password provided', { errors: passwordValidation.errors });
      throw createError('ValidationError', 'Password does not meet security requirements', {
        errors: passwordValidation.errors
      });
    }

    // Find and validate the reset token
    const tokenRecord = await PasswordResetTokenRepository.findByToken(token);
    if (!tokenRecord) {
      logger.warn('Invalid or expired reset token used');
      throw createError('ValidationError', 'Invalid or expired reset token');
    }

    // Verify staff still exists and is enabled
    const staff = await StaffRepository.findById(tokenRecord.staff_id);
    if (!staff) {
      logger.error('Staff not found for valid token', { 
        staff_id: tokenRecord.staff_id 
      });
      throw createError('ValidationError', 'Invalid reset token');
    }

    if (!staff.enabled) {
      logger.warn('Password reset attempted for disabled account', { 
        staff_id: staff.staff_id 
      });
      throw createError('ValidationError', 'Account is disabled');
    }

    // Hash the new password
    const newPasswordHash = await PasswordAuth.hashPassword(new_password);

    // Update the staff password
    await StaffRepository.update(staff.staff_id, {
      password_hash: newPasswordHash
    });

    // Consume the token (delete it to prevent reuse)
    const consumedStaffId = await PasswordResetTokenRepository.consumeToken(token);
    if (!consumedStaffId) {
      logger.error('Failed to consume reset token after password update', { 
        staff_id: staff.staff_id 
      });
      // Password was updated, but token wasn't consumed - log for investigation
      // Don't fail the request since password was successfully updated
    }

    logger.info('Password reset completed successfully', { 
      staff_id: staff.staff_id,
      email: staff.email
    });

    const response: PasswordResetConfirmResponse = {
      message: 'Password has been reset successfully'
    };

    return buildResponse(response, 200);

  } catch (error) {
    logger.error('Password reset confirmation failed', { error });
    
    const errorResponse = errorToResponse(error, correlationId);
    const statusCode = error instanceof Error && 'statusCode' in error 
      ? (error as any).statusCode 
      : 500;
    
    return buildErrorResponse(errorResponse, statusCode);
  }
};