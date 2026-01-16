// PUT /subscription/:subscriptionId handler - Update subscription information
import type { RouteHandler } from '../../lib/types.js';
import { dynamoDBHelper } from '../../lib/dynamodb.js';
import { logger } from '../../lib/logging.js';
import { sendError } from '../../lib/response.js';
import { z } from 'zod';

// Schema for updatable subscription fields
const UpdateSubscriptionSchema = z.object({
  package_id: z.number().int().positive().optional(),
  tenant_url: z.string().min(1).max(255).optional(),
  tenant_api_url: z.string().min(1).max(255).optional(),
  domain_name: z.string().url().optional(),
  number_of_stores: z.number().int().min(1).optional(),
  status: z.enum(['Pending', 'Deploying', 'Active', 'Failed', 'Suspended', 'Terminated']).optional(),
}).strict();

export const updateSubscriptionHandler: RouteHandler = async (req, res) => {
  try {
    const subscriptionId = req.params?.['subscriptionId'];

    if (!subscriptionId) {
      sendError(res, 'ValidationError', 'Subscription ID is required', req.correlationId);
      return;
    }

    logger.info('Processing update subscription request', {
      correlationId: req.correlationId,
      requestedBy: req.context.staff_id,
      subscriptionId,
      updateFields: Object.keys(req.body || {}),
    });

    // Validate request body
    const validation = UpdateSubscriptionSchema.safeParse(req.body);
    if (!validation.success) {
      logger.warn('Update subscription validation failed', {
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

    // Check if subscription exists
    const existingSubscription = await dynamoDBHelper.getSubscription(subscriptionId, req.correlationId);
    if (!existingSubscription.found || !existingSubscription.subscription) {
      logger.warn('Subscription not found for update', {
        correlationId: req.correlationId,
        subscriptionId,
      });
      sendError(res, 'NotFound', 'Subscription not found', req.correlationId);
      return;
    }

    const subscription = existingSubscription.subscription;

    // Check if user is admin when trying to update status
    if (updates.status && req.context.roles && !req.context.roles.includes('admin')) {
      logger.warn('Non-admin attempted to update subscription status', {
        correlationId: req.correlationId,
        subscriptionId,
        requestedBy: req.context.staff_id,
        roles: req.context.roles,
      });
      sendError(res, 'Forbidden', 'Only admins can update subscription status', req.correlationId);
      return;
    }

    // If package_id is being updated, validate it exists
    if (updates.package_id) {
      const packageResult = await dynamoDBHelper.getPackage(updates.package_id, req.correlationId);
      if (!packageResult.found || !packageResult.package) {
        logger.warn('Invalid package_id provided for subscription update', {
          correlationId: req.correlationId,
          package_id: updates.package_id,
        });
        sendError(res, 'ValidationError', `Invalid package ID: ${updates.package_id}`, req.correlationId);
        return;
      }
    }

    // Perform the subscription update - cast to SubscriptionUpdate type
    const result = await dynamoDBHelper.updateSubscription(
      subscriptionId, 
      updates as any, 
      req.correlationId
    );

    if (!result.success || !result.data) {
      throw new Error('Failed to update subscription');
    }

    const updatedSubscription = result.data;

    // Update landlord global table if URL or domain fields changed
    if (updates.tenant_url || updates.tenant_api_url || updates.domain_name || updates.number_of_stores) {
      logger.info('Updating landlord global table', {
        correlationId: req.correlationId,
        subscriptionId,
        tenantId: subscription.tenant_id,
      });

      try {
        // Get landlord record by subscription ID (landlord.id = subscription_id)
        const landlordResult = await dynamoDBHelper.getLandlord(subscriptionId, req.correlationId);
        
        if (landlordResult.found && landlordResult.landlord) {
          // Prepare landlord updates
          const landlordUpdates: any = {};
          
          if (updates.tenant_url) {
            landlordUpdates.domain = updates.tenant_url;
          }
          
          if (updates.tenant_api_url) {
            landlordUpdates.api_url = updates.tenant_api_url;
          }
          
          if (updates.domain_name) {
            landlordUpdates.url = updates.domain_name;
          }
          
          if (updates.number_of_stores) {
            landlordUpdates.outlets = updates.number_of_stores;
          }

          // Update landlord record
          await dynamoDBHelper.updateLandlord(subscriptionId, landlordUpdates, req.correlationId);

          logger.info('Landlord global table updated successfully', {
            correlationId: req.correlationId,
            subscriptionId,
            updatedFields: Object.keys(landlordUpdates),
          });
        } else {
          logger.warn('Landlord record not found for subscription', {
            correlationId: req.correlationId,
            subscriptionId,
          });
        }
      } catch (landlordError) {
        logger.error('Failed to update landlord global table', {
          correlationId: req.correlationId,
          subscriptionId,
          error: landlordError instanceof Error ? landlordError.message : 'Unknown error',
        });
        // Don't fail the subscription update if landlord update fails
      }
    }

    logger.info('Subscription updated successfully', {
      correlationId: req.correlationId,
      subscriptionId,
      updatedFields: Object.keys(updates),
    });

    res.status(200).json({
      success: true,
      data: updatedSubscription,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Update subscription handler error', {
      correlationId: req.correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    sendError(res, 'InternalError', 'Failed to update subscription', req.correlationId);
  }
};
