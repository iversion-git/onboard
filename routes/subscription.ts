// Subscription management routes registration
import type { InternalRouter } from '../lib/router.js';
import { authMiddleware, requireAdminOrManager } from '../middleware/auth.js';
import { validationMiddleware } from '../middleware/validation.js';
import { CreateSubscriptionSchema } from '../lib/data-models.js';
import { createSubscriptionHandler, listSubscriptionsHandler, getSubscriptionHandler } from '../handlers/subscription/index.js';

export function registerSubscriptionRoutes(router: InternalRouter): void {
  // POST /subscription/create - Create new subscription for tenant (admin/manager only)
  router.post('/subscription/create',
    authMiddleware(),
    requireAdminOrManager,
    validationMiddleware({
      body: CreateSubscriptionSchema
    }),
    createSubscriptionHandler
  );

  // GET /subscription/list - List subscriptions for a tenant (admin/manager only)
  router.get('/subscription/list',
    authMiddleware(),
    requireAdminOrManager,
    listSubscriptionsHandler
  );

  // GET /subscription/:subscriptionId - Get specific subscription details (admin/manager only)
  router.get('/subscription/:subscriptionId',
    authMiddleware(),
    requireAdminOrManager,
    getSubscriptionHandler
  );
}