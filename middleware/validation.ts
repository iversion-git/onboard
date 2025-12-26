// Validation middleware using Zod schemas
import type { Middleware } from '../lib/types.js';
import { sendError } from '../lib/response.js';
import { z } from 'zod';

export interface ValidationOptions {
  body?: z.ZodSchema;
  query?: z.ZodSchema;
  params?: z.ZodSchema;
  headers?: z.ZodSchema;
}

export function validationMiddleware(schemas: ValidationOptions): Middleware {
  return async (req, res, next) => {
    try {
      // Validate request body
      if (schemas.body) {
        const result = schemas.body.safeParse(req.body);
        if (!result.success) {
          sendError(
            res,
            'ValidationError',
            'Invalid request body',
            req.correlationId,
            {
              field: 'body',
              errors: result.error.errors
            }
          );
          return;
        }
        req.body = result.data;
      }

      // Validate query parameters
      if (schemas.query) {
        const result = schemas.query.safeParse(req.query);
        if (!result.success) {
          sendError(
            res,
            'ValidationError',
            'Invalid query parameters',
            req.correlationId,
            {
              field: 'query',
              errors: result.error.errors
            }
          );
          return;
        }
        req.query = result.data;
      }

      // Validate path parameters
      if (schemas.params) {
        const result = schemas.params.safeParse(req.params);
        if (!result.success) {
          sendError(
            res,
            'ValidationError',
            'Invalid path parameters',
            req.correlationId,
            {
              field: 'params',
              errors: result.error.errors
            }
          );
          return;
        }
        req.params = result.data;
      }

      // Validate headers
      if (schemas.headers) {
        const result = schemas.headers.safeParse(req.headers);
        if (!result.success) {
          sendError(
            res,
            'ValidationError',
            'Invalid headers',
            req.correlationId,
            {
              field: 'headers',
              errors: result.error.errors
            }
          );
          return;
        }
        // Note: We don't override req.headers as it might break other middleware
      }

      await next();
    } catch (error) {
      console.error('Validation middleware error:', error);
      sendError(res, 'InternalError', 'Validation error', req.correlationId);
    }
  };
}

// Common validation schemas
export const commonSchemas = {
  email: z.string().email().transform(email => email.toLowerCase().trim()),
  
  staffId: z.string().uuid(),
  
  tenantId: z.string().uuid(),
  
  correlationId: z.string().uuid().optional(),
  
  pagination: z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0)
  }),

  authHeaders: z.object({
    authorization: z.string().regex(/^Bearer .+/, 'Authorization header must be Bearer token')
  })
};