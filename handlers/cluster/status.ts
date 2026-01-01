// GET /clusters/{id}/status handler for deployment status checking
import type { RouteHandler } from '../../lib/types.js';
import { dynamoDBHelper } from '../../lib/dynamodb.js';
import { getCloudFormationHelper } from '../../lib/cloudformation.js';
import { getCrossAccountRoleManager } from '../../lib/cross-account-roles.js';
import { logger } from '../../lib/logging.js';
import { sendError } from '../../lib/response.js';
import { z } from 'zod';

// Status check query parameters schema
const StatusQuerySchema = z.object({
  cross_account_config: z.string().optional().transform((val) => {
    if (!val) return undefined;
    try {
      return JSON.parse(val);
    } catch {
      return undefined;
    }
  }).pipe(z.object({
    target_account_id: z.string().regex(/^\d{12}$/),
    role_name: z.string().min(1),
    external_id: z.string().optional(),
  }).optional()),
  include_events: z.string().optional().transform(val => val === 'true'),
});

export const statusHandler: RouteHandler = async (req, res) => {
  try {
    const clusterId = req.params['id'];
    
    if (!clusterId) {
      sendError(res, 'ValidationError', 'Cluster ID is required', req.correlationId);
      return;
    }

    logger.info('Processing cluster status request', {
      correlationId: req.correlationId,
      clusterId,
      requestedBy: req.context.staff_id,
      requestedByEmail: req.context.email,
    });

    // Validate query parameters
    const queryValidation = StatusQuerySchema.safeParse(req.query);
    if (!queryValidation.success) {
      logger.warn('Cluster status query validation failed', {
        correlationId: req.correlationId,
        clusterId,
        errors: queryValidation.error.errors,
      });
      sendError(
        res,
        'ValidationError',
        'Invalid query parameters',
        req.correlationId,
        { validationErrors: queryValidation.error.errors }
      );
      return;
    }

    const { cross_account_config, include_events } = queryValidation.data;

    // Get cluster record
    const clusterResult = await dynamoDBHelper.getCluster(clusterId, req.correlationId);
    if (!clusterResult.found || !clusterResult.cluster) {
      logger.warn('Cluster not found for status check', {
        correlationId: req.correlationId,
        clusterId,
      });
      sendError(res, 'NotFound', 'Cluster not found', req.correlationId);
      return;
    }

    const cluster = clusterResult.cluster;

    // If cluster has no deployment ID, return cluster status only
    if (!cluster.deployment_id) {
      logger.info('Cluster status retrieved (no deployment)', {
        correlationId: req.correlationId,
        clusterId,
        status: cluster.status,
      });

      res.status(200).json({
        success: true,
        data: {
          cluster_id: clusterId,
          cluster_status: cluster.status,
          deployment_status: cluster.deployment_status || 'NOT_DEPLOYED',
          deployment_id: null,
          stack_outputs: cluster.stack_outputs || {},
          last_updated: cluster.updated_at,
          deployed_at: cluster.deployed_at,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      // Get CloudFormation helper
      const cfnHelper = getCloudFormationHelper(cluster.region);

      let stackStatus;
      let stackEvents: any[] = [];

      if (cross_account_config) {
        // Cross-account status check
        logger.info('Checking cross-account cluster deployment status', {
          correlationId: req.correlationId,
          clusterId,
          targetAccountId: cross_account_config.target_account_id,
          deploymentId: cluster.deployment_id,
        });

        const allowedAccountIds: string[] = []; // This should be configured via environment variables
        const crossAccountManager = getCrossAccountRoleManager(allowedAccountIds, cluster.region);

        const crossAccountDeploymentConfig = {
          targetAccountId: cross_account_config.target_account_id,
          region: cluster.region,
          roleName: cross_account_config.role_name,
          externalId: cross_account_config.external_id,
          sessionName: `status-check-${clusterId.substring(0, 8)}`,
          durationSeconds: 3600,
        };

        const session = await crossAccountManager.assumeRole(crossAccountDeploymentConfig);
        
        const crossAccountCfnConfig = {
          roleArn: session.roleArn,
          sessionName: session.sessionName,
          externalId: cross_account_config.external_id,
        };

        stackStatus = await cfnHelper.getStackStatus(cluster.deployment_id, crossAccountCfnConfig);
        
        if (include_events && stackStatus) {
          stackEvents = await cfnHelper.getStackEvents(cluster.deployment_id, crossAccountCfnConfig);
        }
      } else {
        // Same-account status check
        logger.info('Checking same-account cluster deployment status', {
          correlationId: req.correlationId,
          clusterId,
          deploymentId: cluster.deployment_id,
        });

        stackStatus = await cfnHelper.getStackStatus(cluster.deployment_id);
        
        if (include_events && stackStatus) {
          stackEvents = await cfnHelper.getStackEvents(cluster.deployment_id);
        }
      }

      if (!stackStatus) {
        logger.warn('CloudFormation stack not found', {
          correlationId: req.correlationId,
          clusterId,
          deploymentId: cluster.deployment_id,
        });

        // Update cluster status to reflect missing stack
        await dynamoDBHelper.updateCluster(clusterId, {
          status: 'Failed',
          deployment_status: 'STACK_NOT_FOUND',
        }, req.correlationId);

        res.status(200).json({
          success: true,
          data: {
            cluster_id: clusterId,
            cluster_status: 'Failed',
            deployment_status: 'STACK_NOT_FOUND',
            deployment_id: cluster.deployment_id,
            stack_outputs: {},
            last_updated: new Date().toISOString(),
            deployed_at: cluster.deployed_at,
            error: 'CloudFormation stack not found',
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Update cluster status based on CloudFormation status
      let clusterStatus = cluster.status;
      let deployedAt = cluster.deployed_at;

      if (stackStatus.status === 'CREATE_COMPLETE' || stackStatus.status === 'UPDATE_COMPLETE') {
        clusterStatus = 'Active';
        deployedAt = deployedAt || new Date().toISOString();
      } else if (stackStatus.status?.includes('FAILED') || stackStatus.status?.includes('ROLLBACK')) {
        clusterStatus = 'Failed';
      } else if (stackStatus.status?.includes('IN_PROGRESS')) {
        clusterStatus = 'Deploying';
      }

      // Update cluster record if status changed
      if (clusterStatus !== cluster.status || 
          stackStatus.status !== cluster.deployment_status ||
          (stackStatus.outputs && JSON.stringify(stackStatus.outputs) !== JSON.stringify(cluster.stack_outputs))) {
        
        await dynamoDBHelper.updateCluster(clusterId, {
          status: clusterStatus,
          deployment_status: stackStatus.status,
          stack_outputs: stackStatus.outputs || cluster.stack_outputs || {},
          ...(deployedAt && deployedAt !== cluster.deployed_at && { deployed_at: deployedAt }),
        }, req.correlationId);
      }

      logger.info('Cluster status retrieved successfully', {
        correlationId: req.correlationId,
        clusterId,
        clusterStatus,
        deploymentStatus: stackStatus.status,
      });

      // Return success response
      res.status(200).json({
        success: true,
        data: {
          cluster_id: clusterId,
          cluster_status: clusterStatus,
          deployment_status: stackStatus.status,
          deployment_id: cluster.deployment_id,
          stack_outputs: stackStatus.outputs || {},
          last_updated: new Date().toISOString(),
          deployed_at: deployedAt,
          ...(include_events && stackEvents.length > 0 && { 
            recent_events: stackEvents.slice(0, 10).map((event: any) => ({
              timestamp: event.Timestamp,
              resource_type: event.ResourceType,
              logical_resource_id: event.LogicalResourceId,
              resource_status: event.ResourceStatus,
              resource_status_reason: event.ResourceStatusReason,
            }))
          }),
        },
        timestamp: new Date().toISOString(),
      });

    } catch (statusError) {
      logger.error('Failed to get CloudFormation stack status', {
        correlationId: req.correlationId,
        clusterId,
        deploymentId: cluster.deployment_id,
        error: statusError instanceof Error ? statusError.message : 'Unknown status error',
      });

      // Return cluster status with error information
      res.status(200).json({
        success: true,
        data: {
          cluster_id: clusterId,
          cluster_status: cluster.status,
          deployment_status: cluster.deployment_status || 'STATUS_CHECK_FAILED',
          deployment_id: cluster.deployment_id,
          stack_outputs: cluster.stack_outputs || {},
          last_updated: cluster.updated_at,
          deployed_at: cluster.deployed_at,
          error: `Failed to check deployment status: ${statusError instanceof Error ? statusError.message : 'Unknown error'}`,
        },
        timestamp: new Date().toISOString(),
      });
    }

  } catch (error) {
    logger.error('Cluster status handler error', {
      correlationId: req.correlationId,
      clusterId: req.params['id'],
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    sendError(res, 'InternalError', 'Failed to get cluster status', req.correlationId);
  }
};