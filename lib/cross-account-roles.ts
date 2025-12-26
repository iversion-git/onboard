/**
 * Cross-Account IAM Role Management Module
 * 
 * Provides utilities for managing cross-account IAM roles for CloudFormation
 * deployments with proper security boundaries and audit logging.
 */

import { STSClient, AssumeRoleCommand, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { getConfig } from './config.js';
import { logger } from './logging.js';
import { z } from 'zod';

// Cross-account deployment configuration schema
const crossAccountDeploymentSchema = z.object({
  targetAccountId: z.string().regex(/^\d{12}$/, 'Must be a valid 12-digit AWS account ID'),
  region: z.string().min(1),
  roleName: z.string().min(1),
  externalId: z.string().optional(),
  sessionName: z.string().min(1).max(64),
  durationSeconds: z.number().min(900).max(43200).default(3600)
});

// Account validation configuration
const accountValidationSchema = z.object({
  allowedAccountIds: z.array(z.string().regex(/^\d{12}$/)).min(1),
  requireExternalId: z.boolean().default(true),
  maxSessionDuration: z.number().min(900).max(43200).default(3600)
});

export type CrossAccountDeploymentConfig = z.infer<typeof crossAccountDeploymentSchema>;
export type AccountValidationConfig = z.infer<typeof accountValidationSchema>;

// Cross-account session information
export interface CrossAccountSession {
  accountId: string;
  roleArn: string;
  sessionName: string;
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
    expiration: Date;
  };
  assumedRoleUser: {
    assumedRoleId: string;
    arn: string;
  };
}

/**
 * Cross-Account Role Manager Class
 * Handles secure cross-account role assumption and validation
 */
export class CrossAccountRoleManager {
  private stsClient: STSClient;
  private config: ReturnType<typeof getConfig>;
  private validationConfig: AccountValidationConfig;

  constructor(validationConfig: AccountValidationConfig, region?: string) {
    this.config = getConfig();
    this.validationConfig = accountValidationSchema.parse(validationConfig);
    
    const clientRegion = region || this.config.aws.region;
    
    this.stsClient = new STSClient({
      region: clientRegion,
      maxAttempts: 3
    });
  }

