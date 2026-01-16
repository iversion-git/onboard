// GET /clusters handler with admin-only access for cluster listing with filters and search
import type { RouteHandler } from '../../lib/types.js';
import { dynamoDBHelper } from '../../lib/dynamodb.js';
import { logger } from '../../lib/logging.js';
import { sendError } from '../../lib/response.js';

export const listHandler: RouteHandler = async (req, res) => {
  try {
    logger.info('Processing cluster list request', {
      correlationId: req.correlationId,
      requestedBy: req.context.staff_id,
      queryParams: req.query,
    });

    // Extract query parameters for filtering and search
    const type = req.query?.['type'] as string | undefined;
    const environment = req.query?.['environment'] as string | undefined;
    const region = req.query?.['region'] as string | undefined;
    const status = req.query?.['status'] as string | undefined;
    const search = req.query?.['search'] as string | undefined;

    // Get all clusters from DynamoDB
    const allClusters = await dynamoDBHelper.getAllClusters(req.correlationId);

    // Apply filters
    let filteredClusters = allClusters;

    // Filter by type (shared/dedicated)
    if (type) {
      filteredClusters = filteredClusters.filter(
        cluster => cluster.type.toLowerCase() === type.toLowerCase()
      );
    }

    // Filter by environment (Production/Staging/Dev)
    if (environment) {
      filteredClusters = filteredClusters.filter(
        cluster => cluster.environment?.toLowerCase() === environment.toLowerCase()
      );
    }

    // Filter by region
    if (region) {
      filteredClusters = filteredClusters.filter(
        cluster => cluster.region.toLowerCase() === region.toLowerCase()
      );
    }

    // Filter by status
    if (status) {
      filteredClusters = filteredClusters.filter(
        cluster => cluster.status.toLowerCase() === status.toLowerCase()
      );
    }

    // Apply search across all text fields if provided
    if (search && search.trim()) {
      const searchLower = search.toLowerCase().trim();
      filteredClusters = filteredClusters.filter(cluster => {
        return (
          cluster.name.toLowerCase().includes(searchLower) ||
          cluster.type.toLowerCase().includes(searchLower) ||
          cluster.region.toLowerCase().includes(searchLower) ||
          cluster.cidr.toLowerCase().includes(searchLower) ||
          cluster.status.toLowerCase().includes(searchLower) ||
          (cluster.environment && cluster.environment.toLowerCase().includes(searchLower))
        );
      });
    }

    logger.info('Cluster list retrieved successfully', {
      correlationId: req.correlationId,
      totalClusters: allClusters.length,
      filteredCount: filteredClusters.length,
      filters: { type, environment, region, status, search },
    });

    // Return success response with cluster list
    res.status(200).json({
      success: true,
      data: {
        clusters: filteredClusters.map(cluster => ({
          cluster_id: cluster.cluster_id,
          name: cluster.name,
          type: cluster.type,
          environment: cluster.environment,
          region: cluster.region,
          cidr: cluster.cidr,
          status: cluster.status,
          deployment_status: cluster.deployment_status,
          deployment_id: cluster.deployment_id,
          created_at: cluster.created_at,
          updated_at: cluster.updated_at,
          deployed_at: cluster.deployed_at,
        })),
        count: filteredClusters.length,
        filters: {
          type: type || null,
          environment: environment || null,
          region: region || null,
          status: status || null,
          search: search || null,
        },
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Cluster list handler error', {
      correlationId: req.correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    sendError(res, 'InternalError', 'Failed to retrieve cluster list', req.correlationId);
  }
};