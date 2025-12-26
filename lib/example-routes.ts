// Example route registration to demonstrate the routing system
// This file shows how routes will be registered in later tasks
import type { InternalRequest, InternalResponse } from './types.js';
import { InternalRouter } from './router.js';
import { authMiddleware, validationMiddleware, commonSchemas } from '../middleware/index.js';
import { z } from 'zod';

export function registerExampleRoutes(router: InternalRouter): void {
  // Health check endpoint (no auth required)
  router.get('/health', async (req: InternalRequest, res: InternalResponse) => {
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      service: 'aws-lambda-control-plane',
      correlationId: req.correlationId
    });
  });

  // Example authenticated endpoint
  router.get('/staff/me', 
    authMiddleware({ required: true }),
    async (req: InternalRequest, res: InternalResponse) => {
      res.json({
        message: 'This would return staff profile',
        context: req.context,
        correlationId: req.correlationId
      });
    }
  );

  // Example endpoint with validation
  router.post('/example/validate',
    validationMiddleware({
      body: z.object({
        email: commonSchemas.email,
        name: z.string().min(1).max(100)
      })
    }),
    async (req: InternalRequest, res: InternalResponse) => {
      res.json({
        message: 'Validation passed',
        data: req.body,
        correlationId: req.correlationId
      });
    }
  );

  // Example endpoint with path parameters
  router.get('/example/users/:userId',
    validationMiddleware({
      params: z.object({
        userId: z.string().uuid()
      })
    }),
    async (req: InternalRequest, res: InternalResponse) => {
      res.json({
        message: 'User endpoint',
        userId: req.params['userId'],
        correlationId: req.correlationId
      });
    }
  );
}

// This function can be used to set up example routes for testing
export function createExampleRouter(): InternalRouter {
  const router = new InternalRouter();
  registerExampleRoutes(router);
  return router;
}