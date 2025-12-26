// Cluster management routes tests
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { handler } from '../index.js';

// Mock environment variables
beforeEach(() => {
  process.env['JWT_SECRET'] = 'test-jwt-secret-that-is-at-least-32-characters-long-for-security';
  process.env['STAGE'] = 'test';
  process.env['AWS_REGION'] = 'us-east-1';
});

// Mock AWS SDK clients
vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(() => ({})),
}));

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: vi.fn(() => ({
      send: vi.fn(),
    })),
  },
  GetCommand: vi.fn(),
  PutCommand: vi.fn(),
  UpdateCommand: vi.fn(),
  DeleteCommand: vi.fn(),
  QueryCommand: vi.fn(),
  ScanCommand: vi.fn(),
}));

describe('Cluster Routes', () => {
  const createMockEvent = (
    method: string,
    path: string,
    body?: any,
    headers: Record<string, string> = {}
  ): APIGatewayProxyEvent => ({
    httpMethod: method,
    path,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    multiValueHeaders: {},
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    pathParameters: null,
    stageVariables: null,
    body: body ? JSON.stringify(body) : null,
    isBase64Encoded: false,
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
      protocol: 'HTTP/1.1',
      httpMethod: method,
      path,
      stage: 'test',
      requestId: 'test-request-id',
      requestTime: '01/Jan/2023:00:00:00 +0000',
      requestTimeEpoch: 1672531200,
      resourceId: 'test-resource',
      resourcePath: path,
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
        userArn: null,
      },
      authorizer: {},
    },
    resource: path,
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

  it('should return 401 for GET /clusters without authentication', async () => {
    const event = createMockEvent('GET', '/clusters');
    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(401);
    const body = JSON.parse(result.body);
    expect(body.error.code).toBe('Unauthorized');
  });

  it('should return 401 for POST /clusters without authentication', async () => {
    const event = createMockEvent('POST', '/clusters', {
      name: 'test-cluster',
      type: 'dedicated',
      region: 'us-east-1',
      cidr: '10.0.0.0/16'
    });
    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(401);
    const body = JSON.parse(result.body);
    expect(body.error.code).toBe('Unauthorized');
  });

  it('should return 404 for non-existent cluster routes', async () => {
    const event = createMockEvent('GET', '/clusters/non-existent');
    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(404);
    const body = JSON.parse(result.body);
    expect(body.error.code).toBe('NotFound');
  });

  it('should handle CORS preflight requests', async () => {
    const event = createMockEvent('OPTIONS', '/clusters');
    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(200);
    expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(result.headers['Access-Control-Allow-Methods']).toContain('GET');
    expect(result.headers['Access-Control-Allow-Methods']).toContain('POST');
  });
});