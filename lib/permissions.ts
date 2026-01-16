// Permission checking utilities for role-based access control
import type { AuthContext } from './types.js';
import { logger } from './logging.js';

// Role hierarchy levels
export const ROLE_HIERARCHY = {
  user: 1,      // Read-only access to tenants/subscriptions + create new ones
  manager: 2,   // Full access to tenants and subscriptions
  admin: 3,     // Full access to everything
} as const;

export type Role = keyof typeof ROLE_HIERARCHY;

// Permission checking result
export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  requiredRoles?: string[];
  userRoles?: string[];
}

/**
 * Permission checker class for centralized authorization logic
 */
export class PermissionChecker {
  /**
   * Check if user has a specific role
   */
  static hasRole(context: AuthContext, requiredRole: Role): PermissionCheckResult {
    if (!context.authenticated) {
      return {
        allowed: false,
        reason: 'User not authenticated',
        requiredRoles: [requiredRole],
        userRoles: []
      };
    }

    const userRoles = context.roles || [];
    const hasRequiredRole = userRoles.includes(requiredRole);

    return {
      allowed: hasRequiredRole,
      reason: hasRequiredRole ? undefined : `Missing required role: ${requiredRole}`,
      requiredRoles: [requiredRole],
      userRoles
    };
  }

  /**
   * Check if user has any of the specified roles
   */
  static hasAnyRole(context: AuthContext, requiredRoles: Role[]): PermissionCheckResult {
    if (!context.authenticated) {
      return {
        allowed: false,
        reason: 'User not authenticated',
        requiredRoles,
        userRoles: []
      };
    }

    const userRoles = context.roles || [];
    const hasAnyRequiredRole = requiredRoles.some(role => userRoles.includes(role));

    return {
      allowed: hasAnyRequiredRole,
      reason: hasAnyRequiredRole ? undefined : `Missing any of required roles: ${requiredRoles.join(', ')}`,
      requiredRoles,
      userRoles
    };
  }

  /**
   * Check if user has all of the specified roles
   */
  static hasAllRoles(context: AuthContext, requiredRoles: Role[]): PermissionCheckResult {
    if (!context.authenticated) {
      return {
        allowed: false,
        reason: 'User not authenticated',
        requiredRoles,
        userRoles: []
      };
    }

    const userRoles = context.roles || [];
    const hasAllRequiredRoles = requiredRoles.every(role => userRoles.includes(role));

    return {
      allowed: hasAllRequiredRoles,
      reason: hasAllRequiredRoles ? undefined : `Missing required roles: ${requiredRoles.filter(role => !userRoles.includes(role)).join(', ')}`,
      requiredRoles,
      userRoles
    };
  }

  /**
   * Check if user has minimum role level (hierarchical)
   */
  static hasMinimumRole(context: AuthContext, minimumRole: Role): PermissionCheckResult {
    if (!context.authenticated) {
      return {
        allowed: false,
        reason: 'User not authenticated',
        requiredRoles: [minimumRole],
        userRoles: []
      };
    }

    const userRoles = context.roles || [];
    const userMaxLevel = Math.max(...userRoles.map(role => ROLE_HIERARCHY[role as Role] || 0));
    const requiredLevel = ROLE_HIERARCHY[minimumRole];

    const hasMinimumLevel = userMaxLevel >= requiredLevel;

    return {
      allowed: hasMinimumLevel,
      reason: hasMinimumLevel ? undefined : `Insufficient role level. Required: ${minimumRole} (level ${requiredLevel}), user max level: ${userMaxLevel}`,
      requiredRoles: [minimumRole],
      userRoles
    };
  }

  /**
   * Check if user is admin
   */
  static isAdmin(context: AuthContext): PermissionCheckResult {
    return this.hasRole(context, 'admin');
  }

  /**
   * Check if user is admin or manager
   */
  static isAdminOrManager(context: AuthContext): PermissionCheckResult {
    return this.hasAnyRole(context, ['admin', 'manager']);
  }

  /**
   * Check if user can access their own resource or is admin
   */
  static canAccessOwnResourceOrAdmin(context: AuthContext, resourceOwnerId: string): PermissionCheckResult {
    if (!context.authenticated) {
      return {
        allowed: false,
        reason: 'User not authenticated',
        userRoles: []
      };
    }

    const userRoles = context.roles || [];
    const isAdmin = userRoles.includes('admin');
    const isOwner = context.staff_id === resourceOwnerId;

    const allowed = isAdmin || isOwner;

    return {
      allowed,
      reason: allowed ? undefined : 'Access denied: not resource owner and not admin',
      userRoles
    };
  }

