// Local development server for testing Lambda function
import { createServer } from 'http';
import { handler } from './index.js';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';

// Load environment variables from .env.local
import { readFileSync } from 'fs';
import { join } from 'path';

try {
  const envFile = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
  const envVars = envFile.split('\n').filter(line => line.trim() && !line.startsWith('#'));
  
  envVars.forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
  
  console.log('✅ Loaded environment variables from .env.local');
} catch (error) {
  console.log('⚠️  No .env.local file found, using system environment variables');
}

const PORT = process.env.PORT || 3000;

// Create mock Lambda context
function createMockContext(): Context {
  return {
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'aws-lambda-control-plane-dev-api',
    functionVersion: '$LATEST',
    invokedFunctionArn: 'arn:aws:lambda:ap-southeast-2:123456789012:function:aws-lambda-control-plane-dev-api',
    memoryLimitInMB: '1024',
    awsRequestId: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    logGroupName: '/aws/lambda/aws-lambda-control-plane-dev-api',
    logStreamName: `local-dev-stream`,
    getRemainingTimeInMillis: () => 30000,
    done: () => {},
    fail: () => {},
    succeed: () => {}
  };
}

// Create mock API Gateway event
function createMockEvent(req: any): APIGatewayProxyEvent {
  const url = new URL(req.url!, `http://localhost:${PORT}`);
  
  return {
    resource: '/{proxy+}',
    path: url.pathname,
    httpMethod: req.method!,
    headers: req.headers as Record<string, string>,
    multiValueHeaders: {},
    queryStringParameters: Object.fromEntries(url.searchParams),
    multiValueQueryStringParameters: {},
    pathParameters: { proxy: url.pathname.slice(1) },
    stageVariables: null,
    requestContext: {
      resourceId: 'local',
      resourcePath: '/{proxy+}',
      httpMethod: req.method!,
      extendedRequestId: `local-${Date.now()}`,
      requestTime: new Date().toISOString(),
      path: url.pathname,
      accountId: '123456789012',
      protocol: 'HTTP/1.1',
      stage: 'dev',
      domainPrefix: 'localhost',
      requestTimeEpoch: Date.now(),
      requestId: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
        userAgent: req.headers['user-agent'] || 'local-dev-server',
        user: null,
        apiKey: null,
        apiKeyId: null,
        clientCert: null
      },
      domainName: 'localhost',
      apiId: 'local-api'
    },
    body: null,
    isBase64Encoded: false
  };
}

// Create HTTP server
const server = createServer(async (req, res) => {
  try {
    console.log(`📥 ${req.method} ${req.url}`);
    
    // Read request body
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', async () => {
      try {
        // Create mock Lambda event
        const event = createMockEvent(req);
        if (body) {
          event.body = body;
        }
        
        const context = createMockContext();
        
        // Call Lambda handler
        const result = await handler(event, context);
        
        // Send response
        res.writeHead(result.statusCode, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
          ...result.headers
        });
        
        res.end(result.body);
        
        console.log(`📤 ${result.statusCode} ${req.method} ${req.url}`);
        
      } catch (error) {
        console.error('❌ Handler error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: {
            code: 'InternalError',
            message: 'Local development server error',
            details: error instanceof Error ? error.message : String(error)
          }
        }));
      }
    });
    
  } catch (error) {
    console.error('❌ Server error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: {
        code: 'InternalError',
        message: 'Server error'
      }
    }));
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Local development server running on http://localhost:${PORT}`);
  console.log(`📋 Test endpoints:`);
  console.log(`   POST http://localhost:${PORT}/auth/login`);
  console.log(`   POST http://localhost:${PORT}/staff/register`);
  console.log(`   GET  http://localhost:${PORT}/staff/me`);
  console.log(`   POST http://localhost:${PORT}/tenant/register`);
  console.log(`\n💡 Use Postman or curl to test the API locally`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down development server...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});