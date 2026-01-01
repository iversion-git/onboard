// POST /cluster/{id}/update handler for updating existing cluster infrastructure
import type { RouteHandler } from '../../lib/types.js';
import { getDynamoDBClient, getTableNames } from '../../lib/dynamodb.js';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { getCloudFormationHelper } from '../../lib/cloudformation.js';
import { getCrossAccountRoleManager } from '../../lib/cross-account-roles.js';
import { getS3TemplateManager } from '../../lib/s3-templates.js';
import { calculateSubnetCIDRs } from '../../lib/cidr-utils.js';
import { getConfig } from '../../lib/config.js';
import { logger } from '../../lib/logging.js';
import { sendError } from '../../lib/response.js';
import { z } from 'zod';

// Update cluster query parameters schema
const UpdateQuerySchema = z.object({
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
  parameters: z.string().optional().transform((val) => {
    if (!val) return undefined;
    try {
      return JSON.parse(val);
    } catch {
      return undefined;
    }
  }).pipe(z.array(z.object({
    ParameterKey: z.string(),
    ParameterValue: z.string()
  })).optional()),
  tags: z.string().optional().transform((val) => {
    if (!val) return undefined;
    try {
      return JSON.parse(val);
    } catch {
      return undefined;
    }
  }).pipe(z.array(z.object({
    Key: z.string(),
    Value: z.string()
  })).optional()),
});

