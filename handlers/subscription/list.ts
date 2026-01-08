// GET /subscription/list handler with admin/manager authorization
import type { RouteHandler } from '../../lib/types.js';
import { dynamoDBHelper } from '../../lib/dynamodb.js';
import { logger } from '../../lib/logging.js';
import { sendError } from '../../lib/response.js';
import { z } from 'zod';

// Query parameter validation schema
const ListSubscriptionsQuerySchema = z.object({
  tenant_id: z.string().uuid().describe('Tenant ID to list subscriptions for'),
});

export const listSubscriptionsHandler: RouteHandler = async (req, res) => {
  try {
    logger.info('Processing subscription list request', {
      correlationId: req.correlationId,
      requestedBy: req.context.staff_id,
      requestedByEmail: req.context.email,
      requestedByRoles: req.context.roles,
    });

    // Validate query parameters
    const validation = ListSubscriptionsQuerySchema.safeParse(req.query);
    if (!validation.success) {
      logger.warn('Subscription list validation failed', {
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
      logger.warn('Invalid tenant_id provided for subscription list', {
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

    // Get all subscriptions for the tenant
    const subscriptions = await dynamoDBHelper.getSubscriptionsByTenant(tenant_id, req.correlationId);

    // Fetch subscription type and package names for all subscriptions
    const enrichedSubscriptions = await Promise.all(
      subscriptions.map(async (subscription) => {
        const [subscriptionTypeResult, packageResult] = await Promise.all([
          dynamoDBHelper.getSubscriptionType(subscription.subscription_type_id, req.correlationId),
          dynamoDBHelper.getPackage(subscription.package_id, req.correlationId)
        ]);

        return {
          subscription_id: subscription.subscription_id,
          subscription_name: subscription.subscription_name,
          subscription_type_level: subscription.subscription_type_level,
          tenant_url: subscription.tenant_url,
          tenant_api_url: subscription.tenant_api_url,
          domain_name: subscription.domain_name,
          number_of_stores: subscription.number_of_stores,
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
          created_at: subscription.created_at,
          updated_at: subscription.updated_at,
          deployed_at: subscription.deployed_at,
        };
      })
    );

    logger.info('Subscription list retrieved successfully', {
      correlationId: req.correlationId,
      tenant_id,
      subscriptionCount: subscriptions.length,
      requestedBy: req.context.staff_id,
    });

    // Return success response
    res.status(200).json({
      success: true,
      data: {
        tenant_id,
        tenant_name: tenantResult.tenant.business_name,
        subscriptions: enrichedSubscriptions,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Subscription list handler error', {
      correlationId: req.correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    sendError(res, 'InternalError', 'Failed to retrieve subscriptions', req.correlationId);
  }
};