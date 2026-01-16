// GET /tenant/:tenantId handler - Get single tenant details
import type { RouteHandler } from '../../lib/types.js';
import { dynamoDBHelper } from '../../lib/dynamodb.js';
import { logger } from '../../lib/logging.js';
import { sendError } from '../../lib/response.js';

export const getTenantHandler: RouteHandler = async (req, res) => {
  try {
    const tenantId = req.params?.tenantId;

    if (!tenantId) {
      sendError(res, 'ValidationError', 'Tenant ID is required', req.correlationId);
      return;
    }

    logger.info('Processing get tenant request', {
      correlationId: req.correlationId,
      requestedBy: req.context.staff_id,
      tenantId,
    });

    // Get tenant by ID
    const result = await dynamoDBHelper.getTenant(tenantId, req.correlationId);

    if (!result.found || !result.tenant) {
      logger.warn('Tenant not found', {
        correlationId: req.correlationId,
        tenantId,
      });
      sendError(res, 'NotFound', 'Tenant not found', req.correlationId);
      return;
    }

    logger.info('Tenant retrieved successfully', {
      correlationId: req.correlationId,
      tenantId,
    });

    res.status(200).json({
      success: true,
      data: result.tenant,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Get tenant handler error', {
      correlationId: req.correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    sendError(res, 'InternalError', 'Failed to retrieve tenant', req.correlationId);
  }
};
