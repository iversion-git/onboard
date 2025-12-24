/**
 * Unit tests for Tenant data model
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TenantRepository, TenantRecord, CreateTenantInput } from './tenants.js';
import { DynamoDBHelpers } from '../aws/dynamodb.js';

// Mock DynamoDB helpers
vi.mock('../aws/dynamodb.js');
const mockDynamoDBHelpers = vi.mocked(DynamoDBHelpers);

describe('TenantRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create a valid tenant record', async () => {
      const input: CreateTenantInput = {
        tenant_id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Company',
        email: 'contact@testcompany.com',
        contact_info: {
          phone: '+1234567890',
          company: 'Test Company Inc.'
        },
        status: 'pending'
      };

      mockDynamoDBHelpers.getItem.mockResolvedValue(null); // No existing tenant
      mockDynamoDBHelpers.putItem.mockResolvedValue();

      const result = await TenantRepository.create(input);

      expect(result.tenant_id).toBe(input.tenant_id);
      expect(result.name).toBe(input.name);
      expect(result.email).toBe('contact@testcompany.com');
      expect(result.status).toBe('pending');
      expect(result.created_at).toBeDefined();
      expect(result.updated_at).toBeDefined();
    });

    it('should normalize email to lowercase', async () => {
      const input: CreateTenantInput = {
        tenant_id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Company',
        email: 'CONTACT@TESTCOMPANY.COM'
      };

      mockDynamoDBHelpers.getItem.mockResolvedValue(null);
      mockDynamoDBHelpers.putItem.mockResolvedValue();

      const result = await TenantRepository.create(input);

      expect(result.email).toBe('contact@testcompany.com');
    });

    it('should use default values for optional fields', async () => {
      const input: CreateTenantInput = {
        tenant_id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Company',
        email: 'contact@testcompany.com'
      };

      mockDynamoDBHelpers.getItem.mockResolvedValue(null);
      mockDynamoDBHelpers.putItem.mockResolvedValue();

      const result = await TenantRepository.create(input);

      expect(result.contact_info).toEqual({});
      expect(result.status).toBe('pending');
    });

    it('should throw error for duplicate tenant ID', async () => {
      const input: CreateTenantInput = {
        tenant_id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Company',
        email: 'contact@testcompany.com'
      };

      const existingTenant: TenantRecord = {
        tenant_id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Existing Company',
        email: 'existing@company.com',
        contact_info: {},
        status: 'active',
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z'
      };

      mockDynamoDBHelpers.getItem.mockResolvedValue(existingTenant);

      await expect(TenantRepository.create(input)).rejects.toThrow('Tenant with this ID already exists');
    });
  });

  describe('findById', () => {
    it('should find tenant by ID', async () => {
      const tenantRecord: TenantRecord = {
        tenant_id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Company',
        email: 'contact@testcompany.com',
        contact_info: { phone: '+1234567890' },
        status: 'active',
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z'
      };

      mockDynamoDBHelpers.getItem.mockResolvedValue(tenantRecord);

      const result = await TenantRepository.findById('123e4567-e89b-12d3-a456-426614174000');

      expect(result).toEqual(tenantRecord);
      expect(mockDynamoDBHelpers.getItem).toHaveBeenCalledWith(
        'Tenants',
        { tenant_id: '123e4567-e89b-12d3-a456-426614174000' }
      );
    });

    it('should return null for non-existent tenant', async () => {
      mockDynamoDBHelpers.getItem.mockResolvedValue(null);

      const result = await TenantRepository.findById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update tenant fields', async () => {
      const tenantId = '123e4567-e89b-12d3-a456-426614174000';
      const updates = {
        name: 'Updated Company Name',
        status: 'active' as const
      };

      mockDynamoDBHelpers.updateItem.mockResolvedValue();

      await TenantRepository.update(tenantId, updates);

      expect(mockDynamoDBHelpers.updateItem).toHaveBeenCalledWith(
        'Tenants',
        { tenant_id: tenantId },
        'SET #name = :name, #status = :status',
        {
          ':name': 'Updated Company Name',
          ':status': 'active'
        },
        {
          '#name': 'name',
          '#status': 'status'
        }
      );
    });

    it('should throw error for empty updates', async () => {
      const tenantId = '123e4567-e89b-12d3-a456-426614174000';

      await expect(TenantRepository.update(tenantId, {})).rejects.toThrow('No valid updates provided');
    });
  });

  describe('status management', () => {
    it('should activate tenant', async () => {
      const tenantId = '123e4567-e89b-12d3-a456-426614174000';
      mockDynamoDBHelpers.updateItem.mockResolvedValue();

      await TenantRepository.activate(tenantId);

      expect(mockDynamoDBHelpers.updateItem).toHaveBeenCalledWith(
        'Tenants',
        { tenant_id: tenantId },
        'SET #status = :status',
        { ':status': 'active' },
        { '#status': 'status' }
      );
    });

    it('should suspend tenant', async () => {
      const tenantId = '123e4567-e89b-12d3-a456-426614174000';
      mockDynamoDBHelpers.updateItem.mockResolvedValue();

      await TenantRepository.suspend(tenantId);

      expect(mockDynamoDBHelpers.updateItem).toHaveBeenCalledWith(
        'Tenants',
        { tenant_id: tenantId },
        'SET #status = :status',
        { ':status': 'suspended' },
        { '#status': 'status' }
      );
    });

    it('should check if tenant is active', async () => {
      const activeTenant: TenantRecord = {
        tenant_id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Active Company',
        email: 'active@company.com',
        contact_info: {},
        status: 'active',
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z'
      };

      mockDynamoDBHelpers.getItem.mockResolvedValue(activeTenant);

      const result = await TenantRepository.isActive('123e4567-e89b-12d3-a456-426614174000');

      expect(result).toBe(true);
    });
  });

  describe('validateTenantData', () => {
    it('should validate correct tenant data', () => {
      const input: CreateTenantInput = {
        tenant_id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Valid Company',
        email: 'valid@company.com'
      };

      expect(() => TenantRepository.validateTenantData(input)).not.toThrow();
    });

    it('should reject empty or whitespace-only names', () => {
      const input: CreateTenantInput = {
        tenant_id: '123e4567-e89b-12d3-a456-426614174000',
        name: '   ',
        email: 'valid@company.com'
      };

      expect(() => TenantRepository.validateTenantData(input)).toThrow('Tenant name cannot be empty or only whitespace');
    });
  });
});