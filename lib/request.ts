// Request utilities for Lambda proxy integration
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import type { InternalRequest, AuthContext } from './types.js';
import { randomUUID } from 'crypto';

export function parseRequestBody(event: APIGatewayProxyEvent): any {
  if (!event.body) {
    return {};
  }

  try {
    return JSON.parse(event.body);
  } catch (error) {
    // If JSON parsing fails, return the raw body
    return event.body;
  }
}

export function parseQueryParameters(event: APIGatewayProxyEvent): Record<string, string> {
  const params: Record<string, string> = {};
  const queryParams = event.queryStringParameters;
  
  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined) {
        params[key] = value;
      }
    }
  }
  
  return params;
}

export function parseHeaders(event: APIGatewayProxyEvent): Record<string, string> {
  // Normalize header names to lowercase for consistent access
  const headers: Record<string, string> = {};
  
  if (event.headers) {
    for (const [key, value] of Object.entries(event.headers)) {
      headers[key.toLowerCase()] = value || '';
    }
  }

  return headers;
}

export function extractPathParameters(
  actualPath: string,
  routePattern: string
): Record<string, string> {
  const params: Record<string, string> = {};
  
  // Simple path parameter extraction for patterns like /staff/:id
  const routeParts = routePattern.split('/');
  const actualParts = actualPath.split('/');
  
  if (routeParts.length !== actualParts.length) {
    return params;
  }
  
  for (let i = 0; i < routeParts.length; i++) {
    const routePart = routeParts[i];
    const actualPart = actualParts[i];
    
    if (routePart?.startsWith(':')) {
      const paramName = routePart.slice(1);
      if (actualPart) {
        params[paramName] = decodeURIComponent(actualPart);
      }
    }
  }
  
  return params;
}

export function createInternalRequest(
  event: APIGatewayProxyEvent,
  lambdaContext: Context,
  pathParams: Record<string, string> = {}
): InternalRequest {
  // Handle both REST API and HTTP API event formats
  const method = (event.httpMethod || (event as any).requestContext?.http?.method)?.toUpperCase() || 'GET';
  const path = event.path || (event as any).rawPath || '/';
  
  const correlationId = event.headers?.['x-correlation-id'] || 
                       event.requestContext?.requestId || 
                       randomUUID();

  // Initialize empty auth context - will be populated by auth middleware
  const authContext: AuthContext = {
    authenticated: false
  };

  return {
    method,
    path,
    headers: parseHeaders(event),
    body: parseRequestBody(event),
    query: parseQueryParameters(event),
    params: pathParams,
    context: authContext,
    correlationId,
    rawEvent: event,
    lambdaContext
  };
}

export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

export function getCorrelationId(req: InternalRequest): string {
  return req.correlationId;
}