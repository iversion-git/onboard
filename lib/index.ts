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
export * from './permissions.js';
export * from './data-models.js';

// AWS Integrations and bundled dependencies (selective exports to avoid conflicts)
export { 
  getDynamoDBClient, 
  getTableNames, 
  DynamoDBHelper, 
  dynamoDBHelper,
  getSESClient,
  SESHelper,
  sesHelper,
  emailTemplates,
  JWTHelper,
  jwtHelper,
  hasRole,
  hasAnyRole,
  hasAllRoles,
  hasMinimumRole,
  PasswordHelper,
  passwordHelper,
  initializeAWSIntegrations,
  healthCheckAWSIntegrations,
  type EmailTemplate,
  type PasswordResetEmailData,
  type JWTTokenPayload,
  type AppConfig
} from './aws-integrations.js';

// Data models and validation schemas
export {
  type StaffRecord,
  type PasswordResetToken,
  type TenantRecord,
  type JWTPayload,
  StaffRecordSchema,
  PasswordResetTokenSchema,
  TenantRecordSchema,
  JWTPayloadSchema,
  CreateStaffSchema,
  UpdateStaffSchema,
  CreateTenantSchema,
  LoginSchema,
  PasswordResetRequestSchema,
  PasswordResetConfirmSchema,
  isStaffRecord,
  isPasswordResetToken,
  isTenantRecord,
  isJWTPayload,
  type StaffUpdate,
  type TenantUpdate,
  type DatabaseOperationResult,
  type StaffQueryResult,
  type TenantQueryResult,
  type PasswordResetTokenQueryResult
} from './data-models.js';

// Permission utilities
export {
  PermissionChecker,
  ROLE_HIERARCHY,
  ENDPOINT_PERMISSIONS,
  checkEndpointPermission,
  requireEndpointPermission,
  type Role,
  type PermissionCheckResult
} from './permissions.js';

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