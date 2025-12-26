// POST /staff/enable handler with admin authorization
import type { RouteHandler } from '../../lib/types.js';
import { dynamoDBHelper } from '../../lib/dynamodb.js';
import { logger } from '../../lib/logging.js';
import { sendError } from '../../lib/response.js';
import { z } from 'zod';

// Schema for staff enable request
const EnableStaffSchema = z.object({
  staff_id: z.string().uuid(),
});

export const enableHandler: RouteHandler = async (req, res) => {
  try {
    logger.info('Processing staff enable request', {
      correlationId: req.correlationId,
      requestedBy: req.context.staff_id,
      requestedByEmail: req.context.email,
    });

    // Validate request body
    const validation = EnableStaffSchema.safeParse(req.body);
    if (!validation.success) {
      logger.warn('Staff enable validation failed', {
        correlationId: req.correlationId,
        errors: validation.error.errors,
      });
      sendError(
        res,
        'ValidationError',
        'Invalid staff enable request',
        req.correlationId,
        { validationErrors: validation.error.errors }
      );
      return;
    }

    const { staff_id } = validation.data;

    // Check if staff member exists
    const staffResult = await dynamoDBHelper.getStaffById(staff_id, req.correlationId);
    
    if (!staffResult.found || !staffResult.staff) {
      logger.warn('Staff enable attempt for non-existent staff', {
        correlationId: req.correlationId,
        staffId: staff_id,
      });
      sendError(
        res,
        'NotFound',
        'Staff member not found',
        req.correlationId
      );
      return;
    }

    // Check if already enabled
    if (staffResult.staff.enabled) {
      logger.info('Staff member already enabled', {
        correlationId: req.correlationId,
        staffId: staff_id,
        email: staffResult.staff.email,
      });
      
      // Return current state
      res.status(200).json({
        success: true,
        data: {
          staff_id: staffResult.staff.staff_id,
          email: staffResult.staff.email,
          roles: staffResult.staff.roles,
          enabled: staffResult.staff.enabled,
          updated_at: staffResult.staff.updated_at,
        },
        message: 'Staff member is already enabled',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Update staff to enabled
    const updateResult = await dynamoDBHelper.updateStaff(
      staff_id,
      { enabled: true },
      req.correlationId
    );

    if (!updateResult.success) {
      logger.error('Failed to enable staff member', {
        correlationId: req.correlationId,
        staffId: staff_id,
        error: updateResult.error,
      });
      sendError(
        res,
        'InternalError',
        'Failed to enable staff member',
        req.correlationId
      );
      return;
    }

    logger.info('Staff member enabled successfully', {
      correlationId: req.correlationId,
      staffId: staff_id,
      email: updateResult.data?.email,
      enabledBy: req.context.staff_id,
    });

    // Return success response
    res.status(200).json({
      success: true,
      data: {
        staff_id: updateResult.data?.staff_id,
        email: updateResult.data?.email,
        roles: updateResult.data?.roles,
        enabled: updateResult.data?.enabled,
        updated_at: updateResult.data?.updated_at,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Staff enable handler error', {
      correlationId: req.correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    sendError(res, 'InternalError', 'Staff enable failed', req.correlationId);
  }
};