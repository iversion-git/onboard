/**
 * CloudFormation Integration Module
 * 
 * Provides CloudFormation client and utilities for cross-account deployments
 * with proper IAM role assumption and deployment tracking.
 */

import { 
  CloudFormationClient, 
  CreateStackCommand, 
  UpdateStackCommand, 
  DeleteStackCommand, 
  DescribeStacksCommand, 
  DescribeStackEventsCommand,
  ListStacksCommand,
  ValidateTemplateCommand,
  type Stack,
  type StackStatus,
  type StackEvent,
  type Output,
  type Capability
} from '@aws-sdk/client-cloudformation';
import { STSClient, AssumeRoleCommand, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { getConfig } from './config.js';
import { logger } from './logging.js';
import { z } from 'zod';

// CloudFormation deployment configuration schema
const deploymentConfigSchema = z.object({
  stackName: z.string().min(1).max(128),
  templateUrl: z.string().url(),
  parameters: z.array(z.object({
    ParameterKey: z.string(),
    ParameterValue: z.string()
  })).optional(),
  tags: z.array(z.object({
    Key: z.string(),
    Value: z.string()
  })).optional(),
  capabilities: z.array(z.enum(['CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM', 'CAPABILITY_AUTO_EXPAND'])).optional(),
  roleArn: z.string().optional(),
  timeoutInMinutes: z.number().min(1).max(180).optional(),
  enableTerminationProtection: z.boolean().optional()
});

// Cross-account role assumption configuration
const crossAccountConfigSchema = z.object({
  roleArn: z.string(),
  sessionName: z.string(),
  externalId: z.string().optional(),
  durationSeconds: z.number().min(900).max(43200).optional()
});

export type DeploymentConfig = z.infer<typeof deploymentConfigSchema>;
export type CrossAccountConfig = z.infer<typeof crossAccountConfigSchema>;

// CloudFormation deployment result
export interface DeploymentResult {
  stackId: string;
  stackName: string;
  status: StackStatus;
  outputs?: Output[];
  events?: StackEvent[];
  error?: string;
}

// Stack status categories for easier handling
export const STACK_STATUS_CATEGORIES = {
  IN_PROGRESS: [
    'CREATE_IN_PROGRESS',
    'UPDATE_IN_PROGRESS', 
    'DELETE_IN_PROGRESS',
    'ROLLBACK_IN_PROGRESS',
    'UPDATE_ROLLBACK_IN_PROGRESS'
  ] as StackStatus[],
  SUCCESS: [
    'CREATE_COMPLETE',
    'UPDATE_COMPLETE'
  ] as StackStatus[],
  FAILED: [
    'CREATE_FAILED',
    'UPDATE_FAILED',
    'DELETE_FAILED',
    'ROLLBACK_FAILED',
    'UPDATE_ROLLBACK_FAILED',
    'ROLLBACK_COMPLETE',
    'UPDATE_ROLLBACK_COMPLETE'
  ] as StackStatus[]
};
/**
 * CloudFormation Helper Class
 * Provides high-level CloudFormation operations with cross-account support
 */
export class CloudFormationHelper {
  private client: CloudFormationClient;
  private stsClient: STSClient;
  private config: ReturnType<typeof getConfig>;

  constructor(region?: string) {
    this.config = getConfig();
    const clientRegion = region || this.config.aws.region;
    
    this.client = new CloudFormationClient({
      region: clientRegion,
      maxAttempts: 3
    });
    
    this.stsClient = new STSClient({
      region: clientRegion,
      maxAttempts: 3
    });
  }

  /**
   * Assume cross-account role and return new CloudFormation client
   */
  async assumeRoleAndGetClient(crossAccountConfig: CrossAccountConfig): Promise<CloudFormationClient> {
    try {
      logger.info('Assuming cross-account role', {
        roleArn: crossAccountConfig.roleArn,
        sessionName: crossAccountConfig.sessionName
      });

      const command = new AssumeRoleCommand({
        RoleArn: crossAccountConfig.roleArn,
        RoleSessionName: crossAccountConfig.sessionName,
        ExternalId: crossAccountConfig.externalId,
        DurationSeconds: crossAccountConfig.durationSeconds || 3600
      });

      const response = await this.stsClient.send(command);
      
      if (!response.Credentials) {
        throw new Error('Failed to assume role: No credentials returned');
      }

      // Create new CloudFormation client with assumed role credentials
      const assumedRoleClient = new CloudFormationClient({
        region: this.client.config.region,
        credentials: {
          accessKeyId: response.Credentials.AccessKeyId!,
          secretAccessKey: response.Credentials.SecretAccessKey!,
          sessionToken: response.Credentials.SessionToken!
        },
        maxAttempts: 3
      });

      logger.info('Successfully assumed cross-account role', {
        assumedRoleId: response.AssumedRoleUser?.AssumedRoleId,
        expiration: response.Credentials.Expiration
      });

      return assumedRoleClient;
    } catch (error) {
      logger.error('Failed to assume cross-account role', {
        error: error instanceof Error ? error.message : 'Unknown error',
        roleArn: crossAccountConfig.roleArn
      });
      throw error;
    }
  }

  /**
   * Validate current AWS credentials and permissions
   */
  async validateCredentials(): Promise<{ accountId: string; arn: string }> {
    try {
      const command = new GetCallerIdentityCommand({});
      const response = await this.stsClient.send(command);
      
      return {
        accountId: response.Account!,
        arn: response.Arn!
      };
    } catch (error) {
      logger.error('Failed to validate AWS credentials', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Invalid AWS credentials or insufficient permissions');
    }
  }
  /**
   * Deploy CloudFormation stack (create or update)
   */
  async deployStack(
    deploymentConfig: DeploymentConfig, 
    crossAccountConfig?: CrossAccountConfig
  ): Promise<DeploymentResult> {
    try {
      // Validate deployment configuration
      const validatedConfig = deploymentConfigSchema.parse(deploymentConfig);
      
      // Use cross-account client if specified
      const cfnClient = crossAccountConfig 
        ? await this.assumeRoleAndGetClient(crossAccountConfig)
        : this.client;

      logger.info('Starting CloudFormation deployment', {
        stackName: validatedConfig.stackName,
        templateUrl: validatedConfig.templateUrl,
        crossAccount: !!crossAccountConfig
      });

      // Check if stack exists
      const stackExists = await this.stackExists(validatedConfig.stackName, cfnClient);
      
      let command;
      if (stackExists) {
        // Update existing stack
        command = new UpdateStackCommand({
          StackName: validatedConfig.stackName,
          TemplateURL: validatedConfig.templateUrl,
          Parameters: validatedConfig.parameters,
          Tags: validatedConfig.tags,
          Capabilities: validatedConfig.capabilities as Capability[],
          RoleARN: validatedConfig.roleArn
        });
      } else {
        // Create new stack
        command = new CreateStackCommand({
          StackName: validatedConfig.stackName,
          TemplateURL: validatedConfig.templateUrl,
          Parameters: validatedConfig.parameters,
          Tags: validatedConfig.tags,
          Capabilities: validatedConfig.capabilities as Capability[],
          RoleARN: validatedConfig.roleArn,
          TimeoutInMinutes: validatedConfig.timeoutInMinutes,
          EnableTerminationProtection: validatedConfig.enableTerminationProtection
        });
      }

      const response = await cfnClient.send(command);
      
      logger.info('CloudFormation deployment initiated', {
        stackId: response.StackId,
        stackName: validatedConfig.stackName,
        operation: stackExists ? 'update' : 'create'
      });

      return {
        stackId: response.StackId!,
        stackName: validatedConfig.stackName,
        status: stackExists ? 'UPDATE_IN_PROGRESS' : 'CREATE_IN_PROGRESS'
      };
    } catch (error) {
      logger.error('CloudFormation deployment failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stackName: deploymentConfig.stackName
      });
      
      return {
        stackId: '',
        stackName: deploymentConfig.stackName,
        status: 'CREATE_FAILED',
        error: error instanceof Error ? error.message : 'Unknown deployment error'
      };
    }
  }

  /**
   * Get stack status and details
   */
  async getStackStatus(
    stackName: string, 
    crossAccountConfig?: CrossAccountConfig
  ): Promise<DeploymentResult | null> {
    try {
      const cfnClient = crossAccountConfig 
        ? await this.assumeRoleAndGetClient(crossAccountConfig)
        : this.client;

      const command = new DescribeStacksCommand({
        StackName: stackName
      });

      const response = await cfnClient.send(command);
      const stack = response.Stacks?.[0];

      if (!stack) {
        return null;
      }

      return {
        stackId: stack.StackId!,
        stackName: stack.StackName!,
        status: stack.StackStatus!,
        ...(stack.Outputs && { outputs: stack.Outputs })
      };
    } catch (error) {
      logger.error('Failed to get stack status', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stackName
      });
      return null;
    }
  }
  /**
   * Get stack events for troubleshooting
   */
  async getStackEvents(
    stackName: string, 
    crossAccountConfig?: CrossAccountConfig
  ): Promise<StackEvent[]> {
    try {
      const cfnClient = crossAccountConfig 
        ? await this.assumeRoleAndGetClient(crossAccountConfig)
        : this.client;

      const command = new DescribeStackEventsCommand({
        StackName: stackName
      });

      const response = await cfnClient.send(command);
      return response.StackEvents || [];
    } catch (error) {
      logger.error('Failed to get stack events', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stackName
      });
      return [];
    }
  }

  /**
   * Delete CloudFormation stack
   */
  async deleteStack(
    stackName: string, 
    crossAccountConfig?: CrossAccountConfig
  ): Promise<boolean> {
    try {
      const cfnClient = crossAccountConfig 
        ? await this.assumeRoleAndGetClient(crossAccountConfig)
        : this.client;

      const command = new DeleteStackCommand({
        StackName: stackName
      });

      await cfnClient.send(command);
      
      logger.info('CloudFormation stack deletion initiated', {
        stackName
      });

      return true;
    } catch (error) {
      logger.error('Failed to delete stack', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stackName
      });
      return false;
    }
  }

  /**
   * Validate CloudFormation template
   */
  async validateTemplate(templateUrl: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const command = new ValidateTemplateCommand({
        TemplateURL: templateUrl
      });

      await this.client.send(command);
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Template validation failed'
      };
    }
  }

  /**
   * Check if stack exists
   */
  private async stackExists(stackName: string, cfnClient: CloudFormationClient): Promise<boolean> {
    try {
      const command = new DescribeStacksCommand({
        StackName: stackName
      });

      await cfnClient.send(command);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * List all stacks with optional status filter
   */
  async listStacks(statusFilter?: StackStatus[]): Promise<Stack[]> {
    try {
      const command = new ListStacksCommand({
        StackStatusFilter: statusFilter
      });

      const response = await this.client.send(command);
      return response.StackSummaries?.map(summary => ({
        StackId: summary.StackId,
        StackName: summary.StackName,
        StackStatus: summary.StackStatus,
        CreationTime: summary.CreationTime,
        LastUpdatedTime: summary.LastUpdatedTime,
        DeletionTime: summary.DeletionTime,
        TemplateDescription: summary.TemplateDescription
      } as Stack)) || [];
    } catch (error) {
      logger.error('Failed to list stacks', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }
}

// Global CloudFormation helper instance
let cloudFormationHelper: CloudFormationHelper | null = null;

/**
 * Get CloudFormation helper instance (singleton)
 */
export function getCloudFormationHelper(region?: string): CloudFormationHelper {
  if (!cloudFormationHelper) {
    cloudFormationHelper = new CloudFormationHelper(region);
  }
  return cloudFormationHelper;
}

/**
 * Get CloudFormation client directly
 */
export function getCloudFormationClient(region?: string): CloudFormationClient {
  const config = getConfig();
  const clientRegion = region || config.aws.region;
  
  return new CloudFormationClient({
    region: clientRegion,
    maxAttempts: 3
  });
}

/**
 * Utility functions for stack status checking
 */
export function isStackInProgress(status: StackStatus): boolean {
  return STACK_STATUS_CATEGORIES.IN_PROGRESS.includes(status);
}

export function isStackSuccessful(status: StackStatus): boolean {
  return STACK_STATUS_CATEGORIES.SUCCESS.includes(status);
}

export function isStackFailed(status: StackStatus): boolean {
  return STACK_STATUS_CATEGORIES.FAILED.includes(status);
}