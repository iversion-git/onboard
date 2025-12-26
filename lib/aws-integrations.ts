/**
 * AWS Integrations Module
 * 
 * This module provides centralized access to all AWS services and utilities
 * used throughout the single Lambda function. All dependencies are bundled
 * with esbuild for optimal performance.
 */

// Re-export all AWS integrations and utilities
export { getDynamoDBClient, getTableNames, DynamoDBHelper, dynamoDBHelper } from './dynamodb.js';
export { getSESClient, SESHelper, sesHelper, emailTemplates, type EmailTemplate, type PasswordResetEmailData } from './ses.js';
export { JWTHelper, jwtHelper, hasRole, hasAnyRole, hasAllRoles, hasMinimumRole, type JWTTokenPayload } from './jwt.js';
export { PasswordHelper, passwordHelper } from './password.js';
export { getConfig, loadConfig, resetConfig, validateRequiredConfig, getCorsOrigins, isProduction, isDevelopment, getJwtSecret, type AppConfig } from './config.js';
export { logger } from './logging.js';

// Re-export commonly used AWS SDK clients for direct access if needed
export { DynamoDBClient } from '@aws-sdk/client-dynamodb';
export { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
export { SESClient } from '@aws-sdk/client-ses';

// Re-export validation and utility libraries
export { z } from 'zod';
export { SignJWT, jwtVerify } from 'jose';
export * as bcrypt from 'bcryptjs';

// AWS Lambda Powertools (for observability)
export { Logger } from '@aws-lambda-powertools/logger';
export { Metrics } from '@aws-lambda-powertools/metrics';
export { Tracer } from '@aws-lambda-powertools/tracer';

// Import required functions for the initialization functions
import { logger } from './logging.js';
import { validateRequiredConfig, getJwtSecret } from './config.js';
import { getDynamoDBClient } from './dynamodb.js';
import { getSESClient } from './ses.js';

/**
 * Initialize all AWS integrations and validate configuration
 * This should be called during Lambda cold start
 */
export async function initializeAWSIntegrations(): Promise<void> {
  try {
    logger.info('Initializing AWS integrations');

    // Validate configuration
    validateRequiredConfig();

    // Initialize clients (they're lazy-loaded, so this just validates config)
    getDynamoDBClient();
    getSESClient();
    
    // Validate JWT configuration
    getJwtSecret();

    logger.info('AWS integrations initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize AWS integrations', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Health check for all AWS integrations
 * Useful for monitoring and debugging
 */
export async function healthCheckAWSIntegrations(): Promise<{
  status: 'healthy' | 'unhealthy';
  services: Record<string, 'healthy' | 'unhealthy' | 'error'>;
  errors?: string[];
}> {
  const services: Record<string, 'healthy' | 'unhealthy' | 'error'> = {};
  const errors: string[] = [];

  try {
    // Check DynamoDB
    try {
      getDynamoDBClient();
      services['dynamodb'] = 'healthy';
    } catch (error) {
      services['dynamodb'] = 'error';
      errors.push(`DynamoDB: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Check SES
    try {
      getSESClient();
      services['ses'] = 'healthy';
    } catch (error) {
      services['ses'] = 'error';
      errors.push(`SES: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Check JWT
    try {
      getJwtSecret();
      services['jwt'] = 'healthy';
    } catch (error) {
      services['jwt'] = 'error';
      errors.push(`JWT: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Check configuration
    try {
      validateRequiredConfig();
      services['config'] = 'healthy';
    } catch (error) {
      services['config'] = 'error';
      errors.push(`Config: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const status = errors.length === 0 ? 'healthy' : 'unhealthy';

    return {
      status,
      services,
      ...(errors.length > 0 && { errors }),
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      services,
      errors: [`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
}