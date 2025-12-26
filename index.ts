// Main Lambda handler entry point with internal routing
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { createRouterForEnvironment } from './lib/setup.js';

// Create router instance with environment-specific configuration
const router = createRouterForEnvironment();

// TODO: Route handlers will be registered in later tasks
// Example of how routes will be registered:
// router.get('/health', async (req, res) => {
//   res.json({ status: 'healthy', timestamp: new Date().toISOString() });
// });

// Main Lambda handler
export const handler = async (
  event: APIGatewayProxyEvent, 
  context: Context
): Promise<APIGatewayProxyResult> => {
  // Use the internal router to handle all requests
  return await router.handle(event, context);
};