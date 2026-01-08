// POST /stack/create handler with admin/manager authorization
import type { RouteHandler } from '../../lib/types.js';
import { dynamoDBHelper } from '../../lib/dynamodb.js';
import { logger } from '../../lib/logging.js';
import { sendError } from '../../lib/response.js';
import { CreateStackSchema } from '../../lib/data-models.js';
import { generateTenantUrls, getAwsRegionCode } from '../../lib/url-utils.js';

export const createStackHandler: RouteHandler = async (req, res) => {
  try {
    logger.info('Processing stack creation request', {
      correlationId: req.correlationId,
      requestedBy: req.context.staff_id,
      requestedByEmail: req.context.email,
      requestedByRoles: req.context.roles,
    });

    // Validate request body
    const validation = CreateStackSchema.safeParse(req.body);
    if (!validation.success) {
      logger.warn('Stack creation validation failed', {
        correlationId: req.correlationId,
        errors: validation.error.issues,
      });
      sendError(
        res,
        'ValidationError',
        'Invalid stack creation data',
        req.correlationId,
        { validationErrors: validation.error.issues }
      );
      return;
    }

    const { tenant_id, stack_type } = validation.data;

    // Validate tenant exists
    const tenantResult = await dynamoDBHelper.getTenant(tenant_id, req.correlationId);
    if (!tenantResult.found || !tenantResult.tenant) {
      logger.warn('Invalid tenant_id provided for stack creation', {
        correlationId: req.correlationId,
        tenant_id,
      });
      sendError(
        res,
        'ValidationError',
        'Invalid tenant ID provided',
        req.correlationId
      );
      return;
    }

    const tenant = tenantResult.tenant;

    // Check if tenant is active (optional business rule)
    if (tenant.status !== 'Active' && tenant.status !== 'Pending') {
      logger.warn('Attempted to create stack for inactive tenant', {
        correlationId: req.correlationId,
        tenant_id,
        tenantStatus: tenant.status,
      });
      sendError(
        res,
        'ValidationError',
        `Cannot create stack for tenant with status: ${tenant.status}`,
        req.correlationId
      );
      return;
    }

    // Validate tenant has required fields for stack creation
    if (!tenant.subscription_type || !tenant.package_name) {
      logger.warn('Tenant missing required fields for stack creation', {
        correlationId: req.correlationId,
        tenant_id,
        hasSubscriptionType: !!tenant.subscription_type,
        hasPackageName: !!tenant.package_name,
      });
      sendError(
        res,
        'ValidationError',
        'Tenant must have subscription type and package name configured before creating stacks',
        req.correlationId
      );
      return;
    }

    // Generate stack name based on tenant URL and type
    let stack_name: string;
    if (stack_type === 'Production') {
      stack_name = `${tenant.tenant_url}-prod`;
      
      // For production stacks, check if one already exists
      const existingStacks = await dynamoDBHelper.getStacksByTenant(tenant_id, req.correlationId);
      const existingProductionStack = existingStacks.find(stack => stack.stack_type === 'Production');
      
      if (existingProductionStack) {
        logger.warn('Attempted to create multiple production stacks for tenant', {
          correlationId: req.correlationId,
          tenant_id,
          existingStackId: existingProductionStack.stack_id,
        });
        sendError(
          res,
          'Conflict',
          'Tenant already has a production stack',
          req.correlationId
        );
        return;
      }
    } else {
      // For dev stacks, find the next available number
      const existingStacks = await dynamoDBHelper.getStacksByTenant(tenant_id, req.correlationId);
      const devStacks = existingStacks.filter(stack => stack.stack_type === 'Dev');
      
      if (devStacks.length === 0) {
        stack_name = `${tenant.tenant_url}-dev`;
      } else {
        // Find the highest number used
        const devNumbers = devStacks
          .map(stack => {
            const match = stack.stack_name.match(new RegExp(`^${tenant.tenant_url}-dev(?:-(\\d+))?$`));
            if (match) {
              return match[1] ? parseInt(match[1], 10) : 1;
            }
            return 0;
          })
          .filter(num => num > 0);
        
        const nextNumber = devNumbers.length === 0 ? 1 : Math.max(...devNumbers) + 1;
        stack_name = nextNumber === 1 ? `${tenant.tenant_url}-dev` : `${tenant.tenant_url}-dev-${nextNumber}`;
      }
    }

    // Generate tenant URLs based on deployment type and region
    const { tenantUrl, tenantApiUrl } = generateTenantUrls(tenant);

    // Get AWS region code for stack storage
    const awsRegionCode = getAwsRegionCode(tenant.region, tenant.deployment_type);

    // Create stack record with all tenant information
    const stackData = {
      tenant_id,
      stack_name,
      stack_type,
      tenant_url: tenantUrl,
      tenant_api_url: tenantApiUrl,
      region: awsRegionCode,
      deployment_type: tenant.deployment_type,
      subscription_type: tenant.subscription_type!,
      package_name: tenant.package_name!,
      cluster_id: tenant.cluster_id,
      cluster_name: tenant.cluster_name,
    };

    const result = await dynamoDBHelper.createStack(stackData, req.correlationId);

    if (!result.success) {
      logger.warn('Stack creation failed', {
        correlationId: req.correlationId,
        tenant_id,
        stack_name,
        stack_type,
        error: result.error,
      });
      
      sendError(
        res,
        'InternalError',
        'Failed to create stack',
        req.correlationId
      );
      return;
    }

    logger.info('Stack creation successful', {
      correlationId: req.correlationId,
      stackId: result.data?.stack_id,
      tenant_id: result.data?.tenant_id,
      stack_name: result.data?.stack_name,
      stack_type: result.data?.stack_type,
      tenant_url: result.data?.tenant_url,
      tenant_api_url: result.data?.tenant_api_url,
      status: result.data?.status,
      createdBy: req.context.staff_id,
    });

    // Prepare for future downstream provisioning workflows
    logger.info('Stack ready for downstream provisioning', {
      correlationId: req.correlationId,
      stackId: result.data?.stack_id,
      tenant_id: result.data?.tenant_id,
      stack_type: result.data?.stack_type,
      tenantDeploymentType: tenant.deployment_type,
      tenantRegion: tenant.region,
      tenantSubscriptionType: tenant.subscription_type,
      tenantPackageName: tenant.package_name,
    });

    // Return success response
    res.status(201).json({
      success: true,
      data: {
        stack_id: result.data?.stack_id,
        tenant_id: result.data?.tenant_id,
        stack_name: result.data?.stack_name,
        stack_type: result.data?.stack_type,
        tenant_url: result.data?.tenant_url,
        tenant_api_url: result.data?.tenant_api_url,
        region: result.data?.region,
        deployment_type: result.data?.deployment_type,
        subscription_type: result.data?.subscription_type,
        package_name: result.data?.package_name,
        cluster_id: result.data?.cluster_id,
        cluster_name: result.data?.cluster_name,
        status: result.data?.status,
        created_at: result.data?.created_at,
        updated_at: result.data?.updated_at,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Stack creation handler error', {
      correlationId: req.correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    sendError(res, 'InternalError', 'Stack creation failed', req.correlationId);
  }
};