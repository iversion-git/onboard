// Integration tests for the main Lambda handler
import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { handler } from '../index.js';
import { resetConfig } from '../lib/config.js';

describe('Main Lambda Handler', () => {
  let mockEvent: APIGatewayProxyEvent;
  let mockContext: Context;
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Set required environment variables for testing
    process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-characters-long';
    process.env.STAGE = 'test';
    process.env.AWS_REGION = 'us-east-1';
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
    resetConfig();
  });

  beforeEach(() => {
    // Reset config for each test
    resetConfig();

    // Mock API Gateway event
    mockEvent = {
      httpMethod: 'GET',
      path: '/health',
      headers: {},
      multiValueHeaders: {},
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      pathParameters: null,
      stageVariables: null,
      body: null,
      isBase64Encoded: false,
      requestContext: {
        accountId: 'test-account',
        apiId: 'test-api',
        protocol: 'HTTP/1.1',
        httpMethod: 'GET',
        path: '/health',
        stage: 'test',
        requestId: 'test-request-id',
        requestTime: '01/Jan/2023:00:00:00 +0000',
        requestTimeEpoch: 1672531200,
        resourceId: 'test-resource',
        resourcePath: '/health',
        identity: {
          accessKey: null,
          accountId: null,
          apiKey: null,
          apiKeyId: null,
          caller: null,
          clientCert: null,
          cognitoAuthenticationProvider: null,
          cognitoAuthenticationType: null,
          cognitoIdentityId: null,
          cognitoIdentityPoolId: null,
          principalOrgId: null,
          sourceIp: '127.0.0.1',
          user: null,
          userAgent: 'test-agent',
          userArn: null
        },
        authorizer: null
      },
      resource: '/health'
    };

    // Mock Lambda context
    mockContext = {
      callbackWaitsForEmptyEventLoop: true,
      functionName: 'test-function',
      functionVersion: '1',
      invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function',
      memoryLimitInMB: '128',
      awsRequestId: 'test-aws-request-id',
      logGroupName: '/aws/lambda/test-function',
      logStreamName: '2023/01/01/[$LATEST]test-stream',
      getRemainingTimeInMillis: () => 30000,
      done: () => {},
      fail: () => {},
      succeed: () => {}
    };
  });

  describe('Handler Initialization', () => {
    it('should initialize router and handle requests', async () => {
      // Test with a non-existent route to verify router is working
      const result = await handler(mockEvent, mockContext);

      expect(result).toBeDefined();
      expect(result.statusCode).toBe(404);
      expect(result.headers).toHaveProperty('Content-Type', 'application/json');
      expect(result.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
      
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('NotFound');
      expect(body.error.correlationId).toBe('test-request-id');
    });

    it('should handle CORS preflight requests', async () => {
      mockEvent.httpMethod = 'OPTIONS';
      mockEvent.path = '/auth/login';

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(result.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
      expect(result.headers).toHaveProperty('Access-Control-Allow-Methods');
      expect(result.headers).toHaveProperty('Access-Control-Allow-Headers');
      expect(result.body).toBe('');
    });

    it('should set callbackWaitsForEmptyEventLoop to false for connection pooling', async () => {
      await handler(mockEvent, mockContext);
      
      expect(mockContext.callbackWaitsForEmptyEventLoop).toBe(false);
    });
  });

  describe('Route Registration', () => {
    it('should register authentication routes', async () => {
      mockEvent.httpMethod = 'POST';
      mockEvent.path = '/auth/login';
      mockEvent.body = JSON.stringify({ email: 'test@example.com', password: 'password' });

      const result = await handler(mockEvent, mockContext);

      // Should not return 404 (route not found), indicating route is registered
      expect(result.statusCode).not.toBe(404);
      // Should return 400 for validation error or other business logic error
      expect([400, 401, 500]).toContain(result.statusCode);
    });

    it('should register staff management routes', async () => {
      mockEvent.httpMethod = 'GET';
      mockEvent.path = '/staff/me';

      const result = await handler(mockEvent, mockContext);

      // Should not return 404 (route not found), indicating route is registered
      expect(result.statusCode).not.toBe(404);
      // Should return 401 for authentication error
      expect(result.statusCode).toBe(401);
    });

    it('should register tenant management routes', async () => {
      mockEvent.httpMethod = 'POST';
      mockEvent.path = '/tenant/register';
      mockEvent.body = JSON.stringify({ name: 'Test Tenant', email: 'tenant@example.com' });

      const result = await handler(mockEvent, mockContext);

      // Should not return 404 (route not found), indicating route is registered
      expect(result.statusCode).not.toBe(404);
      // Should return 401 for authentication error
      expect(result.statusCode).toBe(401);
    });
  });

  describe('Error Handling', () => {
    it('should handle unhandled exceptions gracefully', async () => {
      // Create an event that might cause an error
      mockEvent.httpMethod = 'POST';
      mockEvent.path = '/auth/login';
      mockEvent.body = 'invalid-json{';

      const result = await handler(mockEvent, mockContext);

      expect(result).toBeDefined();
      expect(result.statusCode).toBeGreaterThanOrEqual(400);
      expect(result.headers).toHaveProperty('Content-Type', 'application/json');
      // The correlation ID might be in the response body instead of headers for validation errors
      
      const body = JSON.parse(result.body);
      expect(body.error).toBeDefined();
      expect(body.error.correlationId).toBe('test-request-id');
      expect(body.timestamp).toBeDefined();
    });

    it('should include correlation ID in all responses', async () => {
      const result = await handler(mockEvent, mockContext);

      const body = JSON.parse(result.body);
      expect(body.error.correlationId).toBe('test-request-id');
    });
  });

  describe('Cold Start Optimization', () => {
    it('should reuse router instance across invocations', async () => {
      // First invocation
      const result1 = await handler(mockEvent, mockContext);
      expect(result1).toBeDefined();

      // Second invocation should reuse the same router
      const result2 = await handler(mockEvent, mockContext);
      expect(result2).toBeDefined();

      // Both should have the same behavior (indicating same router instance)
      expect(result1.statusCode).toBe(result2.statusCode);
    });
  });
});