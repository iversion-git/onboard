// Configuration management with environment variable validation
import { z } from 'zod';

// Configuration schema with validation
const configSchema = z.object({
  // AWS Configuration
  AWS_REGION: z.string().default('us-east-1'),
  STAGE: z.string().default('dev'),
  
  // DynamoDB Table Names
  STAFF_TABLE: z.string().optional(),
  PASSWORD_RESET_TOKENS_TABLE: z.string().optional(),
  TENANTS_TABLE: z.string().optional(),
  
  // JWT Configuration
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters long'),
  JWT_EXPIRY: z.string().default('24h'),
  
  // SES Configuration
  SES_FROM_EMAIL: z.string().email().optional(),
  SES_REGION: z.string().default('us-east-1'),
  
  // CORS Configuration
  CORS_ORIGINS: z.string().optional(),
  
  // Logging Configuration
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  ENABLE_XRAY: z.string().transform(val => val === 'true').default('true'),
  
  // Security Configuration
  BCRYPT_ROUNDS: z.string().transform(val => parseInt(val, 10)).default('12'),
  PASSWORD_RESET_TOKEN_EXPIRY_HOURS: z.string().transform(val => parseInt(val, 10)).default('24'),
  
  // Performance Configuration
  CONNECTION_TIMEOUT: z.string().transform(val => parseInt(val, 10)).default('5000'),
  REQUEST_TIMEOUT: z.string().transform(val => parseInt(val, 10)).default('30000')
});

export type Config = z.infer<typeof configSchema>;

// Global configuration instance
let config: Config | null = null;

/**
 * Load and validate configuration from environment variables
 * Throws an error if required configuration is missing or invalid
 */
export function loadConfig(): Config {
  if (config) {
    return config;
  }

  try {
    // Parse and validate environment variables
    config = configSchema.parse(process.env);
    
    // Generate table names if not provided
    if (!config.STAFF_TABLE) {
      config.STAFF_TABLE = `Staff-${config.STAGE}`;
    }
    if (!config.PASSWORD_RESET_TOKENS_TABLE) {
      config.PASSWORD_RESET_TOKENS_TABLE = `PasswordResetTokens-${config.STAGE}`;
    }
    if (!config.TENANTS_TABLE) {
      config.TENANTS_TABLE = `Tenants-${config.STAGE}`;
    }
    
    return config;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingFields = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      throw new Error(`Configuration validation failed:\n${missingFields.join('\n')}`);
    }
    throw error;
  }
}

/**
 * Get current configuration (loads if not already loaded)
 */
export function getConfig(): Config {
  return loadConfig();
}

/**
 * Reset configuration (useful for testing)
 */
export function resetConfig(): void {
  config = null;
}

/**
 * Validate that all required configuration is present for the current stage
 */
export function validateRequiredConfig(): void {
  const cfg = getConfig();
  
  const requiredForProduction = [
    'SES_FROM_EMAIL',
    'CORS_ORIGINS',
    'JWT_SECRET'
  ];
  
  if (cfg.STAGE === 'prod') {
    const missing = requiredForProduction.filter(key => !cfg[key as keyof Config]);
    if (missing.length > 0) {
      throw new Error(`Missing required production configuration: ${missing.join(', ')}`);
    }
  }
  
  // Validate JWT secret length in all environments
  if (cfg.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long for security');
  }
}

/**
 * Get CORS origins as an array
 */
export function getCorsOrigins(): string[] {
  const cfg = getConfig();
  
  if (!cfg.CORS_ORIGINS) {
    return cfg.STAGE === 'prod' ? [] : ['*'];
  }
  
  return cfg.CORS_ORIGINS.split(',').map(origin => origin.trim());
}

/**
 * Check if we're running in production
 */
export function isProduction(): boolean {
  return getConfig().STAGE === 'prod';
}

/**
 * Check if we're running in development
 */
export function isDevelopment(): boolean {
  return getConfig().STAGE === 'dev';
}

/**
 * Get JWT secret (with validation)
 */
export function getJwtSecret(): string {
  const cfg = getConfig();
  
  if (!cfg.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  
  if (cfg.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long for security');
  }
  
  return cfg.JWT_SECRET;
}