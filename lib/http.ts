// Enhanced HTTP utilities for request parsing, response building, and CORS handling
import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { InternalRequest } from './types.js';
import { getCorsOrigins } from './config.js';

/**
 * HTTP method constants
 */
export const HTTP_METHODS = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
  PATCH: 'PATCH',
  OPTIONS: 'OPTIONS',
  HEAD: 'HEAD'
} as const;

export type HttpMethod = typeof HTTP_METHODS[keyof typeof HTTP_METHODS];

/**
 * Common HTTP status codes
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
} as const;

/**
 * Content type constants
 */
export const CONTENT_TYPES = {
  JSON: 'application/json',
  TEXT: 'text/plain',
  HTML: 'text/html',
  XML: 'application/xml',
  FORM_URLENCODED: 'application/x-www-form-urlencoded',
  MULTIPART_FORM: 'multipart/form-data'
} as const;

/**
 * CORS configuration interface
 */
export interface CorsConfig {
  origins: string[];
  methods: string[];
  headers: string[];
  credentials: boolean;
  maxAge?: number;
}

/**
 * Default CORS configuration
 */
export const DEFAULT_CORS_CONFIG: CorsConfig = {
  origins: ['*'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  headers: ['Content-Type', 'Authorization', 'X-Correlation-ID'],
  credentials: false,
  maxAge: 86400 // 24 hours
};

/**
 * Get CORS headers for a request
 */
export function getCorsHeaders(
  origin?: string,
  config: CorsConfig = DEFAULT_CORS_CONFIG
): Record<string, string> {
  const headers: Record<string, string> = {};

  // Handle origin
  if (config.origins.includes('*')) {
    headers['Access-Control-Allow-Origin'] = '*';
  } else if (origin && config.origins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  // Add other CORS headers
  headers['Access-Control-Allow-Methods'] = config.methods.join(', ');
  headers['Access-Control-Allow-Headers'] = config.headers.join(', ');

  if (config.credentials) {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  if (config.maxAge) {
    headers['Access-Control-Max-Age'] = config.maxAge.toString();
  }

  return headers;
}

/**
 * Check if a request origin is allowed
 */
export function isOriginAllowed(origin: string | undefined, allowedOrigins: string[]): boolean {
  if (!origin) {
    return true; // Allow requests without origin (e.g., mobile apps)
  }

  if (allowedOrigins.includes('*')) {
    return true;
  }

  return allowedOrigins.includes(origin);
}

/**
 * Parse request body with proper error handling
 */
export function parseRequestBodySafe(event: APIGatewayProxyEvent): {
  success: boolean;
  data?: any;
  error?: string;
} {
  if (!event.body) {
    return { success: true, data: {} };
  }

  try {
    // Handle base64 encoded body
    const body = event.isBase64Encoded 
      ? Buffer.from(event.body, 'base64').toString('utf-8')
      : event.body;

    // Try to parse as JSON
    const parsed = JSON.parse(body);
    return { success: true, data: parsed };
  } catch (error) {
    return { 
      success: false, 
      error: 'Invalid JSON in request body',
      data: event.body // Return raw body as fallback
    };
  }
}

/**
 * Extract and validate content type
 */
export function getContentType(headers: Record<string, string>): string | null {
  const contentType = headers['content-type'] || headers['Content-Type'];
  return contentType ? contentType.split(';')[0]?.trim() || null : null;
}

/**
 * Check if request has JSON content type
 */
export function isJsonRequest(headers: Record<string, string>): boolean {
  const contentType = getContentType(headers);
  return contentType === CONTENT_TYPES.JSON;
}

/**
 * Validate request method
 */
export function isValidHttpMethod(method: string): method is HttpMethod {
  return Object.values(HTTP_METHODS).includes(method as HttpMethod);
}

/**
 * Create success response helper (placeholder for future implementation)
 */
export function createSuccessResponse(): void {
  // This would be used with the response builder
  // Implementation depends on the response context
}

/**
 * Extract client IP address from API Gateway event
 */
export function getClientIp(event: APIGatewayProxyEvent): string {
  return event.requestContext.identity.sourceIp || 'unknown';
}

/**
 * Extract user agent from request headers
 */
export function getUserAgent(headers: Record<string, string>): string {
  return headers['user-agent'] || headers['User-Agent'] || 'unknown';
}

/**
 * Create CORS preflight response
 */
export function createCorsPreflightResponse(
  origin?: string,
  requestedMethod?: string,
  requestedHeaders?: string
): {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
} {
  const corsOrigins = getCorsOrigins();
  const corsConfig: CorsConfig = {
    origins: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    headers: ['Content-Type', 'Authorization', 'X-Correlation-ID'],
    credentials: false
  };

  // Validate requested method
  if (requestedMethod && !corsConfig.methods.includes(requestedMethod)) {
    return {
      statusCode: HTTP_STATUS.FORBIDDEN,
      headers: getCorsHeaders(origin, corsConfig),
      body: ''
    };
  }

  // Validate requested headers
  if (requestedHeaders) {
    const requested = requestedHeaders.split(',').map(h => h.trim().toLowerCase());
    const allowed = corsConfig.headers.map(h => h.toLowerCase());
    const unauthorized = requested.filter(h => !allowed.includes(h));
    
    if (unauthorized.length > 0) {
      return {
        statusCode: HTTP_STATUS.FORBIDDEN,
        headers: getCorsHeaders(origin, corsConfig),
        body: ''
      };
    }
  }

  return {
    statusCode: HTTP_STATUS.OK,
    headers: getCorsHeaders(origin, corsConfig),
    body: ''
  };
}

/**
 * Sanitize headers for logging (remove sensitive information)
 */
export function sanitizeHeadersForLogging(
  headers: Record<string, string>,
  sensitiveHeaders: string[] = ['authorization', 'cookie', 'x-api-key', 'x-auth-token']
): Record<string, string> {
  const sanitized: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(headers)) {
    if (sensitiveHeaders.includes(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Validate request size limits
 */
export function validateRequestSize(
  event: APIGatewayProxyEvent,
  maxBodySize: number = 1024 * 1024 // 1MB default
): { valid: boolean; error?: string } {
  if (!event.body) {
    return { valid: true };
  }

  const bodySize = event.isBase64Encoded 
    ? Buffer.from(event.body, 'base64').length
    : Buffer.byteLength(event.body, 'utf8');

  if (bodySize > maxBodySize) {
    return {
      valid: false,
      error: `Request body too large. Maximum size: ${maxBodySize} bytes`
    };
  }

  return { valid: true };
}

/**
 * Extract request metadata for logging and monitoring
 */
export function extractRequestMetadata(
  event: APIGatewayProxyEvent,
  req: InternalRequest
): {
  method: string;
  path: string;
  userAgent: string;
  clientIp: string;
  correlationId: string;
  requestId: string;
  stage: string;
  protocol: string;
} {
  return {
    method: req.method,
    path: req.path,
    userAgent: getUserAgent(req.headers),
    clientIp: getClientIp(event),
    correlationId: req.correlationId,
    requestId: event.requestContext.requestId,
    stage: event.requestContext.stage,
    protocol: event.requestContext.protocol
  };
}