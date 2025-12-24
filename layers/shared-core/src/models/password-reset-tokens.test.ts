/**
 * Unit tests for Password Reset Token data model
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PasswordResetTokenRepository, PasswordResetToken } from './password-reset-tokens.js';
import { DynamoDBHelpers } from '../aws/dynamodb.js';

// Mock DynamoDB helpers
vi.mock('../aws/dynamodb.js');
const mockDynamoDBHelpers = vi.mocked(DynamoDBHelpers);

describe('PasswordResetTokenRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateToken', () => {
    it('should generate a valid token structure', () => {
      const result = PasswordResetTokenRepository.generateToken();

      expect(result.token).toMatch(/^[a-f0-9]{64}$/i);
      expect(result.token_hash).toMatch(/^[a-f0-9]{64}$/i);
      expect(result.expires_at).toBeGreaterThan(Math.floor(Date.now() / 1000));
      expect(result.token).not.toBe(result.token_hash);
    });

    it('should generate unique tokens', () => {
      const token1 = PasswordResetTokenRepository.generateToken();
      const token2 = PasswordResetTokenRepository.generateToken();

      expect(token1.token).not.toBe(token2.token);
      expect(token1.token_hash).not.toBe(token2.token_hash);
    });
  });

  describe('create', () => {
    it('should create a password reset token', async () => {
      const staffId = '123e4567-e89b-12d3-a456-426614174000';
      mockDynamoDBHelpers.putItem.mockResolvedValue();

      const result = await PasswordResetTokenRepository.create(staffId);

      expect(result.token).toMatch(/^[a-f0-9]{64}$/i);
      expect(result.token_hash).toMatch(/^[a-f0-9]{64}$/i);
      expect(result.expires_at).toBeGreaterThan(Math.floor(Date.now() / 1000));

      expect(mockDynamoDBHelpers.putItem).toHaveBeenCalledWith(
        'PasswordResetTokens',
        expect.objectContaining({
          token_hash: result.token_hash,
          staff_id: staffId,
          expires_at: result.expires_at,
          created_at: expect.any(String)
        }),
        { addTimestamps: false }
      );
    });
  });

  describe('findByToken', () => {
    it('should find valid token', async () => {
      const token = 'a'.repeat(64);
      const tokenRecord: PasswordResetToken = {
        token_hash: PasswordResetTokenRepository.hashToken(token),
        staff_id: '123e4567-e89b-12d3-a456-426614174000',
        expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        created_at: '2023-01-01T00:00:00.000Z'
      };

      mockDynamoDBHelpers.getItem.mockResolvedValue(tokenRecord);

      const result = await PasswordResetTokenRepository.findByToken(token);

      expect(result).toEqual(tokenRecord);
    });

    it('should return null for expired token', async () => {
      const token = 'a'.repeat(64);
      const expiredTokenRecord: PasswordResetToken = {
        token_hash: PasswordResetTokenRepository.hashToken(token),
        staff_id: '123e4567-e89b-12d3-a456-426614174000',
        expires_at: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
        created_at: '2023-01-01T00:00:00.000Z'
      };

      mockDynamoDBHelpers.getItem.mockResolvedValue(expiredTokenRecord);

      const result = await PasswordResetTokenRepository.findByToken(token);

      expect(result).toBeNull();
    });

    it('should return null for used token', async () => {
      const token = 'a'.repeat(64);
      const usedTokenRecord: PasswordResetToken = {
        token_hash: PasswordResetTokenRepository.hashToken(token),
        staff_id: '123e4567-e89b-12d3-a456-426614174000',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        created_at: '2023-01-01T00:00:00.000Z',
        used_at: '2023-01-01T01:00:00.000Z'
      };

      mockDynamoDBHelpers.getItem.mockResolvedValue(usedTokenRecord);

      const result = await PasswordResetTokenRepository.findByToken(token);

      expect(result).toBeNull();
    });
  });

  describe('consumeToken', () => {
    it('should consume valid token and return staff_id', async () => {
      const token = 'a'.repeat(64);
      const staffId = '123e4567-e89b-12d3-a456-426614174000';
      const tokenRecord: PasswordResetToken = {
        token_hash: PasswordResetTokenRepository.hashToken(token),
        staff_id: staffId,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        created_at: '2023-01-01T00:00:00.000Z'
      };

      mockDynamoDBHelpers.getItem.mockResolvedValue(tokenRecord);
      mockDynamoDBHelpers.deleteItem.mockResolvedValue();

      const result = await PasswordResetTokenRepository.consumeToken(token);

      expect(result).toBe(staffId);
      expect(mockDynamoDBHelpers.deleteItem).toHaveBeenCalledWith(
        'PasswordResetTokens',
        { token_hash: PasswordResetTokenRepository.hashToken(token) }
      );
    });

    it('should return null for invalid token', async () => {
      const token = 'invalid_token';
      mockDynamoDBHelpers.getItem.mockResolvedValue(null);

      const result = await PasswordResetTokenRepository.consumeToken(token);

      expect(result).toBeNull();
      expect(mockDynamoDBHelpers.deleteItem).not.toHaveBeenCalled();
    });
  });

  describe('isValidTokenFormat', () => {
    it('should validate correct token format', () => {
      const validToken = 'a'.repeat(64);
      expect(PasswordResetTokenRepository.isValidTokenFormat(validToken)).toBe(true);
    });

    it('should reject invalid token formats', () => {
      expect(PasswordResetTokenRepository.isValidTokenFormat('short')).toBe(false);
      expect(PasswordResetTokenRepository.isValidTokenFormat('g'.repeat(64))).toBe(false); // invalid hex
      expect(PasswordResetTokenRepository.isValidTokenFormat('a'.repeat(63))).toBe(false); // too short
      expect(PasswordResetTokenRepository.isValidTokenFormat('a'.repeat(65))).toBe(false); // too long
    });
  });
});