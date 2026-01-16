// GET /subscription/list handler - List all subscriptions with optional filtering and search
import type { RouteHandler } from '../../lib/types.js';
import { dynamoDBHelper } from '../../lib/dynamodb.js';
import { logger } from '../../lib/logging.js';
import { sendError } from '../../lib/response.js';

export const listSubscriptionsHandler: RouteHandler = async (req, res) => {
  try {
    logger.info('Processing list all subscriptions request', {
      correlationId: req.correlationId,
      requestedBy: req.context.staff_id,
      queryParams: req.query,
    });

    // Extract query parameters for filtering and search
    const tenantId = req.query?.['tenant_id'] as string | undefined;
    const subscriptionTypeLevel = req.query?.['subscription_type_level'] as string | undefined;
    const region = req.query?.['region'] as string | undefined;
    const packageId = req.query?.['package_id'] as string | undefined;
    const subscriptionTypeId = req.query?.['subscription_type_id'] as string | undefined;
    const status = req.query?.['status'] as string | undefined;
    const search = req.query?.['search'] as string | undefined;

    // Get all subscriptions
    const allSubscriptions = await dynamoDBHelper.listAllSubscriptions(req.correlationId);

    // Apply filters
    let filteredSubscriptions = allSubscriptions;

    // Filter by tenant ID
    if (tenantId) {
      filteredSubscriptions = filteredSubscriptions.filter(
        sub => sub.tenant_id === tenantId
      );
    }

    // Filter by subscription type level (Production/Dev)
    if (subscriptionTypeLevel) {
      filteredSubscriptions = filteredSubscriptions.filter(
        sub => sub.subscription_type_level.toLowerCase() === subscriptionTypeLevel.toLowerCase()
      );
    }

    // Filter by region
    if (region) {
      filteredSubscriptions = filteredSubscriptions.filter(
        sub => sub.region.toLowerCase() === region.toLowerCase()
      );
    }

    // Filter by package ID
    if (packageId) {
      const packageIdNum = parseInt(packageId, 10);
      if (!isNaN(packageIdNum)) {
        filteredSubscriptions = filteredSubscriptions.filter(
          sub => sub.package_id === packageIdNum
        );
      }
    }

    // Filter by subscription type ID
    if (subscriptionTypeId) {
      const subscriptionTypeIdNum = parseInt(subscriptionTypeId, 10);
      if (!isNaN(subscriptionTypeIdNum)) {
        filteredSubscriptions = filteredSubscriptions.filter(
          sub => sub.subscription_type_id === subscriptionTypeIdNum
        );
      }
    }

    // Filter by status
    if (status) {
      filteredSubscriptions = filteredSubscriptions.filter(
        sub => sub.status.toLowerCase() === status.toLowerCase()
      );
    }

    // Apply search across all text fields if provided
    if (search && search.trim()) {
      const searchLower = search.toLowerCase().trim();
      filteredSubscriptions = filteredSubscriptions.filter(sub => {
        return (
          sub.subscription_name.toLowerCase().includes(searchLower) ||
          sub.tenant_url.toLowerCase().includes(searchLower) ||
          sub.tenant_api_url.toLowerCase().includes(searchLower) ||
          sub.domain_name.toLowerCase().includes(searchLower) ||
          sub.region.toLowerCase().includes(searchLower) ||
          sub.deployment_type.toLowerCase().includes(searchLower) ||
          sub.cluster_name.toLowerCase().includes(searchLower) ||
          sub.status.toLowerCase().includes(searchLower) ||
          sub.subscription_type_level.toLowerCase().includes(searchLower)
        );
      });
    }

    // Enrich subscriptions with subscription type and package names
    const enrichedSubscriptions = await Promise.all(
      filteredSubscriptions.map(async (subscription) => {
        const [subscriptionTypeResult, packageResult, tenantResult] = await Promise.all([
          dynamoDBHelper.getSubscriptionType(subscription.subscription_type_id, req.correlationId),
          dynamoDBHelper.getPackage(subscription.package_id, req.correlationId),
          dynamoDBHelper.getTenant(subscription.tenant_id, req.correlationId)
        ]);

        return {
          subscription_id: subscription.subscription_id,
          tenant_id: subscription.tenant_id,
          tenant_name: tenantResult.found ? tenantResult.tenant?.business_name : 'Unknown',
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
          created_at: subscription.created_at,
          updated_at: subscription.updated_at,
          deployed_at: subscription.deployed_at,
        };
      })
    );

    logger.info('Subscriptions list retrieved successfully', {
      correlationId: req.correlationId,
      totalSubscriptions: allSubscriptions.length,
      filteredCount: enrichedSubscriptions.length,
      filters: { tenantId, subscriptionTypeLevel, region, packageId, subscriptionTypeId, status, search },
    });

    res.status(200).json({
      success: true,
      data: {
        subscriptions: enrichedSubscriptions,
        count: enrichedSubscriptions.length,
        filters: {
          tenant_id: tenantId || null,
          subscription_type_level: subscriptionTypeLevel || null,
          region: region || null,
          package_id: packageId || null,
          subscription_type_id: subscriptionTypeId || null,
          status: status || null,
          search: search || null,
        },
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('List subscriptions handler error', {
      correlationId: req.correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    sendError(res, 'InternalError', 'Failed to retrieve subscriptions list', req.correlationId);
  }
};
