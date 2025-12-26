// Basic tests for the internal routing system
import { describe, it, expect } from 'vitest';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import type { InternalRequest, InternalResponse } from '../lib/types.js';
import { InternalRouter } from '../lib/router.js';

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

describe('InternalRouter', () => {
  it('should handle basic GET route', async () => {
    const router = new InternalRouter();
    
    router.get('/test', async (_req: InternalRequest, res: InternalResponse) => {
      res.json({ message: 'test response' });
    });

    const event = createMockEvent('GET', '/test');
    const result = await router.handle(event, mockContext);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ message: 'test response' });
  });

  it('should handle POST route with body', async () => {
    const router = new InternalRouter();
    
    router.post('/echo', async (req: InternalRequest, res: InternalResponse) => {
      res.json({ received: req.body });
    });

    const event = createMockEvent('POST', '/echo', { test: 'data' });
    const result = await router.handle(event, mockContext);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ received: { test: 'data' } });
  });

  it('should handle path parameters', async () => {
    const router = new InternalRouter();
    
    router.get('/users/:id', async (_req: InternalRequest, res: InternalResponse) => {
      res.json({ userId: _req.params['id'] });
    });

    const event = createMockEvent('GET', '/users/123');
    const result = await router.handle(event, mockContext);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ userId: '123' });
  });

  it('should return 404 for unknown routes', async () => {
    const router = new InternalRouter();
    
    const event = createMockEvent('GET', '/unknown');
    const result = await router.handle(event, mockContext);

    expect(result.statusCode).toBe(404);
    const body = JSON.parse(result.body);
    expect(body.error.code).toBe('NotFound');
  });

  it('should handle CORS preflight requests', async () => {
    const router = new InternalRouter();
    
    const event = createMockEvent('OPTIONS', '/test');
    const result = await router.handle(event, mockContext);

    expect(result.statusCode).toBe(200);
    expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    expect(result.headers?.['Access-Control-Allow-Methods']).toContain('GET');
  });

  it('should execute middleware in order', async () => {
    const router = new InternalRouter();
    const executionOrder: string[] = [];
    
    router.use(async (_req, _res, next) => {
      executionOrder.push('middleware1');
      await next();
    });

    router.use(async (_req, _res, next) => {
      executionOrder.push('middleware2');
      await next();
    });

    router.get('/test', async (_req: InternalRequest, res: InternalResponse) => {
      executionOrder.push('handler');
      res.json({ order: executionOrder });
    });

    const event = createMockEvent('GET', '/test');
    const result = await router.handle(event, mockContext);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.order).toEqual(['middleware1', 'middleware2', 'handler']);
  });
});