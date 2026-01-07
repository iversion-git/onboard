// POST /tenant/register handler with admin/manager authorization
import type { RouteHandler } from '../../lib/types.js';
import { dynamoDBHelper } from '../../lib/dynamodb.js';
import { logger } from '../../lib/logging.js';
import { sendError } from '../../lib/response.js';
import { CreateTenantSchema } from '../../lib/data-models.js';

export const registerHandler: RouteHandler = async (req, res) => {
  try {
    logger.info('Processing tenant registration request', {
      correlationId: req.correlationId,
      requestedBy: req.context.staff_id,
      requestedByEmail: req.context.email,
      requestedByRoles: req.context.roles,
    });

    // Validate request body
    const validation = CreateTenantSchema.safeParse(req.body);
    if (!validation.success) {
      logger.warn('Tenant registration validation failed', {
        correlationId: req.correlationId,
        errors: validation.error.issues,
      });
      sendError(
        res,
        'ValidationError',
        'Invalid tenant registration data',
        req.correlationId,
        { validationErrors: validation.error.issues }
      );
      return;
    }

    const { name, email, mobile_number, business_name, deployment_type, region, tenant_url, subscription_type, package_name, cluster_id } = validation.data;

    // Validate cluster_id exists and matches deployment type (now required)
    const clusterResult = await dynamoDBHelper.getCluster(cluster_id, req.correlationId);
    if (!clusterResult.found || !clusterResult.cluster) {
      logger.warn('Invalid cluster_id provided for tenant registration', {
        correlationId: req.correlationId,
        cluster_id,
        deployment_type,
      });
      sendError(
        res,
        'ValidationError',
        'Invalid cluster ID provided',
        req.correlationId
      );
      return;
    }

    // Check if cluster type matches tenant deployment type
    const expectedClusterType = deployment_type.toLowerCase();
    if (clusterResult.cluster.type !== expectedClusterType) {
      logger.warn('Cluster type mismatch for tenant registration', {
        correlationId: req.correlationId,
        cluster_id,
        clusterType: clusterResult.cluster.type,
        tenantDeploymentType: deployment_type,
      });
      sendError(
        res,
        'ValidationError',
        `Cluster type '${clusterResult.cluster.type}' does not match tenant deployment type '${deployment_type}'`,
        req.correlationId
      );
      return;
    }

    // Check if cluster is active
    if (clusterResult.cluster.status !== 'Active') {
      logger.warn('Inactive cluster provided for tenant registration', {
        correlationId: req.correlationId,
        cluster_id,
        clusterStatus: clusterResult.cluster.status,
      });
      sendError(
        res,
        'ValidationError',
        `Cluster is not active (status: ${clusterResult.cluster.status})`,
        req.correlationId
      );
      return;
    }

    // Create tenant record with required cluster assignment
    const tenantData = {
      name,
      email,
      mobile_number,
      business_name,
      deployment_type,
      region,
      tenant_url,
      subscription_type,
      package_name,
      cluster_id,
      cluster_name: clusterResult.cluster.name,
    };

    const result = await dynamoDBHelper.createTenant(tenantData, req.correlationId);

    if (!result.success) {
      logger.warn('Tenant registration failed', {
        correlationId: req.correlationId,
        name,
        email,
        business_name,
        tenant_url,
        error: result.error,
      });
      
      if (result.error?.includes('already taken') || result.error?.includes('Conflict')) {
        sendError(
          res,
          'Conflict',
          'Tenant URL is already taken',
          req.correlationId
        );
      } else if (result.error?.includes('already exists')) {
        sendError(
          res,
          'Conflict',
          'Tenant with this information already exists',
          req.correlationId
        );
      } else {
        sendError(
          res,
          'InternalError',
          'Failed to create tenant',
          req.correlationId
        );
      }
      return;
    }

    logger.info('Tenant registration successful', {
      correlationId: req.correlationId,
      tenantId: result.data?.tenant_id,
      name: result.data?.name,
      email: result.data?.email,
      business_name: result.data?.business_name,
      tenant_url: result.data?.tenant_url,
      deployment_type: result.data?.deployment_type,
      region: result.data?.region,
      subscription_type: result.data?.subscription_type,
      package_name: result.data?.package_name,
      cluster_id: result.data?.cluster_id,
      cluster_name: result.data?.cluster_name,
      status: result.data?.status,
      createdBy: req.context.staff_id,
    });

    // Prepare for future downstream provisioning workflows
    // This is where we would trigger downstream provisioning workflows in the future
    logger.info('Tenant ready for downstream provisioning', {
      correlationId: req.correlationId,
      tenantId: result.data?.tenant_id,
      status: result.data?.status,
      deployment_type: result.data?.deployment_type,
      region: result.data?.region,
      subscription_type: result.data?.subscription_type,
      package_name: result.data?.package_name,
    });

    // Return success response
    res.status(201).json({
      success: true,
      data: {
        tenant_id: result.data?.tenant_id,
        name: result.data?.name,
        email: result.data?.email,
        mobile_number: result.data?.mobile_number,
        business_name: result.data?.business_name,
        status: result.data?.status,
        deployment_type: result.data?.deployment_type,
        region: result.data?.region,
        tenant_url: result.data?.tenant_url,
        subscription_type: result.data?.subscription_type,
        package_name: result.data?.package_name,
        cluster_id: result.data?.cluster_id,
        cluster_name: result.data?.cluster_name,
        created_at: result.data?.created_at,
        updated_at: result.data?.updated_at,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Tenant registration handler error', {
      correlationId: req.correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    sendError(res, 'InternalError', 'Tenant registration failed', req.correlationId);
  }
};