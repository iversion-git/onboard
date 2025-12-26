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
        errors: validation.error.errors,
      });
      sendError(
        res,
        'ValidationError',
        'Invalid tenant registration data',
        req.correlationId,
        { validationErrors: validation.error.errors }
      );
      return;
    }

    const { name, email, contact_info } = validation.data;

    // Create tenant record
    const tenantData = {
      name,
      email,
      contact_info: contact_info || {},
    };

    const result = await dynamoDBHelper.createTenant(tenantData, req.correlationId);

    if (!result.success) {
      logger.warn('Tenant registration failed', {
        correlationId: req.correlationId,
        name,
        email,
        error: result.error,
      });
      
      if (result.error?.includes('already exists') || result.error?.includes('Conflict')) {
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
      status: result.data?.status,
      createdBy: req.context.staff_id,
    });

    // Prepare for future downstream provisioning workflows
    // This is where we would trigger downstream provisioning workflows in the future
    logger.info('Tenant ready for downstream provisioning', {
      correlationId: req.correlationId,
      tenantId: result.data?.tenant_id,
      status: result.data?.status,
    });

    // Return success response
    res.status(201).json({
      success: true,
      data: {
        tenant_id: result.data?.tenant_id,
        name: result.data?.name,
        email: result.data?.email,
        contact_info: result.data?.contact_info,
        status: result.data?.status,
        created_at: result.data?.created_at,
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