// Tenant management routes registration
import type { InternalRouter } from '../lib/router.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { validationMiddleware } from '../middleware/validation.js';
import { CreateTenantSchema } from '../lib/data-models.js';
import { registerHandler, availableClustersHandler, listTenantsHandler } from '../handlers/tenant/index.js';

export function registerTenantRoutes(router: InternalRouter): void {
  // POST /tenant/register - Create new tenant (admin/manager/user can create)
  router.post('/tenant/register',
    authMiddleware(),
    requireRole(['admin', 'manager', 'user']),
    validationMiddleware({
      body: CreateTenantSchema
    }),
    registerHandler
  );

  // GET /tenant/available-clusters - Get available clusters by deployment type (admin/manager/user can read)
  router.get('/tenant/available-clusters',
    authMiddleware(),
    requireRole(['admin', 'manager', 'user']),
    availableClustersHandler
  );

  // GET /tenant/list - List all tenants with optional filtering and search (admin/manager/user can read)
  router.get('/tenant/list',
    authMiddleware(),
    requireRole(['admin', 'manager', 'user']),
    listTenantsHandler
  );
}