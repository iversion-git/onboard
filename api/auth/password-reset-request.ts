/**
 * POST /auth/password-reset/request - Request password reset
 * Generates secure token and sends reset email via SES
 */

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { z } from 'zod';
import { parseRequestBody, buildResponse, buildErrorResponse, getCorrelationId } from '../../layers/shared-core/src/http.js';
import { createError, errorToResponse } from '../../layers/shared-core/src/errors.js';
import { StaffRepository } from '../../layers/shared-core/src/models/staff.js';
import { PasswordResetTokenRepository } from '../../layers/shared-core/src/models/password-reset-tokens.js';
import { SESHelpers } from '../../layers/shared-core/src/aws/ses.js';
import { createLoggerFromCorrelationId } from '../../layers/shared-core/src/logging.js';

// Request validation schema
const PasswordResetRequestSchema = z.object({
  email: z.string().email().toLowerCase()
});

type PasswordResetRequest = z.infer<typeof PasswordResetRequestSchema>;

// Response schema
interface PasswordResetResponse {
  message: string;
}

/**
 * Lambda handler for password reset request
 */
export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  const correlationId = getCorrelationId(event);
  const logger = createLoggerFromCorrelationId('auth-password-reset-request', correlationId);

  try {
    logger.info('Processing password reset request');

    // Parse and validate request body
    const { email } = parseRequestBody(event, PasswordResetRequestSchema);

    // Find staff by email
    const staff = await StaffRepository.findByEmail(email);
    if (!staff) {
      // For security, don't reveal whether email exists
      // Always return success to prevent email enumeration
      logger.warn('Password reset requested for non-existent email', { email });
      
      const response: PasswordResetResponse = {
        message: 'If an account with that email exists, a password reset link has been sent.'
      };
      
      return buildResponse(response, 200);
    }

    // Check if account is enabled
    if (!staff.enabled) {
      logger.warn('Password reset requested for disabled account', { 
        staff_id: staff.staff_id, 
        email 
      });
      
      // For security, don't reveal account status
      const response: PasswordResetResponse = {
        message: 'If an account with that email exists, a password reset link has been sent.'
      };
      
      return buildResponse(response, 200);
    }

    // Generate password reset token
    const tokenData = await PasswordResetTokenRepository.create(staff.staff_id);

    // Send password reset email
    try {
      await SESHelpers.sendPasswordResetEmail(
        staff.email,
        tokenData.token,
        staff.email.split('@')[0] // Use email prefix as name fallback
      );

      logger.info('Password reset email sent successfully', { 
        staff_id: staff.staff_id, 
        email,
        expires_at: tokenData.expires_at
      });
    } catch (emailError) {
      logger.error('Failed to send password reset email', { 
        staff_id: staff.staff_id, 
        email,
        error: emailError 
      });
      
      // Don't expose email sending failures to client
      // The token was created, so we could potentially retry
      throw createError('InternalError', 'Unable to send password reset email');
    }

    const response: PasswordResetResponse = {
      message: 'If an account with that email exists, a password reset link has been sent.'
    };

    return buildResponse(response, 200);

  } catch (error) {
    logger.error('Password reset request failed', { error });
    
    const errorResponse = errorToResponse(error, correlationId);
    const statusCode = error instanceof Error && 'statusCode' in error 
      ? (error as any).statusCode 
      : 500;
    
    return buildErrorResponse(errorResponse, statusCode);
  }
};