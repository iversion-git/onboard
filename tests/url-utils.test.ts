// URL utilities tests
import { describe, it, expect } from 'vitest';
import { generateTenantUrl, generateTenantApiUrl, generateTenantUrls, validateTenantUrlFormat, getAwsRegionCode, generateRandomTwoDigits } from '../lib/url-utils.js';
import type { TenantRecord } from '../lib/data-models.js';

describe('URL Utils', () => {
  describe('generateTenantUrl', () => {
    it('should generate correct tenant URL for Production', () => {
      expect(generateTenantUrl('tenant1', 'Production')).toBe('tenant1.flowrix.app');
      expect(generateTenantUrl('TENANT1', 'Production')).toBe('tenant1.flowrix.app');
      expect(generateTenantUrl('acme-corp', 'Production')).toBe('acme-corp.flowrix.app');
    });

    it('should generate correct tenant URL for Dev with random suffix', () => {
      const result = generateTenantUrl('tenant1', 'Dev', '22');
      expect(result).toBe('tenant1-dev-22.flowrix.app');
    });

    it('should generate random suffix for Dev when not provided', () => {
      const result = generateTenantUrl('tenant1', 'Dev');
      expect(result).toMatch(/^tenant1-dev-\d{2}\.flowrix\.app$/);
    });
  });

  describe('generateTenantApiUrl', () => {
    it('should generate correct API URL for Dedicated deployment - Production', () => {
      expect(generateTenantApiUrl('tenant1', 'Dedicated', 'Australia', 'Production')).toBe('tenant1.flowrix.app');
      expect(generateTenantApiUrl('tenant1', 'Dedicated', 'US', 'Production')).toBe('tenant1.flowrix.app');
    });

    it('should generate correct API URL for Dedicated deployment - Dev', () => {
      expect(generateTenantApiUrl('tenant1', 'Dedicated', 'Australia', 'Dev', '22')).toBe('tenant1-dev-22.flowrix.app');
      expect(generateTenantApiUrl('tenant1', 'Dedicated', 'US', 'Dev', '33')).toBe('tenant1-dev-33.flowrix.app');
    });

    it('should generate correct API URL for Shared deployment - Production', () => {
      expect(generateTenantApiUrl('tenant1', 'Shared', 'Australia', 'Production')).toBe('tenant1.au.flowrix.app');
      expect(generateTenantApiUrl('tenant1', 'Shared', 'US', 'Production')).toBe('tenant1.us.flowrix.app');
      expect(generateTenantApiUrl('tenant1', 'Shared', 'UK', 'Production')).toBe('tenant1.uk.flowrix.app');
      expect(generateTenantApiUrl('tenant1', 'Shared', 'Europe', 'Production')).toBe('tenant1.eu.flowrix.app');
    });

    it('should generate correct API URL for Shared deployment - Dev', () => {
      expect(generateTenantApiUrl('tenant1', 'Shared', 'Australia', 'Dev', '22')).toBe('tenant1-dev-22.au.flowrix.app');
      expect(generateTenantApiUrl('tenant1', 'Shared', 'US', 'Dev', '33')).toBe('tenant1-dev-33.us.flowrix.app');
      expect(generateTenantApiUrl('tenant1', 'Shared', 'UK', 'Dev', '44')).toBe('tenant1-dev-44.uk.flowrix.app');
      expect(generateTenantApiUrl('tenant1', 'Shared', 'Europe', 'Dev', '55')).toBe('tenant1-dev-55.eu.flowrix.app');
    });

    it('should handle unknown regions gracefully', () => {
      expect(generateTenantApiUrl('tenant1', 'Shared', 'Unknown', 'Production')).toBe('tenant1.us.flowrix.app');
      expect(generateTenantApiUrl('tenant1', 'Shared', 'Unknown', 'Dev', '22')).toBe('tenant1-dev-22.us.flowrix.app');
    });
  });

  describe('generateTenantUrls', () => {
    it('should generate both URLs for Dedicated tenant - Production', () => {
      const tenant: TenantRecord = {
        tenant_id: '550e8400-e29b-41d4-a716-446655440003',
        name: 'John Smith',
        email: 'john@acme.com',
        mobile_number: '+1-555-123-4567',
        business_name: 'Acme Corporation',
        status: 'Active',
        deployment_type: 'Dedicated',
        region: 'Australia',
        tenant_url: 'tenant1',
        subscription_type_id: 1,
        package_id: 2,
        cluster_id: '550e8400-e29b-41d4-a716-446655440004',
        cluster_name: 'Dedicated Production Cluster',
        created_at: '2025-01-07T05:00:00.000Z',
        updated_at: '2025-01-07T05:00:00.000Z',
      };

      const result = generateTenantUrls(tenant, 'Production');
      expect(result.tenantUrl).toBe('tenant1.flowrix.app');
      expect(result.tenantApiUrl).toBe('tenant1.flowrix.app');
    });

    it('should generate both URLs for Shared tenant - Production', () => {
      const tenant: TenantRecord = {
        tenant_id: '550e8400-e29b-41d4-a716-446655440003',
        name: 'John Smith',
        email: 'john@acme.com',
        mobile_number: '+1-555-123-4567',
        business_name: 'Acme Corporation',
        status: 'Active',
        deployment_type: 'Shared',
        region: 'Australia',
        tenant_url: 'tenant1',
        subscription_type_id: 1,
        package_id: 2,
        cluster_id: '550e8400-e29b-41d4-a716-446655440004',
        cluster_name: 'Shared Production Cluster',
        created_at: '2025-01-07T05:00:00.000Z',
        updated_at: '2025-01-07T05:00:00.000Z',
      };

      const result = generateTenantUrls(tenant, 'Production');
      expect(result.tenantUrl).toBe('tenant1.flowrix.app');
      expect(result.tenantApiUrl).toBe('tenant1.au.flowrix.app');
    });

    it('should generate both URLs for Dev subscription with random suffix', () => {
      const tenant: TenantRecord = {
        tenant_id: '550e8400-e29b-41d4-a716-446655440003',
        name: 'John Smith',
        email: 'john@acme.com',
        mobile_number: '+1-555-123-4567',
        business_name: 'Acme Corporation',
        status: 'Active',
        deployment_type: 'Shared',
        region: 'Australia',
        tenant_url: 'tenant1',
        subscription_type_id: 1,
        package_id: 2,
        cluster_id: '550e8400-e29b-41d4-a716-446655440004',
        cluster_name: 'Shared Production Cluster',
        created_at: '2025-01-07T05:00:00.000Z',
        updated_at: '2025-01-07T05:00:00.000Z',
      };

      const result = generateTenantUrls(tenant, 'Dev', '22');
      expect(result.tenantUrl).toBe('tenant1-dev-22.flowrix.app');
      expect(result.tenantApiUrl).toBe('tenant1-dev-22.au.flowrix.app');
    });
  });

  describe('getAwsRegionCode', () => {
    it('should return "dedicated" for Dedicated deployment type', () => {
      expect(getAwsRegionCode('Australia', 'Dedicated')).toBe('dedicated');
      expect(getAwsRegionCode('US', 'Dedicated')).toBe('dedicated');
      expect(getAwsRegionCode('UK', 'Dedicated')).toBe('dedicated');
      expect(getAwsRegionCode('Europe', 'Dedicated')).toBe('dedicated');
    });

    it('should return correct AWS region codes for Shared deployment', () => {
      expect(getAwsRegionCode('Australia', 'Shared')).toBe('ap-southeast-2');
      expect(getAwsRegionCode('US', 'Shared')).toBe('us-east-1');
      expect(getAwsRegionCode('UK', 'Shared')).toBe('eu-west-2');
      expect(getAwsRegionCode('Europe', 'Shared')).toBe('eu-central-1');
    });

    it('should handle unknown regions gracefully for Shared deployment', () => {
      expect(getAwsRegionCode('Unknown', 'Shared')).toBe('us-east-1');
    });
  });

  describe('generateRandomTwoDigits', () => {
    it('should generate a 2-digit number between 10-99', () => {
      for (let i = 0; i < 100; i++) {
        const result = generateRandomTwoDigits();
        expect(result).toMatch(/^\d{2}$/);
        const num = parseInt(result, 10);
        expect(num).toBeGreaterThanOrEqual(10);
        expect(num).toBeLessThanOrEqual(99);
      }
    });
  });

  describe('validateTenantUrlFormat', () => {
    it('should validate correct tenant URLs', () => {
      expect(validateTenantUrlFormat('acme-corp').valid).toBe(true);
      expect(validateTenantUrlFormat('tenant123').valid).toBe(true);
      expect(validateTenantUrlFormat('my-company').valid).toBe(true);
      expect(validateTenantUrlFormat('test-env-1').valid).toBe(true);
    });

    it('should reject invalid tenant URLs', () => {
      expect(validateTenantUrlFormat('Acme-Corp').valid).toBe(false); // uppercase
      expect(validateTenantUrlFormat('-acme').valid).toBe(false); // starts with hyphen
      expect(validateTenantUrlFormat('acme-').valid).toBe(false); // ends with hyphen
      expect(validateTenantUrlFormat('acme--corp').valid).toBe(false); // consecutive hyphens
      expect(validateTenantUrlFormat('acme_corp').valid).toBe(false); // underscore
      expect(validateTenantUrlFormat('acme.corp').valid).toBe(false); // dot
      expect(validateTenantUrlFormat('').valid).toBe(false); // empty
      expect(validateTenantUrlFormat('a'.repeat(51)).valid).toBe(false); // too long
    });

    it('should provide helpful error messages', () => {
      expect(validateTenantUrlFormat('Acme-Corp').error).toContain('lowercase letters');
      expect(validateTenantUrlFormat('-acme').error).toContain('cannot start or end with a hyphen');
      expect(validateTenantUrlFormat('acme--corp').error).toContain('consecutive hyphens');
      expect(validateTenantUrlFormat('a'.repeat(51)).error).toContain('between 1 and 50 characters');
    });
  });
});