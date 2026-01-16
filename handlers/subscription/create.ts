// POST /subscription/create handler with admin/manager authorization
import type { RouteHandler } from '../../lib/types.js';
import { dynamoDBHelper } from '../../lib/dynamodb.js';
import { logger } from '../../lib/logging.js';
import { sendError } from '../../lib/response.js';
import { CreateSubscriptionSchema } from '../../lib/data-models.js';
import { generateTenantUrls, getAwsRegionCode, generateRandomTwoDigits } from '../../lib/url-utils.js';
import { 
  generateDatabaseName, 
  generateDatabaseUsername, 
  generateDatabasePassword, 
  generateS3Id, 
  mapSubscriptionToEnvironment,
  extractDomain,
  generateTenantFullUrl,
  generateDatabaseUrl,
  extractDatabaseHostname
} from '../../lib/landlord-utils.js';

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

    const { tenant_id, subscription_type_level, domain_name, number_of_stores = 1, cluster_id, subscription_type_id, subscription_type, package_id, package_name } = validation.data;

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

    // Check if tenant status allows subscription creation
    if (tenant.status !== 'Active') {
      logger.warn('Cannot create subscription for non-active tenant', {
        correlationId: req.correlationId,
        tenant_id,
        tenantStatus: tenant.status,
      });
      sendError(
        res,
        'ValidationError',
        `Cannot create subscription for tenant with status: ${tenant.status}. Tenant must be Active.`,
        req.correlationId
      );
      return;
    }

    // Resolve subscription type (either from ID or name)
    let finalSubscriptionTypeId = subscription_type_id;
    let subscriptionTypeRecord;

    if (subscription_type_id) {
      const subscriptionTypeResult = await dynamoDBHelper.getSubscriptionType(subscription_type_id, req.correlationId);
      if (!subscriptionTypeResult.found || !subscriptionTypeResult.subscriptionType) {
        logger.warn('Invalid subscription_type_id provided for subscription creation', {
          correlationId: req.correlationId,
          subscription_type_id,
        });
        sendError(
          res,
          'ValidationError',
          `Invalid subscription type ID: ${subscription_type_id}`,
          req.correlationId
        );
        return;
      }
      subscriptionTypeRecord = subscriptionTypeResult.subscriptionType;
    } else if (subscription_type) {
      const subscriptionTypes = await dynamoDBHelper.getAllActiveSubscriptionTypes(req.correlationId);
      subscriptionTypeRecord = subscriptionTypes.find(st => st.subscription_type_name === subscription_type);
      
      if (!subscriptionTypeRecord) {
        logger.warn('Invalid subscription_type provided for subscription creation', {
          correlationId: req.correlationId,
          subscription_type,
        });
        sendError(
          res,
          'ValidationError',
          `Invalid subscription type: ${subscription_type}`,
          req.correlationId
        );
        return;
      }
      finalSubscriptionTypeId = subscriptionTypeRecord.subscription_type_id;
    }

    // Resolve package (either from ID or name)
    let finalPackageId = package_id;
    let packageRecord;

    if (package_id) {
      const packageResult = await dynamoDBHelper.getPackage(package_id, req.correlationId);
      if (!packageResult.found || !packageResult.package) {
        logger.warn('Invalid package_id provided for subscription creation', {
          correlationId: req.correlationId,
          package_id,
        });
        sendError(
          res,
          'ValidationError',
          `Invalid package ID: ${package_id}`,
          req.correlationId
        );
        return;
      }
      packageRecord = packageResult.package;
    } else if (package_name) {
      const packages = await dynamoDBHelper.getAllActivePackages(req.correlationId);
      packageRecord = packages.find(pkg => pkg.package_name === package_name);
      
      if (!packageRecord) {
        logger.warn('Invalid package_name provided for subscription creation', {
          correlationId: req.correlationId,
          package_name,
        });
        sendError(
          res,
          'ValidationError',
          `Invalid package name: ${package_name}`,
          req.correlationId
        );
        return;
      }
      finalPackageId = packageRecord.package_id;
    }

    // Validate subscription type and package are active
    if (!subscriptionTypeRecord!.active) {
      logger.warn('Inactive subscription type for subscription creation', {
        correlationId: req.correlationId,
        subscription_type_id: finalSubscriptionTypeId,
      });
      sendError(
        res,
        'ValidationError',
        'Subscription type is not active',
        req.correlationId
      );
      return;
    }

    if (!packageRecord!.active) {
      logger.warn('Inactive package for subscription creation', {
        correlationId: req.correlationId,
        package_id: finalPackageId,
      });
      sendError(
        res,
        'ValidationError',
        'Package is not active',
        req.correlationId
      );
      return;
    }

    // Get cluster information for subscription
    const clusterResult = await dynamoDBHelper.getCluster(cluster_id, req.correlationId);
    if (!clusterResult.found || !clusterResult.cluster) {
      logger.warn('Invalid cluster_id provided for subscription creation', {
        correlationId: req.correlationId,
        cluster_id,
        tenant_id,
      });
      sendError(
        res,
        'ValidationError',
        'Invalid cluster ID provided',
        req.correlationId
      );
      return;
    }

    const cluster = clusterResult.cluster;
    
    // Extract DB proxy URL from cluster stack outputs if available
    const dbProxyUrl = cluster.stack_outputs?.DBProxyEndpoint || 
                      cluster.stack_outputs?.DatabaseEndpoint || 
                      undefined;

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

    // Generate subscription name and URLs based on tenant URL and type
    let randomSuffix: string | undefined;
    
    if (subscription_type_level === 'Production') {
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
    }

    // Generate tenant URLs based on deployment type, region, and subscription type
    const { tenantUrl, tenantApiUrl } = generateTenantUrls(tenant, subscription_type_level, randomSuffix);

    // Check uniqueness of URLs and domain name
    const [isTenantUrlUnique, isTenantApiUrlUnique, isDomainNameUnique] = await Promise.all([
      dynamoDBHelper.checkTenantUrlUniqueness(tenantUrl, req.correlationId),
      dynamoDBHelper.checkTenantApiUrlUniqueness(tenantApiUrl, req.correlationId),
      dynamoDBHelper.checkDomainNameUniqueness(domain_name, req.correlationId)
    ]);

    if (!isTenantUrlUnique) {
      logger.warn('Tenant URL is not unique', {
        correlationId: req.correlationId,
        tenantUrl,
        tenant_id,
      });
      sendError(
        res,
        'Conflict',
        `Tenant URL '${tenantUrl}' is already in use`,
        req.correlationId
      );
      return;
    }

    if (!isTenantApiUrlUnique) {
      logger.warn('Tenant API URL is not unique', {
        correlationId: req.correlationId,
        tenantApiUrl,
        tenant_id,
      });
      sendError(
        res,
        'Conflict',
        `Tenant API URL '${tenantApiUrl}' is already in use`,
        req.correlationId
      );
      return;
    }

    if (!isDomainNameUnique) {
      logger.warn('Domain name is not unique', {
        correlationId: req.correlationId,
        domain_name,
        tenant_id,
      });
      sendError(
        res,
        'Conflict',
        `Domain name '${domain_name}' is already in use`,
        req.correlationId
      );
      return;
    }

    // Get AWS region code for subscription storage
    const awsRegionCode = getAwsRegionCode(tenant.region, tenant.deployment_type);

    // Create subscription record with essential cluster information
    const subscriptionData = {
      tenant_id,
      tenant_name: tenant.business_name, // Copy business name from tenant
      subscription_type_level,
      tenant_url: tenantUrl,
      tenant_api_url: tenantApiUrl,
      domain_name,
      number_of_stores,
      region: awsRegionCode,
      deployment_type: tenant.deployment_type,
      subscription_type_id: finalSubscriptionTypeId!,
      package_id: finalPackageId!,
      cluster_id: cluster_id,
      cluster_name: cluster.name,
      cluster_region: cluster.region,
      db_proxy_url: dbProxyUrl,
    };

    const result = await dynamoDBHelper.createSubscription(subscriptionData, req.correlationId);

    if (!result.success) {
      logger.warn('Subscription creation failed', {
        correlationId: req.correlationId,
        tenant_id,
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

    // Step 2: Create landlord record in global table
    try {
      logger.info('Creating landlord record for subscription', {
        correlationId: req.correlationId,
        subscriptionId: result.data?.subscription_id,
        tenant_id,
      });

      // Generate required fields for landlord record
      const databaseName = generateDatabaseName(tenant.tenant_url, subscription_type_level);
      const dbUsername = generateDatabaseUsername();
      const dbPassword = generateDatabasePassword();
      const s3Id = generateS3Id(`${result.data?.subscription_id}-${Date.now()}`);
      const environment = mapSubscriptionToEnvironment(subscription_type_level);
      const domain = extractDomain(domain_name);

      // Create landlord record
      const landlordData = {
        id: result.data?.subscription_id!,
        name: tenant.business_name,
        domain: tenantUrl, // Generated tenant URL without https:// (e.g., "acme-corp-prod.shared.au.myapp.com")
        database: databaseName,
        dbusername: dbUsername,
        dbpassword: dbPassword,
        dburl: extractDatabaseHostname(dbProxyUrl), // Just the DB hostname without port (e.g., "prod-db-01-instance-1.cabaivmklndo.ap-southeast-2.rds.amazonaws.com")
        s3id: s3Id,
        url: `https://${extractDomain(domain_name)}`, // Full URL of the domain supplied during subscription creation (e.g., "https://acme-corp.com")
        api_url: tenantApiUrl, // Generated tenant API URL without https:// (e.g., "tenant1.au.flowrix.app")
        package_id: result.data?.package_id!,
        industry_id: result.data?.subscription_type_id!,
        environment: environment,
        outlets: result.data?.number_of_stores!,
      };

      const landlordResult = await dynamoDBHelper.createLandlord(landlordData, req.correlationId);

      if (!landlordResult.success) {
        logger.error('Failed to create landlord record', {
          correlationId: req.correlationId,
          subscriptionId: result.data?.subscription_id,
          error: landlordResult.error,
        });
        
        // Note: We don't rollback subscription creation here as it's already committed
        // This could be enhanced with compensation patterns in the future
        logger.warn('Subscription created but landlord record failed - manual intervention may be required', {
          correlationId: req.correlationId,
          subscriptionId: result.data?.subscription_id,
        });
      } else {
        logger.info('Landlord record created successfully', {
          correlationId: req.correlationId,
          subscriptionId: result.data?.subscription_id,
          landlordId: landlordResult.data?.id,
          databaseName,
          s3Id,
        });
      }
    } catch (landlordError) {
      logger.error('Landlord record creation failed with exception', {
        correlationId: req.correlationId,
        subscriptionId: result.data?.subscription_id,
        error: landlordError instanceof Error ? landlordError.message : 'Unknown error',
      });
      
      // Continue with response even if landlord creation fails
      // This ensures subscription creation is not blocked by landlord table issues
    }

    logger.info('Subscription creation successful', {
      correlationId: req.correlationId,
      subscriptionId: result.data?.subscription_id,
      tenant_id: result.data?.tenant_id,
      tenant_name: result.data?.tenant_name,
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
      subscriptionTypeId: finalSubscriptionTypeId,
      packageId: finalPackageId,
    });

    // Return success response
    res.status(201).json({
      success: true,
      data: {
        subscription_id: result.data?.subscription_id,
        tenant_id: result.data?.tenant_id,
        tenant_name: result.data?.tenant_name,
        subscription_type_level: result.data?.subscription_type_level,
        tenant_url: result.data?.tenant_url,
        tenant_api_url: result.data?.tenant_api_url,
        domain_name: result.data?.domain_name,
        number_of_stores: result.data?.number_of_stores,
        region: result.data?.region,
        deployment_type: result.data?.deployment_type,
        subscription_type_id: result.data?.subscription_type_id,
        subscription_type_name: subscriptionTypeRecord!.subscription_type_name,
        package_id: result.data?.package_id,
        package_name: packageRecord!.package_name,
        cluster_id: result.data?.cluster_id,
        cluster_name: result.data?.cluster_name,
        cluster_region: result.data?.cluster_region,
        db_proxy_url: result.data?.db_proxy_url,
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