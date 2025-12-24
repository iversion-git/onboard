/**
 * HTTP utilities for AWS Lambda functions
 * Leverages AWS Lambda's built-in event structure and response format
 */

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { z } from 'zod';
import { ApiResponse, AuthContext, ErrorResponse, ValidatedRequest } from './types.js';
import { createError } from './errors.js';

/**
 * Parse request body with Zod validation
 * Uses AWS Lambda's built-in JSON parsing capabilities
 */
export function parseRequestBody<T>(
  event: APIGatewayProxyEventV2,
  schema: z.ZodSchema<T>
): T {
  if (!event.body) {
    throw createError('ValidationError', 'Request body is required');
  }

  let parsed: unknown;
  try {
    // AWS Lambda automatically handles base64 decoding if needed
    parsed = JSON.parse(event.body);
  } catch (error) {
    throw createError('ValidationError', 'Invalid JSON in request body');
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw createError('ValidationError', 'Request validation failed', {
      issues: result.error.issues
    });
  }

  return result.data;
}

/**
 * Generate a new correlation ID
 * Used for tracking requests across services
 */
export function generateCorrelationId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Extract correlation ID from request headers or generate one
 * Uses AWS Lambda's built-in request ID as fallback
 */
export function getCorrelationId(event: APIGatewayProxyEventV2): string {
  return event.headers['x-correlation-id'] || 
         event.headers['X-Correlation-ID'] || 
         event.requestContext.requestId;
}

/**
 * Extract authentication context from Lambda Authorizer
 * AWS API Gateway automatically injects this via the authorizer
 */
export function getAuthContext(event: APIGatewayProxyEventV2): AuthContext {
  const authorizer = (event.requestContext as any).authorizer;
  
  if (!authorizer || !authorizer.lambda) {
    throw createError('Unauthorized', 'No authentication context found');
  }

  const context = authorizer.lambda;
  
  if (!context.staff_id || !context.email || !context.roles) {
    throw createError('Unauthorized', 'Invalid authentication context');
  }

  // Parse roles from JSON string (API Gateway context values are strings)
  let roles: string[];
  try {
    roles = typeof context.roles === 'string' ? JSON.parse(context.roles) : context.roles;
  } catch (error) {
    throw createError('Unauthorized', 'Invalid roles format in authentication context');
  }

  return {
    staff_id: context.staff_id,
    email: context.email,
    roles: Array.isArray(roles) ? roles : [roles],
    stage: context.stage || process.env['STAGE'] || 'dev'
  };
}

/**
 * Create validated request object
 */
export function createValidatedRequest<T>(
  event: APIGatewayProxyEventV2,
  schema: z.ZodSchema<T>
): ValidatedRequest<T> {
  return {
    body: parseRequestBody(event, schema),
    context: getAuthContext(event),
    correlationId: getCorrelationId(event)
  };
}

/**
 * Build successful API response
 * Uses AWS Lambda's standard response format
 */
export function buildResponse<T>(
  data: T,
  statusCode: number = 200,
  additionalHeaders: Record<string, string> = {}
): ApiResponse<T> {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(),
      ...additionalHeaders
    },
    body: JSON.stringify(data)
  };
}

/**
 * Build error response
 */
export function buildErrorResponse(
  error: ErrorResponse,
  statusCode: number = 500,
  additionalHeaders: Record<string, string> = {}
): ApiResponse<ErrorResponse> {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(),
      ...additionalHeaders
    },
    body: JSON.stringify(error)
  };
}

/**
 * Get CORS headers based on environment
 * Restricts origins in production, allows all in development
 */
export function getCorsHeaders(): Record<string, string> {
  const stage = process.env['STAGE'] || 'dev';
  const corsOrigins = process.env['CORS_ORIGINS']?.split(',') || ['*'];
  
  if (stage === 'prod' && corsOrigins.includes('*')) {
    // In production, never allow wildcard origins
    return {
      'Access-Control-Allow-Origin': 'https://app.example.com',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Correlation-ID',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Credentials': 'true'
    };
  }

  return {
    'Access-Control-Allow-Origin': corsOrigins[0] || '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Correlation-ID',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Credentials': corsOrigins[0] !== '*' ? 'true' : 'false'
  };
}

/**
 * Handle CORS preflight requests
 */
export function handleCorsPreflightRequest(): ApiResponse<null> {
  return {
    statusCode: 200,
    headers: getCorsHeaders(),
    body: ''
  };
}