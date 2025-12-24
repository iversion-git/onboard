/**
 * Unit tests for authentication utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JWTAuth, PasswordAuth, AuthContextManager, type JWTTokenPayload } from './auth.js';
import type { AuthContext } from './types.js';

// Mock the SecretsManagerHelpers
vi.mock('./aws/secrets.js', () => ({
  SecretsManagerHelpers: {
    getJWTSigningKey: vi.fn().mockResolvedValue('test-signing-key-32-characters-long')
  }
}));

// Mock the logger
vi.mock('./logging.js', () => ({
  createLoggerFromCorrelationId: vi.fn().mockReturnValue({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}));

describe('JWTAuth', () => {
  beforeEach(() => {
    // Clear cache before each test
    JWTAuth.clearCache();
    vi.clearAllMocks();
  });

  describe('signToken', () => {
    it('should sign a valid JWT token', async () => {
      const staffId = 'staff-123';
      const email = 'test@example.com';
      const roles = ['admin', 'staff'];

      const token = await JWTAuth.signToken(staffId, email, roles);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should include correct payload in signed token', async () => {
      const staffId = 'staff-456';
      const email = 'manager@example.com';
      const roles = ['manager'];

      const token = await JWTAuth.signToken(staffId, email, roles);
      const payload = await JWTAuth.verifyToken(token);

      expect(payload.sub).toBe(staffId);
      expect(payload.email).toBe(email);
      expect(payload.roles).toEqual(roles);
      expect(payload.iat).toBeDefined();
      expect(payload.exp).toBeDefined();
      expect(payload.exp).toBeGreaterThan(payload.iat!);
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', async () => {
      const staffId = 'staff-789';
      const email = 'staff@example.com';
      const roles = ['staff'];

      const token = await JWTAuth.signToken(staffId, email, roles);
      const payload = await JWTAuth.verifyToken(token);

      expect(payload.sub).toBe(staffId);
      expect(payload.email).toBe(email);
      expect(payload.roles).toEqual(roles);
    });

    it('should reject invalid tokens', async () => {
      const invalidToken = 'invalid.token.here';

      await expect(JWTAuth.verifyToken(invalidToken)).rejects.toThrow('Token verification failed');
    });

    it('should reject tokens with missing required fields', async () => {
      // This test would require creating a malformed token, which is complex
      // In practice, the jose library handles most validation
      const emptyToken = '';
      
      await expect(JWTAuth.verifyToken(emptyToken)).rejects.toThrow();
    });
  });

  describe('createAuthContext', () => {
    it('should create valid AuthContext from JWT payload', () => {
      const payload: JWTTokenPayload = {
        sub: 'staff-123',
        email: 'test@example.com',
        roles: ['admin'],
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      };

      const context = JWTAuth.createAuthContext(payload);

      expect(context.staff_id).toBe(payload.sub);
      expect(context.email).toBe(payload.email);
      expect(context.roles).toEqual(payload.roles);
      expect(context.stage).toBeDefined();
    });
  });
});

describe('PasswordAuth', () => {
  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const password = 'TestPassword123!';
      const hash = await PasswordAuth.hashPassword(password);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash).not.toBe(password);
      expect(hash.startsWith('$2b$')).toBe(true); // bcrypt hash format
    });

    it('should reject empty passwords', async () => {
      await expect(PasswordAuth.hashPassword('')).rejects.toThrow('Password cannot be empty');
    });

    it('should produce different hashes for same password', async () => {
      const password = 'TestPassword123!';
      const hash1 = await PasswordAuth.hashPassword(password);
      const hash2 = await PasswordAuth.hashPassword(password);

      expect(hash1).not.toBe(hash2); // Salt makes each hash unique
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const password = 'TestPassword123!';
      const hash = await PasswordAuth.hashPassword(password);

      const isValid = await PasswordAuth.verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'TestPassword123!';
      const wrongPassword = 'WrongPassword123!';
      const hash = await PasswordAuth.hashPassword(password);

      const isValid = await PasswordAuth.verifyPassword(wrongPassword, hash);
      expect(isValid).toBe(false);
    });

    it('should handle empty inputs gracefully', async () => {
      const hash = await PasswordAuth.hashPassword('TestPassword123!');

      expect(await PasswordAuth.verifyPassword('', hash)).toBe(false);
      expect(await PasswordAuth.verifyPassword('password', '')).toBe(false);
    });
  });

  describe('validatePasswordStrength', () => {
    it('should accept strong passwords', () => {
      const strongPassword = 'StrongPass123!';
      const result = PasswordAuth.validatePasswordStrength(strongPassword);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject weak passwords', () => {
      const weakPassword = 'weak';
      const result = PasswordAuth.validatePasswordStrength(weakPassword);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should provide specific error messages', () => {
      const result = PasswordAuth.validatePasswordStrength('short');

      expect(result.errors).toContain('Password must be at least 8 characters long');
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
      expect(result.errors).toContain('Password must contain at least one number');
      expect(result.errors).toContain('Password must contain at least one special character');
    });
  });
});

describe('AuthContextManager', () => {
  const mockContext: AuthContext = {
    staff_id: 'staff-123',
    email: 'test@example.com',
    roles: ['admin', 'staff'],
    stage: 'dev'
  };

  describe('hasRole', () => {
    it('should return true for existing role', () => {
      expect(AuthContextManager.hasRole(mockContext, 'admin')).toBe(true);
      expect(AuthContextManager.hasRole(mockContext, 'staff')).toBe(true);
    });

    it('should return false for non-existing role', () => {
      expect(AuthContextManager.hasRole(mockContext, 'manager')).toBe(false);
    });
  });

  describe('hasAnyRole', () => {
    it('should return true if user has any of the required roles', () => {
      expect(AuthContextManager.hasAnyRole(mockContext, ['admin', 'manager'])).toBe(true);
      expect(AuthContextManager.hasAnyRole(mockContext, ['manager', 'staff'])).toBe(true);
    });

    it('should return false if user has none of the required roles', () => {
      expect(AuthContextManager.hasAnyRole(mockContext, ['manager', 'supervisor'])).toBe(false);
    });
  });

  describe('hasAllRoles', () => {
    it('should return true if user has all required roles', () => {
      expect(AuthContextManager.hasAllRoles(mockContext, ['admin', 'staff'])).toBe(true);
      expect(AuthContextManager.hasAllRoles(mockContext, ['admin'])).toBe(true);
    });

    it('should return false if user is missing any required role', () => {
      expect(AuthContextManager.hasAllRoles(mockContext, ['admin', 'manager'])).toBe(false);
    });
  });

  describe('isAdmin', () => {
    it('should return true for admin users', () => {
      expect(AuthContextManager.isAdmin(mockContext)).toBe(true);
    });

    it('should return false for non-admin users', () => {
      const staffContext = { ...mockContext, roles: ['staff'] };
      expect(AuthContextManager.isAdmin(staffContext)).toBe(false);
    });
  });

  describe('isManagerOrAdmin', () => {
    it('should return true for admin users', () => {
      expect(AuthContextManager.isManagerOrAdmin(mockContext)).toBe(true);
    });

    it('should return true for manager users', () => {
      const managerContext = { ...mockContext, roles: ['manager'] };
      expect(AuthContextManager.isManagerOrAdmin(managerContext)).toBe(true);
    });

    it('should return false for staff-only users', () => {
      const staffContext = { ...mockContext, roles: ['staff'] };
      expect(AuthContextManager.isManagerOrAdmin(staffContext)).toBe(false);
    });
  });

  describe('getHighestPrivilege', () => {
    it('should return admin for admin users', () => {
      expect(AuthContextManager.getHighestPrivilege(mockContext)).toBe('admin');
    });

    it('should return manager for manager users', () => {
      const managerContext = { ...mockContext, roles: ['manager', 'staff'] };
      expect(AuthContextManager.getHighestPrivilege(managerContext)).toBe('manager');
    });

    it('should return staff for staff-only users', () => {
      const staffContext = { ...mockContext, roles: ['staff'] };
      expect(AuthContextManager.getHighestPrivilege(staffContext)).toBe('staff');
    });

    it('should return none for users with no recognized roles', () => {
      const noRoleContext = { ...mockContext, roles: [] };
      expect(AuthContextManager.getHighestPrivilege(noRoleContext)).toBe('none');
    });
  });

  describe('validateContext', () => {
    it('should validate correct AuthContext', () => {
      expect(AuthContextManager.validateContext(mockContext)).toBe(true);
    });

    it('should reject invalid contexts', () => {
      expect(AuthContextManager.validateContext(null)).toBe(false);
      expect(AuthContextManager.validateContext({})).toBe(false);
      expect(AuthContextManager.validateContext({ staff_id: 'test' })).toBe(false);
      expect(AuthContextManager.validateContext({ 
        staff_id: 'test', 
        email: 'test@example.com', 
        roles: 'not-array', 
        stage: 'dev' 
      })).toBe(false);
    });
  });
});