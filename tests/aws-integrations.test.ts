// AWS Integrations tests
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  initializeAWSIntegrations, 
  healthCheckAWSIntegrations,
  dynamoDBHelper,
  sesHelper,
  jwtHelper,
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
  SESHelper
} from '../lib/aws-integrations.js';
import { resetConfig } from '../lib/config.js';

describe('AWS Integrations', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    resetConfig();
    process.env = { ...originalEnv };
    // Set required environment variables for testing
    process.env['JWT_SECRET'] = 'this-is-a-very-long-secret-key-for-testing-purposes-123456';
    process.env['STAGE'] = 'test';
  });

  afterEach(() => {
    process.env = originalEnv;
    resetConfig();
  });

  describe('Initialization', () => {
    it('should initialize AWS integrations successfully', async () => {
      await expect(initializeAWSIntegrations()).resolves.not.toThrow();
    });

    it('should perform health check on AWS integrations', async () => {
      const health = await healthCheckAWSIntegrations();
      
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('services');
      expect(health.services).toHaveProperty('dynamodb');
      expect(health.services).toHaveProperty('ses');
      expect(health.services).toHaveProperty('jwt');
      expect(health.services).toHaveProperty('config');
    });
  });

  describe('Helper Instances', () => {
    it('should provide DynamoDB helper instance', () => {
      expect(dynamoDBHelper).toBeDefined();
      expect(typeof dynamoDBHelper.getStaffById).toBe('function');
      expect(typeof dynamoDBHelper.createStaff).toBe('function');
    });

    it('should provide SES helper instance', () => {
      expect(sesHelper).toBeDefined();
      expect(typeof sesHelper.sendEmail).toBe('function');
      expect(typeof sesHelper.sendPasswordResetEmail).toBe('function');
    });

    it('should provide JWT helper instance', () => {
      expect(jwtHelper).toBeDefined();
      expect(typeof jwtHelper.signToken).toBe('function');
      expect(typeof jwtHelper.verifyToken).toBe('function');
    });

    it('should provide Password helper functions', () => {
      expect(hashPassword).toBeDefined();
      expect(typeof hashPassword).toBe('function');
      expect(typeof verifyPassword).toBe('function');
    });
  });

  describe('JWT Operations', () => {
    it('should sign and verify JWT tokens', async () => {
      const payload = {
        staffId: 'test-staff-123',
        email: 'test@example.com',
        roles: ['staff']
      };

      const token = await jwtHelper.signToken(payload);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);

      const verified = await jwtHelper.verifyToken(token);
      expect(verified.sub).toBe(payload.staffId);
      expect(verified.email).toBe(payload.email);
      expect(verified.roles).toEqual(payload.roles);
    });

    it('should reject invalid JWT tokens', async () => {
      await expect(jwtHelper.verifyToken('invalid.token.here')).rejects.toThrow();
    });
  });

  describe('Password Operations', () => {
    it('should hash and verify passwords', async () => {
      const password = 'TestPassword123!';
      
      const hash = await hashPassword(password);
      expect(typeof hash).toBe('string');
      expect(hash).not.toBe(password);

      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);

      const isInvalid = await verifyPassword('wrongpassword', hash);
      expect(isInvalid).toBe(false);
    });

    it('should validate password strength', () => {
      const strongPassword = 'StrongPassword123!';
      const weakPassword = 'weak';

      const strongResult = validatePasswordStrength(strongPassword);
      expect(strongResult.isValid).toBe(true);
      expect(strongResult.errors).toHaveLength(0);

      const weakResult = validatePasswordStrength(weakPassword);
      expect(weakResult.isValid).toBe(false);
      expect(weakResult.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Email Utilities', () => {
    it('should validate email addresses', () => {
      expect(SESHelper.isValidEmail('test@example.com')).toBe(true);
      expect(SESHelper.isValidEmail('invalid-email')).toBe(false);
    });

    it('should normalize email addresses', () => {
      expect(SESHelper.normalizeEmail('  TEST@EXAMPLE.COM  ')).toBe('test@example.com');
    });
  });
});