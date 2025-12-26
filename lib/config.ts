// Configuration management with environment variable validation
import { z } from 'zod';

// Environment variables schema with validation
const envSchema = z.object({
  // AWS Configuration
  AWS_REGION: z.string().default('us-east-1'),
  STAGE: z.string().default('dev'),
  
  // DynamoDB Table Names
  DYNAMODB_STAFF_TABLE: z.string().optional(),
  DYNAMODB_PASSWORD_RESET_TOKENS_TABLE: z.string().optional(),
  DYNAMODB_TENANTS_TABLE: z.string().optional(),
  
  // JWT Configuration
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters long'),
  JWT_EXPIRY: z.string().default('24h'),
  
  // SES Configuration
  SES_FROM_EMAIL: z.string().email().optional(),
  SES_REGION: z.string().default('us-east-1'),
  
  // CORS Configuration
  CORS_ORIGINS: z.string().optional(),
  
  // App Configuration
  APP_BASE_URL: z.string().optional(),
  
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

// Structured configuration interface
export interface AppConfig {
  aws: {
    region: string;
  };
  stage: string;
  dynamodb: {
    staffTable: string;
    passwordResetTokensTable: string;
    tenantsTable: string;
  };
  jwt: {
    secret: string;
    expiry: string;
  };
  ses: {
    fromEmail: string;
    region: string;
  };
  cors: {
    origins: string[];
  };
  app: {
    baseUrl: string;
  };
  logging: {
    level: string;
    enableXray: boolean;
  };
  security: {
    bcryptRounds: number;
    passwordResetTokenExpiryHours: number;
  };
  performance: {
    connectionTimeout: number;
    requestTimeout: number;
  };
}

// Global configuration instance
let config: AppConfig | null = null;

/**
 * Load and validate configuration from environment variables
 * Throws an error if required configuration is missing or invalid
 */
export function loadConfig(): AppConfig {
  if (config) {
    return config;
  }

  try {
    // Parse and validate environment variables
    const env = envSchema.parse(process.env);
    
    // Transform to structured configuration
    config = {
      aws: {
        region: env.AWS_REGION,
      },
      stage: env.STAGE,
      dynamodb: {
        staffTable: env.DYNAMODB_STAFF_TABLE || `Staff-${env.STAGE}`,
        passwordResetTokensTable: env.DYNAMODB_PASSWORD_RESET_TOKENS_TABLE || `PasswordResetTokens-${env.STAGE}`,
        tenantsTable: env.DYNAMODB_TENANTS_TABLE || `Tenants-${env.STAGE}`,
      },
      jwt: {
        secret: env.JWT_SECRET,
        expiry: env.JWT_EXPIRY,
      },
      ses: {
        fromEmail: env.SES_FROM_EMAIL || `noreply@${env.STAGE === 'prod' ? 'example.com' : 'dev.example.com'}`,
        region: env.SES_REGION,
      },
      cors: {
        origins: env.CORS_ORIGINS ? env.CORS_ORIGINS.split(',').map(origin => origin.trim()) : (env.STAGE === 'prod' ? [] : ['*']),
      },
      app: {
        baseUrl: env.APP_BASE_URL || `https://${env.STAGE === 'prod' ? 'app.example.com' : `${env.STAGE}.example.com`}`,
      },
      logging: {
        level: env.LOG_LEVEL,
        enableXray: env.ENABLE_XRAY,
      },
      security: {
        bcryptRounds: env.BCRYPT_ROUNDS,
        passwordResetTokenExpiryHours: env.PASSWORD_RESET_TOKEN_EXPIRY_HOURS,
      },
      performance: {
        connectionTimeout: env.CONNECTION_TIMEOUT,
        requestTimeout: env.REQUEST_TIMEOUT,
      },
    };
    
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
export function getConfig(): AppConfig {
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
  
  if (cfg.stage === 'prod') {
    const missing: string[] = [];
    
    if (!cfg.ses.fromEmail.includes('@')) {
      missing.push('SES_FROM_EMAIL');
    }
    if (cfg.cors.origins.length === 0) {
      missing.push('CORS_ORIGINS');
    }
    if (!cfg.jwt.secret) {
      missing.push('JWT_SECRET');
    }
    
    if (missing.length > 0) {
      throw new Error(`Missing required production configuration: ${missing.join(', ')}`);
    }
  }
  
  // Validate JWT secret length in all environments
  if (cfg.jwt.secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long for security');
  }
}

/**
 * Get CORS origins as an array
 */
export function getCorsOrigins(): string[] {
  const cfg = getConfig();
  return cfg.cors.origins;
}

/**
 * Check if we're running in production
 */
export function isProduction(): boolean {
  return getConfig().stage === 'prod';
}

/**
 * Check if we're running in development
 */
export function isDevelopment(): boolean {
  return getConfig().stage === 'dev';
}

/**
 * Get JWT secret (with validation)
 */
export function getJwtSecret(): string {
  const cfg = getConfig();
  
  if (!cfg.jwt.secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  
  if (cfg.jwt.secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long for security');
  }
  
  return cfg.jwt.secret;
}