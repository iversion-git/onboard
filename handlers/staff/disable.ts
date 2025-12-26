// POST /staff/disable handler with admin authorization
import type { RouteHandler } from '../../lib/types.js';
import { dynamoDBHelper } from '../../lib/dynamodb.js';
import { logger } from '../../lib/logging.js';
import { sendError } from '../../lib/response.js';
import { z } from 'zod';

// Schema for staff disable request
const DisableStaffSchema = z.object({
  staff_id: z.string().uuid(),
});

export const disableHandler: RouteHandler = async (req, res) => {
  try {
    logger.info('Processing staff disable request', {
      correlationId: req.correlationId,
      requestedBy: req.context.staff_id,
      requestedByEmail: req.context.email,
    });

    // Validate request body
    const validation = DisableStaffSchema.safeParse(req.body);
    if (!validation.success) {
      logger.warn('Staff disable validation failed', {
        correlationId: req.correlationId,
        errors: validation.error.errors,
      });
      sendError(
        res,
        'ValidationError',
        'Invalid staff disable request',
        req.correlationId,
        { validationErrors: validation.error.errors }
      );
      return;
    }

    const { staff_id } = validation.data;

    // Prevent self-disable
    if (staff_id === req.context.staff_id) {
      logger.warn('Staff member attempted to disable themselves', {
        correlationId: req.correlationId,
        staffId: staff_id,
      });
      sendError(
        res,
        'Forbidden',
        'Cannot disable your own account',
        req.correlationId
      );
      return;
    }

    // Check if staff member exists
    const staffResult = await dynamoDBHelper.getStaffById(staff_id, req.correlationId);
    
    if (!staffResult.found || !staffResult.staff) {
      logger.warn('Staff disable attempt for non-existent staff', {
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

    // Check if already disabled
    if (!staffResult.staff.enabled) {
      logger.info('Staff member already disabled', {
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
        message: 'Staff member is already disabled',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Update staff to disabled
    const updateResult = await dynamoDBHelper.updateStaff(
      staff_id,
      { enabled: false },
      req.correlationId
    );

    if (!updateResult.success) {
      logger.error('Failed to disable staff member', {
        correlationId: req.correlationId,
        staffId: staff_id,
        error: updateResult.error,
      });
      sendError(
        res,
        'InternalError',
        'Failed to disable staff member',
        req.correlationId
      );
      return;
    }

    logger.info('Staff member disabled successfully', {
      correlationId: req.correlationId,
      staffId: staff_id,
      email: updateResult.data?.email,
      disabledBy: req.context.staff_id,
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
    logger.error('Staff disable handler error', {
      correlationId: req.correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    sendError(res, 'InternalError', 'Staff disable failed', req.correlationId);
  }
};