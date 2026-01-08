// GET /subscription/:subscriptionId handler with admin/manager authorization
import type { RouteHandler } from '../../lib/types.js';
import { dynamoDBHelper } from '../../lib/dynamodb.js';
import { logger } from '../../lib/logging.js';
import { sendError } from '../../lib/response.js';

export const getSubscriptionHandler: RouteHandler = async (req, res) => {
  try {
    logger.info('Processing get subscription request', {
      correlationId: req.correlationId,
      requestedBy: req.context.staff_id,
      requestedByEmail: req.context.email,
      requestedByRoles: req.context.roles,
    });

    const subscriptionId = req.params?.['subscriptionId'];
    if (!subscriptionId) {
      logger.warn('Missing subscription ID in request', {
        correlationId: req.correlationId,
      });
      sendError(
        res,
        'ValidationError',
        'Subscription ID is required',
        req.correlationId
      );
      return;
    }

    // Get subscription by ID
    const subscriptionResult = await dynamoDBHelper.getSubscription(subscriptionId, req.correlationId);
    if (!subscriptionResult.found || !subscriptionResult.subscription) {
      logger.warn('Subscription not found', {
        correlationId: req.correlationId,
        subscriptionId,
      });
      sendError(
        res,
        'NotFound',
        'Subscription not found',
        req.correlationId
      );
      return;
    }

    const subscription = subscriptionResult.subscription;

    // Get tenant information for additional context
    const tenantResult = await dynamoDBHelper.getTenant(subscription.tenant_id, req.correlationId);
    
    // Fetch subscription type and package names
    const [subscriptionTypeResult, packageResult] = await Promise.all([
      dynamoDBHelper.getSubscriptionType(subscription.subscription_type_id, req.correlationId),
      dynamoDBHelper.getPackage(subscription.package_id, req.correlationId)
    ]);
    
    logger.info('Subscription retrieved successfully', {
      correlationId: req.correlationId,
      subscriptionId: subscription.subscription_id,
      tenant_id: subscription.tenant_id,
      subscription_type_level: subscription.subscription_type_level,
      requestedBy: req.context.staff_id,
    });

    // Return success response
    res.status(200).json({
      success: true,
      data: {
        subscription_id: subscription.subscription_id,
        tenant_id: subscription.tenant_id,
        tenant_name: tenantResult.found ? tenantResult.tenant?.business_name : undefined,
        subscription_name: subscription.subscription_name,
        subscription_type_level: subscription.subscription_type_level,
        tenant_url: subscription.tenant_url,
        tenant_api_url: subscription.tenant_api_url,
        domain_name: subscription.domain_name,
        region: subscription.region,
        deployment_type: subscription.deployment_type,
        subscription_type_id: subscription.subscription_type_id,
        subscription_type_name: subscriptionTypeResult.found ? subscriptionTypeResult.subscriptionType?.subscription_type_name : 'Unknown',
        package_id: subscription.package_id,
        package_name: packageResult.found ? packageResult.package?.package_name : 'Unknown',
        cluster_id: subscription.cluster_id,
        cluster_name: subscription.cluster_name,
        status: subscription.status,
        deployment_id: subscription.deployment_id,
        deployment_status: subscription.deployment_status,
        stack_outputs: subscription.stack_outputs,
        created_at: subscription.created_at,
        updated_at: subscription.updated_at,
        deployed_at: subscription.deployed_at,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Get subscription handler error', {
      correlationId: req.correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    sendError(res, 'InternalError', 'Failed to retrieve subscription', req.correlationId);
  }
};