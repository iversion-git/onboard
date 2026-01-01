// DELETE /clusters/{id} handler for removing In-Active clusters from database
import type { RouteHandler } from '../../lib/types.js';
import { getDynamoDBClient, getTableNames } from '../../lib/dynamodb.js';
import { GetCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from '../../lib/logging.js';
import { sendError } from '../../lib/response.js';

export const deleteHandler: RouteHandler = async (req, res) => {
  try {
    const clusterId = req.params['id'];
    
    if (!clusterId) {
      sendError(res, 'ValidationError', 'Cluster ID is required', req.correlationId);
      return;
    }

    logger.info('Processing cluster delete request', {
      correlationId: req.correlationId,
      clusterId,
      requestedBy: req.context.staff_id,
      requestedByEmail: req.context.email,
    });

    // Get cluster record directly from DynamoDB
    const dynamoClient = getDynamoDBClient();
    const tables = getTableNames();
    
    const clusterResult = await dynamoClient.send(new GetCommand({
      TableName: tables.clusters,
      Key: { cluster_id: clusterId }
    }));
    
    if (!clusterResult.Item) {
      logger.warn('Cluster not found for deletion', {
        correlationId: req.correlationId,
        clusterId,
      });
      sendError(res, 'NotFound', 'Cluster not found', req.correlationId);
      return;
    }

    const cluster = clusterResult.Item;

    // Security check: Only allow deletion if cluster status is In-Active
    if (cluster.status !== 'In-Active') {
      logger.warn('Attempted to delete cluster with non-In-Active status', {
        correlationId: req.correlationId,
        clusterId,
        currentStatus: cluster.status,
        requestedBy: req.context.staff_id,
      });
      
      sendError(
        res, 
        'Forbidden', 
        `Cannot delete cluster with status '${cluster.status}'. Only clusters with status 'In-Active' can be deleted from the database.`, 
        req.correlationId
      );
      return;
    }

    // Delete the cluster record from DynamoDB
    await dynamoClient.send(new DeleteCommand({
      TableName: tables.clusters,
      Key: { cluster_id: clusterId }
    }));

    logger.info('Cluster deleted successfully from database', {
      correlationId: req.correlationId,
      clusterId,
      clusterName: cluster.name,
      deletedBy: req.context.staff_id,
      deletedByEmail: req.context.email,
    });

    // Return success response
    res.status(200).json({
      success: true,
      data: {
        cluster_id: clusterId,
        cluster_name: cluster.name,
        message: 'Cluster record deleted from database successfully',
        deleted_at: new Date().toISOString(),
        deleted_by: req.context.email,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Cluster delete handler error', {
      correlationId: req.correlationId,
      clusterId: req.params['id'],
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    sendError(res, 'InternalError', 'Failed to delete cluster', req.correlationId);
  }
};