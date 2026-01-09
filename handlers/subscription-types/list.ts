// GET /subscription-types handler - List all active subscription types for dropdown
import type { RouteHandler } from '../../lib/types.js';
import { dynamoDBHelper } from '../../lib/dynamodb.js';
import { logger } from '../../lib/logging.js';
import { sendError } from '../../lib/response.js';

export const listSubscriptionTypesHandler: RouteHandler = async (req, res) => {
  try {
    logger.info('Processing subscription types list request', {
      correlationId: req.correlationId,
      requestedBy: req.context?.staff_id,
    });

    // Get all active subscription types
    const subscriptionTypes = await dynamoDBHelper.getAllActiveSubscriptionTypes(req.correlationId);
    
    // Filter only active subscription types and format for frontend dropdown
    const activeSubscriptionTypes = subscriptionTypes
      .map(st => ({
        subscription_type_id: st.subscription_type_id,
        subscription_type_name: st.subscription_type_name,
        description: st.description
      }))
      .sort((a, b) => a.subscription_type_id - b.subscription_type_id); // Sort by ID

    logger.info('Subscription types list retrieved successfully', {
      correlationId: req.correlationId,
      subscriptionTypeCount: activeSubscriptionTypes.length,
    });

    // Return success response
    res.status(200).json({
      success: true,
      data: {
        subscription_types: activeSubscriptionTypes,
        total_count: activeSubscriptionTypes.length
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Subscription types list handler error', {
      correlationId: req.correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    sendError(res, 'InternalError', 'Failed to retrieve subscription types', req.correlationId);
  }
};