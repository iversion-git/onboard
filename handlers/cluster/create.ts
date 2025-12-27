// POST /clusters handler with cluster creation and CIDR validation
import type { RouteHandler } from '../../lib/types.js';
import { dynamoDBHelper } from '../../lib/dynamodb.js';
import { logger } from '../../lib/logging.js';
import { sendError } from '../../lib/response.js';
import { CreateClusterSchema } from '../../lib/data-models.js';

export const createHandler: RouteHandler = async (req, res) => {
  try {
    logger.info('Processing cluster creation request', {
      correlationId: req.correlationId,
      requestedBy: req.context.staff_id,
      requestedByEmail: req.context.email,
    });

    // Validate request body
    const validation = CreateClusterSchema.safeParse(req.body);
    if (!validation.success) {
      logger.warn('Cluster creation validation failed', {
        correlationId: req.correlationId,
        errors: validation.error.errors,
      });
      sendError(
        res,
        'ValidationError',
        'Invalid cluster creation data',
        req.correlationId,
        { validationErrors: validation.error.errors }
      );
      return;
    }

    const { name, type, environment, region, cidr } = validation.data;

    // Create cluster record (CIDR validation and overlap checking is handled in dynamoDBHelper.createCluster)
    const clusterData = {
      name,
      type,
      environment,
      region,
      cidr,
      status: 'created' as const,
    };

    const result = await dynamoDBHelper.createCluster(clusterData, req.correlationId);

    if (!result.success) {
      logger.warn('Cluster creation failed', {
        correlationId: req.correlationId,
        name,
        type,
        region,
        cidr,
        error: result.error,
      });
      
      if (result.error?.includes('overlap') || result.error?.includes('CIDR')) {
        sendError(
          res,
          'Conflict',
          result.error,
          req.correlationId
        );
      } else if (result.error?.includes('already exists') || result.error?.includes('Conflict')) {
        sendError(
          res,
          'Conflict',
          'Cluster with this configuration already exists',
          req.correlationId
        );
      } else {
        sendError(
          res,
          'InternalError',
          'Failed to create cluster',
          req.correlationId
        );
      }
      return;
    }

    logger.info('Cluster creation successful', {
      correlationId: req.correlationId,
      clusterId: result.data?.cluster_id,
      name: result.data?.name,
      type: result.data?.type,
      environment: result.data?.environment,
      region: result.data?.region,
      cidr: result.data?.cidr,
      status: result.data?.status,
      createdBy: req.context.staff_id,
    });

    // Return success response
    res.status(201).json({
      success: true,
      data: {
        cluster_id: result.data?.cluster_id,
        name: result.data?.name,
        type: result.data?.type,
        environment: result.data?.environment,
        region: result.data?.region,
        cidr: result.data?.cidr,
        status: result.data?.status,
        created_at: result.data?.created_at,
        updated_at: result.data?.updated_at,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Cluster creation handler error', {
      correlationId: req.correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    sendError(res, 'InternalError', 'Cluster creation failed', req.correlationId);
  }
};