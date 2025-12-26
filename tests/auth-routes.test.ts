// Authentication routes integration tests
import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { InternalRouter } from '../lib/router.js';
import { registerAuthRoutes } from '../routes/auth.js';
import { createConfiguredRouter } from '../lib/setup.js';

// Set up test environment variables
beforeAll(() => {
  process.env['JWT_SECRET'] = 'test-jwt-secret-that-is-at-least-32-characters-long-for-security';
  process.env['STAGE'] = 'test';
  process.env['AWS_REGION'] = 'us-east-1';
  process.env['DYNAMODB_STAFF_TABLE'] = 'Staff-test';
  process.env['DYNAMODB_PASSWORD_RESET_TOKENS_TABLE'] = 'PasswordResetTokens-test';
  process.env['DYNAMODB_TENANTS_TABLE'] = 'Tenants-test';
  process.env['SES_FROM_EMAIL'] = 'test@example.com';
  process.env['APP_BASE_URL'] = 'https://test.example.com';
});

// Mock AWS services for testing
const mockEvent = (method: string, path: string, body?: any): APIGatewayProxyEvent => ({
  httpMethod: method,
  path,
  headers: {
    'Content-Type': 'application/json',
  },
  body: body ? JSON.stringify(body) : null,
  isBase64Encoded: false,
  queryStringParameters: null,
  pathParameters: null,
  stageVariables: null,
  requestContext: {
    requestId: 'test-request-id',
    stage: 'test',
    resourceId: 'test-resource',
    resourcePath: path,
    httpMethod: method,
    requestTime: '2023-01-01T00:00:00.000Z',
    requestTimeEpoch: 1672531200000,
    identity: {
      sourceIp: '127.0.0.1',
      userAgent: 'test-agent',
      accessKey: null,
      accountId: null,
      apiKey: null,
      apiKeyId: null,
      caller: null,
      cognitoAuthenticationProvider: null,
      cognitoAuthenticationType: null,
      cognitoIdentityId: null,
      cognitoIdentityPoolId: null,
      principalOrgId: null,
      user: null,
      userArn: null,
    },
    accountId: 'test-account',
    apiId: 'test-api',
    protocol: 'HTTP/1.1',
    domainName: 'test.example.com',
    domainPrefix: 'test',
  },
  resource: path,
  multiValueHeaders: {},
  multiValueQueryStringParameters: null,
});

const mockContext: Context = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'test-function',
  functionVersion: '1',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function',
  memoryLimitInMB: '128',
  awsRequestId: 'test-request-id',
  logGroupName: '/aws/lambda/test-function',
  logStreamName: '2023/01/01/[$LATEST]test-stream',
  getRemainingTimeInMillis: () => 30000,
  done: () => {},
  fail: () => {},
  succeed: () => {},
};

describe('Authentication Routes', () => {
  let router: InternalRouter;

  beforeEach(() => {
    // Create a fresh router for each test
    router = createConfiguredRouter({
      corsOrigins: ['*'],
      enableLogging: false, // Disable logging for cleaner test output
    });
    
    // Register authentication routes
    registerAuthRoutes(router);
  });

  describe('Route Registration', () => {
    it('should register POST /auth/login route', async () => {
      const event = mockEvent('POST', '/auth/login', {
        email: 'test@example.com',
        password: 'testpassword123'
      });

      const response = await router.handle(event, mockContext);
      
      // Should not return 404 (route not found)
      expect(response.statusCode).not.toBe(404);
      
      // Should return a proper response structure
      expect(response.headers).toHaveProperty('Content-Type');
      expect(response.body).toBeDefined();
    });

    it('should register POST /auth/password-reset/request route', async () => {
      const event = mockEvent('POST', '/auth/password-reset/request', {
        email: 'test@example.com'
      });

      const response = await router.handle(event, mockContext);
      
      // Should not return 404 (route not found)
      expect(response.statusCode).not.toBe(404);
      
      // Should return a proper response structure
      expect(response.headers).toHaveProperty('Content-Type');
      expect(response.body).toBeDefined();
    });

    it('should register POST /auth/password-reset/confirm route', async () => {
      const event = mockEvent('POST', '/auth/password-reset/confirm', {
        token: 'test-token-123',
        new_password: 'NewPassword123!'
      });

      const response = await router.handle(event, mockContext);
      
      // Should not return 404 (route not found)
      expect(response.statusCode).not.toBe(404);
      
      // Should return a proper response structure
      expect(response.headers).toHaveProperty('Content-Type');
      expect(response.body).toBeDefined();
    });

    it('should return 404 for unregistered auth routes', async () => {
      const event = mockEvent('POST', '/auth/nonexistent', {});

      const response = await router.handle(event, mockContext);
      
      expect(response.statusCode).toBe(404);
      
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('NotFound');
    });
  });

  describe('Request Validation', () => {
    it('should validate login request body', async () => {
      const event = mockEvent('POST', '/auth/login', {
        // Missing required fields
      });

      const response = await router.handle(event, mockContext);
      
      expect(response.statusCode).toBe(400);
      
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('ValidationError');
      expect(body.error.details).toHaveProperty('field');
      expect(body.error.details.field).toBe('body');
    });

    it('should validate password reset request body', async () => {
      const event = mockEvent('POST', '/auth/password-reset/request', {
        email: 'invalid-email' // Invalid email format
      });

      const response = await router.handle(event, mockContext);
      
      expect(response.statusCode).toBe(400);
      
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('ValidationError');
    });

    it('should validate password reset confirm body', async () => {
      const event = mockEvent('POST', '/auth/password-reset/confirm', {
        token: 'test-token',
        new_password: '123' // Too short password
      });

      const response = await router.handle(event, mockContext);
      
      expect(response.statusCode).toBe(400);
      
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('ValidationError');
    });
  });

  describe('CORS Support', () => {
    it('should handle OPTIONS requests for auth routes', async () => {
      const event = mockEvent('OPTIONS', '/auth/login');

      const response = await router.handle(event, mockContext);
      
      expect(response.statusCode).toBe(200);
      expect(response.headers).toHaveProperty('Access-Control-Allow-Origin');
      expect(response.headers).toHaveProperty('Access-Control-Allow-Methods');
      expect(response.headers).toHaveProperty('Access-Control-Allow-Headers');
    });
  });
});