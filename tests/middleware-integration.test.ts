// Integration tests for middleware pipeline
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { createExampleRouter } from '../lib/example-routes.js';
import { resetConfig } from '../lib/config.js';

// Mock Lambda event helper
function createMockEvent(
  method: string, 
  path: string, 
  body?: any,
  headers?: Record<string, string>
): APIGatewayProxyEvent {
  return {
    httpMethod: method,
    path,
    headers: headers || {},
    body: body ? JSON.stringify(body) : null,
    queryStringParameters: null,
    pathParameters: null,
    requestContext: {
      requestId: 'test-request-id',
      accountId: '123456789012',
      apiId: 'test-api',
      stage: 'test',
      requestTime: '2024-01-01T00:00:00.000Z',
      requestTimeEpoch: 1704067200000,
      identity: {
        sourceIp: '127.0.0.1',
        userAgent: 'test-agent'
      },
      httpMethod: method,
      resourcePath: path,
      protocol: 'HTTP/1.1',
      resourceId: 'test-resource'
    } as any,
    resource: path,
    stageVariables: null,
    isBase64Encoded: false,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null
  };
}

const mockContext: Context = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'test-function',
  functionVersion: '1',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function',
  memoryLimitInMB: '128',
  awsRequestId: 'test-request-id',
  logGroupName: '/aws/lambda/test-function',
  logStreamName: '2024/01/01/[$LATEST]test-stream',
  getRemainingTimeInMillis: () => 30000,
  done: () => {},
  fail: () => {},
  succeed: () => {}
};

describe('Middleware Integration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    resetConfig();
    process.env = { ...originalEnv };
    // Set required environment variables for testing
    process.env['JWT_SECRET'] = 'this-is-a-very-long-secret-key-for-testing-purposes-123456';
    process.env['STAGE'] = 'test';
  });

  afterEach(() => {
    process.env = originalEnv;
    resetConfig();
  });
  it('should handle health check without authentication', async () => {
    const router = createExampleRouter();
    
    const event = createMockEvent('GET', '/health');
    const result = await router.handle(event, mockContext);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.status).toBe('healthy');
    expect(body.service).toBe('aws-lambda-control-plane');
  });

  it('should reject authenticated endpoint without token', async () => {
    const router = createExampleRouter();
    
    const event = createMockEvent('GET', '/staff/me');
    const result = await router.handle(event, mockContext);

    expect(result.statusCode).toBe(401);
    const body = JSON.parse(result.body);
    expect(body.error.code).toBe('Unauthorized');
  });

  it('should reject authenticated endpoint with invalid token format', async () => {
    const router = createExampleRouter();
    
    const event = createMockEvent('GET', '/staff/me', undefined, {
      'Authorization': 'InvalidFormat token123'
    });
    const result = await router.handle(event, mockContext);

    expect(result.statusCode).toBe(401);
    const body = JSON.parse(result.body);
    expect(body.error.code).toBe('Unauthorized');
  });

  it('should validate request body and reject invalid data', async () => {
    const router = createExampleRouter();
    
    const event = createMockEvent('POST', '/example/validate', {
      email: 'invalid-email',
      name: ''
    });
    const result = await router.handle(event, mockContext);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error.code).toBe('ValidationError');
    expect(body.error.details.field).toBe('body');
  });

  it('should validate request body and accept valid data', async () => {
    const router = createExampleRouter();
    
    const event = createMockEvent('POST', '/example/validate', {
      email: 'test@example.com',
      name: 'Test User'
    });
    const result = await router.handle(event, mockContext);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.message).toBe('Validation passed');
    expect(body.data.email).toBe('test@example.com');
    expect(body.data.name).toBe('Test User');
  });

  it('should validate path parameters', async () => {
    const router = createExampleRouter();
    
    const validUuid = '123e4567-e89b-12d3-a456-426614174000';
    const event = createMockEvent('GET', `/example/users/${validUuid}`);
    const result = await router.handle(event, mockContext);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.userId).toBe(validUuid);
  });

  it('should reject invalid path parameters', async () => {
    const router = createExampleRouter();
    
    const event = createMockEvent('GET', '/example/users/invalid-uuid');
    const result = await router.handle(event, mockContext);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error.code).toBe('ValidationError');
    expect(body.error.details.field).toBe('params');
  });

  it('should include correlation ID in all responses', async () => {
    const router = createExampleRouter();
    
    const event = createMockEvent('GET', '/health');
    const result = await router.handle(event, mockContext);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(typeof body.correlationId).toBe('string');
    expect(body.correlationId.length).toBeGreaterThan(0);
  });

  it('should handle CORS preflight requests', async () => {
    const router = createExampleRouter();
    
    const event = createMockEvent('OPTIONS', '/health');
    const result = await router.handle(event, mockContext);

    expect(result.statusCode).toBe(200);
    expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    expect(result.headers?.['Access-Control-Allow-Methods']).toContain('GET');
    expect(result.headers?.['Access-Control-Allow-Headers']).toContain('Authorization');
  });
});