  /**
   * Log permission check result
   */
  static logPermissionCheck(
    operation: string,
    result: PermissionCheckResult,
    context: AuthContext,
    correlationId?: string
  ): void {
    const logData = {
      operation,
      allowed: result.allowed,
      reason: result.reason,
      staffId: context.staff_id,
      userRoles: result.userRoles,
      requiredRoles: result.requiredRoles,
      correlationId
    };

    if (result.allowed) {
      logger.info('Permission check passed', logData);
    } else {
      logger.warn('Permission check failed', logData);
    }
  }
}

// Convenience functions for common permission checks
export const hasRole = (context: AuthContext, role: Role): boolean => 
  PermissionChecker.hasRole(context, role).allowed;

export const hasAnyRole = (context: AuthContext, roles: Role[]): boolean => 
  PermissionChecker.hasAnyRole(context, roles).allowed;

export const hasAllRoles = (context: AuthContext, roles: Role[]): boolean => 
  PermissionChecker.hasAllRoles(context, roles).allowed;

export const hasMinimumRole = (context: AuthContext, minimumRole: Role): boolean => 
  PermissionChecker.hasMinimumRole(context, minimumRole).allowed;

export const isAdmin = (context: AuthContext): boolean => 
  PermissionChecker.isAdmin(context).allowed;

export const isAdminOrManager = (context: AuthContext): boolean => 
  PermissionChecker.isAdminOrManager(context).allowed;

export const canAccessOwnResourceOrAdmin = (context: AuthContext, resourceOwnerId: string): boolean => 
  PermissionChecker.canAccessOwnResourceOrAdmin(context, resourceOwnerId).allowed;

// Endpoint-specific permission definitions
export const ENDPOINT_PERMISSIONS = {
  // Authentication endpoints (public)
  'POST /auth/login': { public: true },
  'POST /auth/password-reset/request': { public: true },
  'POST /auth/password-reset/confirm': { public: true },

  // Staff management endpoints
  'POST /staff/register': { roles: ['admin'] },
  'POST /staff/enable': { roles: ['admin'] },
  'POST /staff/disable': { roles: ['admin'] },
  'GET /staff/me': { authenticated: true },

  // Tenant management endpoints
  'POST /tenant/register': { roles: ['admin', 'manager'] },
} as const;

/**
 * Check if user has permission for a specific endpoint
 */
export function checkEndpointPermission(
  method: string,
  path: string,
  context: AuthContext
): PermissionCheckResult {
  const endpoint = `${method} ${path}` as keyof typeof ENDPOINT_PERMISSIONS;
  const permission = ENDPOINT_PERMISSIONS[endpoint];

  if (!permission) {
    return {
      allowed: false,
      reason: `No permission configuration found for endpoint: ${endpoint}`
    };
  }

  // Public endpoints
  if ('public' in permission && permission.public) {
    return { allowed: true };
  }

  // Authenticated endpoints
  if ('authenticated' in permission && permission.authenticated) {
    return {
      allowed: context.authenticated,
      reason: context.authenticated ? undefined : 'Authentication required'
    };
  }

  // Role-based endpoints
  if ('roles' in permission && permission.roles) {
    return PermissionChecker.hasAnyRole(context, permission.roles as Role[]);
  }

  return {
    allowed: false,
    reason: 'Invalid permission configuration'
  };
}

/**
 * Middleware factory for endpoint-specific permissions
 */
export function requireEndpointPermission(method: string, path: string) {
  return async (req: any, res: any, next: () => Promise<void>) => {
    const result = checkEndpointPermission(method, path, req.context);
    
    PermissionChecker.logPermissionCheck(
      `${method} ${path}`,
      result,
      req.context,
      req.correlationId
    );

    if (!result.allowed) {
      const { sendError } = await import('./response.js');
      const errorType = !req.context.authenticated ? 'Unauthorized' : 'Forbidden';
      sendError(res, errorType, result.reason || 'Access denied', req.correlationId);
      return;
    }

    await next();
  };
}