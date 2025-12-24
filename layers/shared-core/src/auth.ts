/**
 * Authentication utilities for JWT token management and password operations
 * Provides secure JWT signing/verification and bcrypt password hashing
 */

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import bcrypt from 'bcrypt';
import { SecretsManagerHelpers } from './aws/secrets.js';
import { createLoggerFromCorrelationId } from './logging.js';
import type { AuthContext } from './types.js';

// Create a logger instance for authentication operations
const logger = createLoggerFromCorrelationId('auth', 'authentication');

/**
 * JWT token payload structure matching the design specification
 */
export interface JWTTokenPayload extends JWTPayload {
  sub: string;        // staff_id
  email: string;
  roles: string[];
  iat: number;        // issued at
  exp: number;        // expires at
  iss?: string;       // issuer (optional)
  aud?: string;       // audience (optional)
}

/**
 * JWT Authentication utilities
 */
export class JWTAuth {
  private static signingKeyCache: { key: Uint8Array; expiry: number } | null = null;
  private static readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private static readonly TOKEN_EXPIRY_HOURS = 24; // 24 hours
  private static readonly BCRYPT_ROUNDS = 12;

  /**
   * Get JWT signing key with caching
   */
  private static async getSigningKey(): Promise<Uint8Array> {
    // Check cache first
    if (this.signingKeyCache && Date.now() < this.signingKeyCache.expiry) {
      logger.debug('JWT signing key retrieved from cache');
      return this.signingKeyCache.key;
    }

    try {
      const keyString = await SecretsManagerHelpers.getJWTSigningKey();
      const key = new TextEncoder().encode(keyString);
      
      // Cache the key
      this.signingKeyCache = {
        key,
        expiry: Date.now() + this.CACHE_TTL_MS
      };

      logger.info('JWT signing key retrieved and cached');
      return key;
    } catch (error) {
      logger.error('Failed to retrieve JWT signing key', { error });
      throw new Error('JWT signing key not available');
    }
  }

  /**
   * Sign a JWT token with staff information
   */
  static async signToken(staffId: string, email: string, roles: string[]): Promise<string> {
    try {
      const signingKey = await this.getSigningKey();
      const stage = process.env['STAGE'] || 'dev';
      
      const now = Math.floor(Date.now() / 1000);
      const exp = now + (this.TOKEN_EXPIRY_HOURS * 60 * 60);

      const jwt = await new SignJWT({
        sub: staffId,
        email,
        roles,
        iat: now,
        exp,
        iss: `control-plane-${stage}`,
        aud: `control-plane-api-${stage}`
      } as JWTTokenPayload)
        .setProtectedHeader({ alg: 'HS256' })
        .sign(signingKey);

      logger.info('JWT token signed successfully', { 
        staffId, 
        email, 
        roles: roles.length,
        expiresAt: new Date(exp * 1000).toISOString()
      });

      return jwt;
    } catch (error) {
      logger.error('Failed to sign JWT token', { staffId, email, error });
      throw new Error('Token signing failed');
    }
  }

  /**
   * Verify and decode a JWT token
   */
  static async verifyToken(token: string): Promise<JWTTokenPayload> {
    try {
      const signingKey = await this.getSigningKey();
      const stage = process.env['STAGE'] || 'dev';

      const { payload } = await jwtVerify(token, signingKey, {
        issuer: `control-plane-${stage}`,
        audience: `control-plane-api-${stage}`
      });

      const jwtPayload = payload as JWTTokenPayload;

      // Validate required fields
      if (!jwtPayload.sub || !jwtPayload.email || !Array.isArray(jwtPayload.roles)) {
        throw new Error('Invalid token payload structure');
      }

      logger.debug('JWT token verified successfully', { 
        staffId: jwtPayload.sub,
        email: jwtPayload.email,
        roles: jwtPayload.roles.length
      });

      return jwtPayload;
    } catch (error) {
      logger.warn('JWT token verification failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw new Error('Token verification failed');
    }
  }

  /**
   * Extract AuthContext from JWT payload
   */
  static createAuthContext(payload: JWTTokenPayload): AuthContext {
    const stage = process.env['STAGE'] || 'dev';
    
    return {
      staff_id: payload.sub,
      email: payload.email,
      roles: payload.roles,
      stage
    };
  }

  /**
   * Clear signing key cache (useful for testing or key rotation)
   */
  static clearCache(): void {
    this.signingKeyCache = null;
    logger.info('JWT signing key cache cleared');
  }
}

/**
 * Password hashing and verification utilities
 */
export class PasswordAuth {
  private static readonly BCRYPT_ROUNDS = 12;

  /**
   * Hash a password using bcrypt
   */
  static async hashPassword(password: string): Promise<string> {
    try {
      if (!password || password.length === 0) {
        throw new Error('Password cannot be empty');
      }

      const hash = await bcrypt.hash(password, this.BCRYPT_ROUNDS);
      
      logger.debug('Password hashed successfully');
      return hash;
    } catch (error) {
      // Re-throw our custom error messages, otherwise wrap in generic message
      if (error instanceof Error && error.message === 'Password cannot be empty') {
        throw error;
      }
      logger.error('Password hashing failed', { error });
      throw new Error('Password hashing failed');
    }
  }

  /**
   * Verify a password against its hash
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      if (!password || !hash) {
        logger.warn('Password verification attempted with empty password or hash');
        return false;
      }

      const isValid = await bcrypt.compare(password, hash);
      
      logger.debug('Password verification completed', { isValid });
      return isValid;
    } catch (error) {
      logger.error('Password verification failed', { error });
      return false;
    }
  }

  /**
   * Check if a password meets security requirements
   */
  static validatePasswordStrength(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!password) {
      errors.push('Password is required');
      return { isValid: false, errors };
    }

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

/**
 * Authentication context utilities
 */
export class AuthContextManager {
  /**
   * Check if user has required role
   */
  static hasRole(context: AuthContext, requiredRole: string): boolean {
    return context.roles.includes(requiredRole);
  }

  /**
   * Check if user has any of the required roles
   */
  static hasAnyRole(context: AuthContext, requiredRoles: string[]): boolean {
    return requiredRoles.some(role => context.roles.includes(role));
  }

  /**
   * Check if user has all required roles
   */
  static hasAllRoles(context: AuthContext, requiredRoles: string[]): boolean {
    return requiredRoles.every(role => context.roles.includes(role));
  }

  /**
   * Check if user is admin
   */
  static isAdmin(context: AuthContext): boolean {
    return this.hasRole(context, 'admin');
  }

  /**
   * Check if user is manager or admin
   */
  static isManagerOrAdmin(context: AuthContext): boolean {
    return this.hasAnyRole(context, ['admin', 'manager']);
  }

  /**
   * Get user's highest privilege level
   */
  static getHighestPrivilege(context: AuthContext): 'admin' | 'manager' | 'staff' | 'none' {
    if (this.hasRole(context, 'admin')) return 'admin';
    if (this.hasRole(context, 'manager')) return 'manager';
    if (this.hasRole(context, 'staff')) return 'staff';
    return 'none';
  }

  /**
   * Validate auth context structure
   */
  static validateContext(context: any): context is AuthContext {
    return (
      typeof context === 'object' &&
      context !== null &&
      typeof context.staff_id === 'string' &&
      typeof context.email === 'string' &&
      Array.isArray(context.roles) &&
      context.roles.every((role: any) => typeof role === 'string') &&
      typeof context.stage === 'string'
    );
  }
}