// POST /subscription-types/create handler - Create new subscription type (Admin only)
import type { RouteHandler } from '../../lib/types.js';
import { dynamoDBHelper } from '../../lib/dynamodb.js';
import { logger } from '../../lib/logging.js';
import { sendError } from '../../lib/response.js';
import { z } from 'zod';

// Schema for creating a new subscription type
const CreateSubscriptionTypeSchema = z.object({
  subscription_type_name: z.string().min(1).max(100),
}).strict();

export const createSubscriptionTypeHandler: RouteHandler = async (req, res) => {
  try {
    logger.info('Processing create subscription type request', {
      correlationId: req.correlationId,
      requestedBy: req.context.staff_id,
    });

    // Validate request body
    const validation = CreateSubscriptionTypeSchema.safeParse(req.body);
    if (!validation.success) {
      logger.warn('Create subscription type validation failed', {
        correlationId: req.correlationId,
        errors: validation.error.issues,
      });
      sendError(
        res,
        'ValidationError',
        'Invalid subscription type data',
        req.correlationId,
        { validationErrors: validation.error.issues }
      );
      return;
    }

    const subscriptionTypeData = validation.data;

    // Get all existing subscription types to determine next subscription_type_id
    const existingTypes = await dynamoDBHelper.getAllSubscriptionTypes(req.correlationId);
    
    // Find the highest subscription_type_id and increment by 10
    const maxTypeId = existingTypes.length > 0
      ? Math.max(...existingTypes.map(type => type.subscription_type_id))
      : 0;
    const newTypeId = maxTypeId + 10;

    // Create the subscription type
    const result = await dynamoDBHelper.createSubscriptionType(
      {
        subscription_type_id: newTypeId,
        subscription_type_name: subscriptionTypeData.subscription_type_name,
        active: true, // New subscription types are active by default
      },
      req.correlationId
    );

    if (!result.success || !result.data) {
      throw new Error('Failed to create subscription type');
    }

    logger.info('Subscription type created successfully', {
      correlationId: req.correlationId,
      subscriptionTypeId: result.data.subscription_type_id,
      subscriptionTypeName: result.data.subscription_type_name,
    });

    res.status(201).json({
      success: true,
      data: result.data,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Create subscription type handler error', {
      correlationId: req.correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    sendError(res, 'InternalError', 'Failed to create subscription type', req.correlationId);
  }
};
