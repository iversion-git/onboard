// Stack management routes registration
import type { InternalRouter } from '../lib/router.js';
import { authMiddleware, requireAdminOrManager } from '../middleware/auth.js';
import { validationMiddleware } from '../middleware/validation.js';
import { CreateStackSchema } from '../lib/data-models.js';
import { createStackHandler, listStacksHandler, getStackHandler } from '../handlers/stack/index.js';

export function registerStackRoutes(router: InternalRouter): void {
  // POST /stack/create - Create new stack for tenant (admin/manager only)
  router.post('/stack/create',
    authMiddleware(),
    requireAdminOrManager,
    validationMiddleware({
      body: CreateStackSchema
    }),
    createStackHandler
  );

  // GET /stack/list - List stacks for a tenant (admin/manager only)
  router.get('/stack/list',
    authMiddleware(),
    requireAdminOrManager,
    listStacksHandler
  );

  // GET /stack/:stackId - Get specific stack details (admin/manager only)
  router.get('/stack/:stackId',
    authMiddleware(),
    requireAdminOrManager,
    getStackHandler
  );
}