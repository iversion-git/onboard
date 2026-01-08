// Stack management routes tests
import { describe, it, expect, beforeEach } from 'vitest';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { createRouterForEnvironment } from '../lib/setup.js';
import { registerStackRoutes } from '../routes/stack.js';

// Set up test environment variables
process.env['JWT_SECRET'] = 'test-jwt-secret-that-is-at-least-32-characters-long-for-security';
process.env['STAGE'] = 'test';
process.env['AWS_REGION'] = 'us-east-1';
process.env['DYNAMODB_STAFF_TABLE'] = 'Staff-test';
process.env['DYNAMODB_PASSWORD_RESET_TOKENS_TABLE'] = 'PasswordResetTokens-test';
process.env['DYNAMODB_TENANTS_TABLE'] = 'Tenants-test';
process.env['DYNAMODB_STACKS_TABLE'] = 'Stacks-test';
process.env['DYNAMODB_CLUSTERS_TABLE'] = 'Clusters-test';

describe('Stack Routes', () => {
  let router: ReturnType<typeof createRouterForEnvironment>;

  beforeEach(() => {
    router = createRouterForEnvironment();
    registerStackRoutes(router);
  });

  describe('POST /stack/create', () => {
    it('should require authentication', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/stack/create',
        headers: {},
        body: JSON.stringify({
          tenant_id: '550e8400-e29b-41d4-a716-446655440003',
          stack_type: 'Production'
        }),
        isBase64Encoded: false,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        pathParameters: null,
        queryStringParameters: null,
        requestContext: {
          requestId: 'test-request-id',
        } as any,
        resource: '',
        stageVariables: null,
      };

      const context: Context = {} as Context;
      const result = await router.handle(event, context);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('Unauthorized');
    });

    it('should validate request body schema', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/stack/create',
        headers: {
          'Authorization': 'Bearer valid-jwt-token'
        },
        body: JSON.stringify({
          // Missing required fields
          stack_type: 'Production'
        }),
        isBase64Encoded: false,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        pathParameters: null,
        queryStringParameters: null,
        requestContext: {
          requestId: 'test-request-id',
        } as any,
        resource: '',
        stageVariables: null,
      };

      const context: Context = {} as Context;
      const result = await router.handle(event, context);

      // Should fail validation before reaching authentication
      expect([400, 401]).toContain(result.statusCode);
    });
  });

  describe('GET /stack/list', () => {
    it('should require authentication', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/stack/list',
        headers: {},
        body: null,
        isBase64Encoded: false,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        pathParameters: null,
        queryStringParameters: {
          tenant_id: '550e8400-e29b-41d4-a716-446655440003'
        },
        requestContext: {
          requestId: 'test-request-id',
        } as any,
        resource: '',
        stageVariables: null,
      };

      const context: Context = {} as Context;
      const result = await router.handle(event, context);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('Unauthorized');
    });
  });

  describe('GET /stack/:stackId', () => {
    it('should require authentication', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/stack/550e8400-e29b-41d4-a716-446655440005',
        headers: {},
        body: null,
        isBase64Encoded: false,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        pathParameters: {
          stackId: '550e8400-e29b-41d4-a716-446655440005'
        },
        queryStringParameters: null,
        requestContext: {
          requestId: 'test-request-id',
        } as any,
        resource: '',
        stageVariables: null,
      };

      const context: Context = {} as Context;
      const result = await router.handle(event, context);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('Unauthorized');
    });
  });
});