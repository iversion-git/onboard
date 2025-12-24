/**
 * Password Reset Token data model and access patterns
 * Handles secure password reset token management with TTL
 */

import { z } from 'zod';
import { createHash, randomBytes } from 'crypto';
import { DynamoDBHelpers } from '../aws/dynamodb.js';
import { createLoggerFromCorrelationId } from '../logging.js';

const logger = createLoggerFromCorrelationId('password-reset-tokens-model', 'data-access');

// Password reset token record schema
export const PasswordResetTokenSchema = z.object({
  token_hash: z.string().min(1),
  staff_id: z.string().uuid(),
  expires_at: z.number().int().positive(),
  created_at: z.string().datetime(),
  used_at: z.string().datetime().optional()
});

export type PasswordResetToken = z.infer<typeof PasswordResetTokenSchema>;

// Token creation result (includes plain token for email)
export interface TokenCreationResult {
  token: string;           // Plain token for email
  token_hash: string;      // Hashed token for storage
  expires_at: number;      // Expiration timestamp
}

/**
 * Password Reset Token data access layer
 */
export class PasswordResetTokenRepository {
  private static readonly TABLE_NAME = 'PasswordResetTokens';
  private static readonly TOKEN_EXPIRY_HOURS = 1; // 1 hour expiry

  /**
   * Generate a secure password reset token
   */
  static generateToken(): TokenCreationResult {
    // Generate cryptographically secure random token
    const token = randomBytes(32).toString('hex');
    
    // Hash the token for storage (SHA-256)
    const token_hash = createHash('sha256').update(token).digest('hex');
    
    // Set expiration time (1 hour from now)
    const expires_at = Math.floor(Date.now() / 1000) + (this.TOKEN_EXPIRY_HOURS * 60 * 60);

    return {
      token,
      token_hash,
      expires_at
    };
  }

  /**
   * Create a password reset token for a staff member
   */
  static async create(staffId: string): Promise<TokenCreationResult> {
    const tokenData = this.generateToken();

    const tokenRecord: PasswordResetToken = {
      token_hash: tokenData.token_hash,
      staff_id: staffId,
      expires_at: tokenData.expires_at,
      created_at: new Date().toISOString()
    };

    // Validate record
    const validatedRecord = PasswordResetTokenSchema.parse(tokenRecord);

    await DynamoDBHelpers.putItem(this.TABLE_NAME, validatedRecord, { addTimestamps: false });

    logger.info('Password reset token created', { 
      staff_id: staffId, 
      expires_at: tokenData.expires_at 
    });

    return tokenData;
  }

  /**
   * Find and validate a password reset token
   */
  static async findByToken(token: string): Promise<PasswordResetToken | null> {
    // Hash the provided token to match stored hash
    const token_hash = createHash('sha256').update(token).digest('hex');

    const result = await DynamoDBHelpers.getItem<PasswordResetToken>(
      this.TABLE_NAME,
      { token_hash }
    );

    if (!result) {
      return null;
    }

    // Validate retrieved record
    const validatedRecord = PasswordResetTokenSchema.parse(result);

    // Check if token has expired
    const currentTime = Math.floor(Date.now() / 1000);
    if (validatedRecord.expires_at <= currentTime) {
      logger.warn('Expired password reset token accessed', { 
        token_hash, 
        expires_at: validatedRecord.expires_at,
        current_time: currentTime 
      });
      return null;
    }

    // Check if token has already been used
    if (validatedRecord.used_at) {
      logger.warn('Already used password reset token accessed', { 
        token_hash, 
        used_at: validatedRecord.used_at 
      });
      return null;
    }

    return validatedRecord;
  }

  /**
   * Mark a token as used and delete it
   */
  static async consumeToken(token: string): Promise<string | null> {
    const token_hash = createHash('sha256').update(token).digest('hex');
    
    // First, verify the token exists and is valid
    const tokenRecord = await this.findByToken(token);
    if (!tokenRecord) {
      return null;
    }

    // Delete the token (it's single-use)
    await DynamoDBHelpers.deleteItem(this.TABLE_NAME, { token_hash });

    logger.info('Password reset token consumed', { 
      staff_id: tokenRecord.staff_id,
      token_hash 
    });

    return tokenRecord.staff_id;
  }

  /**
   * Clean up expired tokens (optional - TTL handles this automatically)
   * This method is provided for manual cleanup if needed
   */
  static async cleanupExpiredTokens(): Promise<void> {
    // Note: DynamoDB TTL will automatically handle cleanup
    // This method could be implemented for manual cleanup if needed
    logger.info('TTL-based cleanup is automatic for expired tokens');
  }

  /**
   * Validate token format without database lookup
   */
  static isValidTokenFormat(token: string): boolean {
    // Token should be 64 hex characters (32 bytes as hex)
    return /^[a-f0-9]{64}$/i.test(token);
  }

  /**
   * Hash a token for comparison (utility method)
   */
  static hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}