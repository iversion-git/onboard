import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { createLoggerFromCorrelationId } from '../logging.js';

// Create a logger instance for Secrets Manager operations
const logger = createLoggerFromCorrelationId('secrets-manager', 'aws-integration');

/**
 * Secrets Manager integration for JWT signing key and other secrets
 */
export class SecretsManagerHelpers {
  private static client: SecretsManagerClient | null = null;
  private static cache: Map<string, { value: string; expiry: number }> = new Map();
  private static readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Initialize Secrets Manager client
   */
  private static getClient(): SecretsManagerClient {
    if (!this.client) {
      this.client = new SecretsManagerClient({
        region: process.env['AWS_REGION'] || 'us-east-1',
        maxAttempts: 3,
        retryMode: 'adaptive'
      });
      logger.info('Secrets Manager client initialized');
    }
    return this.client;
  }

  /**
   * Get secret value with caching
   */
  private static async getSecretValue(secretId: string): Promise<string> {
    // Check cache first
    const cached = this.cache.get(secretId);
    if (cached && Date.now() < cached.expiry) {
      logger.debug('Secret retrieved from cache', { secretId });
      return cached.value;
    }

    const client = this.getClient();

    try {
      const command = new GetSecretValueCommand({
        SecretId: secretId
      });

      const result = await client.send(command);
      
      if (!result.SecretString) {
        throw new Error(`Secret ${secretId} has no string value`);
      }

      // Cache the secret
      this.cache.set(secretId, {
        value: result.SecretString,
        expiry: Date.now() + this.CACHE_TTL_MS
      });

      logger.info('Secret retrieved from Secrets Manager', { secretId });
      return result.SecretString;
    } catch (error) {
      logger.error('Failed to retrieve secret', { secretId, error });
      throw error;
    }
  }

  /**
   * Get JWT signing key for token generation and verification
   */
  static async getJWTSigningKey(): Promise<string> {
    const stage = process.env['STAGE'] || 'dev';
    const secretId = `control-plane/${stage}/jwt-signing-key`;
    
    try {
      return await this.getSecretValue(secretId);
    } catch (error) {
      logger.error('Failed to retrieve JWT signing key', { stage, error });
      throw new Error('JWT signing key not available');
    }
  }

  /**
   * Get database encryption key (if needed for sensitive data)
   */
  static async getDatabaseEncryptionKey(): Promise<string> {
    const stage = process.env['STAGE'] || 'dev';
    const secretId = `control-plane/${stage}/db-encryption-key`;
    
    try {
      return await this.getSecretValue(secretId);
    } catch (error) {
      logger.error('Failed to retrieve database encryption key', { stage, error });
      throw new Error('Database encryption key not available');
    }
  }

  /**
   * Get external service API key (for future integrations)
   */
  static async getExternalServiceKey(serviceName: string): Promise<string> {
    const stage = process.env['STAGE'] || 'dev';
    const secretId = `control-plane/${stage}/external-services/${serviceName}`;
    
    try {
      return await this.getSecretValue(secretId);
    } catch (error) {
      logger.error('Failed to retrieve external service key', { serviceName, stage, error });
      throw new Error(`External service key for ${serviceName} not available`);
    }
  }

  /**
   * Clear cache (useful for testing or forced refresh)
   */
  static clearCache(): void {
    this.cache.clear();
    logger.info('Secrets Manager cache cleared');
  }

  /**
   * Get cache statistics (for monitoring)
   */
  static getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}