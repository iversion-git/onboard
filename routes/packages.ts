// Package routes registration
import type { InternalRouter } from '../lib/router.js';
import { authMiddleware, requireAdminOrManager, requireAdmin } from '../middleware/auth.js';
import { listPackagesHandler, createPackageHandler } from '../handlers/packages/index.js';

export function registerPackageRoutes(router: InternalRouter): void {
  // GET /packages - List all active packages for dropdown (admin/manager only)
  router.get('/packages',
    authMiddleware(),
    requireAdminOrManager,
    listPackagesHandler
  );

  // POST /packages/create - Create new package (admin only)
  router.post('/packages/create',
    authMiddleware(),
    requireAdmin,
    createPackageHandler
  );
}