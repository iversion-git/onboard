/**
 * Lambda Authorizer for centralized JWT verification and role-based access control
 * Implements Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

import type { 
  APIGatewayRequestAuthorizerEvent, 
  APIGatewayAuthorizerResult,
  Context as LambdaContext
} from 'aws-lambda';
import { JWTAuth, AuthContextManager } from '/opt/shared-core/auth.js';
import { createLoggerFromCorrelationId } from '/opt/shared-core/logging.js';
import { generateCorrelationId } from '/opt/shared-core/http.js';

// Role requirements for different endpoints
const ENDPOINT_ROLE_REQUIREMENTS: Record<string, string[]> = {
  // Staff management endpoints - admin only
  'POST /staff/register': ['admin'],
  'POST /staff/enable': ['admin'],
  'POST /staff/disable': ['admin'],
  
  // Tenant management - admin or manager
  'POST /tenant/register': ['admin', 'manager'],
  
  // Profile access - any authenticated user
  'GET /staff/me': ['admin', 'manager', 'staff']
};

/**
 * Extract JWT token from Authorization header
 */
function extractToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader) {
    return null;
  }

  // Support both "Bearer <token>" and just "<token>" formats
  const bearerMatch = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  if (bearerMatch) {
    return bearerMatch[1];
  }

  // If no Bearer prefix, treat the entire header as the token
  return authorizationHeader.trim();
}

/**
 * Generate policy document for API Gateway
 */
function generatePolicy(
  principalId: string,
  effect: 'Allow' | 'Deny',
  resource: string,
  context?: Record<string, any>
): APIGatewayAuthorizerResult {
  return {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource
        }
      ]
    },
    context: context || {}
  };
}

/**
 * Check if user has required permissions for the endpoint
 */
function hasRequiredPermissions(
  method: string,
  path: string,
  userRoles: string[]
): boolean {
  const endpointKey = `${method} ${path}`;
  const requiredRoles = ENDPOINT_ROLE_REQUIREMENTS[endpointKey];

  // If no specific role requirements, allow any authenticated user
  if (!requiredRoles) {
    return true;
  }

  // Check if user has any of the required roles
  return requiredRoles.some(role => userRoles.includes(role));
}

/**
 * Lambda Authorizer handler
 */
export async function handler(
  event: APIGatewayRequestAuthorizerEvent,
  context: LambdaContext
): Promise<APIGatewayAuthorizerResult> {
  const correlationId = generateCorrelationId();
  const logger = createLoggerFromCorrelationId('authorizer', correlationId);

  logger.info('Authorization request received', {
    methodArn: event.methodArn,
    httpMethod: event.httpMethod,
    path: event.path,
    headers: Object.keys(event.headers || {})
  });

  try {
    // Extract JWT token from Authorization header
    const authHeader = event.headers?.['Authorization'] || event.headers?.['authorization'];
    const token = extractToken(authHeader);

    if (!token) {
      logger.warn('No authorization token provided');
      return generatePolicy('unauthorized', 'Deny', event.methodArn);
    }

    // Verify JWT token
    let jwtPayload;
    try {
      jwtPayload = await JWTAuth.verifyToken(token);
    } catch (error) {
      logger.warn('JWT token verification failed', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return generatePolicy('unauthorized', 'Deny', event.methodArn);
    }

    // Create auth context
    const authContext = JWTAuth.createAuthContext(jwtPayload);

    // Validate auth context structure
    if (!AuthContextManager.validateContext(authContext)) {
      logger.error('Invalid auth context structure', { authContext });
      return generatePolicy('invalid-context', 'Deny', event.methodArn);
    }

    // Check role-based permissions for the specific endpoint
    const hasPermission = hasRequiredPermissions(
      event.httpMethod || 'GET',
      event.path || '/',
      authContext.roles
    );

    if (!hasPermission) {
      logger.warn('Insufficient permissions for endpoint', {
        staffId: authContext.staff_id,
        userRoles: authContext.roles,
        method: event.httpMethod,
        path: event.path,
        requiredRoles: ENDPOINT_ROLE_REQUIREMENTS[`${event.httpMethod} ${event.path}`]
      });
      return generatePolicy(authContext.staff_id, 'Deny', event.methodArn);
    }

    // Authorization successful - pass context to business lambda
    logger.info('Authorization successful', {
      staffId: authContext.staff_id,
      email: authContext.email,
      roles: authContext.roles,
      method: event.httpMethod,
      path: event.path
    });

    return generatePolicy(authContext.staff_id, 'Allow', event.methodArn, {
      // Pass auth context to business lambda
      staff_id: authContext.staff_id,
      email: authContext.email,
      roles: JSON.stringify(authContext.roles), // API Gateway context values must be strings
      stage: authContext.stage,
      correlationId
    });

  } catch (error) {
    logger.error('Authorizer error', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    // Deny access on any unexpected error
    return generatePolicy('error', 'Deny', event.methodArn);
  }
}