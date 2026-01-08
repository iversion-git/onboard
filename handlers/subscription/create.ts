// POST /subscription/create handler with admin/manager authorization
import type { RouteHandler } from '../../lib/types.js';
import { dynamoDBHelper } from '../../lib/dynamodb.js';
import { logger } from '../../lib/logging.js';
import { sendError } from '../../lib/response.js';
import { CreateSubscriptionSchema } from '../../lib/data-models.js';
import { generateTenantUrls, getAwsRegionCode, generateRandomTwoDigits } from '../../lib/url-utils.js';

export const createSubscriptionHandler: RouteHandler = async (req, res) => {
  try {
    logger.info('Processing subscription creation request', {
      correlationId: req.correlationId,
      requestedBy: req.context.staff_id,
      requestedByEmail: req.context.email,
      requestedByRoles: req.context.roles,
    });

    // Validate request body
    const validation = CreateSubscriptionSchema.safeParse(req.body);
    if (!validation.success) {
      logger.warn('Subscription creation validation failed', {
        correlationId: req.correlationId,
        errors: validation.error.issues,
      });
      sendError(
        res,
        'ValidationError',
        'Invalid subscription creation data',
        req.correlationId,
        { validationErrors: validation.error.issues }
      );
      return;
    }

    const { tenant_id, subscription_type_level, domain_name } = validation.data;

    // Validate tenant exists
    const tenantResult = await dynamoDBHelper.getTenant(tenant_id, req.correlationId);
    if (!tenantResult.found || !tenantResult.tenant) {
      logger.warn('Invalid tenant_id provided for subscription creation', {
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
      logger.warn('Attempted to create subscription for inactive tenant', {
        correlationId: req.correlationId,
        tenant_id,
        tenantStatus: tenant.status,
      });
      sendError(
        res,
        'ValidationError',
        `Cannot create subscription for tenant with status: ${tenant.status}`,
        req.correlationId
      );
      return;
    }

    // Validate tenant has required fields for subscription creation
    if (!tenant.subscription_type_id || !tenant.package_id) {
      logger.warn('Tenant missing required fields for subscription creation', {
        correlationId: req.correlationId,
        tenant_id,
        hasSubscriptionTypeId: !!tenant.subscription_type_id,
        hasPackageId: !!tenant.package_id,
      });
      sendError(
        res,
        'ValidationError',
        'Tenant must have subscription type ID and package ID configured before creating subscriptions',
        req.correlationId
      );
      return;
    }

    // Validate subscription type exists and is active
    const subscriptionTypeResult = await dynamoDBHelper.getSubscriptionType(tenant.subscription_type_id, req.correlationId);
    if (!subscriptionTypeResult.found || !subscriptionTypeResult.subscriptionType) {
      logger.warn('Invalid subscription_type_id for tenant', {
        correlationId: req.correlationId,
        tenant_id,
        subscription_type_id: tenant.subscription_type_id,
      });
      sendError(
        res,
        'ValidationError',
        'Invalid subscription type ID',
        req.correlationId
      );
      return;
    }

    if (!subscriptionTypeResult.subscriptionType.active) {
      logger.warn('Inactive subscription type for tenant', {
        correlationId: req.correlationId,
        tenant_id,
        subscription_type_id: tenant.subscription_type_id,
      });
      sendError(
        res,
        'ValidationError',
        'Subscription type is not active',
        req.correlationId
      );
      return;
    }

    // Validate package exists and is active
    const packageResult = await dynamoDBHelper.getPackage(tenant.package_id, req.correlationId);
    if (!packageResult.found || !packageResult.package) {
      logger.warn('Invalid package_id for tenant', {
        correlationId: req.correlationId,
        tenant_id,
        package_id: tenant.package_id,
      });
      sendError(
        res,
        'ValidationError',
        'Invalid package ID',
        req.correlationId
      );
      return;
    }

    if (!packageResult.package.active) {
      logger.warn('Inactive package for tenant', {
        correlationId: req.correlationId,
        tenant_id,
        package_id: tenant.package_id,
      });
      sendError(
        res,
        'ValidationError',
        'Package is not active',
        req.correlationId
      );
      return;
    }

    // Generate subscription name and URLs based on tenant URL and type
    let subscription_name: string;
    let randomSuffix: string | undefined;
    
    if (subscription_type_level === 'Production') {
      subscription_name = `${tenant.tenant_url}-prod`;
      
      // For production subscriptions, check if one already exists
      const existingSubscriptions = await dynamoDBHelper.getSubscriptionsByTenant(tenant_id, req.correlationId);
      const existingProductionSubscription = existingSubscriptions.find(subscription => subscription.subscription_type_level === 'Production');
      
      if (existingProductionSubscription) {
        logger.warn('Attempted to create multiple production subscriptions for tenant', {
          correlationId: req.correlationId,
          tenant_id,
          existingSubscriptionId: existingProductionSubscription.subscription_id,
        });
        sendError(
          res,
          'Conflict',
          'Tenant already has a production subscription',
          req.correlationId
        );
        return;
      }
    } else {
      // For dev subscriptions, generate a random 2-digit suffix for uniqueness
      randomSuffix = generateRandomTwoDigits();
      subscription_name = `${tenant.tenant_url}-dev-${randomSuffix}`;
      
      // Ensure the generated name is unique (very unlikely collision, but let's be safe)
      const existingSubscriptions = await dynamoDBHelper.getSubscriptionsByTenant(tenant_id, req.correlationId);
      let attempts = 0;
      while (existingSubscriptions.some(sub => sub.subscription_name === subscription_name) && attempts < 10) {
        randomSuffix = generateRandomTwoDigits();
        subscription_name = `${tenant.tenant_url}-dev-${randomSuffix}`;
        attempts++;
      }
      
      if (attempts >= 10) {
        logger.error('Failed to generate unique subscription name after 10 attempts', {
          correlationId: req.correlationId,
          tenant_id,
          tenant_url: tenant.tenant_url,
        });
        sendError(
          res,
          'InternalError',
          'Failed to generate unique subscription name',
          req.correlationId
        );
        return;
      }
    }

    // Generate tenant URLs based on deployment type, region, and subscription type
    const { tenantUrl, tenantApiUrl } = generateTenantUrls(tenant, subscription_type_level, randomSuffix);

    // Get AWS region code for subscription storage
    const awsRegionCode = getAwsRegionCode(tenant.region, tenant.deployment_type);

    // Create subscription record with all tenant information
    const subscriptionData = {
      tenant_id,
      subscription_name,
      subscription_type_level,
      tenant_url: tenantUrl,
      tenant_api_url: tenantApiUrl,
      domain_name,
      region: awsRegionCode,
      deployment_type: tenant.deployment_type,
      subscription_type_id: tenant.subscription_type_id!,
      package_id: tenant.package_id!,
      cluster_id: tenant.cluster_id,
      cluster_name: tenant.cluster_name,
    };

    const result = await dynamoDBHelper.createSubscription(subscriptionData, req.correlationId);

    if (!result.success) {
      logger.warn('Subscription creation failed', {
        correlationId: req.correlationId,
        tenant_id,
        subscription_name,
        subscription_type_level,
        error: result.error,
      });
      
      sendError(
        res,
        'InternalError',
        'Failed to create subscription',
        req.correlationId
      );
      return;
    }

    logger.info('Subscription creation successful', {
      correlationId: req.correlationId,
      subscriptionId: result.data?.subscription_id,
      tenant_id: result.data?.tenant_id,
      subscription_name: result.data?.subscription_name,
      subscription_type_level: result.data?.subscription_type_level,
      tenant_url: result.data?.tenant_url,
      tenant_api_url: result.data?.tenant_api_url,
      status: result.data?.status,
      createdBy: req.context.staff_id,
    });

    // Prepare for future downstream provisioning workflows
    logger.info('Subscription ready for downstream provisioning', {
      correlationId: req.correlationId,
      subscriptionId: result.data?.subscription_id,
      tenant_id: result.data?.tenant_id,
      subscription_type_level: result.data?.subscription_type_level,
      tenantDeploymentType: tenant.deployment_type,
      tenantRegion: tenant.region,
      tenantSubscriptionType: tenant.subscription_type_id,
      tenantPackageName: tenant.package_id,
    });

    // Return success response
    res.status(201).json({
      success: true,
      data: {
        subscription_id: result.data?.subscription_id,
        tenant_id: result.data?.tenant_id,
        subscription_name: result.data?.subscription_name,
        subscription_type_level: result.data?.subscription_type_level,
        tenant_url: result.data?.tenant_url,
        tenant_api_url: result.data?.tenant_api_url,
        domain_name: result.data?.domain_name,
        region: result.data?.region,
        deployment_type: result.data?.deployment_type,
        subscription_type_id: result.data?.subscription_type_id,
        subscription_type_name: subscriptionTypeResult.subscriptionType.subscription_type_name,
        package_id: result.data?.package_id,
        package_name: packageResult.package.package_name,
        cluster_id: result.data?.cluster_id,
        cluster_name: result.data?.cluster_name,
        status: result.data?.status,
        created_at: result.data?.created_at,
        updated_at: result.data?.updated_at,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Subscription creation handler error', {
      correlationId: req.correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    sendError(res, 'InternalError', 'Subscription creation failed', req.correlationId);
  }
};