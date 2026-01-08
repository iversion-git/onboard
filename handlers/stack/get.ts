// GET /stack/:stackId handler with admin/manager authorization
import type { RouteHandler } from '../../lib/types.js';
import { dynamoDBHelper } from '../../lib/dynamodb.js';
import { logger } from '../../lib/logging.js';
import { sendError } from '../../lib/response.js';

export const getStackHandler: RouteHandler = async (req, res) => {
  try {
    logger.info('Processing get stack request', {
      correlationId: req.correlationId,
      requestedBy: req.context.staff_id,
      requestedByEmail: req.context.email,
      requestedByRoles: req.context.roles,
    });

    const stackId = req.params?.['stackId'];
    if (!stackId) {
      logger.warn('Missing stack ID in request', {
        correlationId: req.correlationId,
      });
      sendError(
        res,
        'ValidationError',
        'Stack ID is required',
        req.correlationId
      );
      return;
    }

    // Get stack by ID
    const stackResult = await dynamoDBHelper.getStack(stackId, req.correlationId);
    if (!stackResult.found || !stackResult.stack) {
      logger.warn('Stack not found', {
        correlationId: req.correlationId,
        stackId,
      });
      sendError(
        res,
        'NotFound',
        'Stack not found',
        req.correlationId
      );
      return;
    }

    const stack = stackResult.stack;

    // Get tenant information for additional context
    const tenantResult = await dynamoDBHelper.getTenant(stack.tenant_id, req.correlationId);
    
    logger.info('Stack retrieved successfully', {
      correlationId: req.correlationId,
      stackId: stack.stack_id,
      tenant_id: stack.tenant_id,
      stack_type: stack.stack_type,
      requestedBy: req.context.staff_id,
    });

    // Return success response
    res.status(200).json({
      success: true,
      data: {
        stack_id: stack.stack_id,
        tenant_id: stack.tenant_id,
        tenant_name: tenantResult.found ? tenantResult.tenant?.business_name : undefined,
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
        stack_outputs: stack.stack_outputs,
        created_at: stack.created_at,
        updated_at: stack.updated_at,
        deployed_at: stack.deployed_at,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Get stack handler error', {
      correlationId: req.correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    sendError(res, 'InternalError', 'Failed to retrieve stack', req.correlationId);
  }
};