// Enhanced error handling system with standardized error types and responses
import type { ApiError, InternalResponse } from './types.js';
import { getHttpStatusForError, createErrorResponse } from './response.js';

/**
 * Custom error classes for different types of application errors
 */
export class AppError extends Error {
  public readonly code: ApiError;
  public readonly statusCode: number;
  public readonly details?: any;
  public readonly correlationId: string | undefined;

  constructor(
    code: ApiError,
    message: string,
    details?: any,
    correlationId?: string
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = getHttpStatusForError(code);
    this.details = details;
    this.correlationId = correlationId;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any, correlationId?: string) {
    super('ValidationError', message, details, correlationId);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Authentication required', correlationId?: string) {
    super('Unauthorized', message, undefined, correlationId);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Insufficient permissions', correlationId?: string) {
    super('Forbidden', message, undefined, correlationId);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found', correlationId?: string) {
    super('NotFound', message, undefined, correlationId);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource already exists', correlationId?: string) {
    super('Conflict', message, undefined, correlationId);
    this.name = 'ConflictError';
  }
}

export class InternalError extends AppError {
  constructor(message: string = 'Internal server error', details?: any, correlationId?: string) {
    super('InternalError', message, details, correlationId);
    this.name = 'InternalError';
  }
}

/**
 * Error handler middleware that catches and formats errors
 */
export function handleError(
  error: unknown,
  correlationId: string,
  res: InternalResponse
): void {
  // If response is already sent, don't try to send another
  if (res._ended) {
    return;
  }

  let appError: AppError;

  if (error instanceof AppError) {
    appError = error;
  } else if (error instanceof Error) {
    // Convert generic errors to InternalError
    appError = new InternalError(
      'An unexpected error occurred',
      { originalMessage: error.message },
      correlationId
    );
  } else {
    // Handle non-Error objects
    appError = new InternalError(
      'An unexpected error occurred',
      { error: String(error) },
      correlationId
    );
  }

  // Log the error (with stack trace for internal errors)
  const logData = {
    level: 'error',
    message: 'Error handling request',
    correlationId: appError.correlationId || correlationId,
    error: {
      code: appError.code,
      message: appError.message,
      statusCode: appError.statusCode,
      details: appError.details
    },
    timestamp: new Date().toISOString()
  };

  // Include stack trace for internal errors in non-production
  if (appError.code === 'InternalError' && process.env['STAGE'] !== 'prod') {
    (logData.error as any).stack = appError.stack;
  }

  console.error(JSON.stringify(logData));

  // Send error response
  const errorResponse = createErrorResponse(
    appError.code,
    appError.message,
    appError.correlationId || correlationId,
    appError.details
  );

  res.status(appError.statusCode).json(errorResponse);
}

/**
 * Async error wrapper for route handlers
 */
export function asyncHandler(
  handler: (req: any, res: any) => Promise<void>
) {
  return async (req: any, res: any): Promise<void> => {
    try {
      await handler(req, res);
    } catch (error) {
      handleError(error, req.correlationId, res);
    }
  };
}

/**
 * Validation error helper for Zod validation failures
 */
export function createValidationError(
  zodError: any,
  correlationId?: string
): ValidationError {
  const details = zodError.errors?.map((err: any) => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code
  })) || [];

  return new ValidationError(
    'Request validation failed',
    { validationErrors: details },
    correlationId
  );
}

/**
 * Check if an error is a specific type of AppError
 */
export function isAppError(error: unknown, code?: ApiError): error is AppError {
  if (!(error instanceof AppError)) {
    return false;
  }
  
  return code ? error.code === code : true;
}

/**
 * Safe error message extraction (prevents sensitive data leakage)
 */
export function getSafeErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.message;
  }
  
  if (error instanceof Error) {
    // Only return generic message for non-AppError instances
    return 'An error occurred while processing your request';
  }
  
  return 'An unexpected error occurred';
}

/**
 * Error reporting utility for external monitoring services
 */
export function reportError(
  error: unknown,
  context: {
    correlationId: string;
    userId?: string;
    operation?: string;
    metadata?: Record<string, any>;
  }
): void {
  // This would integrate with external error reporting services
  // like Sentry, Rollbar, or AWS CloudWatch Insights
  
  const errorData = {
    timestamp: new Date().toISOString(),
    correlationId: context.correlationId,
    userId: context.userId,
    operation: context.operation,
    metadata: context.metadata,
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : { message: String(error) }
  };

  // For now, just log to CloudWatch
  console.error('ERROR_REPORT', JSON.stringify(errorData));
  
  // TODO: Integrate with external error reporting service
  // await errorReportingService.report(errorData);
}