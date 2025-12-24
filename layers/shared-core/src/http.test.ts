/**
 * Unit tests for HTTP utilities
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { 
  parseRequestBody, 
  getCorrelationId, 
  buildResponse, 
  getCorsHeaders,
  handleCorsPreflightRequest 
} from './http.js';
import { createError } from './errors.js';

describe('HTTP Utilities', () => {
  beforeEach(() => {
    // Reset environment variables
    delete process.env.STAGE;
    delete process.env.CORS_ORIGINS;
  });

  describe('parseRequestBody', () => {
    const testSchema = z.object({
      name: z.string(),
      email: z.string().email()
    });

    it('should parse valid JSON body', () => {
      const event = {
        body: JSON.stringify({ name: 'Test User', email: 'test@example.com' })
      } as APIGatewayProxyEventV2;

      const result = parseRequestBody(event, testSchema);
      expect(result).toEqual({ name: 'Test User', email: 'test@example.com' });
    });

    it('should throw ValidationError for missing body', () => {
      const event = { body: null } as APIGatewayProxyEventV2;

      expect(() => parseRequestBody(event, testSchema)).toThrow('Request body is required');
    });

    it('should throw ValidationError for invalid JSON', () => {
      const event = { body: 'invalid json' } as APIGatewayProxyEventV2;

      expect(() => parseRequestBody(event, testSchema)).toThrow('Invalid JSON in request body');
    });

    it('should throw ValidationError for schema validation failure', () => {
      const event = {
        body: JSON.stringify({ name: 'Test User', email: 'invalid-email' })
      } as APIGatewayProxyEventV2;

      expect(() => parseRequestBody(event, testSchema)).toThrow('Request validation failed');
    });
  });

  describe('getCorrelationId', () => {
    it('should return x-correlation-id header if present', () => {
      const event = {
        headers: { 'x-correlation-id': 'test-correlation-id' },
        requestContext: { requestId: 'request-id' }
      } as APIGatewayProxyEventV2;

      expect(getCorrelationId(event)).toBe('test-correlation-id');
    });

    it('should return X-Correlation-ID header if present', () => {
      const event = {
        headers: { 'X-Correlation-ID': 'test-correlation-id' },
        requestContext: { requestId: 'request-id' }
      } as APIGatewayProxyEventV2;

      expect(getCorrelationId(event)).toBe('test-correlation-id');
    });

    it('should fallback to request ID', () => {
      const event = {
        headers: {},
        requestContext: { requestId: 'request-id' }
      } as APIGatewayProxyEventV2;

      expect(getCorrelationId(event)).toBe('request-id');
    });
  });

  describe('buildResponse', () => {
    it('should build successful response with default status code', () => {
      const data = { message: 'success' };
      const response = buildResponse(data);

      expect(response.statusCode).toBe(200);
      expect(response.headers['Content-Type']).toBe('application/json');
      expect(JSON.parse(response.body)).toEqual(data);
    });

    it('should build response with custom status code', () => {
      const data = { id: '123' };
      const response = buildResponse(data, 201);

      expect(response.statusCode).toBe(201);
      expect(JSON.parse(response.body)).toEqual(data);
    });
  });

  describe('getCorsHeaders', () => {
    it('should return wildcard origin for development', () => {
      process.env.STAGE = 'dev';
      process.env.CORS_ORIGINS = '*';

      const headers = getCorsHeaders();
      expect(headers['Access-Control-Allow-Origin']).toBe('*');
      expect(headers['Access-Control-Allow-Credentials']).toBe('false');
    });

    it('should restrict origins in production', () => {
      process.env.STAGE = 'prod';
      process.env.CORS_ORIGINS = '*';

      const headers = getCorsHeaders();
      expect(headers['Access-Control-Allow-Origin']).toBe('https://app.example.com');
      expect(headers['Access-Control-Allow-Credentials']).toBe('true');
    });

    it('should use specific origins when configured', () => {
      process.env.STAGE = 'prod';
      process.env.CORS_ORIGINS = 'https://app.example.com,https://admin.example.com';

      const headers = getCorsHeaders();
      expect(headers['Access-Control-Allow-Origin']).toBe('https://app.example.com');
      expect(headers['Access-Control-Allow-Credentials']).toBe('true');
    });
  });

  describe('handleCorsPreflightRequest', () => {
    it('should return 200 with CORS headers', () => {
      const response = handleCorsPreflightRequest();
      
      expect(response.statusCode).toBe(200);
      expect(response.headers['Access-Control-Allow-Origin']).toBeDefined();
      expect(response.body).toBe('');
    });
  });
});