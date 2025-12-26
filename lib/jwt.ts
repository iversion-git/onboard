import { SignJWT, jwtVerify } from 'jose';
import { getConfig } from './config.js';
import { logger } from './logging.js';

// JWT payload interface matching our requirements
export interface JWTTokenPayload {
  sub: string;        // staff_id
  email: string;
  roles: string[];
  iat: number;        // issued at
  exp: number;        // expires at
  iss?: string;       // issuer (optional)
  aud?: string;       // audience (optional)
}

// JWT configuration
const JWT_ALGORITHM = 'HS256';
const JWT_ISSUER = 'aws-lambda-control-plane';
const JWT_AUDIENCE = 'control-plane-api';

// Get JWT secret from environment with validation
const getJWTSecret = (): Uint8Array => {
  const config = getConfig();
  const secret = config.jwt.secret;
  
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  
  if (secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }
  
  // Convert string secret to Uint8Array for jose library
  return new TextEncoder().encode(secret);
};

// JWT Helper class for signing and verifying tokens
export class JWTHelper {
  private secret: Uint8Array;

  constructor() {
    this.secret = getJWTSecret();
    logger.info('JWT helper initialized');
  }

  /**
   * Sign a JWT token with staff information
   */
  async signToken(payload: {
    staffId: string;
    email: string;
    roles: string[];
  }, correlationId?: string): Promise<string> {
    try {
      logger.info('Signing JWT token', {
        staffId: payload.staffId,
        email: payload.email,
        roles: payload.roles,
        correlationId,
      });

      const now = Math.floor(Date.now() / 1000);
      const exp = now + (24 * 60 * 60); // 24 hours from now

      const jwt = await new SignJWT({
        sub: payload.staffId,
        email: payload.email,
        roles: payload.roles,
        iat: now,
        exp: exp,
        iss: JWT_ISSUER,
        aud: JWT_AUDIENCE,
      })
        .setProtectedHeader({ alg: JWT_ALGORITHM })
        .sign(this.secret);

      logger.info('JWT token signed successfully', {
        staffId: payload.staffId,
        expiresAt: new Date(exp * 1000).toISOString(),
        correlationId,
      });

      return jwt;
    } catch (error) {
      logger.error('Failed to sign JWT token', {
        error: error instanceof Error ? error.message : 'Unknown error',
        staffId: payload.staffId,
        correlationId,
      });
      throw error;
    }
  }

  /**
   * Verify and decode a JWT token
   */
  async verifyToken(token: string, correlationId?: string): Promise<JWTTokenPayload> {
    try {
      logger.info('Verifying JWT token', { correlationId });

      const { payload } = await jwtVerify(token, this.secret, {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        algorithms: [JWT_ALGORITHM],
      });

      // Validate required fields
      if (!payload.sub || !payload['email'] || !payload['roles']) {
        throw new Error('Invalid JWT payload: missing required fields');
      }

      if (!Array.isArray(payload['roles'])) {
        throw new Error('Invalid JWT payload: roles must be an array');
      }

      const jwtPayload: JWTTokenPayload = {
        sub: payload.sub,
        email: payload['email'] as string,
        roles: payload['roles'] as string[],
        iat: payload.iat!,
        exp: payload.exp!,
        ...(payload.iss && { iss: payload.iss }),
        ...(typeof payload.aud === 'string' && { aud: payload.aud }),
      };

      logger.info('JWT token verified successfully', {
        staffId: jwtPayload.sub,
        email: jwtPayload.email,
        roles: jwtPayload.roles,
        expiresAt: new Date(jwtPayload.exp * 1000).toISOString(),
        correlationId,
      });

      return jwtPayload;
    } catch (error) {
      logger.error('Failed to verify JWT token', {
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId,
      });
      throw error;
    }
  }

  /**
   * Extract token from Authorization header
   */
  static extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader) {
      return null;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1] || null;
  }

  /**
   * Check if a token is expired (without verifying signature)
   */
  static isTokenExpired(token: string): boolean {
    try {
      // Decode without verification to check expiration
      const parts = token.split('.');
      if (parts.length !== 3) {
        return true;
      }

      const payload = JSON.parse(atob(parts[1]!));
      const now = Math.floor(Date.now() / 1000);
      
      return payload.exp && payload.exp < now;
    } catch {
      return true;
    }
  }

  /**
   * Get token expiration time
   */
  static getTokenExpiration(token: string): Date | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      const payload = JSON.parse(atob(parts[1]!));
      return payload.exp ? new Date(payload.exp * 1000) : null;
    } catch {
      return null;
    }
  }
}

// Export singleton instance (lazy initialization)
let jwtHelperInstance: JWTHelper | null = null;
export const jwtHelper = {
  get instance(): JWTHelper {
    if (!jwtHelperInstance) {
      jwtHelperInstance = new JWTHelper();
    }
    return jwtHelperInstance;
  },
  
  // Proxy methods for convenience
  signToken: (payload: { staffId: string; email: string; roles: string[]; }, correlationId?: string) => 
    jwtHelper.instance.signToken(payload, correlationId),
  verifyToken: (token: string, correlationId?: string) => 
    jwtHelper.instance.verifyToken(token, correlationId),
};

// Utility functions for role checking
export const hasRole = (userRoles: string[], requiredRole: string): boolean => {
  return userRoles.includes(requiredRole);
};

export const hasAnyRole = (userRoles: string[], requiredRoles: string[]): boolean => {
  return requiredRoles.some(role => userRoles.includes(role));
};

export const hasAllRoles = (userRoles: string[], requiredRoles: string[]): boolean => {
  return requiredRoles.every(role => userRoles.includes(role));
};

// Role hierarchy checking (admin > manager > staff)
export const hasMinimumRole = (userRoles: string[], minimumRole: 'staff' | 'manager' | 'admin'): boolean => {
  const roleHierarchy = {
    staff: 1,
    manager: 2,
    admin: 3,
  };

  const userMaxRole = Math.max(...userRoles.map(role => roleHierarchy[role as keyof typeof roleHierarchy] || 0));
  const requiredLevel = roleHierarchy[minimumRole];

  return userMaxRole >= requiredLevel;
};