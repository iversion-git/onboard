// GET /staff/list handler - List all staff members for grid display
import type { RouteHandler } from '../../lib/types.js';
import { dynamoDBHelper } from '../../lib/dynamodb.js';
import { logger } from '../../lib/logging.js';
import { sendError } from '../../lib/response.js';

export const listStaffHandler: RouteHandler = async (req, res) => {
  try {
    logger.info('Processing list staff request', {
      correlationId: req.correlationId,
      requestedBy: req.context.staff_id,
    });

    // Get all staff members
    const staffList = await dynamoDBHelper.listAllStaff(req.correlationId);

    // Format response for grid display
    const formattedStaff = staffList.map(staff => ({
      staff_id: staff.staff_id,
      full_name: staff.email.split('@')[0], // Extract name from email (you can enhance this later)
      email: staff.email,
      roles: staff.roles,
      enabled: staff.enabled,
      last_login: staff.last_login || null,
      created_at: staff.created_at,
    }));

    logger.info('Staff list retrieved successfully', {
      correlationId: req.correlationId,
      count: formattedStaff.length,
    });

    res.status(200).json({
      success: true,
      data: {
        staff: formattedStaff,
        count: formattedStaff.length,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('List staff handler error', {
      correlationId: req.correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    sendError(res, 'InternalError', 'Failed to retrieve staff list', req.correlationId);
  }
};