export const updateHandler: RouteHandler = async (req, res) => {
  try {
    const clusterId = req.params['id'];
    
    if (!clusterId) {
      sendError(res, 'ValidationError', 'Cluster ID is required', req.correlationId);
      return;
    }

    logger.info('Processing cluster update request', {
      correlationId: req.correlationId,
      clusterId,
      requestedBy: req.context.staff_id,
      requestedByEmail: req.context.email,
    });

    // Validate query parameters
    const queryValidation = UpdateQuerySchema.safeParse(req.query);
    if (!queryValidation.success) {
      logger.warn('Cluster update query validation failed', {
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

    const { cross_account_config, parameters, tags } = queryValidation.data;

    // Get cluster record directly from DynamoDB
    const dynamoClient = getDynamoDBClient();
    const tables = getTableNames();
    
    const clusterResult = await dynamoClient.send(new GetCommand({
      TableName: tables.clusters,
      Key: { cluster_id: clusterId }
    }));
    
    if (!clusterResult.Item) {
      logger.warn('Cluster not found for update', {
        correlationId: req.correlationId,
        clusterId,
      });
      sendError(res, 'NotFound', 'Cluster not found', req.correlationId);
      return;
    }

    const cluster = clusterResult.Item;

    // Security check: Only allow update if cluster has been deployed
    if (!cluster.deployment_id) {
      logger.warn('Attempted to update cluster that has never been deployed', {
        correlationId: req.correlationId,
        clusterId,
        currentStatus: cluster.status,
        requestedBy: req.context.staff_id,
      });
      
      sendError(
        res, 
        'BadRequest', 
        'Cannot update cluster that has never been deployed. Use deploy endpoint first.', 
        req.correlationId
      );
      return;
    }

    // Check if cluster is in a state that allows updates
    if (cluster.status === 'Deploying') {
      logger.warn('Attempted to update cluster that is currently deploying', {
        correlationId: req.correlationId,
        clusterId,
        currentStatus: cluster.status,
        requestedBy: req.context.staff_id,
      });
      
      sendError(
        res, 
        'Conflict', 
        'Cannot update cluster while deployment is in progress. Wait for current deployment to complete.', 
        req.correlationId
      );
      return;
    }

    try {
      // Get S3 template manager and template info
      const config = getConfig();
      const s3TemplateManager = getS3TemplateManager(config.s3.templateBucket, cluster.region);
      const templateInfo = await s3TemplateManager.getTemplateInfo(cluster.type);

      // Calculate subnet CIDRs from VPC CIDR
      const subnets = calculateSubnetCIDRs(cluster.cidr);

      // Prepare default CloudFormation parameters
      const defaultParameters = [
        { ParameterKey: 'VpcCIDR', ParameterValue: cluster.cidr },
        // Cluster-specific parameters for tagging
        { ParameterKey: 'ClusterName', ParameterValue: cluster.name },
        { ParameterKey: 'ClusterType', ParameterValue: cluster.type === 'dedicated' ? 'Dedicated' : 'Shared' },
        { ParameterKey: 'ClusterEnvironment', ParameterValue: cluster.environment },
        // Public subnet CIDRs
        { ParameterKey: 'PublicSubnet1CIDR', ParameterValue: subnets.public[0] },
        { ParameterKey: 'PublicSubnet2CIDR', ParameterValue: subnets.public[1] },
        { ParameterKey: 'PublicSubnet3CIDR', ParameterValue: subnets.public[2] },
        // Private App subnet CIDRs
        { ParameterKey: 'PrivateAppSubnet1CIDR', ParameterValue: subnets.privateApp[0] },
        { ParameterKey: 'PrivateAppSubnet2CIDR', ParameterValue: subnets.privateApp[1] },
        { ParameterKey: 'PrivateAppSubnet3CIDR', ParameterValue: subnets.privateApp[2] },
        // Private DB subnet CIDRs
        { ParameterKey: 'PrivateDBSubnet1CIDR', ParameterValue: subnets.privateDB[0] },
        { ParameterKey: 'PrivateDBSubnet2CIDR', ParameterValue: subnets.privateDB[1] },
        { ParameterKey: 'PrivateDBSubnet3CIDR', ParameterValue: subnets.privateDB[2] },
      ];

      // Use the existing stack name from deployment_id
      const stackName = cluster.deployment_id.split('/')[1]; // Extract stack name from ARN

      const deploymentConfig = {
        stackName,
        templateUrl: templateInfo.url,
        parameters: [...defaultParameters, ...(parameters || [])],
        tags: [
          { Key: 'ClusterId', Value: cluster.cluster_id },
          { Key: 'ClusterName', Value: cluster.name },
          { Key: 'ClusterType', Value: cluster.type },
          { Key: 'ManagedBy', Value: 'ControlPlaneAPI' },
          ...(tags || [])
        ],
        capabilities: ['CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM'] as ('CAPABILITY_IAM' | 'CAPABILITY_NAMED_IAM' | 'CAPABILITY_AUTO_EXPAND')[],
        enableTerminationProtection: true, // Maintain delete protection
        timeoutInMinutes: 60,
      };

      // Get CloudFormation helper
      const cfnHelper = getCloudFormationHelper(cluster.region);

      let deploymentResult;

      if (cross_account_config) {
        // Cross-account update
        logger.info('Initiating cross-account cluster update', {
          correlationId: req.correlationId,
          clusterId,
          targetAccountId: cross_account_config.target_account_id,
          stackName,
        });

        const allowedAccountIds: string[] = config.cloudformation.allowedAccountIds || [];
        const crossAccountManager = getCrossAccountRoleManager(allowedAccountIds, cluster.region);

        const crossAccountDeploymentConfig = {
          targetAccountId: cross_account_config.target_account_id,
          region: cluster.region,
          roleName: cross_account_config.role_name,
          externalId: cross_account_config.external_id,
          sessionName: `update-${clusterId.substring(0, 8)}`,
          durationSeconds: 3600,
        };

        const session = await crossAccountManager.assumeRole(crossAccountDeploymentConfig);
        
        const crossAccountCfnConfig = {
          roleArn: session.roleArn,
          sessionName: session.sessionName,
          externalId: cross_account_config.external_id,
        };

        deploymentResult = await cfnHelper.deployStack(deploymentConfig, crossAccountCfnConfig);
      } else {
        // Same-account update
        logger.info('Initiating same-account cluster update', {
          correlationId: req.correlationId,
          clusterId,
          stackName,
        });

        deploymentResult = await cfnHelper.deployStack(deploymentConfig);
      }

      // Update cluster with deployment information
      await dynamoClient.send(new UpdateCommand({
        TableName: tables.clusters,
        Key: { cluster_id: clusterId },
        UpdateExpression: 'SET #status = :status, #deployment_status = :deployment_status, #updated_at = :updated_at',
        ExpressionAttributeNames: {
          '#status': 'status',
          '#deployment_status': 'deployment_status',
          '#updated_at': 'updated_at'
        },
        ExpressionAttributeValues: {
          ':status': deploymentResult.status === 'UPDATE_FAILED' ? 'Failed' : 'Deploying',
          ':deployment_status': String(deploymentResult.status),
          ':updated_at': new Date().toISOString()
        }
      }));

      logger.info('Cluster update initiated successfully', {
        correlationId: req.correlationId,
        clusterId,
        stackId: deploymentResult.stackId,
        stackName,
        status: deploymentResult.status,
        clusterName: cluster.name,
        environment: cluster.environment,
        vpcCidr: cluster.cidr,
        calculatedSubnets: subnets,
      });

      // Return success response
      res.status(200).json({
        success: true,
        data: {
          cluster_id: clusterId,
          deployment_id: deploymentResult.stackId,
          stack_name: stackName,
          status: String(deploymentResult.status),
          template_url: templateInfo.url,
          initiated_at: new Date().toISOString(),
          message: 'Cluster update initiated successfully',
        },
        timestamp: new Date().toISOString(),
      });

    } catch (updateError) {
      // Update cluster status to failed on update error
      await dynamoClient.send(new UpdateCommand({
        TableName: tables.clusters,
        Key: { cluster_id: clusterId },
        UpdateExpression: 'SET #status = :status, #deployment_status = :deployment_status, #updated_at = :updated_at',
        ExpressionAttributeNames: {
          '#status': 'status',
          '#deployment_status': 'deployment_status',
          '#updated_at': 'updated_at'
        },
        ExpressionAttributeValues: {
          ':status': 'Failed',
          ':deployment_status': 'UPDATE_FAILED',
          ':updated_at': new Date().toISOString()
        }
      }));

      logger.error('Cluster update failed', {
        correlationId: req.correlationId,
        clusterId,
        error: updateError instanceof Error ? updateError.message : 'Unknown update error',
      });

      sendError(
        res,
        'InternalError',
        `Cluster update failed: ${updateError instanceof Error ? updateError.message : 'Unknown error'}`,
        req.correlationId
      );
    }

  } catch (error) {
    logger.error('Cluster update handler error', {
      correlationId: req.correlationId,
      clusterId: req.params['id'],
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    sendError(res, 'InternalError', 'Failed to update cluster', req.correlationId);
  }
};