  /**
   * Assume cross-account role with validation and audit logging
   */
  async assumeRole(deploymentConfig: CrossAccountDeploymentConfig): Promise<CrossAccountSession> {
    try {
      // Validate deployment configuration
      const validatedConfig = crossAccountDeploymentSchema.parse(deploymentConfig);
      
      // Validate target account is allowed
      if (!this.validationConfig.allowedAccountIds.includes(validatedConfig.targetAccountId)) {
        throw new Error(`Target account ${validatedConfig.targetAccountId} is not in the allowed accounts list`);
      }

      // Validate external ID requirement
      if (this.validationConfig.requireExternalId && !validatedConfig.externalId) {
        throw new Error('External ID is required for cross-account role assumption');
      }

      // Construct role ARN
      const roleArn = `arn:aws:iam::${validatedConfig.targetAccountId}:role/${validatedConfig.roleName}`;
      
      logger.info('Attempting cross-account role assumption', {
        targetAccountId: validatedConfig.targetAccountId,
        roleArn,
        sessionName: validatedConfig.sessionName,
        region: validatedConfig.region,
        hasExternalId: !!validatedConfig.externalId
      });

      // Get current identity for audit logging
      const currentIdentity = await this.getCurrentIdentity();
      
      // Assume the cross-account role
      const assumeRoleCommand = new AssumeRoleCommand({
        RoleArn: roleArn,
        RoleSessionName: validatedConfig.sessionName,
        ExternalId: validatedConfig.externalId,
        DurationSeconds: Math.min(validatedConfig.durationSeconds, this.validationConfig.maxSessionDuration)
      });

      const response = await this.stsClient.send(assumeRoleCommand);
      
      if (!response.Credentials || !response.AssumedRoleUser) {
        throw new Error('Failed to assume role: No credentials or assumed role user returned');
      }

      const session: CrossAccountSession = {
        accountId: validatedConfig.targetAccountId,
        roleArn,
        sessionName: validatedConfig.sessionName,
        credentials: {
          accessKeyId: response.Credentials.AccessKeyId!,
          secretAccessKey: response.Credentials.SecretAccessKey!,
          sessionToken: response.Credentials.SessionToken!,
          expiration: response.Credentials.Expiration!
        },
        assumedRoleUser: {
          assumedRoleId: response.AssumedRoleUser.AssumedRoleId!,
          arn: response.AssumedRoleUser.Arn!
        }
      };

      // Audit log successful role assumption
      logger.info('Cross-account role assumption successful', {
        sourceAccount: currentIdentity.accountId,
        sourceArn: currentIdentity.arn,
        targetAccountId: validatedConfig.targetAccountId,
        assumedRoleArn: session.assumedRoleUser.arn,
        assumedRoleId: session.assumedRoleUser.assumedRoleId,
        sessionExpiration: session.credentials.expiration,
        correlationId: this.generateCorrelationId()
      });

      return session;
    } catch (error) {
      logger.error('Cross-account role assumption failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        targetAccountId: deploymentConfig.targetAccountId,
        roleName: deploymentConfig.roleName,
        correlationId: this.generateCorrelationId()
      });
      throw error;
    }
  }
  /**
   * Validate cross-account role exists and is accessible
   */
  async validateRole(deploymentConfig: CrossAccountDeploymentConfig): Promise<{ valid: boolean; error?: string }> {
    try {
      // Attempt to assume the role with minimal duration
      const testConfig = {
        ...deploymentConfig,
        durationSeconds: 900, // Minimum duration for testing
        sessionName: `${deploymentConfig.sessionName}-validation`
      };

      const session = await this.assumeRole(testConfig);
      
      // If we got here, the role is valid and accessible
      logger.info('Cross-account role validation successful', {
        targetAccountId: deploymentConfig.targetAccountId,
        roleName: deploymentConfig.roleName,
        assumedRoleId: session.assumedRoleUser.assumedRoleId
      });

      return { valid: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';
      
      logger.warn('Cross-account role validation failed', {
        targetAccountId: deploymentConfig.targetAccountId,
        roleName: deploymentConfig.roleName,
        error: errorMessage
      });

      return {
        valid: false,
        error: errorMessage
      };
    }
  }

  /**
   * Generate cross-account role ARN
   */
  generateRoleArn(accountId: string, roleName: string): string {
    if (!/^\d{12}$/.test(accountId)) {
      throw new Error('Invalid AWS account ID format');
    }
    
    return `arn:aws:iam::${accountId}:role/${roleName}`;
  }

  /**
   * Generate standardized role name for control plane deployments
   */
  generateStandardRoleName(suffix?: string): string {
    const baseName = this.config.cloudformation.crossAccountRolePrefix;
    return suffix ? `${baseName}-${suffix}` : baseName;
  }

  /**
   * Get current AWS identity for audit logging
   */
  private async getCurrentIdentity(): Promise<{ accountId: string; arn: string; userId: string }> {
    try {
      const command = new GetCallerIdentityCommand({});
      const response = await this.stsClient.send(command);
      
      return {
        accountId: response.Account!,
        arn: response.Arn!,
        userId: response.UserId!
      };
    } catch (error) {
      logger.error('Failed to get current AWS identity', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Unable to determine current AWS identity');
    }
  }

  /**
   * Generate correlation ID for audit logging
   */
  private generateCorrelationId(): string {
    return `cross-account-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if session is still valid (not expired)
   */
  isSessionValid(session: CrossAccountSession): boolean {
    return session.credentials.expiration > new Date();
  }

  /**
   * Get session time remaining in seconds
   */
  getSessionTimeRemaining(session: CrossAccountSession): number {
    const now = new Date();
    const expiration = session.credentials.expiration;
    
    if (expiration <= now) {
      return 0;
    }
    
    return Math.floor((expiration.getTime() - now.getTime()) / 1000);
  }

  /**
   * Create STS client with assumed role credentials
   */
  createAssumedRoleSTSClient(session: CrossAccountSession, region?: string): STSClient {
    const clientRegion = region || this.config.aws.region;
    
    return new STSClient({
      region: clientRegion,
      credentials: {
        accessKeyId: session.credentials.accessKeyId,
        secretAccessKey: session.credentials.secretAccessKey,
        sessionToken: session.credentials.sessionToken
      },
      maxAttempts: 3
    });
  }
}

/**
 * Default cross-account role manager configuration
 */
export function createDefaultAccountValidationConfig(): AccountValidationConfig {
  const config = getConfig();
  
  // In production, this should be configured via environment variables
  // For now, we'll use a basic configuration
  return {
    allowedAccountIds: [], // Should be populated from environment or configuration
    requireExternalId: config.stage === 'prod',
    maxSessionDuration: 3600
  };
}

/**
 * Create cross-account role manager with default configuration
 */
export function createCrossAccountRoleManager(
  allowedAccountIds: string[],
  region?: string
): CrossAccountRoleManager {
  const validationConfig: AccountValidationConfig = {
    allowedAccountIds,
    requireExternalId: getConfig().stage === 'prod',
    maxSessionDuration: 3600
  };
  
  return new CrossAccountRoleManager(validationConfig, region);
}

// Global cross-account role manager instance
let crossAccountRoleManager: CrossAccountRoleManager | null = null;

/**
 * Get cross-account role manager instance (singleton)
 */
export function getCrossAccountRoleManager(allowedAccountIds?: string[], region?: string): CrossAccountRoleManager {
  if (!crossAccountRoleManager) {
    if (!allowedAccountIds || allowedAccountIds.length === 0) {
      throw new Error('Allowed account IDs must be provided for cross-account role manager initialization');
    }
    crossAccountRoleManager = createCrossAccountRoleManager(allowedAccountIds, region);
  }
  return crossAccountRoleManager;
}