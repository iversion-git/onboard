/**
 * Unit tests for error handling
 */

import { describe, it, expect } from 'vitest';
import { 
  createError, 
  getStatusCodeForErrorType, 
  errorToResponse, 
  isApiError,
  ApiErrorClass,
  withErrorHandling
} from './errors.js';

describe('Error Handling', () => {
  describe('createError', () => {
    it('should create API error with correct properties', () => {
      const error = createError('ValidationError', 'Invalid input', { field: 'email' });
      
      expect(error).toBeInstanceOf(ApiErrorClass);
      expect(error.type).toBe('ValidationError');
      expect(error.message).toBe('Invalid input');
      expect(error.details).toEqual({ field: 'email' });
      expect(error.statusCode).toBe(400);
    });
  });

  describe('getStatusCodeForErrorType', () => {
    it('should return correct status codes for error types', () => {
      expect(getStatusCodeForErrorType('ValidationError')).toBe(400);
      expect(getStatusCodeForErrorType('Unauthorized')).toBe(401);
      expect(getStatusCodeForErrorType('Forbidden')).toBe(403);
      expect(getStatusCodeForErrorType('NotFound')).toBe(404);
      expect(getStatusCodeForErrorType('Conflict')).toBe(409);
      expect(getStatusCodeForErrorType('InternalError')).toBe(500);
    });
  });

  describe('errorToResponse', () => {
    it('should convert API error to response', () => {
      const error = createError('ValidationError', 'Invalid input');
      const response = errorToResponse(error, 'test-correlation-id');
      
      expect(response.error.code).toBe('ValidationError');
      expect(response.error.message).toBe('Invalid input');
      expect(response.error.correlationId).toBe('test-correlation-id');
      expect(response.timestamp).toBeDefined();
    });

    it('should convert generic error to response', () => {
      const error = new Error('Generic error');
      const response = errorToResponse(error, 'test-correlation-id');
      
      expect(response.error.code).toBe('InternalError');
      expect(response.error.message).toBe('An unexpected error occurred');
      expect(response.error.correlationId).toBe('test-correlation-id');
    });

    it('should handle unknown error types', () => {
      const response = errorToResponse('string error', 'test-correlation-id');
      
      expect(response.error.code).toBe('InternalError');
      expect(response.error.message).toBe('An unexpected error occurred');
    });
  });

  describe('isApiError', () => {
    it('should identify API errors correctly', () => {
      const apiError = createError('ValidationError', 'Invalid input');
      const genericError = new Error('Generic error');
      
      expect(isApiError(apiError)).toBe(true);
      expect(isApiError(apiError, 'ValidationError')).toBe(true);
      expect(isApiError(apiError, 'NotFound')).toBe(false);
      expect(isApiError(genericError)).toBe(false);
    });
  });

  describe('withErrorHandling', () => {
    it('should wrap handler and pass through successful results', async () => {
      const handler = async (event: any, correlationId: string) => {
        return { success: true, correlationId };
      };
      
      const wrappedHandler = withErrorHandling(handler);
      const result = await wrappedHandler({ test: 'event' });
      
      expect(result.success).toBe(true);
      expect(result.correlationId).toBeDefined();
    });

    it('should re-throw errors for Lambda runtime handling', async () => {
      const handler = async (event: any, correlationId: string) => {
        throw createError('ValidationError', 'Test error');
      };
      
      const wrappedHandler = withErrorHandling(handler);
      
      await expect(wrappedHandler({ test: 'event' })).rejects.toThrow('Test error');
    });
  });
});