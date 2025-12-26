// Tenant management routes registration
import type { InternalRouter } from '../lib/router.js';
import { authMiddleware, requireAdminOrManager } from '../middleware/auth.js';
import { validationMiddleware } from '../middleware/validation.js';
import { CreateTenantSchema } from '../lib/data-models.js';
import { registerHandler } from '../handlers/tenant/index.js';

export function registerTenantRoutes(router: InternalRouter): void {
  // POST /tenant/register - Create new tenant (admin/manager only)
  router.post('/tenant/register',
    authMiddleware(),
    requireAdminOrManager,
    validationMiddleware({
      body: CreateTenantSchema
    }),
    registerHandler
  );
}