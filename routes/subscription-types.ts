// Subscription types routes registration
import type { InternalRouter } from '../lib/router.js';
import { authMiddleware, requireAdminOrManager } from '../middleware/auth.js';
import { listSubscriptionTypesHandler } from '../handlers/subscription-types/index.js';

export function registerSubscriptionTypeRoutes(router: InternalRouter): void {
  // GET /subscription-types - List all active subscription types for dropdown (admin/manager only)
  router.get('/subscription-types',
    authMiddleware(),
    requireAdminOrManager,
    listSubscriptionTypesHandler
  );
}