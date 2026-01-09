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

    const { name, email, mobile_number, business_name, deployment_type, region, tenant_url } = validation.data;

    // Create tenant record (subscription and package selection moved to subscription creation)
    const tenantData = {
      name,
      email,
      mobile_number,
      business_name,
      deployment_type,
      region,
      tenant_url,
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
      status: result.data?.status,
      createdBy: req.context.staff_id,
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