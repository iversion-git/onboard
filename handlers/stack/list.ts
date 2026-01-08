// GET /stack/list handler with admin/manager authorization
import type { RouteHandler } from '../../lib/types.js';
import { dynamoDBHelper } from '../../lib/dynamodb.js';
import { logger } from '../../lib/logging.js';
import { sendError } from '../../lib/response.js';
import { z } from 'zod';

// Query parameter validation schema
const ListStacksQuerySchema = z.object({
  tenant_id: z.string().uuid().describe('Tenant ID to list stacks for'),
});

export const listStacksHandler: RouteHandler = async (req, res) => {
  try {
    logger.info('Processing stack list request', {
      correlationId: req.correlationId,
      requestedBy: req.context.staff_id,
      requestedByEmail: req.context.email,
      requestedByRoles: req.context.roles,
    });

    // Validate query parameters
    const validation = ListStacksQuerySchema.safeParse(req.query);
    if (!validation.success) {
      logger.warn('Stack list validation failed', {
        correlationId: req.correlationId,
        errors: validation.error.issues,
      });
      sendError(
        res,
        'ValidationError',
        'Invalid query parameters',
        req.correlationId,
        { validationErrors: validation.error.issues }
      );
      return;
    }

    const { tenant_id } = validation.data;

    // Validate tenant exists
    const tenantResult = await dynamoDBHelper.getTenant(tenant_id, req.correlationId);
    if (!tenantResult.found || !tenantResult.tenant) {
      logger.warn('Invalid tenant_id provided for stack list', {
        correlationId: req.correlationId,
        tenant_id,
      });
      sendError(
        res,
        'ValidationError',
        'Invalid tenant ID provided',
        req.correlationId
      );
      return;
    }

    // Get all stacks for the tenant
    const stacks = await dynamoDBHelper.getStacksByTenant(tenant_id, req.correlationId);

    logger.info('Stack list retrieved successfully', {
      correlationId: req.correlationId,
      tenant_id,
      stackCount: stacks.length,
      requestedBy: req.context.staff_id,
    });

    // Return success response
    res.status(200).json({
      success: true,
      data: {
        tenant_id,
        tenant_name: tenantResult.tenant.business_name,
        stacks: stacks.map(stack => ({
          stack_id: stack.stack_id,
          stack_name: stack.stack_name,
          stack_type: stack.stack_type,
          tenant_url: stack.tenant_url,
          tenant_api_url: stack.tenant_api_url,
          region: stack.region,
          deployment_type: stack.deployment_type,
          subscription_type: stack.subscription_type,
          package_name: stack.package_name,
          cluster_id: stack.cluster_id,
          cluster_name: stack.cluster_name,
          status: stack.status,
          deployment_id: stack.deployment_id,
          deployment_status: stack.deployment_status,
          created_at: stack.created_at,
          updated_at: stack.updated_at,
          deployed_at: stack.deployed_at,
        })),
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Stack list handler error', {
      correlationId: req.correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    sendError(res, 'InternalError', 'Failed to retrieve stacks', req.correlationId);
  }
};