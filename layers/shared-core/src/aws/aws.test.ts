import { describe, it, expect } from 'vitest';
import { DynamoDBClientFactory, DynamoDBHelpers, SESHelpers, SecretsManagerHelpers } from './index.js';

describe('AWS Integrations', () => {
  describe('DynamoDBClientFactory', () => {
    it('should export DynamoDBClientFactory class', () => {
      expect(DynamoDBClientFactory).toBeDefined();
      expect(typeof DynamoDBClientFactory.initialize).toBe('function');
      expect(typeof DynamoDBClientFactory.getClient).toBe('function');
      expect(typeof DynamoDBClientFactory.getTableName).toBe('function');
    });

    it('should generate correct table names with stage prefix', () => {
      const tableName = DynamoDBClientFactory.getTableName('Staff');
      expect(tableName).toMatch(/^Staff-/);
    });
  });

  describe('DynamoDBHelpers', () => {
    it('should export DynamoDBHelpers class with all methods', () => {
      expect(DynamoDBHelpers).toBeDefined();
      expect(typeof DynamoDBHelpers.getItem).toBe('function');
      expect(typeof DynamoDBHelpers.putItem).toBe('function');
      expect(typeof DynamoDBHelpers.updateItem).toBe('function');
      expect(typeof DynamoDBHelpers.queryItems).toBe('function');
      expect(typeof DynamoDBHelpers.deleteItem).toBe('function');
    });
  });

  describe('SESHelpers', () => {
    it('should export SESHelpers class with email methods', () => {
      expect(SESHelpers).toBeDefined();
      expect(typeof SESHelpers.sendPasswordResetEmail).toBe('function');
      expect(typeof SESHelpers.sendWelcomeEmail).toBe('function');
    });
  });

  describe('SecretsManagerHelpers', () => {
    it('should export SecretsManagerHelpers class with secret methods', () => {
      expect(SecretsManagerHelpers).toBeDefined();
      expect(typeof SecretsManagerHelpers.getJWTSigningKey).toBe('function');
      expect(typeof SecretsManagerHelpers.getDatabaseEncryptionKey).toBe('function');
      expect(typeof SecretsManagerHelpers.getExternalServiceKey).toBe('function');
      expect(typeof SecretsManagerHelpers.clearCache).toBe('function');
      expect(typeof SecretsManagerHelpers.getCacheStats).toBe('function');
    });

    it('should provide cache management functionality', () => {
      SecretsManagerHelpers.clearCache();
      const stats = SecretsManagerHelpers.getCacheStats();
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('keys');
      expect(Array.isArray(stats.keys)).toBe(true);
    });
  });
});