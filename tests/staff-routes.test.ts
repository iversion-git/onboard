// Staff management routes tests
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { createRouterForEnvironment } from '../lib/setup.js';
import { registerStaffRoutes } from '../routes/staff.js';

// Mock AWS SDK and dependencies
vi.mock('@aws-sdk/client-dynamodb');
vi.mock('@aws-sdk/lib-dynamodb');
vi.mock('@aws-sdk/client-ses');

// Set required environment variables for testing
process.env['JWT_SECRET'] = 'test-jwt-secret-key-for-testing-purposes-only';
process.env['STAGE'] = 'test';
process.env['AWS_REGION'] = 'us-east-1';

describe('Staff Management Routes', () => {
  let router: ReturnType<typeof createRouterForEnvironment>;

  beforeEach(() => {
    router = createRouterForEnvironment();
    registerStaffRoutes(router);
  });

  describe('Route Registration', () => {
    it('should register POST /staff/register route', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/staff/register',
        headers: {},
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password123',
          roles: ['staff']
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
            apiKeyId: null,
            caller: null,
            cognitoAuthenticationProvider: null,
            cognitoAuthenticationType: null,
            cognitoIdentityId: null,
            cognitoIdentityPoolId: null,
            principalOrgId: null,
            user: null,
            userArn: null
          },
          protocol: 'HTTP/1.1',
          resourcePath: '/staff/register',
          httpMethod: 'POST',
          apiId: 'test-api',
          path: '/test/staff/register',
          domainName: 'test.execute-api.us-east-1.amazonaws.com',
          domainPrefix: 'test'
        },
        resource: '/staff/register',
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

      const response = await router.handle(event, context);
      
      // Should return 401 (Unauthorized) because no auth token provided
      // This confirms the route is registered and auth middleware is working
      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.body)).toMatchObject({
        error: {
          code: 'Unauthorized',
          message: 'Missing authorization header'
        }
      });
    });

    it('should register POST /staff/enable route', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/staff/enable',
        headers: {},
        body: JSON.stringify({
          staff_id: '123e4567-e89b-12d3-a456-426614174000'
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
            apiKeyId: null,
            caller: null,
            cognitoAuthenticationProvider: null,
            cognitoAuthenticationType: null,
            cognitoIdentityId: null,
            cognitoIdentityPoolId: null,
            principalOrgId: null,
            user: null,
            userArn: null
          },
          protocol: 'HTTP/1.1',
          resourcePath: '/staff/enable',
          httpMethod: 'POST',
          apiId: 'test-api',
          path: '/test/staff/enable',
          domainName: 'test.execute-api.us-east-1.amazonaws.com',
          domainPrefix: 'test'
        },
        resource: '/staff/enable',
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

      const response = await router.handle(event, context);
      
      // Should return 401 (Unauthorized) because no auth token provided
      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.body)).toMatchObject({
        error: {
          code: 'Unauthorized',
          message: 'Missing authorization header'
        }
      });
    });

    it('should register POST /staff/disable route', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/staff/disable',
        headers: {},
        body: JSON.stringify({
          staff_id: '123e4567-e89b-12d3-a456-426614174000'
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
            apiKeyId: null,
            caller: null,
            cognitoAuthenticationProvider: null,
            cognitoAuthenticationType: null,
            cognitoIdentityId: null,
            cognitoIdentityPoolId: null,
            principalOrgId: null,
            user: null,
            userArn: null
          },
          protocol: 'HTTP/1.1',
          resourcePath: '/staff/disable',
          httpMethod: 'POST',
          apiId: 'test-api',
          path: '/test/staff/disable',
          domainName: 'test.execute-api.us-east-1.amazonaws.com',
          domainPrefix: 'test'
        },
        resource: '/staff/disable',
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

      const response = await router.handle(event, context);
      
      // Should return 401 (Unauthorized) because no auth token provided
      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.body)).toMatchObject({
        error: {
          code: 'Unauthorized',
          message: 'Missing authorization header'
        }
      });
    });

    it('should register GET /staff/me route', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/staff/me',
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
            apiKeyId: null,
            caller: null,
            cognitoAuthenticationProvider: null,
            cognitoAuthenticationType: null,
            cognitoIdentityId: null,
            cognitoIdentityPoolId: null,
            principalOrgId: null,
            user: null,
            userArn: null
          },
          protocol: 'HTTP/1.1',
          resourcePath: '/staff/me',
          httpMethod: 'GET',
          apiId: 'test-api',
          path: '/test/staff/me',
          domainName: 'test.execute-api.us-east-1.amazonaws.com',
          domainPrefix: 'test'
        },
        resource: '/staff/me',
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

      const response = await router.handle(event, context);
      
      // Should return 401 (Unauthorized) because no auth token provided
      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.body)).toMatchObject({
        error: {
          code: 'Unauthorized',
          message: 'Missing authorization header'
        }
      });
    });
  });
});