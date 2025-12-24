/**
 * Configuration management with environment variable validation
 * Uses Zod for runtime validation of environment variables
 */

import { z } from 'zod';
import { Config } from './types.js';
import { createError } from './errors.js';

/**
 * Environment variable schema
 */
const envSchema = z.object({
  STAGE: z.string().default('dev'),
  AWS_REGION: z.string().default('us-east-1'),
  STAFF_TABLE_NAME: z.string().optional(),
  PASSWORD_RESET_TOKENS_TABLE_NAME: z.string().optional(),
  TENANTS_TABLE_NAME: z.string().optional(),
  JWT_SIGNING_KEY_SECRET_NAME: z.string().optional(),
  SES_FROM_EMAIL: z.string().email().optional(),
  CORS_ORIGINS: z.string().default('*'),
  LOG_LEVEL: z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR']).default('INFO')
});

/**
 * Cached configuration instance
 */
let cachedConfig: Config | null = null;

/**
 * Get validated configuration
 * Caches the result to avoid repeated validation
 */
export function getConfig(): Config {
  if (cachedConfig) {
    return cachedConfig;
  }

  const env = envSchema.safeParse(process.env);
  
  if (!env.success) {
    throw createError('InternalError', 'Invalid environment configuration', {
      issues: env.error.issues
    });
  }

  const stage = env.data.STAGE;
  
  cachedConfig = {
    stage,
    region: env.data.AWS_REGION,
    staffTableName: env.data.STAFF_TABLE_NAME || `Staff-${stage}`,
    passwordResetTokensTableName: env.data.PASSWORD_RESET_TOKENS_TABLE_NAME || `PasswordResetTokens-${stage}`,
    tenantsTableName: env.data.TENANTS_TABLE_NAME || `Tenants-${stage}`,
    jwtSigningKeySecretName: env.data.JWT_SIGNING_KEY_SECRET_NAME || `jwt-signing-key-${stage}`,
    sesFromEmail: env.data.SES_FROM_EMAIL || `noreply@example.com`,
    corsOrigins: env.data.CORS_ORIGINS.split(',').map(origin => origin.trim()),
    logLevel: env.data.LOG_LEVEL
  };

  return cachedConfig;
}

/**
 * Reset cached configuration (useful for testing)
 */
export function resetConfig(): void {
  cachedConfig = null;
}

/**
 * Validate required configuration for specific features
 */
export function validateConfigForFeature(feature: 'auth' | 'email' | 'database'): void {
  const config = getConfig();
  
  switch (feature) {
    case 'auth':
      if (!config.jwtSigningKeySecretName) {
        throw createError('InternalError', 'JWT signing key secret name not configured');
      }
      break;
      
    case 'email':
      if (!config.sesFromEmail) {
        throw createError('InternalError', 'SES from email not configured');
      }
      break;
      
    case 'database':
      if (!config.staffTableName || !config.passwordResetTokensTableName || !config.tenantsTableName) {
        throw createError('InternalError', 'Database table names not properly configured');
      }
      break;
  }
}