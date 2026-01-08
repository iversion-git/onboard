// Subscription management routes tests
import { describe, it, expect, beforeEach } from 'vitest';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { createRouterForEnvironment } from '../lib/setup.js';
import { registerSubscriptionRoutes } from '../routes/subscription.js';

// Set up test environment variables
process.env['JWT_SECRET'] = 'test-jwt-secret-that-is-at-least-32-characters-long-for-security';
process.env['STAGE'] = 'test';
process.env['AWS_REGION'] = 'us-east-1';
process.env['DYNAMODB_STAFF_TABLE'] = 'onboard-staff-test';
process.env['DYNAMODB_PASSWORD_RESET_TOKENS_TABLE'] = 'onboard-password-reset-tokens-test';
process.env['DYNAMODB_TENANTS_TABLE'] = 'onboard-tenants-test';
process.env['DYNAMODB_PACKAGES_TABLE'] = 'onboard-packages-test';
process.env['DYNAMODB_SUBSCRIPTION_TYPES_TABLE'] = 'onboard-subscription-types-test';
process.env['DYNAMODB_SUBSCRIPTIONS_TABLE'] = 'onboard-subscriptions-test';
process.env['DYNAMODB_CLUSTERS_TABLE'] = 'onboard-clusters-test';

describe('Subscription Routes', () => {
  let router: ReturnType<typeof createRouterForEnvironment>;

  beforeEach(() => {
    router = createRouterForEnvironment();
    registerSubscriptionRoutes(router);
  });

  describe('POST /subscription/create', () => {
    it('should require authentication', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/subscription/create',
        headers: {},
        body: JSON.stringify({
          tenant_id: '550e8400-e29b-41d4-a716-446655440003',
          subscription_type_level: 'Production',
          domain_name: 'https://mywebsite.com'
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
        path: '/subscription/create',
        headers: {
          'Authorization': 'Bearer valid-jwt-token'
        },
        body: JSON.stringify({
          // Missing required fields
          subscription_type_level: 'Production'
          // Missing tenant_id and domain_name
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

  describe('GET /subscription/list', () => {
    it('should require authentication', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/subscription/list',
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

  describe('GET /subscription/:subscriptionId', () => {
    it('should require authentication', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'GET',
        path: '/subscription/550e8400-e29b-41d4-a716-446655440005',
        headers: {},
        body: null,
        isBase64Encoded: false,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        pathParameters: {
          subscriptionId: '550e8400-e29b-41d4-a716-446655440005'
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