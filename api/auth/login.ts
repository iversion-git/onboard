/**
 * POST /auth/login - Staff authentication endpoint
 * Validates credentials and returns JWT token
 */

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { z } from 'zod';
import { parseRequestBody, buildResponse, buildErrorResponse, getCorrelationId } from '../../layers/shared-core/src/http.js';
import { createError, errorToResponse } from '../../layers/shared-core/src/errors.js';
import { JWTAuth, PasswordAuth } from '../../layers/shared-core/src/auth.js';
import { StaffRepository } from '../../layers/shared-core/src/models/staff.js';
import { createLoggerFromCorrelationId } from '../../layers/shared-core/src/logging.js';

// Request validation schema
const LoginRequestSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1)
});

type LoginRequest = z.infer<typeof LoginRequestSchema>;

// Response schema
interface LoginResponse {
  token: string;
  staff: {
    staff_id: string;
    email: string;
    roles: string[];
  };
}

/**
 * Lambda handler for staff login
 */
export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  const correlationId = getCorrelationId(event);
  const logger = createLoggerFromCorrelationId('auth-login', correlationId);

  try {
    logger.info('Processing login request');

    // Parse and validate request body
    const { email, password } = parseRequestBody(event, LoginRequestSchema);

    // Find staff by email
    const staff = await StaffRepository.findByEmail(email);
    if (!staff) {
      logger.warn('Login attempt with non-existent email', { email });
      throw createError('Unauthorized', 'Invalid credentials');
    }

    // Check if account is enabled
    if (!staff.enabled) {
      logger.warn('Login attempt with disabled account', { 
        staff_id: staff.staff_id, 
        email 
      });
      throw createError('Unauthorized', 'Account is disabled');
    }

    // Verify password
    const isValidPassword = await PasswordAuth.verifyPassword(password, staff.password_hash);
    if (!isValidPassword) {
      logger.warn('Login attempt with invalid password', { 
        staff_id: staff.staff_id, 
        email 
      });
      throw createError('Unauthorized', 'Invalid credentials');
    }

    // Generate JWT token
    const token = await JWTAuth.signToken(staff.staff_id, staff.email, staff.roles);

    const response: LoginResponse = {
      token,
      staff: {
        staff_id: staff.staff_id,
        email: staff.email,
        roles: staff.roles
      }
    };

    logger.info('Login successful', { 
      staff_id: staff.staff_id, 
      email, 
      roles: staff.roles 
    });

    return buildResponse(response, 200);

  } catch (error) {
    logger.error('Login failed', { error });
    
    const errorResponse = errorToResponse(error, correlationId);
    const statusCode = error instanceof Error && 'statusCode' in error 
      ? (error as any).statusCode 
      : 500;
    
    return buildErrorResponse(errorResponse, statusCode);
  }
};