// Main Lambda handler entry point with internal routing
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { createRouterForEnvironment } from './lib/setup.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerStaffRoutes } from './routes/staff.js';
import { registerTenantRoutes } from './routes/tenant.js';

// Create router instance with environment-specific configuration
const router = createRouterForEnvironment();

// Register authentication routes
registerAuthRoutes(router);

// Register staff management routes
registerStaffRoutes(router);

// Register tenant management routes
registerTenantRoutes(router);

// Main Lambda handler
export const handler = async (
  event: APIGatewayProxyEvent, 
  context: Context
): Promise<APIGatewayProxyResult> => {
  // Use the internal router to handle all requests
  return await router.handle(event, context);
};