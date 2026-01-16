// POST /packages/create handler - Create new package (Admin only)
import type { RouteHandler } from '../../lib/types.js';
import { dynamoDBHelper } from '../../lib/dynamodb.js';
import { logger } from '../../lib/logging.js';
import { sendError } from '../../lib/response.js';
import { z } from 'zod';

// Schema for creating a new package
const CreatePackageSchema = z.object({
  package_name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
}).strict();

export const createPackageHandler: RouteHandler = async (req, res) => {
  try {
    logger.info('Processing create package request', {
      correlationId: req.correlationId,
      requestedBy: req.context.staff_id,
    });

    // Validate request body
    const validation = CreatePackageSchema.safeParse(req.body);
    if (!validation.success) {
      logger.warn('Create package validation failed', {
        correlationId: req.correlationId,
        errors: validation.error.issues,
      });
      sendError(
        res,
        'ValidationError',
        'Invalid package data',
        req.correlationId,
        { validationErrors: validation.error.issues }
      );
      return;
    }

    const packageData = validation.data;

    // Get all existing packages to determine next package_id
    const existingPackages = await dynamoDBHelper.getAllPackages(req.correlationId);
    
    // Find the highest package_id and increment by 10
    const maxPackageId = existingPackages.length > 0
      ? Math.max(...existingPackages.map(pkg => pkg.package_id))
      : 0;
    const newPackageId = maxPackageId + 10;

    // Create the package
    const result = await dynamoDBHelper.createPackage(
      {
        package_id: newPackageId,
        package_name: packageData.package_name,
        description: packageData.description,
        active: true, // New packages are active by default
      },
      req.correlationId
    );

    if (!result.success || !result.data) {
      throw new Error('Failed to create package');
    }

    logger.info('Package created successfully', {
      correlationId: req.correlationId,
      packageId: result.data.package_id,
      packageName: result.data.package_name,
    });

    res.status(201).json({
      success: true,
      data: result.data,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Create package handler error', {
      correlationId: req.correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    sendError(res, 'InternalError', 'Failed to create package', req.correlationId);
  }
};
