/**
 * Unit tests for Lambda Authorizer
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { APIGatewayRequestAuthorizerEvent, Context as LambdaContext } from 'aws-lambda';

// Mock the shared core modules
vi.mock('/opt/shared-core/auth.js', () => ({
  JWTAuth: {
    verifyToken: vi.fn(),
    createAuthContext: vi.fn()
  },
  AuthContextManager: {
    validateContext: vi.fn()
  }
}));

vi.mock('/opt/shared-core/logging.js', () => ({
  createLoggerFromCorrelationId: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}));

vi.mock('/opt/shared-core/http.js', () => ({
  generateCorrelationId: vi.fn().mockReturnValue('test-correlation-id')
}));

// Import the handler after mocking
const { handler } = await import('../api/authorizer.js');

// Import mocked modules for type checking
import { JWTAuth, AuthContextManager } from '/opt/shared-core/auth.js';

describe('Lambda Authorizer', () => {
  const mockContext: LambdaContext = {
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'test-authorizer',
    functionVersion: '1',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-authorizer',
    memoryLimitInMB: '256',
    awsRequestId: 'test-request-id',
    logGroupName: '/aws/lambda/test-authorizer',
    logStreamName: '2023/01/01/[$LATEST]test',
    getRemainingTimeInMillis: () => 30000,
    done: vi.fn(),
    fail: vi.fn(),
    succeed: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Token extraction and validation', () => {
    it('should deny access when no authorization header is provided', async () => {
      const event: APIGatewayRequestAuthorizerEvent = {
        type: 'REQUEST',
        methodArn: 'arn:aws:execute-api:us-east-1:123456789012:abcdef123/test/GET/staff/me',
        resource: '/staff/me',
        path: '/staff/me',
        httpMethod: 'GET',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {
          resourceId: 'abc123',
          resourcePath: '/staff/me',
          httpMethod: 'GET',
          extendedRequestId: 'test-extended-id',
          requestTime: '01/Jan/2023:00:00:00 +0000',
          path: '/test/staff/me',
          accountId: '123456789012',
          protocol: 'HTTP/1.1',
          stage: 'test',
          domainPrefix: 'abcdef123',
          requestTimeEpoch: 1672531200000,
          requestId: 'test-request-id',
          identity: {
            cognitoIdentityPoolId: null,
            accountId: null,
            cognitoIdentityId: null,
            caller: null,
            sourceIp: '127.0.0.1',
            principalOrgId: null,
            accessKey: null,
            cognitoAuthenticationType: null,
            cognitoAuthenticationProvider: null,
            userArn: null,
            userAgent: 'test-agent',
            user: null
          },
          domainName: 'abcdef123.execute-api.us-east-1.amazonaws.com',
          apiId: 'abcdef123'
        }
      };

      const result = await handler(event, mockContext);

      expect(result.principalId).toBe('unauthorized');
      expect(result.policyDocument.Statement[0].Effect).toBe('Deny');
    });

    it('should deny access when JWT verification fails', async () => {
      const event: APIGatewayRequestAuthorizerEvent = {
        type: 'REQUEST',
        methodArn: 'arn:aws:execute-api:us-east-1:123456789012:abcdef123/test/GET/staff/me',
        resource: '/staff/me',
        path: '/staff/me',
        httpMethod: 'GET',
        headers: {
          'Authorization': 'Bearer invalid-token'
        },
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {
          resourceId: 'abc123',
          resourcePath: '/staff/me',
          httpMethod: 'GET',
          extendedRequestId: 'test-extended-id',
          requestTime: '01/Jan/2023:00:00:00 +0000',
          path: '/test/staff/me',
          accountId: '123456789012',
          protocol: 'HTTP/1.1',
          stage: 'test',
          domainPrefix: 'abcdef123',
          requestTimeEpoch: 1672531200000,
          requestId: 'test-request-id',
          identity: {
            cognitoIdentityPoolId: null,
            accountId: null,
            cognitoIdentityId: null,
            caller: null,
            sourceIp: '127.0.0.1',
            principalOrgId: null,
            accessKey: null,
            cognitoAuthenticationType: null,
            cognitoAuthenticationProvider: null,
            userArn: null,
            userAgent: 'test-agent',
            user: null
          },
          domainName: 'abcdef123.execute-api.us-east-1.amazonaws.com',
          apiId: 'abcdef123'
        }
      };

      vi.mocked(JWTAuth.verifyToken).mockRejectedValue(new Error('Invalid token'));

      const result = await handler(event, mockContext);

      expect(result.principalId).toBe('unauthorized');
      expect(result.policyDocument.Statement[0].Effect).toBe('Deny');
    });

    it('should allow access for valid token with sufficient permissions', async () => {
      const event: APIGatewayRequestAuthorizerEvent = {
        type: 'REQUEST',
        methodArn: 'arn:aws:execute-api:us-east-1:123456789012:abcdef123/test/GET/staff/me',
        resource: '/staff/me',
        path: '/staff/me',
        httpMethod: 'GET',
        headers: {
          'Authorization': 'Bearer valid-token'
        },
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {
          resourceId: 'abc123',
          resourcePath: '/staff/me',
          httpMethod: 'GET',
          extendedRequestId: 'test-extended-id',
          requestTime: '01/Jan/2023:00:00:00 +0000',
          path: '/test/staff/me',
          accountId: '123456789012',
          protocol: 'HTTP/1.1',
          stage: 'test',
          domainPrefix: 'abcdef123',
          requestTimeEpoch: 1672531200000,
          requestId: 'test-request-id',
          identity: {
            cognitoIdentityPoolId: null,
            accountId: null,
            cognitoIdentityId: null,
            caller: null,
            sourceIp: '127.0.0.1',
            principalOrgId: null,
            accessKey: null,
            cognitoAuthenticationType: null,
            cognitoAuthenticationProvider: null,
            userArn: null,
            userAgent: 'test-agent',
            user: null
          },
          domainName: 'abcdef123.execute-api.us-east-1.amazonaws.com',
          apiId: 'abcdef123'
        }
      };

      const mockJwtPayload = {
        sub: 'staff-123',
        email: 'test@example.com',
        roles: ['staff'],
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      };

      const mockAuthContext = {
        staff_id: 'staff-123',
        email: 'test@example.com',
        roles: ['staff'],
        stage: 'test'
      };

      vi.mocked(JWTAuth.verifyToken).mockResolvedValue(mockJwtPayload);
      vi.mocked(JWTAuth.createAuthContext).mockReturnValue(mockAuthContext);
      vi.mocked(AuthContextManager.validateContext).mockReturnValue(true);

      const result = await handler(event, mockContext);

      expect(result.principalId).toBe('staff-123');
      expect(result.policyDocument.Statement[0].Effect).toBe('Allow');
      expect(result.context).toEqual({
        staff_id: 'staff-123',
        email: 'test@example.com',
        roles: JSON.stringify(['staff']),
        stage: 'test',
        correlationId: 'test-correlation-id'
      });
    });
  });

  describe('Role-based access control', () => {
    it('should deny access when user lacks required permissions', async () => {
      const event: APIGatewayRequestAuthorizerEvent = {
        type: 'REQUEST',
        methodArn: 'arn:aws:execute-api:us-east-1:123456789012:abcdef123/test/POST/staff/register',
        resource: '/staff/register',
        path: '/staff/register',
        httpMethod: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token'
        },
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {
          resourceId: 'abc123',
          resourcePath: '/staff/register',
          httpMethod: 'POST',
          extendedRequestId: 'test-extended-id',
          requestTime: '01/Jan/2023:00:00:00 +0000',
          path: '/test/staff/register',
          accountId: '123456789012',
          protocol: 'HTTP/1.1',
          stage: 'test',
          domainPrefix: 'abcdef123',
          requestTimeEpoch: 1672531200000,
          requestId: 'test-request-id',
          identity: {
            cognitoIdentityPoolId: null,
            accountId: null,
            cognitoIdentityId: null,
            caller: null,
            sourceIp: '127.0.0.1',
            principalOrgId: null,
            accessKey: null,
            cognitoAuthenticationType: null,
            cognitoAuthenticationProvider: null,
            userArn: null,
            userAgent: 'test-agent',
            user: null
          },
          domainName: 'abcdef123.execute-api.us-east-1.amazonaws.com',
          apiId: 'abcdef123'
        }
      };

      const mockJwtPayload = {
        sub: 'staff-123',
        email: 'staff@example.com',
        roles: ['staff'], // Only staff role, but admin required for registration
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      };

      const mockAuthContext = {
        staff_id: 'staff-123',
        email: 'staff@example.com',
        roles: ['staff'],
        stage: 'test'
      };

      vi.mocked(JWTAuth.verifyToken).mockResolvedValue(mockJwtPayload);
      vi.mocked(JWTAuth.createAuthContext).mockReturnValue(mockAuthContext);
      vi.mocked(AuthContextManager.validateContext).mockReturnValue(true);

      const result = await handler(event, mockContext);

      expect(result.principalId).toBe('staff-123');
      expect(result.policyDocument.Statement[0].Effect).toBe('Deny');
    });

    it('should allow access for admin user to admin-only endpoints', async () => {
      const event: APIGatewayRequestAuthorizerEvent = {
        type: 'REQUEST',
        methodArn: 'arn:aws:execute-api:us-east-1:123456789012:abcdef123/test/POST/staff/register',
        resource: '/staff/register',
        path: '/staff/register',
        httpMethod: 'POST',
        headers: {
          'Authorization': 'Bearer admin-token'
        },
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {
          resourceId: 'abc123',
          resourcePath: '/staff/register',
          httpMethod: 'POST',
          extendedRequestId: 'test-extended-id',
          requestTime: '01/Jan/2023:00:00:00 +0000',
          path: '/test/staff/register',
          accountId: '123456789012',
          protocol: 'HTTP/1.1',
          stage: 'test',
          domainPrefix: 'abcdef123',
          requestTimeEpoch: 1672531200000,
          requestId: 'test-request-id',
          identity: {
            cognitoIdentityPoolId: null,
            accountId: null,
            cognitoIdentityId: null,
            caller: null,
            sourceIp: '127.0.0.1',
            principalOrgId: null,
            accessKey: null,
            cognitoAuthenticationType: null,
            cognitoAuthenticationProvider: null,
            userArn: null,
            userAgent: 'test-agent',
            user: null
          },
          domainName: 'abcdef123.execute-api.us-east-1.amazonaws.com',
          apiId: 'abcdef123'
        }
      };

      const mockJwtPayload = {
        sub: 'admin-123',
        email: 'admin@example.com',
        roles: ['admin'],
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      };

      const mockAuthContext = {
        staff_id: 'admin-123',
        email: 'admin@example.com',
        roles: ['admin'],
        stage: 'test'
      };

      vi.mocked(JWTAuth.verifyToken).mockResolvedValue(mockJwtPayload);
      vi.mocked(JWTAuth.createAuthContext).mockReturnValue(mockAuthContext);
      vi.mocked(AuthContextManager.validateContext).mockReturnValue(true);

      const result = await handler(event, mockContext);

      expect(result.principalId).toBe('admin-123');
      expect(result.policyDocument.Statement[0].Effect).toBe('Allow');
    });

    it('should allow manager access to tenant registration', async () => {
      const event: APIGatewayRequestAuthorizerEvent = {
        type: 'REQUEST',
        methodArn: 'arn:aws:execute-api:us-east-1:123456789012:abcdef123/test/POST/tenant/register',
        resource: '/tenant/register',
        path: '/tenant/register',
        httpMethod: 'POST',
        headers: {
          'Authorization': 'Bearer manager-token'
        },
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {
          resourceId: 'abc123',
          resourcePath: '/tenant/register',
          httpMethod: 'POST',
          extendedRequestId: 'test-extended-id',
          requestTime: '01/Jan/2023:00:00:00 +0000',
          path: '/test/tenant/register',
          accountId: '123456789012',
          protocol: 'HTTP/1.1',
          stage: 'test',
          domainPrefix: 'abcdef123',
          requestTimeEpoch: 1672531200000,
          requestId: 'test-request-id',
          identity: {
            cognitoIdentityPoolId: null,
            accountId: null,
            cognitoIdentityId: null,
            caller: null,
            sourceIp: '127.0.0.1',
            principalOrgId: null,
            accessKey: null,
            cognitoAuthenticationType: null,
            cognitoAuthenticationProvider: null,
            userArn: null,
            userAgent: 'test-agent',
            user: null
          },
          domainName: 'abcdef123.execute-api.us-east-1.amazonaws.com',
          apiId: 'abcdef123'
        }
      };

      const mockJwtPayload = {
        sub: 'manager-123',
        email: 'manager@example.com',
        roles: ['manager'],
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      };

      const mockAuthContext = {
        staff_id: 'manager-123',
        email: 'manager@example.com',
        roles: ['manager'],
        stage: 'test'
      };

      vi.mocked(JWTAuth.verifyToken).mockResolvedValue(mockJwtPayload);
      vi.mocked(JWTAuth.createAuthContext).mockReturnValue(mockAuthContext);
      vi.mocked(AuthContextManager.validateContext).mockReturnValue(true);

      const result = await handler(event, mockContext);

      expect(result.principalId).toBe('manager-123');
      expect(result.policyDocument.Statement[0].Effect).toBe('Allow');
    });
  });

  describe('Token format handling', () => {
    it('should handle Bearer token format', async () => {
      const event: APIGatewayRequestAuthorizerEvent = {
        type: 'REQUEST',
        methodArn: 'arn:aws:execute-api:us-east-1:123456789012:abcdef123/test/GET/staff/me',
        resource: '/staff/me',
        path: '/staff/me',
        httpMethod: 'GET',
        headers: {
          'Authorization': 'Bearer valid-token-here'
        },
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {
          resourceId: 'abc123',
          resourcePath: '/staff/me',
          httpMethod: 'GET',
          extendedRequestId: 'test-extended-id',
          requestTime: '01/Jan/2023:00:00:00 +0000',
          path: '/test/staff/me',
          accountId: '123456789012',
          protocol: 'HTTP/1.1',
          stage: 'test',
          domainPrefix: 'abcdef123',
          requestTimeEpoch: 1672531200000,
          requestId: 'test-request-id',
          identity: {
            cognitoIdentityPoolId: null,
            accountId: null,
            cognitoIdentityId: null,
            caller: null,
            sourceIp: '127.0.0.1',
            principalOrgId: null,
            accessKey: null,
            cognitoAuthenticationType: null,
            cognitoAuthenticationProvider: null,
            userArn: null,
            userAgent: 'test-agent',
            user: null
          },
          domainName: 'abcdef123.execute-api.us-east-1.amazonaws.com',
          apiId: 'abcdef123'
        }
      };

      const mockJwtPayload = {
        sub: 'staff-123',
        email: 'test@example.com',
        roles: ['staff'],
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      };

      const mockAuthContext = {
        staff_id: 'staff-123',
        email: 'test@example.com',
        roles: ['staff'],
        stage: 'test'
      };

      vi.mocked(JWTAuth.verifyToken).mockResolvedValue(mockJwtPayload);
      vi.mocked(JWTAuth.createAuthContext).mockReturnValue(mockAuthContext);
      vi.mocked(AuthContextManager.validateContext).mockReturnValue(true);

      const result = await handler(event, mockContext);

      expect(JWTAuth.verifyToken).toHaveBeenCalledWith('valid-token-here');
      expect(result.policyDocument.Statement[0].Effect).toBe('Allow');
    });

    it('should handle direct token format (no Bearer prefix)', async () => {
      const event: APIGatewayRequestAuthorizerEvent = {
        type: 'REQUEST',
        methodArn: 'arn:aws:execute-api:us-east-1:123456789012:abcdef123/test/GET/staff/me',
        resource: '/staff/me',
        path: '/staff/me',
        httpMethod: 'GET',
        headers: {
          'Authorization': 'direct-token-here'
        },
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {
          resourceId: 'abc123',
          resourcePath: '/staff/me',
          httpMethod: 'GET',
          extendedRequestId: 'test-extended-id',
          requestTime: '01/Jan/2023:00:00:00 +0000',
          path: '/test/staff/me',
          accountId: '123456789012',
          protocol: 'HTTP/1.1',
          stage: 'test',
          domainPrefix: 'abcdef123',
          requestTimeEpoch: 1672531200000,
          requestId: 'test-request-id',
          identity: {
            cognitoIdentityPoolId: null,
            accountId: null,
            cognitoIdentityId: null,
            caller: null,
            sourceIp: '127.0.0.1',
            principalOrgId: null,
            accessKey: null,
            cognitoAuthenticationType: null,
            cognitoAuthenticationProvider: null,
            userArn: null,
            userAgent: 'test-agent',
            user: null
          },
          domainName: 'abcdef123.execute-api.us-east-1.amazonaws.com',
          apiId: 'abcdef123'
        }
      };

      const mockJwtPayload = {
        sub: 'staff-123',
        email: 'test@example.com',
        roles: ['staff'],
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      };

      const mockAuthContext = {
        staff_id: 'staff-123',
        email: 'test@example.com',
        roles: ['staff'],
        stage: 'test'
      };

      vi.mocked(JWTAuth.verifyToken).mockResolvedValue(mockJwtPayload);
      vi.mocked(JWTAuth.createAuthContext).mockReturnValue(mockAuthContext);
      vi.mocked(AuthContextManager.validateContext).mockReturnValue(true);

      const result = await handler(event, mockContext);

      expect(JWTAuth.verifyToken).toHaveBeenCalledWith('direct-token-here');
      expect(result.policyDocument.Statement[0].Effect).toBe('Allow');
    });
  });

  describe('Error handling', () => {
    it('should deny access on unexpected errors', async () => {
      const event: APIGatewayRequestAuthorizerEvent = {
        type: 'REQUEST',
        methodArn: 'arn:aws:execute-api:us-east-1:123456789012:abcdef123/test/GET/staff/me',
        resource: '/staff/me',
        path: '/staff/me',
        httpMethod: 'GET',
        headers: {
          'Authorization': 'Bearer valid-token'
        },
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {
          resourceId: 'abc123',
          resourcePath: '/staff/me',
          httpMethod: 'GET',
          extendedRequestId: 'test-extended-id',
          requestTime: '01/Jan/2023:00:00:00 +0000',
          path: '/test/staff/me',
          accountId: '123456789012',
          protocol: 'HTTP/1.1',
          stage: 'test',
          domainPrefix: 'abcdef123',
          requestTimeEpoch: 1672531200000,
          requestId: 'test-request-id',
          identity: {
            cognitoIdentityPoolId: null,
            accountId: null,
            cognitoIdentityId: null,
            caller: null,
            sourceIp: '127.0.0.1',
            principalOrgId: null,
            accessKey: null,
            cognitoAuthenticationType: null,
            cognitoAuthenticationProvider: null,
            userArn: null,
            userAgent: 'test-agent',
            user: null
          },
          domainName: 'abcdef123.execute-api.us-east-1.amazonaws.com',
          apiId: 'abcdef123'
        }
      };

      vi.mocked(JWTAuth.verifyToken).mockRejectedValue(new Error('Unexpected error'));

      const result = await handler(event, mockContext);

      expect(result.principalId).toBe('unauthorized');
      expect(result.policyDocument.Statement[0].Effect).toBe('Deny');
    });

    it('should deny access when auth context validation fails', async () => {
      const event: APIGatewayRequestAuthorizerEvent = {
        type: 'REQUEST',
        methodArn: 'arn:aws:execute-api:us-east-1:123456789012:abcdef123/test/GET/staff/me',
        resource: '/staff/me',
        path: '/staff/me',
        httpMethod: 'GET',
        headers: {
          'Authorization': 'Bearer valid-token'
        },
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {
          resourceId: 'abc123',
          resourcePath: '/staff/me',
          httpMethod: 'GET',
          extendedRequestId: 'test-extended-id',
          requestTime: '01/Jan/2023:00:00:00 +0000',
          path: '/test/staff/me',
          accountId: '123456789012',
          protocol: 'HTTP/1.1',
          stage: 'test',
          domainPrefix: 'abcdef123',
          requestTimeEpoch: 1672531200000,
          requestId: 'test-request-id',
          identity: {
            cognitoIdentityPoolId: null,
            accountId: null,
            cognitoIdentityId: null,
            caller: null,
            sourceIp: '127.0.0.1',
            principalOrgId: null,
            accessKey: null,
            cognitoAuthenticationType: null,
            cognitoAuthenticationProvider: null,
            userArn: null,
            userAgent: 'test-agent',
            user: null
          },
          domainName: 'abcdef123.execute-api.us-east-1.amazonaws.com',
          apiId: 'abcdef123'
        }
      };

      const mockJwtPayload = {
        sub: 'staff-123',
        email: 'test@example.com',
        roles: ['staff'],
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      };

      const mockAuthContext = {
        staff_id: 'staff-123',
        email: 'test@example.com',
        roles: ['staff'],
        stage: 'test'
      };

      vi.mocked(JWTAuth.verifyToken).mockResolvedValue(mockJwtPayload);
      vi.mocked(JWTAuth.createAuthContext).mockReturnValue(mockAuthContext);
      vi.mocked(AuthContextManager.validateContext).mockReturnValue(false); // Invalid context

      const result = await handler(event, mockContext);

      expect(result.principalId).toBe('invalid-context');
      expect(result.policyDocument.Statement[0].Effect).toBe('Deny');
    });
  });
});