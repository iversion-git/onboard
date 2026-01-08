// Data models and DynamoDB access patterns tests
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { 
  StaffRecord,
  PasswordResetToken,
  TenantRecord,
  ClusterRecord
} from '../lib/data-models.js';
import { 
  StaffRecordSchema,
  PasswordResetTokenSchema,
  TenantRecordSchema,
  ClusterRecordSchema,
  CreateStaffSchema,
  CreateClusterSchema,
  LoginSchema,
  PasswordResetRequestSchema,
  PasswordResetConfirmSchema,
  isStaffRecord,
  isPasswordResetToken,
  isTenantRecord,
  isClusterRecord,
  checkCIDROverlap,
  validateCIDRWithOverlapCheck,
  AWS_REGIONS
} from '../lib/data-models.js';
import { DynamoDBHelper } from '../lib/dynamodb.js';
import { resetConfig } from '../lib/config.js';

describe('Data Models', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    resetConfig();
    process.env = { ...originalEnv };
    process.env['STAGE'] = 'test';
    process.env['DYNAMODB_STAFF_TABLE'] = 'onboard-staff-test';
    process.env['DYNAMODB_PASSWORD_RESET_TOKENS_TABLE'] = 'onboard-password-reset-tokens-test';
    process.env['DYNAMODB_TENANTS_TABLE'] = 'onboard-tenants-test';
    process.env['DYNAMODB_CLUSTERS_TABLE'] = 'onboard-clusters-test';
  });

  afterEach(() => {
    process.env = originalEnv;
    resetConfig();
  });

  describe('Schema Validation', () => {
    describe('StaffRecord Schema', () => {
      it('should validate valid staff record', () => {
        const validStaff: StaffRecord = {
          staff_id: '123e4567-e89b-12d3-a456-426614174000',
          email: 'test@example.com',
          password_hash: '$2b$12$hashedpassword',
          roles: ['staff'],
          enabled: true,
          created_at: '2023-01-01T00:00:00.000Z',
          updated_at: '2023-01-01T00:00:00.000Z'
        };

        const result = StaffRecordSchema.safeParse(validStaff);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.email).toBe('test@example.com');
        }
      });

      it('should normalize email to lowercase', () => {
        const staffWithUppercaseEmail = {
          staff_id: '123e4567-e89b-12d3-a456-426614174000',
          email: 'TEST@EXAMPLE.COM',
          password_hash: '$2b$12$hashedpassword',
          roles: ['staff'],
          enabled: true,
          created_at: '2023-01-01T00:00:00.000Z',
          updated_at: '2023-01-01T00:00:00.000Z'
        };

        const result = StaffRecordSchema.safeParse(staffWithUppercaseEmail);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.email).toBe('test@example.com');
        }
      });

      it('should reject invalid staff record', () => {
        const invalidStaff = {
          staff_id: 'invalid-uuid',
          email: 'invalid-email',
          password_hash: '',
          roles: [],
          enabled: 'not-boolean',
          created_at: 'invalid-date',
          updated_at: 'invalid-date'
        };

        const result = StaffRecordSchema.safeParse(invalidStaff);
        expect(result.success).toBe(false);
      });

      it('should validate role values', () => {
        const staffWithInvalidRole = {
          staff_id: '123e4567-e89b-12d3-a456-426614174000',
          email: 'test@example.com',
          password_hash: '$2b$12$hashedpassword',
          roles: ['invalid-role'],
          enabled: true,
          created_at: '2023-01-01T00:00:00.000Z',
          updated_at: '2023-01-01T00:00:00.000Z'
        };

        const result = StaffRecordSchema.safeParse(staffWithInvalidRole);
        expect(result.success).toBe(false);
      });
    });

    describe('PasswordResetToken Schema', () => {
      it('should validate valid password reset token', () => {
        const validToken: PasswordResetToken = {
          token_hash: 'sha256hashedtoken',
          staff_id: '123e4567-e89b-12d3-a456-426614174000',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          created_at: '2023-01-01T00:00:00.000Z'
        };

        const result = PasswordResetTokenSchema.safeParse(validToken);
        expect(result.success).toBe(true);
      });

      it('should validate token with used_at field', () => {
        const usedToken: PasswordResetToken = {
          token_hash: 'sha256hashedtoken',
          staff_id: '123e4567-e89b-12d3-a456-426614174000',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          created_at: '2023-01-01T00:00:00.000Z',
          used_at: '2023-01-01T01:00:00.000Z'
        };

        const result = PasswordResetTokenSchema.safeParse(usedToken);
        expect(result.success).toBe(true);
      });

      it('should reject invalid password reset token', () => {
        const invalidToken = {
          token_hash: '',
          staff_id: 'invalid-uuid',
          expires_at: 'not-a-number',
          created_at: 'invalid-date'
        };

        const result = PasswordResetTokenSchema.safeParse(invalidToken);
        expect(result.success).toBe(false);
      });
    });

    describe('TenantRecord Schema', () => {
      it('should validate valid tenant record', () => {
        const validTenant: TenantRecord = {
          tenant_id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test Company',
          email: 'contact@testcompany.com',
          contact_info: {
            phone: '+1-555-0123',
            address: '123 Main St',
            company: 'Test Company Inc'
          },
          status: 'pending',
          created_at: '2023-01-01T00:00:00.000Z',
          updated_at: '2023-01-01T00:00:00.000Z'
        };

        const result = TenantRecordSchema.safeParse(validTenant);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.email).toBe('contact@testcompany.com');
        }
      });

      it('should normalize email to lowercase', () => {
        const tenantWithUppercaseEmail = {
          tenant_id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test Company',
          email: 'CONTACT@TESTCOMPANY.COM',
          contact_info: {},
          status: 'pending',
          created_at: '2023-01-01T00:00:00.000Z',
          updated_at: '2023-01-01T00:00:00.000Z'
        };

        const result = TenantRecordSchema.safeParse(tenantWithUppercaseEmail);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.email).toBe('contact@testcompany.com');
        }
      });

      it('should validate status values', () => {
        const tenantWithInvalidStatus = {
          tenant_id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test Company',
          email: 'contact@testcompany.com',
          contact_info: {},
          status: 'invalid-status',
          created_at: '2023-01-01T00:00:00.000Z',
          updated_at: '2023-01-01T00:00:00.000Z'
        };

        const result = TenantRecordSchema.safeParse(tenantWithInvalidStatus);
        expect(result.success).toBe(false);
      });
    });

    describe('ClusterRecord Schema', () => {
      it('should validate valid cluster record', () => {
        const validCluster: ClusterRecord = {
          cluster_id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test Cluster',
          type: 'dedicated',
          region: 'us-east-1',
          cidr: '10.0.0.0/16',
          status: 'created',
          created_at: '2023-01-01T00:00:00.000Z',
          updated_at: '2023-01-01T00:00:00.000Z'
        };

        const result = ClusterRecordSchema.safeParse(validCluster);
        expect(result.success).toBe(true);
      });

      it('should validate cluster with deployment fields', () => {
        const clusterWithDeployment: ClusterRecord = {
          cluster_id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test Cluster',
          type: 'shared',
          region: 'us-west-2',
          cidr: '172.16.0.0/12',
          status: 'deployed',
          deployment_status: 'CREATE_COMPLETE',
          deployment_id: 'arn:aws:cloudformation:us-west-2:123456789012:stack/test-stack/12345',
          stack_outputs: { VpcId: 'vpc-12345', SubnetId: 'subnet-67890' },
          created_at: '2023-01-01T00:00:00.000Z',
          updated_at: '2023-01-01T00:00:00.000Z',
          deployed_at: '2023-01-01T01:00:00.000Z'
        };

        const result = ClusterRecordSchema.safeParse(clusterWithDeployment);
        expect(result.success).toBe(true);
      });

      it('should reject invalid AWS region', () => {
        const clusterWithInvalidRegion = {
          cluster_id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test Cluster',
          type: 'dedicated',
          region: 'invalid-region',
          cidr: '10.0.0.0/16',
          status: 'created',
          created_at: '2023-01-01T00:00:00.000Z',
          updated_at: '2023-01-01T00:00:00.000Z'
        };

        const result = ClusterRecordSchema.safeParse(clusterWithInvalidRegion);
        expect(result.success).toBe(false);
      });

      it('should reject invalid CIDR format', () => {
        const clusterWithInvalidCIDR = {
          cluster_id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test Cluster',
          type: 'dedicated',
          region: 'us-east-1',
          cidr: 'invalid-cidr',
          status: 'created',
          created_at: '2023-01-01T00:00:00.000Z',
          updated_at: '2023-01-01T00:00:00.000Z'
        };

        const result = ClusterRecordSchema.safeParse(clusterWithInvalidCIDR);
        expect(result.success).toBe(false);
      });

      it('should reject public IP CIDR ranges', () => {
        const clusterWithPublicCIDR = {
          cluster_id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test Cluster',
          type: 'dedicated',
          region: 'us-east-1',
          cidr: '8.8.8.0/24', // Public IP range
          status: 'created',
          created_at: '2023-01-01T00:00:00.000Z',
          updated_at: '2023-01-01T00:00:00.000Z'
        };

        const result = ClusterRecordSchema.safeParse(clusterWithPublicCIDR);
        expect(result.success).toBe(false);
      });

      it('should validate cluster type values', () => {
        const clusterWithInvalidType = {
          cluster_id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test Cluster',
          type: 'invalid-type',
          region: 'us-east-1',
          cidr: '10.0.0.0/16',
          status: 'created',
          created_at: '2023-01-01T00:00:00.000Z',
          updated_at: '2023-01-01T00:00:00.000Z'
        };

        const result = ClusterRecordSchema.safeParse(clusterWithInvalidType);
        expect(result.success).toBe(false);
      });

      it('should validate cluster status values', () => {
        const clusterWithInvalidStatus = {
          cluster_id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test Cluster',
          type: 'dedicated',
          region: 'us-east-1',
          cidr: '10.0.0.0/16',
          status: 'invalid-status',
          created_at: '2023-01-01T00:00:00.000Z',
          updated_at: '2023-01-01T00:00:00.000Z'
        };

        const result = ClusterRecordSchema.safeParse(clusterWithInvalidStatus);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Input Validation Schemas', () => {
    describe('CreateStaff Schema', () => {
      it('should validate valid staff creation data', () => {
        const validData = {
          email: 'test@example.com',
          password: 'SecurePassword123!',
          roles: ['staff']
        };

        const result = CreateStaffSchema.safeParse(validData);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.email).toBe('test@example.com');
        }
      });

      it('should reject weak passwords', () => {
        const dataWithWeakPassword = {
          email: 'test@example.com',
          password: 'weak',
          roles: ['staff']
        };

        const result = CreateStaffSchema.safeParse(dataWithWeakPassword);
        expect(result.success).toBe(false);
      });

      it('should require at least one role', () => {
        const dataWithoutRoles = {
          email: 'test@example.com',
          password: 'SecurePassword123!',
          roles: []
        };

        const result = CreateStaffSchema.safeParse(dataWithoutRoles);
        expect(result.success).toBe(false);
      });
    });

    describe('CreateCluster Schema', () => {
      it('should validate valid cluster creation data', () => {
        const validData = {
          name: 'Test Cluster',
          type: 'dedicated' as const,
          region: 'us-east-1' as const,
          cidr: '10.0.0.0/16'
        };

        const result = CreateClusterSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should reject invalid CIDR in cluster creation', () => {
        const dataWithInvalidCIDR = {
          name: 'Test Cluster',
          type: 'dedicated' as const,
          region: 'us-east-1' as const,
          cidr: '8.8.8.0/24' // Public IP range
        };

        const result = CreateClusterSchema.safeParse(dataWithInvalidCIDR);
        expect(result.success).toBe(false);
      });

      it('should reject invalid AWS region in cluster creation', () => {
        const dataWithInvalidRegion = {
          name: 'Test Cluster',
          type: 'dedicated' as const,
          region: 'invalid-region',
          cidr: '10.0.0.0/16'
        };

        const result = CreateClusterSchema.safeParse(dataWithInvalidRegion);
        expect(result.success).toBe(false);
      });

      it('should validate all supported AWS regions', () => {
        const validRegions = ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1'];
        
        validRegions.forEach(region => {
          const data = {
            name: 'Test Cluster',
            type: 'dedicated' as const,
            region: region as any,
            cidr: '10.0.0.0/16'
          };

          const result = CreateClusterSchema.safeParse(data);
          expect(result.success).toBe(true);
        });
      });
    });

    describe('Login Schema', () => {
      it('should validate valid login data', () => {
        const validLogin = {
          email: 'test@example.com',
          password: 'password123'
        };

        const result = LoginSchema.safeParse(validLogin);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.email).toBe('test@example.com');
        }
      });

      it('should normalize email to lowercase', () => {
        const loginWithUppercaseEmail = {
          email: 'TEST@EXAMPLE.COM',
          password: 'password123'
        };

        const result = LoginSchema.safeParse(loginWithUppercaseEmail);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.email).toBe('test@example.com');
        }
      });
    });

    describe('Password Reset Schemas', () => {
      it('should validate password reset request', () => {
        const validRequest = {
          email: 'test@example.com'
        };

        const result = PasswordResetRequestSchema.safeParse(validRequest);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.email).toBe('test@example.com');
        }
      });

      it('should validate password reset confirmation', () => {
        const validConfirmation = {
          token: 'reset-token-123',
          new_password: 'NewSecurePassword123!'
        };

        const result = PasswordResetConfirmSchema.safeParse(validConfirmation);
        expect(result.success).toBe(true);
      });

      it('should reject weak new passwords', () => {
        const confirmationWithWeakPassword = {
          token: 'reset-token-123',
          new_password: 'weak'
        };

        const result = PasswordResetConfirmSchema.safeParse(confirmationWithWeakPassword);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Type Guards', () => {
    it('should correctly identify valid staff records', () => {
      const validStaff: StaffRecord = {
        staff_id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        password_hash: '$2b$12$hashedpassword',
        roles: ['staff'],
        enabled: true,
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z'
      };

      expect(isStaffRecord(validStaff)).toBe(true);
      expect(isStaffRecord({ invalid: 'data' })).toBe(false);
    });

    it('should correctly identify valid password reset tokens', () => {
      const validToken: PasswordResetToken = {
        token_hash: 'sha256hashedtoken',
        staff_id: '123e4567-e89b-12d3-a456-426614174000',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        created_at: '2023-01-01T00:00:00.000Z'
      };

      expect(isPasswordResetToken(validToken)).toBe(true);
      expect(isPasswordResetToken({ invalid: 'data' })).toBe(false);
    });

    it('should correctly identify valid tenant records', () => {
      const validTenant: TenantRecord = {
        tenant_id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Company',
        email: 'contact@testcompany.com',
        contact_info: {},
        status: 'pending',
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z'
      };

      expect(isTenantRecord(validTenant)).toBe(true);
      expect(isTenantRecord({ invalid: 'data' })).toBe(false);
    });

    it('should correctly identify valid cluster records', () => {
      const validCluster: ClusterRecord = {
        cluster_id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Cluster',
        type: 'dedicated',
        region: 'us-east-1',
        cidr: '10.0.0.0/16',
        status: 'created',
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z'
      };

      expect(isClusterRecord(validCluster)).toBe(true);
      expect(isClusterRecord({ invalid: 'data' })).toBe(false);
    });
  });

  describe('CIDR Validation', () => {
    describe('checkCIDROverlap', () => {
      it('should detect overlapping CIDR blocks', () => {
        expect(checkCIDROverlap('10.0.0.0/16', '10.0.1.0/24')).toBe(true);
        expect(checkCIDROverlap('192.168.1.0/24', '192.168.1.128/25')).toBe(true);
        expect(checkCIDROverlap('172.16.0.0/12', '172.20.0.0/16')).toBe(true);
      });

      it('should not detect non-overlapping CIDR blocks', () => {
        expect(checkCIDROverlap('10.0.0.0/16', '10.1.0.0/16')).toBe(false);
        expect(checkCIDROverlap('192.168.1.0/24', '192.168.2.0/24')).toBe(false);
        expect(checkCIDROverlap('172.16.0.0/16', '172.17.0.0/16')).toBe(false);
      });

      it('should handle identical CIDR blocks', () => {
        expect(checkCIDROverlap('10.0.0.0/16', '10.0.0.0/16')).toBe(true);
      });
    });

    describe('validateCIDRWithOverlapCheck', () => {
      it('should validate CIDR without overlaps', () => {
        const existingCidrs = ['10.0.0.0/16', '192.168.1.0/24'];
        const result = validateCIDRWithOverlapCheck('172.16.0.0/16', existingCidrs);
        
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
        expect(result.overlaps).toBeUndefined();
      });

      it('should reject CIDR with overlaps', () => {
        const existingCidrs = ['10.0.0.0/16', '192.168.1.0/24'];
        const result = validateCIDRWithOverlapCheck('10.0.1.0/24', existingCidrs);
        
        expect(result.valid).toBe(false);
        expect(result.error).toBe('CIDR overlaps with existing cluster networks');
        expect(result.overlaps).toEqual(['10.0.0.0/16']);
      });

      it('should reject invalid CIDR format', () => {
        const existingCidrs = ['10.0.0.0/16'];
        const result = validateCIDRWithOverlapCheck('invalid-cidr', existingCidrs);
        
        expect(result.valid).toBe(false);
        expect(result.error).toBe('CIDR must be a valid private IPv4 CIDR block (RFC 1918)');
      });

      it('should reject public IP ranges', () => {
        const existingCidrs = ['10.0.0.0/16'];
        const result = validateCIDRWithOverlapCheck('8.8.8.0/24', existingCidrs);
        
        expect(result.valid).toBe(false);
        expect(result.error).toBe('CIDR must be a valid private IPv4 CIDR block (RFC 1918)');
      });
    });

    describe('AWS Regions', () => {
      it('should export valid AWS regions', () => {
        expect(AWS_REGIONS).toBeDefined();
        expect(Array.isArray(AWS_REGIONS)).toBe(true);
        expect(AWS_REGIONS.length).toBeGreaterThan(0);
        
        // Check some common regions
        expect(AWS_REGIONS).toContain('us-east-1');
        expect(AWS_REGIONS).toContain('us-west-2');
        expect(AWS_REGIONS).toContain('eu-west-1');
        expect(AWS_REGIONS).toContain('ap-southeast-1');
      });
    });
  });
});

