// Subscription management routes registration
import type { InternalRouter } from '../lib/router.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { validationMiddleware } from '../middleware/validation.js';
import { CreateSubscriptionSchema } from '../lib/data-models.js';
import { createSubscriptionHandler, listSubscriptionsHandler, getSubscriptionHandler } from '../handlers/subscription/index.js';

export function registerSubscriptionRoutes(router: InternalRouter): void {
  // POST /subscription/create - Create new subscription for tenant (admin/manager/user can create)
  router.post('/subscription/create',
    authMiddleware(),
    requireRole(['admin', 'manager', 'user']),
    validationMiddleware({
      body: CreateSubscriptionSchema
    }),
    createSubscriptionHandler
  );

  // GET /subscription/list - List subscriptions for a tenant (admin/manager/user can read)
  router.get('/subscription/list',
    authMiddleware(),
    requireRole(['admin', 'manager', 'user']),
    listSubscriptionsHandler
  );

  // GET /subscription/:subscriptionId - Get specific subscription details (admin/manager/user can read)
  router.get('/subscription/:subscriptionId',
    authMiddleware(),
    requireRole(['admin', 'manager', 'user']),
    getSubscriptionHandler
  );
}