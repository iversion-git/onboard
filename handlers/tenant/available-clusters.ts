// GET /tenant/available-clusters handler - Get available clusters based on deployment type
import type { RouteHandler } from '../../lib/types.js';
import { dynamoDBHelper } from '../../lib/dynamodb.js';
import { logger } from '../../lib/logging.js';
import { sendError } from '../../lib/response.js';
import { z } from 'zod';

// Query parameters schema
const AvailableClustersQuerySchema = z.object({
  deployment_type: z.enum(['Shared', 'Dedicated']).describe('Deployment type to filter clusters'),
});

export const availableClustersHandler: RouteHandler = async (req, res) => {
  try {
    logger.info('Processing available clusters request', {
      correlationId: req.correlationId,
      requestedBy: req.context.staff_id,
      requestedByEmail: req.context.email,
      queryParams: req.query,
    });

    // Validate query parameters
    const validation = AvailableClustersQuerySchema.safeParse(req.query);
    if (!validation.success) {
      logger.warn('Available clusters query validation failed', {
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

    const { deployment_type } = validation.data;

    // Convert deployment type to cluster type format
    const clusterType = deployment_type.toLowerCase() as 'shared' | 'dedicated';

    // Get available clusters by type
    const clusters = await dynamoDBHelper.getClustersByType(clusterType, req.correlationId);

    logger.info('Available clusters retrieved successfully', {
      correlationId: req.correlationId,
      deploymentType: deployment_type,
      clusterCount: clusters.length,
      requestedBy: req.context.staff_id,
    });

    // Return success response with cluster information
    res.status(200).json({
      success: true,
      data: {
        deployment_type,
        available_clusters: clusters.map(cluster => ({
          cluster_id: cluster.cluster_id,
          name: cluster.name,
          type: cluster.type,
          environment: cluster.environment,
          region: cluster.region,
          status: cluster.status,
          created_at: cluster.created_at,
          deployed_at: cluster.deployed_at,
        })),
        total_count: clusters.length,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Available clusters handler error', {
      correlationId: req.correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    sendError(res, 'InternalError', 'Failed to retrieve available clusters', req.correlationId);
  }
};