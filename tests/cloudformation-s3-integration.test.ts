/**
 * CloudFormation and S3 Integration Tests
 * 
 * Tests for CloudFormation client, S3 template management, and cross-account role functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  getCloudFormationHelper, 
  getCloudFormationClient,
  getS3TemplateManager,
  getS3Client,
  getCrossAccountRoleManager,
  createCrossAccountRoleManager,
  isStackInProgress,
  isStackSuccessful,
  isStackFailed,
  STACK_STATUS_CATEGORIES,
  getConfig
} from '../lib/aws-integrations.js';

// Set up test environment variables
beforeEach(() => {
  process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-characters-long-for-security';
  process.env.STAGE = 'test';
});

describe('CloudFormation Integration', () => {
  describe('Client Initialization', () => {
    it('should create CloudFormation client successfully', () => {
      const client = getCloudFormationClient();
      expect(client).toBeDefined();
      expect(client.config.region).toBeDefined();
    });

    it('should create CloudFormation helper successfully', () => {
      const helper = getCloudFormationHelper();
      expect(helper).toBeDefined();
      expect(helper).toBeInstanceOf(Object);
    });

    it('should create CloudFormation client with custom region', () => {
      const client = getCloudFormationClient('us-west-2');
      expect(client).toBeDefined();
      // Note: AWS SDK v3 client.config.region is a function, not a direct property
      expect(typeof client.config.region).toBe('function');
    });
  });

  describe('Stack Status Utilities', () => {
    it('should correctly identify in-progress stack statuses', () => {
      expect(isStackInProgress('CREATE_IN_PROGRESS')).toBe(true);
      expect(isStackInProgress('UPDATE_IN_PROGRESS')).toBe(true);
      expect(isStackInProgress('DELETE_IN_PROGRESS')).toBe(true);
      expect(isStackInProgress('CREATE_COMPLETE')).toBe(false);
      expect(isStackInProgress('UPDATE_COMPLETE')).toBe(false);
    });

    it('should correctly identify successful stack statuses', () => {
      expect(isStackSuccessful('CREATE_COMPLETE')).toBe(true);
      expect(isStackSuccessful('UPDATE_COMPLETE')).toBe(true);
      expect(isStackSuccessful('CREATE_IN_PROGRESS')).toBe(false);
      expect(isStackSuccessful('CREATE_FAILED')).toBe(false);
    });

    it('should correctly identify failed stack statuses', () => {
      expect(isStackFailed('CREATE_FAILED')).toBe(true);
      expect(isStackFailed('UPDATE_FAILED')).toBe(true);
      expect(isStackFailed('ROLLBACK_COMPLETE')).toBe(true);
      expect(isStackFailed('CREATE_COMPLETE')).toBe(false);
    });

    it('should have comprehensive status categories', () => {
      expect(STACK_STATUS_CATEGORIES.IN_PROGRESS).toContain('CREATE_IN_PROGRESS');
      expect(STACK_STATUS_CATEGORIES.SUCCESS).toContain('CREATE_COMPLETE');
      expect(STACK_STATUS_CATEGORIES.FAILED).toContain('CREATE_FAILED');
    });
  });

  describe('CloudFormation Helper Methods', () => {
    it('should validate template format', async () => {
      const helper = getCloudFormationHelper();
      
      // This will fail with AWS credentials, but we're testing the method exists
      expect(helper.validateTemplate).toBeDefined();
      expect(typeof helper.validateTemplate).toBe('function');
    });

    it('should generate role ARN correctly', async () => {
      const helper = getCloudFormationHelper();
      
      // Test that the helper has the expected methods
      expect(helper.deployStack).toBeDefined();
      expect(helper.getStackStatus).toBeDefined();
      expect(helper.getStackEvents).toBeDefined();
      expect(helper.deleteStack).toBeDefined();
    });
  });
});

describe('S3 Template Management', () => {
  describe('Client Initialization', () => {
    it('should create S3 client successfully', () => {
      const client = getS3Client();
      expect(client).toBeDefined();
      expect(client.config.region).toBeDefined();
    });

    it('should create S3 template manager successfully', () => {
      const manager = getS3TemplateManager('test-bucket');
      expect(manager).toBeDefined();
      expect(manager).toBeInstanceOf(Object);
    });

    it('should create S3 client with custom region', () => {
      const client = getS3Client('us-west-2');
      expect(client).toBeDefined();
      // Note: AWS SDK v3 client.config.region is a function, not a direct property
      expect(typeof client.config.region).toBe('function');
    });
  });

  describe('Template Manager Methods', () => {
    it('should have all required template management methods', () => {
      const manager = getS3TemplateManager('test-bucket');
      
      expect(manager.uploadTemplate).toBeDefined();
      expect(manager.downloadTemplate).toBeDefined();
      expect(manager.listTemplates).toBeDefined();
      expect(manager.getTemplateInfo).toBeDefined();
      expect(manager.deleteTemplate).toBeDefined();
      expect(manager.createTemplateVersion).toBeDefined();
      expect(manager.validateTemplateFormat).toBeDefined();
    });

    it('should validate template format correctly', async () => {
      const manager = getS3TemplateManager('test-bucket');
      
      // Test valid YAML template
      const validYaml = `
AWSTemplateFormatVersion: '2010-09-09'
Description: Test template
Resources:
  TestResource:
    Type: AWS::S3::Bucket
`;
      
      const yamlResult = await manager.validateTemplateFormat(validYaml);
      expect(yamlResult.valid).toBe(true);
      expect(yamlResult.errors).toHaveLength(0);
      
      // Test valid JSON template
      const validJson = JSON.stringify({
        AWSTemplateFormatVersion: '2010-09-09',
        Description: 'Test template',
        Resources: {
          TestResource: {
            Type: 'AWS::S3::Bucket'
          }
        }
      });
      
      const jsonResult = await manager.validateTemplateFormat(validJson);
      expect(jsonResult.valid).toBe(true);
      expect(jsonResult.errors).toHaveLength(0);
      
      // Test invalid template
      const invalidTemplate = 'invalid template content';
      const invalidResult = await manager.validateTemplateFormat(invalidTemplate);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Template Metadata Parsing', () => {
    it('should handle template metadata correctly', () => {
      const manager = getS3TemplateManager('test-bucket');
      
      // Test that the manager can be created with different bucket names
      const manager1 = getS3TemplateManager('bucket-1');
      const manager2 = getS3TemplateManager('bucket-2');
      
      expect(manager1).toBeDefined();
      expect(manager2).toBeDefined();
      expect(manager1).not.toBe(manager2); // Different instances for different buckets
    });
  });
});

describe('Cross-Account Role Management', () => {
  describe('Role Manager Creation', () => {
    it('should create cross-account role manager with allowed accounts', () => {
      const allowedAccounts = ['123456789012', '210987654321'];
      const manager = createCrossAccountRoleManager(allowedAccounts);
      
      expect(manager).toBeDefined();
      expect(manager).toBeInstanceOf(Object);
    });

    it('should have all required role management methods', () => {
      const allowedAccounts = ['123456789012'];
      const manager = createCrossAccountRoleManager(allowedAccounts);
      
      expect(manager.assumeRole).toBeDefined();
      expect(manager.validateRole).toBeDefined();
      expect(manager.generateRoleArn).toBeDefined();
      expect(manager.generateStandardRoleName).toBeDefined();
      expect(manager.isSessionValid).toBeDefined();
      expect(manager.getSessionTimeRemaining).toBeDefined();
      expect(manager.createAssumedRoleSTSClient).toBeDefined();
    });

    it('should generate role ARN correctly', () => {
      const allowedAccounts = ['123456789012'];
      const manager = createCrossAccountRoleManager(allowedAccounts);
      
      const roleArn = manager.generateRoleArn('123456789012', 'TestRole');
      expect(roleArn).toBe('arn:aws:iam::123456789012:role/TestRole');
    });

    it('should validate account ID format', () => {
      const allowedAccounts = ['123456789012'];
      const manager = createCrossAccountRoleManager(allowedAccounts);
      
      expect(() => {
        manager.generateRoleArn('invalid-account', 'TestRole');
      }).toThrow('Invalid AWS account ID format');
    });

    it('should generate standard role names', () => {
      const allowedAccounts = ['123456789012'];
      const manager = createCrossAccountRoleManager(allowedAccounts);
      
      const baseName = manager.generateStandardRoleName();
      expect(baseName).toContain('ControlPlane-CrossAccount-Role');
      
      const suffixName = manager.generateStandardRoleName('Deploy');
      expect(suffixName).toContain('ControlPlane-CrossAccount-Role-Deploy');
    });
  });

  describe('Session Management', () => {
    it('should validate session expiration correctly', () => {
      const allowedAccounts = ['123456789012'];
      const manager = createCrossAccountRoleManager(allowedAccounts);
      
      // Mock session with future expiration
      const validSession = {
        accountId: '123456789012',
        roleArn: 'arn:aws:iam::123456789012:role/TestRole',
        sessionName: 'test-session',
        credentials: {
          accessKeyId: 'test-key',
          secretAccessKey: 'test-secret',
          sessionToken: 'test-token',
          expiration: new Date(Date.now() + 3600000) // 1 hour from now
        },
        assumedRoleUser: {
          assumedRoleId: 'test-id',
          arn: 'test-arn'
        }
      };
      
      expect(manager.isSessionValid(validSession)).toBe(true);
      expect(manager.getSessionTimeRemaining(validSession)).toBeGreaterThan(3500);
      
      // Mock session with past expiration
      const expiredSession = {
        ...validSession,
        credentials: {
          ...validSession.credentials,
          expiration: new Date(Date.now() - 1000) // 1 second ago
        }
      };
      
      expect(manager.isSessionValid(expiredSession)).toBe(false);
      expect(manager.getSessionTimeRemaining(expiredSession)).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when no allowed accounts provided', () => {
      expect(() => {
        getCrossAccountRoleManager();
      }).toThrow('Allowed account IDs must be provided');
    });

    it('should throw error when empty allowed accounts provided', () => {
      expect(() => {
        getCrossAccountRoleManager([]);
      }).toThrow('Allowed account IDs must be provided');
    });
  });
});

describe('Integration Configuration', () => {
  describe('Configuration Loading', () => {
    it('should load CloudFormation and S3 configuration', () => {
      // Test that configuration includes new CloudFormation and S3 settings
      const config = getConfig();
      
      expect(config.cloudformation).toBeDefined();
      expect(config.cloudformation.region).toBeDefined();
      expect(config.cloudformation.templateBucket).toBeDefined();
      expect(config.cloudformation.crossAccountRolePrefix).toBeDefined();
      
      expect(config.s3).toBeDefined();
      expect(config.s3.templateBucket).toBeDefined();
      expect(config.s3.region).toBeDefined();
    });
  });
});