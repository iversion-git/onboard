// Authentication middleware for JWT verification
import type { Middleware, AuthContext } from '../lib/types.js';
import { sendError } from '../lib/response.js';
import { jwtHelper, JWTHelper } from '../lib/jwt.js';
import { logger } from '../lib/logging.js';

export function authMiddleware(options: { required?: boolean } = {}): Middleware {
  const { required = true } = options;

  return async (req, res, next) => {
    try {
      const authHeader = req.headers['authorization'] || req.headers['Authorization'];
      
      if (!authHeader) {
        if (required) {
          logger.warn('Missing authorization header', { 
            correlationId: req.correlationId,
            path: req.path,
            method: req.method 
          });
          sendError(res, 'Unauthorized', 'Missing authorization header', req.correlationId);
          return;
        } else {
          // Set unauthenticated context for optional auth
          req.context = {
            authenticated: false
          };
          await next();
          return;
        }
      }

      // Extract token from Authorization header
      const token = JWTHelper.extractTokenFromHeader(authHeader);
      
      if (!token) {
        logger.warn('Invalid authorization header format', { 
          correlationId: req.correlationId,
          path: req.path,
          method: req.method 
        });
        sendError(res, 'Unauthorized', 'Invalid authorization header format', req.correlationId);
        return;
      }

      // Check if token is expired before verification (optimization)
      if (JWTHelper.isTokenExpired(token)) {
        logger.warn('Token is expired', { 
          correlationId: req.correlationId,
          path: req.path,
          method: req.method 
        });
        sendError(res, 'Unauthorized', 'Token has expired', req.correlationId);
        return;
      }

      // Verify JWT token
      const jwtPayload = await jwtHelper.verifyToken(token, req.correlationId);
      
      // Create authenticated context
      const authContext: AuthContext = {
        staff_id: jwtPayload.sub,
        email: jwtPayload.email,
        roles: jwtPayload.roles,
        stage: process.env['STAGE'] || 'dev',
        authenticated: true
      };

      // Set authenticated context
      req.context = authContext;
      
      logger.info('Authentication successful', {
        staffId: authContext.staff_id,
        email: authContext.email,
        roles: authContext.roles,
        correlationId: req.correlationId,
        path: req.path,
        method: req.method
      });

      await next();

    } catch (error) {
      logger.error('Authentication middleware error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId: req.correlationId,
        path: req.path,
        method: req.method
      });
      
      // Determine specific error type
      if (error instanceof Error) {
        if (error.message.includes('expired') || error.message.includes('exp')) {
          sendError(res, 'Unauthorized', 'Token has expired', req.correlationId);
        } else if (error.message.includes('signature') || error.message.includes('invalid')) {
          sendError(res, 'Unauthorized', 'Invalid token signature', req.correlationId);
        } else {
          sendError(res, 'Unauthorized', 'Authentication failed', req.correlationId);
        }
      } else {
        sendError(res, 'Unauthorized', 'Authentication failed', req.correlationId);
      }
    }
  };
}

// Authorization middleware for role-based access control
export function requireRole(roles: string[]): Middleware {
  return async (req, res, next) => {
    if (!req.context.authenticated) {
      logger.warn('Authorization failed: not authenticated', {
        correlationId: req.correlationId,
        path: req.path,
        method: req.method,
        requiredRoles: roles
      });
      sendError(res, 'Unauthorized', 'Authentication required', req.correlationId);
      return;
    }

    const userRoles = req.context.roles || [];
    const hasRequiredRole = roles.some(role => userRoles.includes(role));

    if (!hasRequiredRole) {
      logger.warn('Authorization failed: insufficient permissions', {
        correlationId: req.correlationId,
        path: req.path,
        method: req.method,
        userRoles,
        requiredRoles: roles
      });
      sendError(
        res, 
        'Forbidden', 
        `Insufficient permissions. Required roles: ${roles.join(', ')}`, 
        req.correlationId
      );
      return;
    }

    logger.info('Authorization successful', {
      correlationId: req.correlationId,
      path: req.path,
      method: req.method,
      userRoles,
      requiredRoles: roles
    });

    await next();
  };
}

// Authorization middleware for minimum role level (hierarchical)
export function requireMinimumRole(minimumRole: 'staff' | 'manager' | 'admin'): Middleware {
  return async (req, res, next) => {
    if (!req.context.authenticated) {
      logger.warn('Authorization failed: not authenticated', {
        correlationId: req.correlationId,
        path: req.path,
        method: req.method,
        minimumRole
      });
      sendError(res, 'Unauthorized', 'Authentication required', req.correlationId);
      return;
    }

    const userRoles = req.context.roles || [];
    
    // Role hierarchy: admin > manager > staff
    const roleHierarchy = {
      staff: 1,
      manager: 2,
      admin: 3,
    };

    const userMaxRole = Math.max(...userRoles.map(role => roleHierarchy[role as keyof typeof roleHierarchy] || 0));
    const requiredLevel = roleHierarchy[minimumRole];

    if (userMaxRole < requiredLevel) {
      logger.warn('Authorization failed: insufficient role level', {
        correlationId: req.correlationId,
        path: req.path,
        method: req.method,
        userRoles,
        minimumRole,
        userMaxRole,
        requiredLevel
      });
      sendError(
        res, 
        'Forbidden', 
        `Insufficient permissions. Minimum role required: ${minimumRole}`, 
        req.correlationId
      );
      return;
    }

    logger.info('Authorization successful', {
      correlationId: req.correlationId,
      path: req.path,
      method: req.method,
      userRoles,
      minimumRole
    });

    await next();
  };
}

// Convenience middleware for admin-only routes
export const requireAdmin = requireRole(['admin']);

// Convenience middleware for admin or manager routes
export const requireAdminOrManager = requireRole(['admin', 'manager']);