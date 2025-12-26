// GET /clusters handler with admin-only access for cluster listing
import type { RouteHandler } from '../../lib/types.js';
import { dynamoDBHelper } from '../../lib/dynamodb.js';
import { logger } from '../../lib/logging.js';
import { sendError } from '../../lib/response.js';

export const listHandler: RouteHandler = async (req, res) => {
  try {
    logger.info('Processing cluster list request', {
      correlationId: req.correlationId,
      requestedBy: req.context.staff_id,
      requestedByEmail: req.context.email,
    });

    // Get all clusters from DynamoDB
    const clusters = await dynamoDBHelper.getAllClusters(req.correlationId);

    logger.info('Cluster list retrieved successfully', {
      correlationId: req.correlationId,
      clusterCount: clusters.length,
      requestedBy: req.context.staff_id,
    });

    // Return success response with cluster list
    res.status(200).json({
      success: true,
      data: {
        clusters: clusters.map(cluster => ({
          cluster_id: cluster.cluster_id,
          name: cluster.name,
          type: cluster.type,
          region: cluster.region,
          cidr: cluster.cidr,
          status: cluster.status,
          deployment_status: cluster.deployment_status,
          deployment_id: cluster.deployment_id,
          created_at: cluster.created_at,
          updated_at: cluster.updated_at,
          deployed_at: cluster.deployed_at,
        })),
        total_count: clusters.length,
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