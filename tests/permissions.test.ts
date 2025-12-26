// Tests for permission checking utilities
import { describe, it, expect } from 'vitest';
import { 
  PermissionChecker, 
  hasRole, 
  hasAnyRole, 
  hasAllRoles, 
  hasMinimumRole,
  isAdmin,
  isAdminOrManager,
  canAccessOwnResourceOrAdmin,
  checkEndpointPermission,
  ROLE_HIERARCHY,
  ENDPOINT_PERMISSIONS
} from '../lib/permissions.js';
import type { AuthContext } from '../lib/types.js';

describe('Permission Utilities', () => {
  const createAuthContext = (authenticated: boolean, roles: string[] = [], staffId?: string): AuthContext => ({
    authenticated,
    roles,
    staff_id: staffId,
    email: staffId ? `${staffId}@example.com` : undefined,
    stage: 'test'
  });

  describe('PermissionChecker', () => {
    describe('hasRole', () => {
      it('should return true when user has the required role', () => {
        const context = createAuthContext(true, ['admin', 'staff']);
        const result = PermissionChecker.hasRole(context, 'admin');
        
        expect(result.allowed).toBe(true);
        expect(result.reason).toBeUndefined();
        expect(result.requiredRoles).toEqual(['admin']);
        expect(result.userRoles).toEqual(['admin', 'staff']);
      });

      it('should return false when user does not have the required role', () => {
        const context = createAuthContext(true, ['staff']);
        const result = PermissionChecker.hasRole(context, 'admin');
        
        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('Missing required role: admin');
        expect(result.requiredRoles).toEqual(['admin']);
        expect(result.userRoles).toEqual(['staff']);
      });

      it('should return false when user is not authenticated', () => {
        const context = createAuthContext(false);
        const result = PermissionChecker.hasRole(context, 'staff');
        
        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('User not authenticated');
        expect(result.requiredRoles).toEqual(['staff']);
        expect(result.userRoles).toEqual([]);
      });
    });

    describe('hasAnyRole', () => {
      it('should return true when user has any of the required roles', () => {
        const context = createAuthContext(true, ['manager']);
        const result = PermissionChecker.hasAnyRole(context, ['admin', 'manager']);
        
        expect(result.allowed).toBe(true);
        expect(result.reason).toBeUndefined();
        expect(result.requiredRoles).toEqual(['admin', 'manager']);
        expect(result.userRoles).toEqual(['manager']);
      });

      it('should return false when user has none of the required roles', () => {
        const context = createAuthContext(true, ['staff']);
        const result = PermissionChecker.hasAnyRole(context, ['admin', 'manager']);
        
        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('Missing any of required roles: admin, manager');
        expect(result.requiredRoles).toEqual(['admin', 'manager']);
        expect(result.userRoles).toEqual(['staff']);
      });
    });

    describe('hasAllRoles', () => {
      it('should return true when user has all required roles', () => {
        const context = createAuthContext(true, ['admin', 'manager', 'staff']);
        const result = PermissionChecker.hasAllRoles(context, ['admin', 'staff']);
        
        expect(result.allowed).toBe(true);
        expect(result.reason).toBeUndefined();
        expect(result.requiredRoles).toEqual(['admin', 'staff']);
        expect(result.userRoles).toEqual(['admin', 'manager', 'staff']);
      });

      it('should return false when user is missing some required roles', () => {
        const context = createAuthContext(true, ['staff']);
        const result = PermissionChecker.hasAllRoles(context, ['admin', 'staff']);
        
        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('Missing required roles: admin');
        expect(result.requiredRoles).toEqual(['admin', 'staff']);
        expect(result.userRoles).toEqual(['staff']);
      });
    });

    describe('hasMinimumRole', () => {
      it('should return true when user has higher role level', () => {
        const context = createAuthContext(true, ['admin']);
        const result = PermissionChecker.hasMinimumRole(context, 'manager');
        
        expect(result.allowed).toBe(true);
        expect(result.reason).toBeUndefined();
        expect(result.requiredRoles).toEqual(['manager']);
        expect(result.userRoles).toEqual(['admin']);
      });

      it('should return true when user has exact role level', () => {
        const context = createAuthContext(true, ['manager']);
        const result = PermissionChecker.hasMinimumRole(context, 'manager');
        
        expect(result.allowed).toBe(true);
        expect(result.reason).toBeUndefined();
      });

      it('should return false when user has lower role level', () => {
        const context = createAuthContext(true, ['staff']);
        const result = PermissionChecker.hasMinimumRole(context, 'manager');
        
        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('Insufficient role level. Required: manager (level 2), user max level: 1');
        expect(result.requiredRoles).toEqual(['manager']);
        expect(result.userRoles).toEqual(['staff']);
      });
    });

    describe('canAccessOwnResourceOrAdmin', () => {
      it('should return true when user is admin', () => {
        const context = createAuthContext(true, ['admin'], 'user1');
        const result = PermissionChecker.canAccessOwnResourceOrAdmin(context, 'user2');
        
        expect(result.allowed).toBe(true);
        expect(result.reason).toBeUndefined();
      });

      it('should return true when user is resource owner', () => {
        const context = createAuthContext(true, ['staff'], 'user1');
        const result = PermissionChecker.canAccessOwnResourceOrAdmin(context, 'user1');
        
        expect(result.allowed).toBe(true);
        expect(result.reason).toBeUndefined();
      });

      it('should return false when user is neither admin nor owner', () => {
        const context = createAuthContext(true, ['staff'], 'user1');
        const result = PermissionChecker.canAccessOwnResourceOrAdmin(context, 'user2');
        
        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('Access denied: not resource owner and not admin');
      });
    });
  });

  describe('Convenience Functions', () => {
    it('should provide convenient boolean functions', () => {
      const adminContext = createAuthContext(true, ['admin']);
      const staffContext = createAuthContext(true, ['staff']);
      const managerContext = createAuthContext(true, ['manager']);

      expect(hasRole(adminContext, 'admin')).toBe(true);
      expect(hasRole(staffContext, 'admin')).toBe(false);

      expect(hasAnyRole(managerContext, ['admin', 'manager'])).toBe(true);
      expect(hasAnyRole(staffContext, ['admin', 'manager'])).toBe(false);

      expect(hasAllRoles(adminContext, ['admin'])).toBe(true);
      expect(hasAllRoles(staffContext, ['admin'])).toBe(false);

      expect(hasMinimumRole(adminContext, 'staff')).toBe(true);
      expect(hasMinimumRole(staffContext, 'admin')).toBe(false);

      expect(isAdmin(adminContext)).toBe(true);
      expect(isAdmin(staffContext)).toBe(false);

      expect(isAdminOrManager(adminContext)).toBe(true);
      expect(isAdminOrManager(managerContext)).toBe(true);
      expect(isAdminOrManager(staffContext)).toBe(false);

      expect(canAccessOwnResourceOrAdmin(adminContext, 'any-user')).toBe(true);
      expect(canAccessOwnResourceOrAdmin(createAuthContext(true, ['staff'], 'user1'), 'user1')).toBe(true);
      expect(canAccessOwnResourceOrAdmin(createAuthContext(true, ['staff'], 'user1'), 'user2')).toBe(false);
    });
  });

  describe('Endpoint Permissions', () => {
    it('should allow public endpoints without authentication', () => {
      const unauthenticatedContext = createAuthContext(false);
      
      const loginResult = checkEndpointPermission('POST', '/auth/login', unauthenticatedContext);
      expect(loginResult.allowed).toBe(true);

      const resetResult = checkEndpointPermission('POST', '/auth/password-reset/request', unauthenticatedContext);
      expect(resetResult.allowed).toBe(true);
    });

    it('should require authentication for authenticated endpoints', () => {
      const unauthenticatedContext = createAuthContext(false);
      const authenticatedContext = createAuthContext(true, ['staff']);
      
      const unauthResult = checkEndpointPermission('GET', '/staff/me', unauthenticatedContext);
      expect(unauthResult.allowed).toBe(false);
      expect(unauthResult.reason).toBe('Authentication required');

      const authResult = checkEndpointPermission('GET', '/staff/me', authenticatedContext);
      expect(authResult.allowed).toBe(true);
    });

    it('should enforce role-based permissions', () => {
      const staffContext = createAuthContext(true, ['staff']);
      const adminContext = createAuthContext(true, ['admin']);
      const managerContext = createAuthContext(true, ['manager']);
      
      // Admin-only endpoint
      const staffRegisterResult = checkEndpointPermission('POST', '/staff/register', staffContext);
      expect(staffRegisterResult.allowed).toBe(false);

      const adminRegisterResult = checkEndpointPermission('POST', '/staff/register', adminContext);
      expect(adminRegisterResult.allowed).toBe(true);

      // Admin or manager endpoint
      const staffTenantResult = checkEndpointPermission('POST', '/tenant/register', staffContext);
      expect(staffTenantResult.allowed).toBe(false);

      const managerTenantResult = checkEndpointPermission('POST', '/tenant/register', managerContext);
      expect(managerTenantResult.allowed).toBe(true);

      const adminTenantResult = checkEndpointPermission('POST', '/tenant/register', adminContext);
      expect(adminTenantResult.allowed).toBe(true);
    });

    it('should handle unknown endpoints', () => {
      const context = createAuthContext(true, ['admin']);
      const result = checkEndpointPermission('GET', '/unknown/endpoint', context);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('No permission configuration found for endpoint: GET /unknown/endpoint');
    });
  });

  describe('Role Hierarchy', () => {
    it('should define correct role hierarchy levels', () => {
      expect(ROLE_HIERARCHY.staff).toBe(1);
      expect(ROLE_HIERARCHY.manager).toBe(2);
      expect(ROLE_HIERARCHY.admin).toBe(3);
    });
  });

  describe('Endpoint Permissions Configuration', () => {
    it('should have correct endpoint configurations', () => {
      expect(ENDPOINT_PERMISSIONS['POST /auth/login']).toEqual({ public: true });
      expect(ENDPOINT_PERMISSIONS['POST /staff/register']).toEqual({ roles: ['admin'] });
      expect(ENDPOINT_PERMISSIONS['GET /staff/me']).toEqual({ authenticated: true });
      expect(ENDPOINT_PERMISSIONS['POST /tenant/register']).toEqual({ roles: ['admin', 'manager'] });
    });
  });
});