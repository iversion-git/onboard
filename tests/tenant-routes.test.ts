// Tenant management routes tests
import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { createRouterForEnvironment } from '../lib/setup.js';
import { registerTenantRoutes } from '../routes/tenant.js';

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

describe('Tenant Management Routes', () => {
  let router: ReturnType<typeof createRouterForEnvironment>;

  beforeEach(() => {
    router = createRouterForEnvironment();
    registerTenantRoutes(router);
  });

  describe('Route Registration', () => {
    it('should register POST /tenant/register route', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/tenant/register',
        headers: {},
        body: JSON.stringify({
          name: 'John Smith',
          email: 'john.smith@example.com',
          mobile_number: '+1-555-123-4567',
          business_name: 'Test Company',
          deployment_type: 'Shared',
          region: 'Australia',
          tenant_url: 'test-company-123',
          subscription_type: 'General',
          package_name: 'Professional',
          cluster_id: '550e8400-e29b-41d4-a716-446655440004'
        }),
        queryStringParameters: null,
        pathParameters: null,
        requestContext: {
          requestId: 'test-request-id',
          accountId: 'test-account',
          resourceId: 'test-resource',
          stage: 'test',
          requestTime: '2023-01-01T00:00:00Z',
          requestTimeEpoch: 1672531200,
          identity: {
            sourceIp: '127.0.0.1',
            userAgent: 'test-agent',
            accessKey: null,
            accountId: null,
            apiKey: null,
            caller: null,
            cognitoAuthenticationProvider: null,
            cognitoAuthenticationType: null,
            cognitoIdentityId: null,
            cognitoIdentityPoolId: null,
            principalOrgId: null,
            user: null,
            userArn: null
          },
          httpMethod: 'POST',
          resourcePath: '/tenant/register',
          protocol: 'HTTP/1.1',
          requestTimeEpoch: 1672531200,
          apiId: 'test-api-id'
        },
        resource: '/tenant/register',
        stageVariables: null,
        isBase64Encoded: false,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null
      };

      const context: Context = {
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
        succeed: () => {}
      };

      const result = await router.handle(event, context);

      // Should return 401 (unauthorized) since no auth token provided
      // This confirms the route is registered and auth middleware is working
      expect(result.statusCode).toBe(401);
      expect(JSON.parse(result.body)).toMatchObject({
        error: {
          code: 'Unauthorized',
          message: 'Missing authorization header'
        }
      });
    });

    it('should return 404 for unregistered tenant routes', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/tenant/list',
        headers: {},
        body: null,
        queryStringParameters: null,
        pathParameters: null,
        requestContext: {
          requestId: 'test-request-id',
          accountId: 'test-account',
          resourceId: 'test-resource',
          stage: 'test',
          requestTime: '2023-01-01T00:00:00Z',
          requestTimeEpoch: 1672531200,
          identity: {
            sourceIp: '127.0.0.1',
            userAgent: 'test-agent',
            accessKey: null,
            accountId: null,
            apiKey: null,
            caller: null,
            cognitoAuthenticationProvider: null,
            cognitoAuthenticationType: null,
            cognitoIdentityId: null,
            cognitoIdentityPoolId: null,
            principalOrgId: null,
            user: null,
            userArn: null
          },
          httpMethod: 'GET',
          resourcePath: '/tenant/list',
          protocol: 'HTTP/1.1',
          requestTimeEpoch: 1672531200,
          apiId: 'test-api-id'
        },
        resource: '/tenant/list',
        stageVariables: null,
        isBase64Encoded: false,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null
      };

      const context: Context = {
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
        succeed: () => {}
      };

      const result = await router.handle(event, context);

      expect(result.statusCode).toBe(404);
      expect(JSON.parse(result.body)).toMatchObject({
        error: {
          code: 'NotFound',
          message: 'Route GET /tenant/list not found'
        }
      });
    });

    it('should register GET /tenant/available-clusters route', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/tenant/available-clusters',
        headers: {},
        body: null,
        queryStringParameters: { deployment_type: 'Shared' },
        pathParameters: null,
        requestContext: {
          requestId: 'test-request-id',
          accountId: 'test-account',
          resourceId: 'test-resource',
          stage: 'test',
          requestTime: '2023-01-01T00:00:00Z',
          requestTimeEpoch: 1672531200,
          identity: {
            sourceIp: '127.0.0.1',
            userAgent: 'test-agent',
            accessKey: null,
            accountId: null,
            apiKey: null,
            caller: null,
            cognitoAuthenticationProvider: null,
            cognitoAuthenticationType: null,
            cognitoIdentityId: null,
            cognitoIdentityPoolId: null,
            principalOrgId: null,
            user: null,
            userArn: null
          },
          httpMethod: 'GET',
          resourcePath: '/tenant/available-clusters',
          protocol: 'HTTP/1.1',
          requestTimeEpoch: 1672531200,
          apiId: 'test-api-id'
        },
        resource: '/tenant/available-clusters',
        stageVariables: null,
        isBase64Encoded: false,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null
      };

      const context: Context = {
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
        succeed: () => {}
      };

      const result = await router.handle(event, context);

      // Should return 401 (unauthorized) since no auth token provided
      // This confirms the route is registered and auth middleware is working
      expect(result.statusCode).toBe(401);
      expect(JSON.parse(result.body)).toMatchObject({
        error: {
          code: 'Unauthorized',
          message: 'Missing authorization header'
        }
      });
    });
  });
});