/**
 * Standardized error handling system
 * Provides consistent error types and responses across all Lambda functions
 */

import { ApiError, ErrorResponse } from './types.js';

/**
 * Custom error class for API errors
 */
export class ApiErrorClass extends Error {
  constructor(
    public readonly type: ApiError,
    message: string,
    public readonly details?: any,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Create standardized API error
 */
export function createError(
  type: ApiError,
  message: string,
  details?: any
): ApiErrorClass {
  const statusCode = getStatusCodeForErrorType(type);
  return new ApiErrorClass(type, message, details, statusCode);
}

/**
 * Get HTTP status code for error type
 */
export function getStatusCodeForErrorType(type: ApiError): number {
  switch (type) {
    case 'ValidationError':
      return 400;
    case 'Unauthorized':
      return 401;
    case 'Forbidden':
      return 403;
    case 'NotFound':
      return 404;
    case 'Conflict':
      return 409;
    case 'InternalError':
    default:
      return 500;
  }
}

/**
 * Convert error to standardized error response
 */
export function errorToResponse(
  error: unknown,
  correlationId: string
): ErrorResponse {
  const timestamp = new Date().toISOString();

  if (error instanceof ApiErrorClass) {
    return {
      error: {
        code: error.type,
        message: error.message,
        details: error.details,
        correlationId
      },
      timestamp
    };
  }

  if (error instanceof Error) {
    return {
      error: {
        code: 'InternalError',
        message: 'An unexpected error occurred',
        details: process.env['NODE_ENV'] === 'development' ? error.message : undefined,
        correlationId
      },
      timestamp
    };
  }

  return {
    error: {
      code: 'InternalError',
      message: 'An unexpected error occurred',
      correlationId
    },
    timestamp
  };
}

/**
 * Check if error is a specific API error type
 */
export function isApiError(error: unknown, type?: ApiError): error is ApiErrorClass {
  if (!(error instanceof ApiErrorClass)) {
    return false;
  }
  
  return type ? error.type === type : true;
}

/**
 * Wrap async Lambda handler with error handling
 */
export function withErrorHandling<TEvent, TResult>(
  handler: (event: TEvent, correlationId: string) => Promise<TResult>
) {
  return async (event: TEvent): Promise<TResult> => {
    // Extract correlation ID from event if it's an API Gateway event
    const correlationId = (event as any).requestContext?.requestId || 
                         (event as any).headers?.['x-correlation-id'] || 
                         crypto.randomUUID();

    try {
      return await handler(event, correlationId);
    } catch (error) {
      // Log error for debugging (will be handled by logging utilities)
      console.error('Lambda handler error:', {
        correlationId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      // Re-throw to let the Lambda runtime handle it
      throw error;
    }
  };
}