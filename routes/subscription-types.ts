// Subscription types routes registration
import type { InternalRouter } from '../lib/router.js';
import { authMiddleware, requireAdminOrManager, requireAdmin } from '../middleware/auth.js';
import { listSubscriptionTypesHandler, createSubscriptionTypeHandler } from '../handlers/subscription-types/index.js';

export function registerSubscriptionTypeRoutes(router: InternalRouter): void {
  // GET /subscription-types - List all active subscription types for dropdown (admin/manager only)
  router.get('/subscription-types',
    authMiddleware(),
    requireAdminOrManager,
    listSubscriptionTypesHandler
  );

  // POST /subscription-types/create - Create new subscription type (admin only)
  router.post('/subscription-types/create',
    authMiddleware(),
    requireAdmin,
    createSubscriptionTypeHandler
  );
}