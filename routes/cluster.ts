// Cluster management routes registration
import type { InternalRouter } from '../lib/router.js';
import { authMiddleware, requireAdmin } from '../middleware/auth.js';
import { validationMiddleware } from '../middleware/validation.js';
import { CreateClusterSchema } from '../lib/data-models.js';
import { 
  listHandler, 
  createHandler, 
  deployHandler,
  statusHandler,
  deleteHandler 
} from '../handlers/cluster/index.js';

export function registerClusterRoutes(router: InternalRouter): void {
  // GET /clusters - List all clusters (admin only)
  router.get('/clusters',
    authMiddleware(),
    requireAdmin,
    listHandler
  );

  // POST /cluster/register - Create new cluster (admin only)
  router.post('/cluster/register',
    authMiddleware(),
    requireAdmin,
    validationMiddleware({
      body: CreateClusterSchema
    }),
    createHandler
  );

  // POST /cluster/{id}/deploy - Deploy cluster infrastructure (admin only)
  router.post('/cluster/:id/deploy',
    authMiddleware(),
    requireAdmin,
    deployHandler
  );

  // GET /cluster/{id}/status - Get cluster deployment status (admin only)
  router.get('/cluster/:id/status',
    authMiddleware(),
    requireAdmin,
    statusHandler
  );

  // DELETE /cluster/{id} - Delete In-Active cluster from database (admin only)
  router.delete('/cluster/:id',
    authMiddleware(),
    requireAdmin,
    deleteHandler
  );
}