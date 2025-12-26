// POST /staff/register handler with admin-only access and account creation
import type { RouteHandler } from '../../lib/types.js';
import { dynamoDBHelper } from '../../lib/dynamodb.js';
import { passwordHelper } from '../../lib/password.js';
import { logger } from '../../lib/logging.js';
import { sendError } from '../../lib/response.js';
import { CreateStaffSchema } from '../../lib/data-models.js';

export const registerHandler: RouteHandler = async (req, res) => {
  try {
    logger.info('Processing staff registration request', {
      correlationId: req.correlationId,
      requestedBy: req.context.staff_id,
      requestedByEmail: req.context.email,
    });

    // Validate request body
    const validation = CreateStaffSchema.safeParse(req.body);
    if (!validation.success) {
      logger.warn('Staff registration validation failed', {
        correlationId: req.correlationId,
        errors: validation.error.errors,
      });
      sendError(
        res,
        'ValidationError',
        'Invalid staff registration data',
        req.correlationId,
        { validationErrors: validation.error.errors }
      );
      return;
    }

    const { email, password, roles } = validation.data;

    // Hash the password
    const passwordHash = await passwordHelper.hashPassword(password, req.correlationId);

    // Create staff record
    const staffData = {
      email,
      password_hash: passwordHash,
      roles,
      enabled: true, // New staff accounts are enabled by default
    };

    const result = await dynamoDBHelper.createStaff(staffData, req.correlationId);

    if (!result.success) {
      logger.warn('Staff registration failed', {
        correlationId: req.correlationId,
        email,
        error: result.error,
      });
      
      if (result.error?.includes('already exists')) {
        sendError(
          res,
          'Conflict',
          'Staff member with this email already exists',
          req.correlationId
        );
      } else {
        sendError(
          res,
          'InternalError',
          'Failed to create staff account',
          req.correlationId
        );
      }
      return;
    }

    logger.info('Staff registration successful', {
      correlationId: req.correlationId,
      staffId: result.data?.staff_id,
      email: result.data?.email,
      roles: result.data?.roles,
      createdBy: req.context.staff_id,
    });

    // Return success response without password hash
    res.status(201).json({
      success: true,
      data: {
        staff_id: result.data?.staff_id,
        email: result.data?.email,
        roles: result.data?.roles,
        enabled: result.data?.enabled,
        created_at: result.data?.created_at,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Staff registration handler error', {
      correlationId: req.correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    sendError(res, 'InternalError', 'Staff registration failed', req.correlationId);
  }
};