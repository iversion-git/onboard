// Configuration tests
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig, resetConfig, getJwtSecret, validateRequiredConfig } from '../lib/config.js';

describe('Configuration Management', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset config before each test
    resetConfig();
    // Clear environment
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    resetConfig();
  });

  describe('JWT Secret Configuration', () => {
    it('should load JWT secret from environment variable', () => {
      process.env['JWT_SECRET'] = 'this-is-a-very-long-secret-key-for-testing-purposes-123456';
      
      const config = loadConfig();
      expect(config.jwt.secret).toBe('this-is-a-very-long-secret-key-for-testing-purposes-123456');
    });

    it('should validate JWT secret minimum length', () => {
      process.env['JWT_SECRET'] = 'short';
      
      expect(() => loadConfig()).toThrow('JWT secret must be at least 32 characters long');
    });

    it('should return JWT secret via getJwtSecret function', () => {
      process.env['JWT_SECRET'] = 'this-is-a-very-long-secret-key-for-testing-purposes-123456';
      
      const secret = getJwtSecret();
      expect(secret).toBe('this-is-a-very-long-secret-key-for-testing-purposes-123456');
    });

    it('should throw error if JWT secret is missing', () => {
      delete process.env['JWT_SECRET'];
      
      expect(() => getJwtSecret()).toThrow('Configuration validation failed');
    });

    it('should validate JWT secret length in getJwtSecret', () => {
      process.env['JWT_SECRET'] = 'short';
      
      expect(() => getJwtSecret()).toThrow('JWT secret must be at least 32 characters long');
    });
  });

  describe('Production Configuration Validation', () => {
    it('should require JWT_SECRET in production', () => {
      process.env['STAGE'] = 'prod';
      process.env['SES_FROM_EMAIL'] = 'test@example.com';
      process.env['CORS_ORIGINS'] = 'https://app.example.com';
      // Missing JWT_SECRET
      
      expect(() => {
        loadConfig();
        validateRequiredConfig();
      }).toThrow('Configuration validation failed');
    });

    it('should pass validation with all required production config', () => {
      process.env['STAGE'] = 'prod';
      process.env['JWT_SECRET'] = 'this-is-a-very-long-secret-key-for-testing-purposes-123456';
      process.env['SES_FROM_EMAIL'] = 'test@example.com';
      process.env['CORS_ORIGINS'] = 'https://app.example.com';
      
      expect(() => {
        loadConfig();
        validateRequiredConfig();
      }).not.toThrow();
    });
  });

  describe('Default Configuration', () => {
    it('should provide default values for optional settings', () => {
      process.env['JWT_SECRET'] = 'this-is-a-very-long-secret-key-for-testing-purposes-123456';
      
      const config = loadConfig();
      expect(config.stage).toBe('dev');
      expect(config.jwt.expiry).toBe('24h');
      expect(config.logging.level).toBe('info');
      expect(config.security.bcryptRounds).toBe(12);
    });

    it('should auto-generate table names based on stage', () => {
      process.env['JWT_SECRET'] = 'this-is-a-very-long-secret-key-for-testing-purposes-123456';
      process.env['STAGE'] = 'test';
      
      const config = loadConfig();
      expect(config.dynamodb.staffTable).toBe('onboard-staff-test');
      expect(config.dynamodb.passwordResetTokensTable).toBe('onboard-password-reset-tokens-test');
      expect(config.dynamodb.tenantsTable).toBe('onboard-tenants-test');
    });
  });
});