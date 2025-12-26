// GET /staff/me handler with authenticated profile retrieval
import type { RouteHandler } from '../../lib/types.js';
import { dynamoDBHelper } from '../../lib/dynamodb.js';
import { logger } from '../../lib/logging.js';
import { sendError } from '../../lib/response.js';

export const meHandler: RouteHandler = async (req, res) => {
  try {
    logger.info('Processing staff profile request', {
      correlationId: req.correlationId,
      staffId: req.context.staff_id,
      email: req.context.email,
    });

    // Get staff_id from authenticated context
    const staffId = req.context.staff_id;
    
    if (!staffId) {
      logger.error('Staff profile request without staff_id in context', {
        correlationId: req.correlationId,
        context: req.context,
      });
      sendError(
        res,
        'Unauthorized',
        'Invalid authentication context',
        req.correlationId
      );
      return;
    }

    // Get staff member details from database
    const staffResult = await dynamoDBHelper.getStaffById(staffId, req.correlationId);
    
    if (!staffResult.found || !staffResult.staff) {
      logger.warn('Staff profile request for non-existent staff', {
        correlationId: req.correlationId,
        staffId,
      });
      sendError(
        res,
        'NotFound',
        'Staff member not found',
        req.correlationId
      );
      return;
    }

    const staff = staffResult.staff;

    // Check if account is still enabled
    if (!staff.enabled) {
      logger.warn('Staff profile request for disabled account', {
        correlationId: req.correlationId,
        staffId,
        email: staff.email,
      });
      sendError(
        res,
        'Forbidden',
        'Account is disabled',
        req.correlationId
      );
      return;
    }

    logger.info('Staff profile retrieved successfully', {
      correlationId: req.correlationId,
      staffId,
      email: staff.email,
      roles: staff.roles,
    });

    // Return profile information (excluding sensitive data)
    res.status(200).json({
      success: true,
      data: {
        staff_id: staff.staff_id,
        email: staff.email,
        roles: staff.roles,
        enabled: staff.enabled,
        created_at: staff.created_at,
        updated_at: staff.updated_at,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Staff profile handler error', {
      correlationId: req.correlationId,
      staffId: req.context.staff_id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    sendError(res, 'InternalError', 'Failed to retrieve profile', req.correlationId);
  }
};