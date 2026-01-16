// GET /tenant/list handler - List all tenants with optional filtering and search
import type { RouteHandler } from '../../lib/types.js';
import { dynamoDBHelper } from '../../lib/dynamodb.js';
import { logger } from '../../lib/logging.js';
import { sendError } from '../../lib/response.js';
import type { TenantRecord } from '../../lib/data-models.js';

export const listTenantsHandler: RouteHandler = async (req, res) => {
  try {
    logger.info('Processing list tenants request', {
      correlationId: req.correlationId,
      requestedBy: req.context.staff_id,
      queryParams: req.query,
    });

    // Extract query parameters for filtering and search
    const deploymentType = req.query?.deployment_type as string | undefined;
    const region = req.query?.region as string | undefined;
    const search = req.query?.search as string | undefined;

    // Get all tenants
    const allTenants = await dynamoDBHelper.listAllTenants(req.correlationId);

    // Apply filters
    let filteredTenants = allTenants;

    // Filter by deployment type if provided
    if (deploymentType) {
      const normalizedDeploymentType = deploymentType.charAt(0).toUpperCase() + deploymentType.slice(1).toLowerCase();
      filteredTenants = filteredTenants.filter(
        tenant => tenant.deployment_type === normalizedDeploymentType
      );
    }

    // Filter by region if provided
    if (region) {
      filteredTenants = filteredTenants.filter(
        tenant => tenant.region.toLowerCase() === region.toLowerCase()
      );
    }

    // Apply search across all text fields if provided
    if (search && search.trim()) {
      const searchLower = search.toLowerCase().trim();
      filteredTenants = filteredTenants.filter(tenant => {
        return (
          tenant.name.toLowerCase().includes(searchLower) ||
          tenant.email.toLowerCase().includes(searchLower) ||
          tenant.mobile_number.includes(searchLower) ||
          tenant.business_name.toLowerCase().includes(searchLower) ||
          tenant.tenant_url.toLowerCase().includes(searchLower) ||
          tenant.deployment_type.toLowerCase().includes(searchLower) ||
          tenant.region.toLowerCase().includes(searchLower) ||
          tenant.status.toLowerCase().includes(searchLower)
        );
      });
    }

    // Format response for grid display
    const formattedTenants = filteredTenants.map(tenant => ({
      tenant_id: tenant.tenant_id,
      name: tenant.name,
      email: tenant.email,
      mobile_number: tenant.mobile_number,
      business_name: tenant.business_name,
      deployment_type: tenant.deployment_type,
      region: tenant.region,
      tenant_url: tenant.tenant_url,
      status: tenant.status,
      created_at: tenant.created_at,
    }));

    logger.info('Tenants list retrieved successfully', {
      correlationId: req.correlationId,
      totalTenants: allTenants.length,
      filteredCount: formattedTenants.length,
      filters: { deploymentType, region, search },
    });

    res.status(200).json({
      success: true,
      data: {
        tenants: formattedTenants,
        count: formattedTenants.length,
        filters: {
          deployment_type: deploymentType || null,
          region: region || null,
          search: search || null,
        },
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('List tenants handler error', {
      correlationId: req.correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    sendError(res, 'InternalError', 'Failed to retrieve tenants list', req.correlationId);
  }
};
