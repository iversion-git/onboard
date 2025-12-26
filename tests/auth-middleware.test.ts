// Authentication middleware specific tests
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { authMiddleware, requireRole, requireMinimumRole } from '../middleware/auth.js';
import { jwtHelper } from '../lib/jwt.js';
import { resetConfig } from '../lib/config.js';
import type { InternalRequest, InternalResponse } from '../lib/types.js';

// Mock request and response objects
function createMockRequest(headers: Record<string, string> = {}): InternalRequest {
  return {
    method: 'GET',
    path: '/test',
    headers,
    body: null,
    query: {},
    params: {},
    context: { authenticated: false },
    correlationId: 'test-correlation-id',
    rawEvent: {} as any,
    lambdaContext: {} as any
  };
}

function createMockResponse(): InternalResponse {
  const response = {
    _statusCode: 200,
    _headers: {},
    _body: '',
    _ended: false,
    status: function(code: number) {
      this._statusCode = code;
      return this;
    },
    json: function(data: any) {
      this._body = JSON.stringify(data);
      return this;
    },
    send: function(data: string) {
      this._body = data;
      return this;
    },
    header: function(name: string, value: string) {
      this._headers[name] = value;
      return this;
    },
    end: function() {
      this._ended = true;
    }
  };
  return response as InternalResponse;
}

describe('Authentication Middleware', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    resetConfig();
    process.env = { ...originalEnv };
    process.env['JWT_SECRET'] = 'this-is-a-very-long-secret-key-for-testing-purposes-123456';
    process.env['STAGE'] = 'test';
  });

  afterEach(() => {
    process.env = originalEnv;
    resetConfig();
  });

  describe('authMiddleware', () => {
    it('should reject requests without authorization header', async () => {
      const middleware = authMiddleware();
      const req = createMockRequest();
      const res = createMockResponse();
      let nextCalled = false;

      await middleware(req, res, async () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(false);
      expect(res._statusCode).toBe(401);
      expect(JSON.parse(res._body).error.code).toBe('Unauthorized');
    });

    it('should reject requests with invalid token format', async () => {
      const middleware = authMiddleware();
      const req = createMockRequest({ 'Authorization': 'InvalidFormat token123' });
      const res = createMockResponse();
      let nextCalled = false;

      await middleware(req, res, async () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(false);
      expect(res._statusCode).toBe(401);
      expect(JSON.parse(res._body).error.code).toBe('Unauthorized');
    });

    it('should accept valid JWT tokens', async () => {
      // Create a valid JWT token
      const token = await jwtHelper.signToken({
        staffId: 'test-staff-123',
        email: 'test@example.com',
        roles: ['staff']
      });

      const middleware = authMiddleware();
      const req = createMockRequest({ 'Authorization': `Bearer ${token}` });
      const res = createMockResponse();
      let nextCalled = false;

      await middleware(req, res, async () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
      expect(req.context.authenticated).toBe(true);
      expect(req.context.staff_id).toBe('test-staff-123');
      expect(req.context.email).toBe('test@example.com');
      expect(req.context.roles).toEqual(['staff']);
    });

    it('should allow unauthenticated requests when required=false', async () => {
      const middleware = authMiddleware({ required: false });
      const req = createMockRequest();
      const res = createMockResponse();
      let nextCalled = false;

      await middleware(req, res, async () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
      expect(req.context.authenticated).toBe(false);
    });
  });

  describe('requireRole', () => {
    it('should allow access with required role', async () => {
      const middleware = requireRole(['admin']);
      const req = createMockRequest();
      req.context = {
        authenticated: true,
        staff_id: 'test-staff',
        email: 'test@example.com',
        roles: ['admin', 'staff'],
        stage: 'test'
      };
      const res = createMockResponse();
      let nextCalled = false;

      await middleware(req, res, async () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
    });

    it('should deny access without required role', async () => {
      const middleware = requireRole(['admin']);
      const req = createMockRequest();
      req.context = {
        authenticated: true,
        staff_id: 'test-staff',
        email: 'test@example.com',
        roles: ['staff'],
        stage: 'test'
      };
      const res = createMockResponse();
      let nextCalled = false;

      await middleware(req, res, async () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(false);
      expect(res._statusCode).toBe(403);
      expect(JSON.parse(res._body).error.code).toBe('Forbidden');
    });

    it('should deny access for unauthenticated users', async () => {
      const middleware = requireRole(['staff']);
      const req = createMockRequest();
      req.context = { authenticated: false };
      const res = createMockResponse();
      let nextCalled = false;

      await middleware(req, res, async () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(false);
      expect(res._statusCode).toBe(401);
      expect(JSON.parse(res._body).error.code).toBe('Unauthorized');
    });
  });

  describe('requireMinimumRole', () => {
    it('should allow admin access to manager-level endpoints', async () => {
      const middleware = requireMinimumRole('manager');
      const req = createMockRequest();
      req.context = {
        authenticated: true,
        staff_id: 'test-staff',
        email: 'test@example.com',
        roles: ['admin'],
        stage: 'test'
      };
      const res = createMockResponse();
      let nextCalled = false;

      await middleware(req, res, async () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
    });

    it('should deny staff access to manager-level endpoints', async () => {
      const middleware = requireMinimumRole('manager');
      const req = createMockRequest();
      req.context = {
        authenticated: true,
        staff_id: 'test-staff',
        email: 'test@example.com',
        roles: ['staff'],
        stage: 'test'
      };
      const res = createMockResponse();
      let nextCalled = false;

      await middleware(req, res, async () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(false);
      expect(res._statusCode).toBe(403);
      expect(JSON.parse(res._body).error.code).toBe('Forbidden');
    });
  });
});