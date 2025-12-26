// Cluster management routes registration
import type { InternalRouter } from '../lib/router.js';
import { authMiddleware, requireAdmin } from '../middleware/auth.js';
import { validationMiddleware } from '../middleware/validation.js';
import { CreateClusterSchema } from '../lib/data-models.js';
import { 
  listHandler, 
  createHandler, 
  deployHandler,
  statusHandler 
} from '../handlers/cluster/index.js';

export function registerClusterRoutes(router: InternalRouter): void {
  // GET /clusters - List all clusters (admin only)
  router.get('/clusters',
    authMiddleware(),
    requireAdmin,
    listHandler
  );

  // POST /clusters - Create new cluster (admin only)
  router.post('/clusters',
    authMiddleware(),
    requireAdmin,
    validationMiddleware({
      body: CreateClusterSchema
    }),
    createHandler
  );

  // POST /clusters/{id}/deploy - Deploy cluster infrastructure (admin only)
  router.post('/clusters/:id/deploy',
    authMiddleware(),
    requireAdmin,
    deployHandler
  );

  // GET /clusters/{id}/status - Get cluster deployment status (admin only)
  router.get('/clusters/:id/status',
    authMiddleware(),
    requireAdmin,
    statusHandler
  );
}