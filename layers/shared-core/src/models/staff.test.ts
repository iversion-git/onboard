/**
 * Unit tests for Staff data model
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StaffRepository, StaffRecord, CreateStaffInput } from './staff.js';
import { DynamoDBHelpers } from '../aws/dynamodb.js';

// Mock DynamoDB helpers
vi.mock('../aws/dynamodb.js');
const mockDynamoDBHelpers = vi.mocked(DynamoDBHelpers);

describe('StaffRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create a valid staff record', async () => {
      const input: CreateStaffInput = {
        staff_id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        password_hash: 'hashed_password',
        roles: ['staff'],
        enabled: true
      };

      mockDynamoDBHelpers.queryItems.mockResolvedValue([]); // No existing staff
      mockDynamoDBHelpers.putItem.mockResolvedValue();

      const result = await StaffRepository.create(input);

      expect(result.staff_id).toBe(input.staff_id);
      expect(result.email).toBe('test@example.com');
      expect(result.roles).toEqual(['staff']);
      expect(result.enabled).toBe(true);
      expect(result.created_at).toBeDefined();
      expect(result.updated_at).toBeDefined();
    });

    it('should normalize email to lowercase', async () => {
      const input: CreateStaffInput = {
        staff_id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'TEST@EXAMPLE.COM',
        password_hash: 'hashed_password',
        roles: ['admin']
      };

      mockDynamoDBHelpers.queryItems.mockResolvedValue([]);
      mockDynamoDBHelpers.putItem.mockResolvedValue();

      const result = await StaffRepository.create(input);

      expect(result.email).toBe('test@example.com');
    });

    it('should throw error for duplicate email', async () => {
      const input: CreateStaffInput = {
        staff_id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        password_hash: 'hashed_password',
        roles: ['staff']
      };

      const existingStaff: StaffRecord = {
        staff_id: '456e7890-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        password_hash: 'other_hash',
        roles: ['staff'],
        enabled: true,
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z'
      };

      mockDynamoDBHelpers.queryItems.mockResolvedValue([existingStaff]);

      await expect(StaffRepository.create(input)).rejects.toThrow('Staff member with this email already exists');
    });
  });

  describe('findByEmail', () => {
    it('should find staff by email', async () => {
      const staffRecord: StaffRecord = {
        staff_id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        password_hash: 'hashed_password',
        roles: ['staff'],
        enabled: true,
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z'
      };

      mockDynamoDBHelpers.queryItems.mockResolvedValue([staffRecord]);

      const result = await StaffRepository.findByEmail('test@example.com');

      expect(result).toEqual(staffRecord);
      expect(mockDynamoDBHelpers.queryItems).toHaveBeenCalledWith(
        'Staff',
        'email = :email',
        { ':email': 'test@example.com' },
        { indexName: 'EmailIndex', limit: 1 }
      );
    });

    it('should normalize email for search', async () => {
      mockDynamoDBHelpers.queryItems.mockResolvedValue([]);

      await StaffRepository.findByEmail('TEST@EXAMPLE.COM');

      expect(mockDynamoDBHelpers.queryItems).toHaveBeenCalledWith(
        'Staff',
        'email = :email',
        { ':email': 'test@example.com' },
        { indexName: 'EmailIndex', limit: 1 }
      );
    });
  });

  describe('hasRole', () => {
    it('should allow admin to access any role', () => {
      const adminStaff: StaffRecord = {
        staff_id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'admin@example.com',
        password_hash: 'hashed_password',
        roles: ['admin'],
        enabled: true,
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z'
      };

      expect(StaffRepository.hasRole(adminStaff, 'admin')).toBe(true);
      expect(StaffRepository.hasRole(adminStaff, 'manager')).toBe(true);
      expect(StaffRepository.hasRole(adminStaff, 'staff')).toBe(true);
    });

    it('should allow manager to access manager and staff roles', () => {
      const managerStaff: StaffRecord = {
        staff_id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'manager@example.com',
        password_hash: 'hashed_password',
        roles: ['manager'],
        enabled: true,
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z'
      };

      expect(StaffRepository.hasRole(managerStaff, 'admin')).toBe(false);
      expect(StaffRepository.hasRole(managerStaff, 'manager')).toBe(true);
      expect(StaffRepository.hasRole(managerStaff, 'staff')).toBe(true);
    });

    it('should allow staff to access only staff role', () => {
      const staffUser: StaffRecord = {
        staff_id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'staff@example.com',
        password_hash: 'hashed_password',
        roles: ['staff'],
        enabled: true,
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z'
      };

      expect(StaffRepository.hasRole(staffUser, 'admin')).toBe(false);
      expect(StaffRepository.hasRole(staffUser, 'manager')).toBe(false);
      expect(StaffRepository.hasRole(staffUser, 'staff')).toBe(true);
    });
  });
});