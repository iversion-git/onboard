/**
 * Unit tests for configuration management
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getConfig, resetConfig, validateConfigForFeature } from './config.js';

describe('Configuration Management', () => {
  beforeEach(() => {
    resetConfig();
    // Clear environment variables
    delete process.env['STAGE'];
    delete process.env['AWS_REGION'];
    delete process.env['CORS_ORIGINS'];
    delete process.env['LOG_LEVEL'];
  });

  describe('getConfig', () => {
    it('should return default configuration', () => {
      const config = getConfig();
      
      expect(config.stage).toBe('dev');
      expect(config.region).toBe('us-east-1');
      expect(config.staffTableName).toBe('Staff-dev');
      expect(config.corsOrigins).toEqual(['*']);
      expect(config.logLevel).toBe('INFO');
    });

    it('should use environment variables when provided', () => {
      process.env['STAGE'] = 'prod';
      process.env['AWS_REGION'] = 'us-west-2';
      process.env['CORS_ORIGINS'] = 'https://app.example.com,https://admin.example.com';
      process.env['LOG_LEVEL'] = 'ERROR';
      
      resetConfig(); // Reset to pick up new env vars
      const config = getConfig();
      
      expect(config.stage).toBe('prod');
      expect(config.region).toBe('us-west-2');
      expect(config.staffTableName).toBe('Staff-prod');
      expect(config.corsOrigins).toEqual(['https://app.example.com', 'https://admin.example.com']);
      expect(config.logLevel).toBe('ERROR');
    });

    it('should cache configuration', () => {
      const config1 = getConfig();
      const config2 = getConfig();
      
      expect(config1).toBe(config2); // Same object reference
    });
  });

  describe('validateConfigForFeature', () => {
    it('should validate auth feature requirements', () => {
      expect(() => validateConfigForFeature('auth')).not.toThrow();
    });

    it('should validate email feature requirements', () => {
      expect(() => validateConfigForFeature('email')).not.toThrow();
    });

    it('should validate database feature requirements', () => {
      expect(() => validateConfigForFeature('database')).not.toThrow();
    });
  });
});