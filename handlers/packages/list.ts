// GET /packages handler - List all active packages for dropdown
import type { RouteHandler } from '../../lib/types.js';
import { dynamoDBHelper } from '../../lib/dynamodb.js';
import { logger } from '../../lib/logging.js';
import { sendError } from '../../lib/response.js';

export const listPackagesHandler: RouteHandler = async (req, res) => {
  try {
    logger.info('Processing packages list request', {
      correlationId: req.correlationId,
      requestedBy: req.context?.staff_id,
    });

    // Get all active packages
    const packages = await dynamoDBHelper.getAllActivePackages(req.correlationId);
    
    // Filter only active packages and format for frontend dropdown
    const activePackages = packages
      .map(pkg => ({
        package_id: pkg.package_id,
        package_name: pkg.package_name,
        description: pkg.description,
        price: pkg.price,
        features: pkg.features
      }))
      .sort((a, b) => a.package_id - b.package_id); // Sort by ID

    logger.info('Packages list retrieved successfully', {
      correlationId: req.correlationId,
      packageCount: activePackages.length,
    });

    // Return success response
    res.status(200).json({
      success: true,
      data: {
        packages: activePackages,
        total_count: activePackages.length
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Packages list handler error', {
      correlationId: req.correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    sendError(res, 'InternalError', 'Failed to retrieve packages', req.correlationId);
  }
};