// Main exports for lib utilities
export * from './types.js';
export * from './config.js';
export * from './errors.js';
export * from './http.js';
export * from './logging.js';
export * from './request.js';
export * from './response.js';
export * from './router.js';
export * from './setup.js';

// Convenience re-exports for common patterns
export { getLogger, log, createRequestLogger, createAuditLogger } from './logging.js';
export { loadConfig, getConfig, getCorsOrigins, getJwtSecret } from './config.js';
export { 
  ValidationError, 
  UnauthorizedError, 
  ForbiddenError, 
  NotFoundError, 
  ConflictError, 
  InternalError,
  handleError,
  asyncHandler 
} from './errors.js';
export { ResponseBuilder, sendError } from './response.js';
export { InternalRouter } from './router.js';
export { createConfiguredRouter, createRouterForEnvironment } from './setup.js';