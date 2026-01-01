// POST /clusters/{id}/deploy handler for infrastructure deployment
import type { RouteHandler } from '../../lib/types.js';
import { dynamoDBHelper } from '../../lib/dynamodb.js';
import { getCloudFormationHelper } from '../../lib/cloudformation.js';
import { getS3TemplateManager } from '../../lib/s3-templates.js';
import { getCrossAccountRoleManager } from '../../lib/cross-account-roles.js';
import { getConfig } from '../../lib/config.js';
import { calculateSubnetCIDRs } from '../../lib/cidr-utils.js';
import { logger } from '../../lib/logging.js';
import { sendError } from '../../lib/response.js';
import { z } from 'zod';

// Deployment request schema
const DeployClusterSchema = z.object({
  cross_account_config: z.object({
    target_account_id: z.string().regex(/^\d{12}$/, 'Must be a valid 12-digit AWS account ID'),
    role_name: z.string().min(1),
    external_id: z.string().optional(),
  }).optional(),
  parameters: z.array(z.object({
    ParameterKey: z.string(),
    ParameterValue: z.string()
  })).optional(),
  tags: z.array(z.object({
    Key: z.string(),
    Value: z.string()
  })).optional(),
});

export const deployHandler: RouteHandler = async (req, res) => {
  try {
    const clusterId = req.params['id'];
    
    if (!clusterId) {
      sendError(res, 'ValidationError', 'Cluster ID is required', req.correlationId);
      return;
    }

    logger.info('Processing cluster deployment request', {
      correlationId: req.correlationId,
      clusterId,
      requestedBy: req.context.staff_id,
      requestedByEmail: req.context.email,
    });

    // Validate request body
    const validation = DeployClusterSchema.safeParse(req.body || {});
    if (!validation.success) {
      logger.warn('Cluster deployment validation failed', {
        correlationId: req.correlationId,
        clusterId,
        errors: validation.error.errors,
      });
      sendError(
        res,
        'ValidationError',
        'Invalid cluster deployment data',
        req.correlationId,
        { validationErrors: validation.error.errors }
      );
      return;
    }

    const { cross_account_config, parameters, tags } = validation.data;

    // Get cluster record
    const clusterResult = await dynamoDBHelper.getCluster(clusterId, req.correlationId);
    if (!clusterResult.found || !clusterResult.cluster) {
      logger.warn('Cluster not found for deployment', {
        correlationId: req.correlationId,
        clusterId,
      });
      sendError(res, 'NotFound', 'Cluster not found', req.correlationId);
      return;
    }

    const cluster = clusterResult.cluster;

    // Check if cluster is in a deployable state
    if (cluster.status === 'Deploying') {
      logger.warn('Cluster deployment already in progress', {
        correlationId: req.correlationId,
        clusterId,
        currentStatus: cluster.status,
      });
      sendError(res, 'Conflict', 'Cluster deployment already in progress', req.correlationId);
      return;
    }

    // Allow deployment for In-Active (new) and Failed clusters
    if (cluster.status !== 'In-Active' && cluster.status !== 'Failed') {
      logger.warn('Cluster is not in deployable state', {
        correlationId: req.correlationId,
        clusterId,
        currentStatus: cluster.status,
      });
      sendError(res, 'Conflict', `Cluster status '${cluster.status}' is not deployable. Must be 'In-Active' or 'Failed'`, req.correlationId);
      return;
    }

    // Update cluster status to deploying
    await dynamoDBHelper.updateCluster(clusterId, {
      status: 'Deploying',
      deployment_status: 'DEPLOYMENT_INITIATED',
    }, req.correlationId);

    try {
      const config = getConfig();
      
      // Use main template that orchestrates nested stacks based on cluster type
      const templateKey = `${cluster.type}-main-template.yaml`;
      
      // Get S3 template manager
      const templateManager = getS3TemplateManager(config.s3.templateBucket);
      
      // Get template URL
      const templateInfo = await templateManager.getTemplateInfo(templateKey);
      if (!templateInfo) {
        throw new Error(`Template not found: ${templateKey}`);
      }

      // Prepare CloudFormation deployment configuration
      // Sanitize cluster name for CloudFormation stack name (no spaces, special chars)
      const sanitizedClusterName = cluster.name.replace(/[^a-zA-Z0-9-]/g, '-').replace(/-+/g, '-');
      const stackName = `control-plane-${sanitizedClusterName}-${clusterId.substring(0, 8)}`;
      
      // Calculate subnet CIDRs from VPC CIDR
      const subnets = calculateSubnetCIDRs(cluster.cidr);
      
      // Default parameters for cluster deployment
      const defaultParameters = [
        { ParameterKey: 'EnvironmentName', ParameterValue: cluster.name },
        { ParameterKey: 'VpcCIDR', ParameterValue: cluster.cidr },
        { ParameterKey: 'TemplateS3Bucket', ParameterValue: config.s3.templateBucket },
        { ParameterKey: 'TemplateS3KeyPrefix', ParameterValue: '' }, // No prefix for now
        // Cluster-specific parameters for tagging
        { ParameterKey: 'ClusterName', ParameterValue: cluster.name },
        { ParameterKey: 'ClusterType', ParameterValue: cluster.type === 'dedicated' ? 'Dedicated' : 'Shared' },
        { ParameterKey: 'ClusterEnvironment', ParameterValue: cluster.environment },
        // Private App subnet CIDRs (no public subnets needed)
        { ParameterKey: 'PrivateAppSubnet1CIDR', ParameterValue: subnets.privateApp[0] },
        { ParameterKey: 'PrivateAppSubnet2CIDR', ParameterValue: subnets.privateApp[1] },
        { ParameterKey: 'PrivateAppSubnet3CIDR', ParameterValue: subnets.privateApp[2] },
        // Private DB subnet CIDRs
        { ParameterKey: 'PrivateDBSubnet1CIDR', ParameterValue: subnets.privateDB[0] },
        { ParameterKey: 'PrivateDBSubnet2CIDR', ParameterValue: subnets.privateDB[1] },
        { ParameterKey: 'PrivateDBSubnet3CIDR', ParameterValue: subnets.privateDB[2] },
      ];

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
        enableTerminationProtection: true, // Enable delete protection for security
        timeoutInMinutes: 60,
      };

      // Get CloudFormation helper
      const cfnHelper = getCloudFormationHelper(cluster.region);

      let deploymentResult;

      if (cross_account_config) {
        // Cross-account deployment
        logger.info('Initiating cross-account cluster deployment', {
          correlationId: req.correlationId,
          clusterId,
          targetAccountId: cross_account_config.target_account_id,
          stackName,
        });

        // Get cross-account role manager
        const allowedAccountIds: string[] = []; // This should be configured via environment variables
        const crossAccountManager = getCrossAccountRoleManager(allowedAccountIds, cluster.region);

        // Prepare cross-account configuration
        const crossAccountDeploymentConfig = {
          targetAccountId: cross_account_config.target_account_id,
          region: cluster.region,
          roleName: cross_account_config.role_name,
          externalId: cross_account_config.external_id,
          sessionName: `cluster-deployment-${clusterId.substring(0, 8)}`,
          durationSeconds: 3600,
        };

        // Assume cross-account role and deploy
        const session = await crossAccountManager.assumeRole(crossAccountDeploymentConfig);
        
        const crossAccountCfnConfig = {
          roleArn: session.roleArn,
          sessionName: session.sessionName,
          externalId: cross_account_config.external_id,
        };

        deploymentResult = await cfnHelper.deployStack(deploymentConfig, crossAccountCfnConfig);
      } else {
        // Same-account deployment
        logger.info('Initiating same-account cluster deployment', {
          correlationId: req.correlationId,
          clusterId,
          stackName,
        });

        deploymentResult = await cfnHelper.deployStack(deploymentConfig);
      }

      // Update cluster with deployment information
      await dynamoDBHelper.updateCluster(clusterId, {
        status: deploymentResult.status === 'CREATE_FAILED' ? 'Failed' : 'Deploying',
        deployment_status: String(deploymentResult.status), // Ensure it's a string
        deployment_id: deploymentResult.stackId,
      }, req.correlationId);

      logger.info('Cluster deployment initiated successfully', {
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
        },
        timestamp: new Date().toISOString(),
      });

    } catch (deploymentError) {
      // Update cluster status to failed on deployment error
      await dynamoDBHelper.updateCluster(clusterId, {
        status: 'Failed',
        deployment_status: 'DEPLOYMENT_FAILED',
      }, req.correlationId);

      logger.error('Cluster deployment failed', {
        correlationId: req.correlationId,
        clusterId,
        error: deploymentError instanceof Error ? deploymentError.message : 'Unknown deployment error',
      });

      sendError(
        res,
        'InternalError',
        `Cluster deployment failed: ${deploymentError instanceof Error ? deploymentError.message : 'Unknown error'}`,
        req.correlationId
      );
    }

  } catch (error) {
    logger.error('Cluster deployment handler error', {
      correlationId: req.correlationId,
      clusterId: req.params['id'],
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    sendError(res, 'InternalError', 'Cluster deployment failed', req.correlationId);
  }
};