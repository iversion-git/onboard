// Staff management routes registration
import type { InternalRouter } from '../lib/router.js';
import { authMiddleware, requireAdmin } from '../middleware/auth.js';
import { validationMiddleware } from '../middleware/validation.js';
import { CreateStaffSchema } from '../lib/data-models.js';
import { z } from 'zod';
import { 
  registerHandler, 
  enableHandler, 
  disableHandler,
  meHandler,
  listStaffHandler
} from '../handlers/staff/index.js';

// Validation schemas for staff management endpoints
const EnableStaffSchema = z.object({
  staff_id: z.string().uuid(),
});

const DisableStaffSchema = z.object({
  staff_id: z.string().uuid(),
});

export function registerStaffRoutes(router: InternalRouter): void {
  // POST /staff/register - Create new staff account (admin only)
  router.post('/staff/register',
    authMiddleware(),
    requireAdmin,
    validationMiddleware({
      body: CreateStaffSchema
    }),
    registerHandler
  );

  // POST /staff/enable - Enable staff account (admin only)
  router.post('/staff/enable',
    authMiddleware(),
    requireAdmin,
    validationMiddleware({
      body: EnableStaffSchema
    }),
    enableHandler
  );

  // POST /staff/disable - Disable staff account (admin only)
  router.post('/staff/disable',
    authMiddleware(),
    requireAdmin,
    validationMiddleware({
      body: DisableStaffSchema
    }),
    disableHandler
  );

  // GET /staff/me - Get current staff profile (authenticated users)
  router.get('/staff/me',
    authMiddleware(),
    meHandler
  );

  // GET /staff/list - List all staff members (admin only)
  router.get('/staff/list',
    authMiddleware(),
    requireAdmin,
    listStaffHandler
  );
}