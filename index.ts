// Main Lambda handler entry point with internal routing
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { createRouterForEnvironment } from './lib/setup.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerStaffRoutes } from './routes/staff.js';
import { registerTenantRoutes } from './routes/tenant.js';
import { registerClusterRoutes } from './routes/cluster.js';
import { logger } from './lib/logging.js';

// Global router instance for cold start optimization
let router: ReturnType<typeof createRouterForEnvironment> | null = null;

// Initialize router with all routes (called once during cold start)
function initializeRouter() {
  if (router) {
    return router;
  }

  logger.info('Initializing Lambda function with internal routing');
  
  try {
    // Create router instance with environment-specific configuration
    router = createRouterForEnvironment();

    // Register all route handlers
    registerAuthRoutes(router);
    registerStaffRoutes(router);
    registerTenantRoutes(router);
    registerClusterRoutes(router);

    logger.info('Router initialized successfully with all routes registered');
    return router;
  } catch (error) {
    logger.error('Failed to initialize router', { error });
    throw error;
  }
}

// Main Lambda handler with cold start optimization and connection pooling
export const handler = async (
  event: APIGatewayProxyEvent, 
  context: Context
): Promise<APIGatewayProxyResult> => {
  // Configure Lambda context for optimal performance
  context.callbackWaitsForEmptyEventLoop = false; // Don't wait for empty event loop (connection pooling)

  try {
    // Initialize router on first invocation (cold start optimization)
    const routerInstance = initializeRouter();

    // Add request correlation ID for tracing
    const correlationId = event.requestContext?.requestId || 'unknown';
    const method = event.httpMethod || (event as any).requestContext?.http?.method || 'UNKNOWN';
    const path = event.path || (event as any).rawPath || '/';
    
    logger.info('Processing request', { 
      method,
      path,
      correlationId,
      coldStart: !router // Log if this is a cold start
    });

    // Use the internal router to handle all requests
    const result = await routerInstance.handle(event, context);

    logger.info('Request processed successfully', {
      statusCode: result.statusCode,
      correlationId
    });

    return result;

  } catch (error) {
    // Global error handler for unhandled exceptions
    const correlationId = event.requestContext?.requestId || 'unknown';
    logger.error('Unhandled error in Lambda handler', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      correlationId 
    });

    // Return standardized error response
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'X-Correlation-ID': correlationId
      },
      body: JSON.stringify({
        error: {
          code: 'InternalError',
          message: 'Internal server error',
          correlationId
        },
        timestamp: new Date().toISOString()
      })
    };
  }
};