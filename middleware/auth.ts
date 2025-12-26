// Authentication middleware for JWT verification
import type { Middleware, AuthContext } from '../lib/types.js';
import { sendError } from '../lib/response.js';

// Placeholder for JWT verification - will be implemented in task 5
// This middleware sets up the structure for authentication
export function authMiddleware(options: { required?: boolean } = {}): Middleware {
  const { required = true } = options;

  return async (req, res, next) => {
    try {
      const authHeader = req.headers['authorization'] || req.headers['Authorization'];
      
      if (!authHeader) {
        if (required) {
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

      if (!authHeader.startsWith('Bearer ')) {
        sendError(res, 'Unauthorized', 'Invalid authorization header format', req.correlationId);
        return;
      }

      const token = authHeader.slice(7); // Remove 'Bearer ' prefix

      // TODO: Implement JWT verification in task 5
      // For now, we'll create a placeholder that will be replaced
      const authContext = await verifyJwtToken(token);
      
      if (!authContext.authenticated) {
        sendError(res, 'Unauthorized', 'Invalid or expired token', req.correlationId);
        return;
      }

      // Set authenticated context
      req.context = authContext;
      await next();

    } catch (error) {
      console.error('Authentication middleware error:', error);
      sendError(res, 'Unauthorized', 'Authentication failed', req.correlationId);
    }
  };
}

// Placeholder JWT verification function - will be implemented in task 5
async function verifyJwtToken(_token: string): Promise<AuthContext> {
  // TODO: Implement actual JWT verification using jose library
  // This is a placeholder that will be replaced in task 5
  
  // For now, return unauthenticated context
  return {
    authenticated: false
  };
}

// Authorization middleware for role-based access control
export function requireRole(roles: string[]): Middleware {
  return async (req, res, next) => {
    if (!req.context.authenticated) {
      sendError(res, 'Unauthorized', 'Authentication required', req.correlationId);
      return;
    }

    const userRoles = req.context.roles || [];
    const hasRequiredRole = roles.some(role => userRoles.includes(role));

    if (!hasRequiredRole) {
      sendError(
        res, 
        'Forbidden', 
        `Insufficient permissions. Required roles: ${roles.join(', ')}`, 
        req.correlationId
      );
      return;
    }

    await next();
  };
}

// Convenience middleware for admin-only routes
export const requireAdmin = requireRole(['admin']);

// Convenience middleware for admin or manager routes
export const requireAdminOrManager = requireRole(['admin', 'manager']);