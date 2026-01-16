// PUT /tenant/:tenantId handler - Update tenant information
import type { RouteHandler } from '../../lib/types.js';
import { dynamoDBHelper } from '../../lib/dynamodb.js';
import { logger } from '../../lib/logging.js';
import { sendError } from '../../lib/response.js';
import { z } from 'zod';
import type { TenantUpdate } from '../../lib/data-models.js';

// Schema for updatable tenant fields
const UpdateTenantSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().optional(),
  mobile_number: z.string().min(1).max(20).optional(),
  business_name: z.string().min(1).max(255).optional(),
  status: z.enum(['Pending', 'Active', 'Suspended', 'Terminated']).optional(),
}).strict();

export const updateTenantHandler: RouteHandler = async (req, res) => {
  try {
    const tenantId = req.params?.['tenantId'];

    if (!tenantId) {
      sendError(res, 'ValidationError', 'Tenant ID is required', req.correlationId);
      return;
    }

    logger.info('Processing update tenant request', {
      correlationId: req.correlationId,
      requestedBy: req.context.staff_id,
      tenantId,
      updateFields: Object.keys(req.body || {}),
    });

    // Validate request body
    const validation = UpdateTenantSchema.safeParse(req.body);
    if (!validation.success) {
      logger.warn('Update tenant validation failed', {
        correlationId: req.correlationId,
        errors: validation.error.issues,
      });
      sendError(
        res,
        'ValidationError',
        'Invalid update data',
        req.correlationId,
        { validationErrors: validation.error.issues }
      );
      return;
    }

    const updates = validation.data;

    // Check if there are any fields to update
    if (Object.keys(updates).length === 0) {
      sendError(res, 'ValidationError', 'No fields to update', req.correlationId);
      return;
    }

    // Check if tenant exists
    const existingTenant = await dynamoDBHelper.getTenant(tenantId, req.correlationId);
    if (!existingTenant.found || !existingTenant.tenant) {
      logger.warn('Tenant not found for update', {
        correlationId: req.correlationId,
        tenantId,
      });
      sendError(res, 'NotFound', 'Tenant not found', req.correlationId);
      return;
    }

    // Check if trying to change status back to Pending from Active
    if (updates.status === 'Pending' && existingTenant.tenant.status === 'Active') {
      logger.warn('Cannot change tenant status from Active back to Pending', {
        correlationId: req.correlationId,
        tenantId,
        currentStatus: existingTenant.tenant.status,
        requestedStatus: updates.status,
      });
      sendError(res, 'ValidationError', 'Cannot change tenant status from Active back to Pending', req.correlationId);
      return;
    }

    // Check if user is admin when trying to update status
    if (updates.status && req.context.roles && !req.context.roles.includes('admin')) {
      logger.warn('Non-admin attempted to update tenant status', {
        correlationId: req.correlationId,
        tenantId,
        requestedBy: req.context.staff_id,
        roles: req.context.roles,
      });
      sendError(res, 'Forbidden', 'Only admins can update tenant status', req.correlationId);
      return;
    }

    // Perform the update - cast to TenantUpdate type
    const result = await dynamoDBHelper.updateTenant(tenantId, updates as TenantUpdate, req.correlationId);

    if (!result.success || !result.data) {
      throw new Error('Failed to update tenant');
    }

    // If status was changed to Suspended or Terminated, cascade to all subscriptions
    if (updates.status && (updates.status === 'Suspended' || updates.status === 'Terminated')) {
      logger.info('Cascading tenant status change to subscriptions', {
        correlationId: req.correlationId,
        tenantId,
        tenantStatus: updates.status,
      });

      try {
        // Get all subscriptions for this tenant
        const subscriptions = await dynamoDBHelper.getSubscriptionsByTenant(tenantId, req.correlationId);

        // Update each subscription's status to match tenant status
        const updatePromises = subscriptions.map(subscription => 
          dynamoDBHelper.updateSubscription(
            subscription.subscription_id,
            { status: updates.status as 'Suspended' | 'Terminated' },
            req.correlationId
          )
        );

        await Promise.all(updatePromises);

        logger.info('Successfully cascaded status to subscriptions', {
          correlationId: req.correlationId,
          tenantId,
          subscriptionCount: subscriptions.length,
          newStatus: updates.status,
        });
      } catch (cascadeError) {
        logger.error('Failed to cascade status to subscriptions', {
          correlationId: req.correlationId,
          tenantId,
          error: cascadeError instanceof Error ? cascadeError.message : 'Unknown error',
        });
        // Don't fail the tenant update if cascade fails, just log it
      }
    }

    logger.info('Tenant updated successfully', {
      correlationId: req.correlationId,
      tenantId,
      updatedFields: Object.keys(updates),
    });

    res.status(200).json({
      success: true,
      data: result.data,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Update tenant handler error', {
      correlationId: req.correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    sendError(res, 'InternalError', 'Failed to update tenant', req.correlationId);
  }
};
