// Package routes registration
import type { InternalRouter } from '../lib/router.js';
import { authMiddleware, requireAdminOrManager } from '../middleware/auth.js';
import { listPackagesHandler } from '../handlers/packages/index.js';

export function registerPackageRoutes(router: InternalRouter): void {
  // GET /packages - List all active packages for dropdown (admin/manager only)
  router.get('/packages',
    authMiddleware(),
    requireAdminOrManager,
    listPackagesHandler
  );
}