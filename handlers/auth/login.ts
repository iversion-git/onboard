// POST /auth/login handler with credential validation and JWT generation
import type { RouteHandler } from '../../lib/types.js';
import { dynamoDBHelper } from '../../lib/dynamodb.js';
import { verifyPassword } from '../../lib/password.js';
import { jwtHelper } from '../../lib/jwt.js';
import { logger } from '../../lib/logging.js';
import { sendError } from '../../lib/response.js';
import { LoginSchema } from '../../lib/data-models.js';

export const loginHandler: RouteHandler = async (req, res) => {
  try {
    logger.info('Processing login request', {
      correlationId: req.correlationId,
      email: req.body?.email,
    });

    // Validate request body
    const validation = LoginSchema.safeParse(req.body);
    if (!validation.success) {
      logger.warn('Login validation failed', {
        correlationId: req.correlationId,
        errors: validation.error.errors,
      });
      sendError(
        res,
        'ValidationError',
        'Invalid login credentials format',
        req.correlationId,
        { validationErrors: validation.error.errors }
      );
      return;
    }

    const { email, password } = validation.data;

    // Get staff member by email
    const staffResult = await dynamoDBHelper.getStaffByEmail(email, req.correlationId);
    
    if (!staffResult.found || !staffResult.staff) {
      logger.warn('Login attempt for non-existent email', {
        correlationId: req.correlationId,
        email,
      });
      // Use generic error message to prevent email enumeration
      sendError(
        res,
        'Unauthorized',
        'Invalid email or password',
        req.correlationId
      );
      return;
    }

    const staff = staffResult.staff;

    // Check if account is enabled
    if (!staff.enabled) {
      logger.warn('Login attempt for disabled account', {
        correlationId: req.correlationId,
        email,
        staffId: staff.staff_id,
      });
      sendError(
        res,
        'Unauthorized',
        'Account is disabled',
        req.correlationId
      );
      return;
    }

    // Verify password
    const isPasswordValid = await verifyPassword(
      password,
      staff.password_hash,
      req.correlationId
    );

    if (!isPasswordValid) {
      logger.warn('Login attempt with invalid password', {
        correlationId: req.correlationId,
        email,
        staffId: staff.staff_id,
      });
      sendError(
        res,
        'Unauthorized',
        'Invalid email or password',
        req.correlationId
      );
      return;
    }

    // Generate JWT token
    const token = await jwtHelper.signToken(
      {
        staffId: staff.staff_id,
        email: staff.email,
        roles: staff.roles,
      },
      req.correlationId
    );

    logger.info('Login successful', {
      correlationId: req.correlationId,
      staffId: staff.staff_id,
      email: staff.email,
      roles: staff.roles,
    });

    // Return success response with JWT token
    res.status(200).json({
      success: true,
      data: {
        token,
        staff: {
          staff_id: staff.staff_id,
          email: staff.email,
          roles: staff.roles,
          enabled: staff.enabled,
        },
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Login handler error', {
      correlationId: req.correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    sendError(res, 'InternalError', 'Login failed', req.correlationId);
  }
};