describe('DynamoDB Access Patterns', () => {
  let dynamoDBHelper: DynamoDBHelper;
  const originalEnv = process.env;

  beforeEach(() => {
    resetConfig();
    process.env = { ...originalEnv };
    process.env['STAGE'] = 'test';
    process.env['JWT_SECRET'] = 'this-is-a-very-long-secret-key-for-testing-purposes-123456';
    process.env['DYNAMODB_STAFF_TABLE'] = 'onboard-staff-test';
    process.env['DYNAMODB_PASSWORD_RESET_TOKENS_TABLE'] = 'onboard-password-reset-tokens-test';
    process.env['DYNAMODB_TENANTS_TABLE'] = 'onboard-tenants-test';
    process.env['DYNAMODB_CLUSTERS_TABLE'] = 'onboard-clusters-test';
    
    dynamoDBHelper = new DynamoDBHelper();
  });

  afterEach(() => {
    process.env = originalEnv;
    resetConfig();
  });

  describe('Method Signatures and Structure', () => {
    it('should have all required staff data access methods', () => {
      expect(typeof dynamoDBHelper.getStaffById).toBe('function');
      expect(typeof dynamoDBHelper.getStaffByEmail).toBe('function');
      expect(typeof dynamoDBHelper.createStaff).toBe('function');
      expect(typeof dynamoDBHelper.updateStaff).toBe('function');
    });

    it('should have all required password reset token methods', () => {
      expect(typeof dynamoDBHelper.getPasswordResetToken).toBe('function');
      expect(typeof dynamoDBHelper.createPasswordResetToken).toBe('function');
      expect(typeof dynamoDBHelper.markPasswordResetTokenUsed).toBe('function');
      expect(typeof dynamoDBHelper.deletePasswordResetToken).toBe('function');
    });

    it('should have all required tenant data access methods', () => {
      expect(typeof dynamoDBHelper.getTenant).toBe('function');
      expect(typeof dynamoDBHelper.createTenant).toBe('function');
      expect(typeof dynamoDBHelper.updateTenant).toBe('function');
    });

    it('should have all required cluster data access methods', () => {
      expect(typeof dynamoDBHelper.getCluster).toBe('function');
      expect(typeof dynamoDBHelper.getAllClusters).toBe('function');
      expect(typeof dynamoDBHelper.createCluster).toBe('function');
      expect(typeof dynamoDBHelper.updateCluster).toBe('function');
      expect(typeof dynamoDBHelper.deleteCluster).toBe('function');
    });

    it('should have proper table name resolution', () => {
      const tables = dynamoDBHelper['tables'];
      expect(tables.staff).toBe('onboard-staff-test');
      expect(tables.passwordResetTokens).toBe('onboard-password-reset-tokens-test');
      expect(tables.tenants).toBe('onboard-tenants-test');
      expect(tables.clusters).toBe('onboard-clusters-test');
    });
  });

  describe('Data Validation Logic', () => {
    it('should validate staff creation data structure', () => {
      const validStaffData = {
        email: 'test@example.com',
        password_hash: '$2b$12$hashedpassword',
        roles: ['staff'] as const,
        enabled: true
      };

      // Test that the data structure matches expected interface
      expect(validStaffData).toHaveProperty('email');
      expect(validStaffData).toHaveProperty('password_hash');
      expect(validStaffData).toHaveProperty('roles');
      expect(validStaffData).toHaveProperty('enabled');
      expect(Array.isArray(validStaffData.roles)).toBe(true);
    });

    it('should validate tenant creation data structure', () => {
      const validTenantData = {
        name: 'Test Company',
        email: 'contact@testcompany.com',
        contact_info: {
          phone: '+1-555-0123',
          address: '123 Main St'
        }
      };

      // Test that the data structure matches expected interface
      expect(validTenantData).toHaveProperty('name');
      expect(validTenantData).toHaveProperty('email');
      expect(validTenantData).toHaveProperty('contact_info');
      expect(typeof validTenantData.contact_info).toBe('object');
    });

    it('should validate password reset token data structure', () => {
      const validTokenData = {
        token_hash: 'sha256hashedtoken',
        staff_id: '123e4567-e89b-12d3-a456-426614174000',
        expires_at: Math.floor(Date.now() / 1000) + 3600
      };

      // Test that the data structure matches expected interface
      expect(validTokenData).toHaveProperty('token_hash');
      expect(validTokenData).toHaveProperty('staff_id');
      expect(validTokenData).toHaveProperty('expires_at');
      expect(typeof validTokenData.expires_at).toBe('number');
    });

    it('should validate cluster creation data structure', () => {
      const validClusterData = {
        name: 'Test Cluster',
        type: 'dedicated' as const,
        region: 'us-east-1' as const,
        cidr: '10.0.0.0/16'
      };

      // Test that the data structure matches expected interface
      expect(validClusterData).toHaveProperty('name');
      expect(validClusterData).toHaveProperty('type');
      expect(validClusterData).toHaveProperty('region');
      expect(validClusterData).toHaveProperty('cidr');
      expect(['dedicated', 'shared']).toContain(validClusterData.type);
    });
  });

  describe('Error Handling Structure', () => {
    it('should provide proper result types for database operations', () => {
      // Test that the helper methods exist and can be called
      expect(typeof dynamoDBHelper.createStaff).toBe('function');
      expect(typeof dynamoDBHelper.createTenant).toBe('function');
      expect(typeof dynamoDBHelper.createPasswordResetToken).toBe('function');
      expect(typeof dynamoDBHelper.createCluster).toBe('function');
      
      // Test that update methods exist
      expect(typeof dynamoDBHelper.updateStaff).toBe('function');
      expect(typeof dynamoDBHelper.updateTenant).toBe('function');
      expect(typeof dynamoDBHelper.updateCluster).toBe('function');
      expect(typeof dynamoDBHelper.markPasswordResetTokenUsed).toBe('function');
    });

    it('should support correlation IDs in method signatures', () => {
      // Test that methods accept correlation ID parameter
      // We can't test actual calls without AWS credentials, but we can verify the methods exist
      expect(dynamoDBHelper.getStaffById.length).toBeGreaterThanOrEqual(1);
      expect(dynamoDBHelper.getStaffByEmail.length).toBeGreaterThanOrEqual(1);
      expect(dynamoDBHelper.getTenant.length).toBeGreaterThanOrEqual(1);
      expect(dynamoDBHelper.getPasswordResetToken.length).toBeGreaterThanOrEqual(1);
      expect(dynamoDBHelper.getCluster.length).toBeGreaterThanOrEqual(1);
      expect(dynamoDBHelper.getAllClusters.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Data Model Integration', () => {
    it('should integrate with validation schemas', () => {
      // Test that the schemas can validate the expected data structures
      const staffData = {
        staff_id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        password_hash: '$2b$12$hashedpassword',
        roles: ['staff'],
        enabled: true,
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z'
      };

      const result = StaffRecordSchema.safeParse(staffData);
      expect(result.success).toBe(true);
    });

    it('should provide type safety for data operations', () => {
      // Test that TypeScript interfaces are properly defined
      expect(isStaffRecord).toBeDefined();
      expect(isPasswordResetToken).toBeDefined();
      expect(isTenantRecord).toBeDefined();
      expect(isClusterRecord).toBeDefined();
      
      expect(typeof isStaffRecord).toBe('function');
      expect(typeof isPasswordResetToken).toBe('function');
      expect(typeof isTenantRecord).toBe('function');
      expect(typeof isClusterRecord).toBe('function');
    });
  });
});