import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { getConfig } from './config.js';
import { logger } from './logging.js';
import type { 
  StaffRecord, 
  PasswordResetToken, 
  TenantRecord,
  ClusterRecord,
  StaffUpdate,
  TenantUpdate,
  ClusterUpdate,
  DatabaseOperationResult,
  StaffQueryResult,
  TenantQueryResult,
  ClusterQueryResult,
  PasswordResetTokenQueryResult,
  CIDRValidationResult
} from './data-models.js';
import {
  StaffRecordSchema,
  PasswordResetTokenSchema,
  TenantRecordSchema,
  ClusterRecordSchema
} from './data-models.js';
import { validateCIDRWithOverlapCheck } from './cidr-utils.js';
import { createApiError } from './errors.js';
import { randomUUID } from 'crypto';

// DynamoDB client configuration with retry patterns
const createDynamoDBClient = (): DynamoDBDocumentClient => {
  const client = new DynamoDBClient({
    region: process.env['AWS_REGION'] || 'us-east-1',
    maxAttempts: 3,
    retryMode: 'adaptive',
    requestHandler: {
      requestTimeout: 5000,
      httpsAgent: {
        maxSockets: 50,
        keepAlive: true,
      },
    },
  });

  return DynamoDBDocumentClient.from(client, {
    marshallOptions: {
      convertEmptyValues: false,
      removeUndefinedValues: true,
      convertClassInstanceToMap: false,
    },
    unmarshallOptions: {
      wrapNumbers: false,
    },
  });
};

// Singleton DynamoDB client instance
let dynamoDBClient: DynamoDBDocumentClient | null = null;

export const getDynamoDBClient = (): DynamoDBDocumentClient => {
  if (!dynamoDBClient) {
    dynamoDBClient = createDynamoDBClient();
    logger.info('DynamoDB client initialized');
  }
  return dynamoDBClient;
};

// Table name resolution based on environment
export const getTableNames = () => {
  const config = getConfig();
  return {
    staff: config.dynamodb.staffTable,
    passwordResetTokens: config.dynamodb.passwordResetTokensTable,
    tenants: config.dynamodb.tenantsTable,
    clusters: config.dynamodb.clustersTable,
  };
};

// Helper functions for common DynamoDB operations with error handling and logging
export class DynamoDBHelper {
  private client: DynamoDBDocumentClient;
  private tables: ReturnType<typeof getTableNames>;

  constructor() {
    this.client = getDynamoDBClient();
    this.tables = getTableNames();
  }

  async getItem(tableName: string, key: Record<string, any>, correlationId?: string) {
    try {
      logger.info('DynamoDB GetItem operation', { 
        tableName, 
        key: Object.keys(key),
        correlationId 
      });

      const command = new GetCommand({
        TableName: tableName,
        Key: key,
      });

      const result = await this.client.send(command);
      
      logger.info('DynamoDB GetItem completed', { 
        tableName, 
        found: !!result.Item,
        correlationId 
      });

      return result.Item;
    } catch (error) {
      logger.error('DynamoDB GetItem failed', { 
        tableName, 
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId 
      });
      throw error;
    }
  }

  async putItem(tableName: string, item: Record<string, any>, correlationId?: string) {
    try {
      logger.info('DynamoDB PutItem operation', { 
        tableName, 
        itemKeys: Object.keys(item),
        correlationId 
      });

      const command = new PutCommand({
        TableName: tableName,
        Item: item,
      });

      await this.client.send(command);
      
      logger.info('DynamoDB PutItem completed', { 
        tableName,
        correlationId 
      });

      return item;
    } catch (error) {
      logger.error('DynamoDB PutItem failed', { 
        tableName, 
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId 
      });
      throw error;
    }
  }

  async updateItem(
    tableName: string, 
    key: Record<string, any>, 
    updateExpression: string, 
    expressionAttributeValues: Record<string, any>,
    expressionAttributeNames?: Record<string, string>,
    correlationId?: string
  ) {
    try {
      logger.info('DynamoDB UpdateItem operation', { 
        tableName, 
        key: Object.keys(key),
        correlationId 
      });

      const command = new UpdateCommand({
        TableName: tableName,
        Key: key,
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        ExpressionAttributeNames: expressionAttributeNames,
        ReturnValues: 'ALL_NEW',
      });

      const result = await this.client.send(command);
      
      logger.info('DynamoDB UpdateItem completed', { 
        tableName,
        correlationId 
      });

      return result.Attributes;
    } catch (error) {
      logger.error('DynamoDB UpdateItem failed', { 
        tableName, 
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId 
      });
      throw error;
    }
  }

  async deleteItem(tableName: string, key: Record<string, any>, correlationId?: string) {
    try {
      logger.info('DynamoDB DeleteItem operation', { 
        tableName, 
        key: Object.keys(key),
        correlationId 
      });

      const command = new DeleteCommand({
        TableName: tableName,
        Key: key,
      });

      await this.client.send(command);
      
      logger.info('DynamoDB DeleteItem completed', { 
        tableName,
        correlationId 
      });

    } catch (error) {
      logger.error('DynamoDB DeleteItem failed', { 
        tableName, 
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId 
      });
      throw error;
    }
  }

  async queryItems(
    tableName: string, 
    keyConditionExpression: string, 
    expressionAttributeValues: Record<string, any>,
    indexName?: string,
    expressionAttributeNames?: Record<string, string>,
    correlationId?: string
  ) {
    try {
      logger.info('DynamoDB Query operation', { 
        tableName, 
        indexName,
        correlationId 
      });

      const command = new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: keyConditionExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        ExpressionAttributeNames: expressionAttributeNames,
        IndexName: indexName,
      });

      const result = await this.client.send(command);
      
      logger.info('DynamoDB Query completed', { 
        tableName, 
        itemCount: result.Items?.length || 0,
        correlationId 
      });

      return result.Items || [];
    } catch (error) {
      logger.error('DynamoDB Query failed', { 
        tableName, 
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId 
      });
      throw error;
    }
  }

  // Staff data access methods with validation
  async getStaffById(staffId: string, correlationId?: string): Promise<StaffQueryResult> {
    try {
      const item = await this.getItem(this.tables.staff, { staff_id: staffId }, correlationId);
      
      if (!item) {
        return { found: false };
      }

      const validationResult = StaffRecordSchema.safeParse(item);
      if (!validationResult.success) {
        logger.error('Invalid staff record format in database', { 
          staffId, 
          errors: validationResult.error.errors,
          correlationId 
        });
        throw createApiError('InternalError', 'Invalid staff record format');
      }

      return { staff: validationResult.data, found: true };
    } catch (error) {
      logger.error('Failed to get staff by ID', { 
        staffId, 
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId 
      });
      throw error;
    }
  }

  async getStaffByEmail(email: string, correlationId?: string): Promise<StaffQueryResult> {
    try {
      const normalizedEmail = email.toLowerCase();
      const items = await this.queryItems(
        this.tables.staff,
        'email = :email',
        { ':email': normalizedEmail },
        'EmailIndex',
        undefined,
        correlationId
      );

      if (!items || items.length === 0) {
        return { found: false };
      }

      const item = items[0];
      const validationResult = StaffRecordSchema.safeParse(item);
      if (!validationResult.success) {
        logger.error('Invalid staff record format in database', { 
          email: normalizedEmail, 
          errors: validationResult.error.errors,
          correlationId 
        });
        throw createApiError('InternalError', 'Invalid staff record format');
      }

      return { staff: validationResult.data, found: true };
    } catch (error) {
      logger.error('Failed to get staff by email', { 
        email, 
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId 
      });
      throw error;
    }
  }

  async createStaff(staffData: Omit<StaffRecord, 'staff_id' | 'created_at' | 'updated_at'>, correlationId?: string): Promise<DatabaseOperationResult<StaffRecord>> {
    try {
      const now = new Date().toISOString();
      const staffRecord: StaffRecord = {
        staff_id: randomUUID(),
        ...staffData,
        email: staffData.email.toLowerCase(),
        created_at: now,
        updated_at: now,
      };

      // Validate the record before saving
      const validationResult = StaffRecordSchema.safeParse(staffRecord);
      if (!validationResult.success) {
        logger.error('Invalid staff record data', { 
          errors: validationResult.error.errors,
          correlationId 
        });
        throw createApiError('ValidationError', 'Invalid staff record data');
      }

      // Check for duplicate email
      const existingStaff = await this.getStaffByEmail(staffRecord.email, correlationId);
      if (existingStaff.found) {
        logger.warn('Attempted to create staff with duplicate email', { 
          email: staffRecord.email,
          correlationId 
        });
        throw createApiError('Conflict', 'Staff member with this email already exists');
      }

      await this.putItem(this.tables.staff, validationResult.data, correlationId);
      
      return { 
        success: true, 
        data: validationResult.data,
        correlationId 
      };
    } catch (error) {
      logger.error('Failed to create staff', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId 
      });
      
      if (error instanceof Error && error.message.includes('already exists')) {
        return { 
          success: false, 
          error: error.message,
          correlationId 
        };
      }
      
      throw error;
    }
  }

  async updateStaff(staffId: string, updates: StaffUpdate, correlationId?: string): Promise<DatabaseOperationResult<StaffRecord>> {
    try {
      // Add updated_at timestamp
      const updatesWithTimestamp = {
        ...updates,
        updated_at: new Date().toISOString(),
      };

      const updateExpression = 'SET ' + Object.keys(updatesWithTimestamp).map((key, index) => `#${key} = :val${index}`).join(', ');
      const expressionAttributeNames = Object.keys(updatesWithTimestamp).reduce((acc, key) => {
        acc[`#${key}`] = key;
        return acc;
      }, {} as Record<string, string>);
      const expressionAttributeValues = Object.keys(updatesWithTimestamp).reduce((acc, key, index) => {
        acc[`:val${index}`] = updatesWithTimestamp[key as keyof typeof updatesWithTimestamp];
        return acc;
      }, {} as Record<string, any>);

      const result = await this.updateItem(
        this.tables.staff,
        { staff_id: staffId },
        updateExpression,
        expressionAttributeValues,
        expressionAttributeNames,
        correlationId
      );

      if (!result) {
        throw createApiError('NotFound', 'Staff member not found');
      }

      // Validate the updated record
      const validationResult = StaffRecordSchema.safeParse(result);
      if (!validationResult.success) {
        logger.error('Invalid staff record after update', { 
          staffId, 
          errors: validationResult.error.errors,
          correlationId 
        });
        throw createApiError('InternalError', 'Invalid staff record after update');
      }

      return { 
        success: true, 
        data: validationResult.data,
        correlationId 
      };
    } catch (error) {
      logger.error('Failed to update staff', { 
        staffId, 
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId 
      });
      throw error;
    }
  }

  async updateStaffPassword(staffId: string, passwordHash: string, correlationId?: string): Promise<DatabaseOperationResult<StaffRecord>> {
    try {
      const updates = {
        password_hash: passwordHash,
        updated_at: new Date().toISOString(),
      };

      const updateExpression = 'SET password_hash = :password_hash, updated_at = :updated_at';
      const expressionAttributeValues = {
        ':password_hash': updates.password_hash,
        ':updated_at': updates.updated_at,
      };

      const result = await this.updateItem(
        this.tables.staff,
        { staff_id: staffId },
        updateExpression,
        expressionAttributeValues,
        undefined,
        correlationId
      );

      if (!result) {
        throw createApiError('NotFound', 'Staff member not found');
      }

      // Validate the updated record
      const validationResult = StaffRecordSchema.safeParse(result);
      if (!validationResult.success) {
        logger.error('Invalid staff record after password update', { 
          staffId, 
          errors: validationResult.error.errors,
          correlationId 
        });
        throw createApiError('InternalError', 'Invalid staff record after password update');
      }

      return { 
        success: true, 
        data: validationResult.data,
        correlationId 
      };
    } catch (error) {
      logger.error('Failed to update staff password', { 
        staffId, 
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId 
      });
      throw error;
    }
  }

  // Password reset token data access methods
  async getPasswordResetToken(tokenHash: string, correlationId?: string): Promise<PasswordResetTokenQueryResult> {
    try {
      const item = await this.getItem(this.tables.passwordResetTokens, { token_hash: tokenHash }, correlationId);
      
      if (!item) {
        return { found: false };
      }

      const validationResult = PasswordResetTokenSchema.safeParse(item);
      if (!validationResult.success) {
        logger.error('Invalid password reset token format in database', { 
          tokenHash, 
          errors: validationResult.error.errors,
          correlationId 
        });
        throw createApiError('InternalError', 'Invalid password reset token format');
      }

      // Check if token is expired
      const now = Math.floor(Date.now() / 1000);
      const expired = validationResult.data.expires_at <= now;

      return { 
        token: validationResult.data, 
        found: true, 
        expired 
      };
    } catch (error) {
      logger.error('Failed to get password reset token', { 
        tokenHash, 
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId 
      });
      throw error;
    }
  }

  async createPasswordResetToken(tokenData: Omit<PasswordResetToken, 'created_at'>, correlationId?: string): Promise<DatabaseOperationResult<PasswordResetToken>> {
    try {
      const tokenRecord: PasswordResetToken = {
        ...tokenData,
        created_at: new Date().toISOString(),
      };

      // Validate the record before saving
      const validationResult = PasswordResetTokenSchema.safeParse(tokenRecord);
      if (!validationResult.success) {
        logger.error('Invalid password reset token data', { 
          errors: validationResult.error.errors,
          correlationId 
        });
        throw createApiError('ValidationError', 'Invalid password reset token data');
      }

      await this.putItem(this.tables.passwordResetTokens, validationResult.data, correlationId);
      
      return { 
        success: true, 
        data: validationResult.data,
        correlationId 
      };
    } catch (error) {
      logger.error('Failed to create password reset token', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId 
      });
      throw error;
    }
  }

  async markPasswordResetTokenUsed(tokenHash: string, correlationId?: string): Promise<DatabaseOperationResult<PasswordResetToken>> {
    try {
      const result = await this.updateItem(
        this.tables.passwordResetTokens,
        { token_hash: tokenHash },
        'SET used_at = :used_at',
        { ':used_at': new Date().toISOString() },
        undefined,
        correlationId
      );

      if (!result) {
        throw createApiError('NotFound', 'Password reset token not found');
      }

      // Validate the updated record
      const validationResult = PasswordResetTokenSchema.safeParse(result);
      if (!validationResult.success) {
        logger.error('Invalid password reset token after update', { 
          tokenHash, 
          errors: validationResult.error.errors,
          correlationId 
        });
        throw createApiError('InternalError', 'Invalid password reset token after update');
      }

      return { 
        success: true, 
        data: validationResult.data,
        correlationId 
      };
    } catch (error) {
      logger.error('Failed to mark password reset token as used', { 
        tokenHash, 
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId 
      });
      throw error;
    }
  }

  async deletePasswordResetToken(tokenHash: string, correlationId?: string): Promise<void> {
    return this.deleteItem(this.tables.passwordResetTokens, { token_hash: tokenHash }, correlationId);
  }

  // Tenant data access methods
  async getTenant(tenantId: string, correlationId?: string): Promise<TenantQueryResult> {
    try {
      const item = await this.getItem(this.tables.tenants, { tenant_id: tenantId }, correlationId);
      
      if (!item) {
        return { found: false };
      }

      const validationResult = TenantRecordSchema.safeParse(item);
      if (!validationResult.success) {
        logger.error('Invalid tenant record format in database', { 
          tenantId, 
          errors: validationResult.error.issues,
          correlationId 
        });
        throw createApiError('InternalError', 'Invalid tenant record format');
      }

      return { tenant: validationResult.data, found: true };
    } catch (error) {
      logger.error('Failed to get tenant', { 
        tenantId, 
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId 
      });
      throw error;
    }
  }

  async getTenantByUrl(tenantUrl: string, correlationId?: string): Promise<TenantQueryResult> {
    try {
      // Scan for tenant with matching tenant_url (in production, consider using GSI)
      const scanCommand = new ScanCommand({
        TableName: this.tables.tenants,
        FilterExpression: 'tenant_url = :tenant_url',
        ExpressionAttributeValues: {
          ':tenant_url': tenantUrl.toLowerCase()
        }
      });

      const result = await this.client.send(scanCommand);
      
      if (!result.Items || result.Items.length === 0) {
        return { found: false };
      }

      const item = result.Items[0];
      const validationResult = TenantRecordSchema.safeParse(item);
      if (!validationResult.success) {
        logger.error('Invalid tenant record format in database', { 
          tenantUrl, 
          errors: validationResult.error.issues,
          correlationId 
        });
        throw createApiError('InternalError', 'Invalid tenant record format');
      }

      return { tenant: validationResult.data, found: true };
    } catch (error) {
      logger.error('Failed to get tenant by URL', { 
        tenantUrl, 
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId 
      });
      throw error;
    }
  }

  async createTenant(tenantData: Omit<TenantRecord, 'tenant_id' | 'status' | 'created_at' | 'updated_at'>, correlationId?: string): Promise<DatabaseOperationResult<TenantRecord>> {
    try {
      const now = new Date().toISOString();
      const tenantRecord: TenantRecord = {
        tenant_id: randomUUID(),
        ...tenantData,
        email: tenantData.email.toLowerCase(),
        tenant_url: tenantData.tenant_url.toLowerCase(),
        status: 'Pending',
        created_at: now,
        updated_at: now,
      };

      // Check if tenant_url is already taken
      const existingTenant = await this.getTenantByUrl(tenantData.tenant_url.toLowerCase(), correlationId);
      if (existingTenant.found) {
        throw createApiError('Conflict', 'Tenant URL is already taken');
      }

      // Validate the record before saving
      const validationResult = TenantRecordSchema.safeParse(tenantRecord);
      if (!validationResult.success) {
        logger.error('Invalid tenant record data', { 
          errors: validationResult.error.issues,
          correlationId 
        });
        throw createApiError('ValidationError', 'Invalid tenant record data');
      }

      await this.putItem(this.tables.tenants, validationResult.data, correlationId);
      
      return { 
        success: true, 
        data: validationResult.data,
        correlationId 
      };
    } catch (error) {
      logger.error('Failed to create tenant', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId 
      });
      throw error;
    }
  }

  async updateTenant(tenantId: string, updates: TenantUpdate, correlationId?: string): Promise<DatabaseOperationResult<TenantRecord>> {
    try {
      // Add updated_at timestamp and normalize email if provided
      const updatesWithTimestamp = {
        ...updates,
        ...(updates.email && { email: updates.email.toLowerCase() }),
        updated_at: new Date().toISOString(),
      };

      const updateExpression = 'SET ' + Object.keys(updatesWithTimestamp).map((key, index) => `#${key} = :val${index}`).join(', ');
      const expressionAttributeNames = Object.keys(updatesWithTimestamp).reduce((acc, key) => {
        acc[`#${key}`] = key;
        return acc;
      }, {} as Record<string, string>);
      const expressionAttributeValues = Object.keys(updatesWithTimestamp).reduce((acc, key, index) => {
        acc[`:val${index}`] = updatesWithTimestamp[key as keyof typeof updatesWithTimestamp];
        return acc;
      }, {} as Record<string, any>);

      const result = await this.updateItem(
        this.tables.tenants,
        { tenant_id: tenantId },
        updateExpression,
        expressionAttributeValues,
        expressionAttributeNames,
        correlationId
      );

      if (!result) {
        throw createApiError('NotFound', 'Tenant not found');
      }

      // Validate the updated record
      const validationResult = TenantRecordSchema.safeParse(result);
      if (!validationResult.success) {
        logger.error('Invalid tenant record after update', { 
          tenantId, 
          errors: validationResult.error.errors,
          correlationId 
        });
        throw createApiError('InternalError', 'Invalid tenant record after update');
      }

      return { 
        success: true, 
        data: validationResult.data,
        correlationId 
      };
    } catch (error) {
      logger.error('Failed to update tenant', { 
        tenantId, 
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId 
      });
      throw error;
    }
  }

  // Cluster data access methods with CIDR validation
  async getCluster(clusterId: string, correlationId?: string): Promise<ClusterQueryResult> {
    try {
      const item = await this.getItem(this.tables.clusters, { cluster_id: clusterId }, correlationId);
      
      if (!item) {
        return { found: false };
      }

      const validationResult = ClusterRecordSchema.safeParse(item);
      if (!validationResult.success) {
        logger.error('Invalid cluster record format in database', { 
          clusterId, 
          errors: validationResult.error.errors,
          correlationId 
        });
        throw createApiError('InternalError', 'Invalid cluster record format');
      }

      return { cluster: validationResult.data, found: true };
    } catch (error) {
      logger.error('Failed to get cluster', { 
        clusterId, 
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId 
      });
      throw error;
    }
  }

  async getAllClusters(correlationId?: string): Promise<ClusterRecord[]> {
    try {
      logger.info('DynamoDB Scan operation for all clusters', { 
        tableName: this.tables.clusters,
        correlationId 
      });

      // Use scan to get all clusters - in production, consider pagination
      const scanCommand = new ScanCommand({
        TableName: this.tables.clusters,
      });

      const result = await this.client.send(scanCommand);
      
      logger.info('DynamoDB Scan completed', { 
        tableName: this.tables.clusters,
        itemCount: result.Items?.length || 0,
        correlationId 
      });

      if (!result.Items) {
        return [];
      }

      // Validate all cluster records, but skip invalid ones instead of failing
      const validClusters: ClusterRecord[] = [];
      for (const item of result.Items) {
        try {
          const validationResult = ClusterRecordSchema.safeParse(item);
          if (validationResult.success) {
            validClusters.push(validationResult.data);
          } else {
            logger.warn('Invalid cluster record found during scan, skipping', { 
              clusterId: item.cluster_id,
              errors: validationResult.error.errors,
              correlationId 
            });
          }
        } catch (validationError) {
          logger.warn('Schema validation failed for cluster record, skipping', { 
            clusterId: item.cluster_id,
            error: validationError instanceof Error ? validationError.message : 'Unknown validation error',
            correlationId 
          });
        }
      }

      return validClusters;
    } catch (error) {
      logger.error('Failed to get all clusters', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId 
      });
      throw error;
    }
  }

  async getClustersByType(clusterType: 'shared' | 'dedicated', correlationId?: string): Promise<ClusterRecord[]> {
    try {
      logger.info('Getting clusters by type', { 
        clusterType,
        tableName: this.tables.clusters,
        correlationId 
      });

      // Use scan with filter expression to get clusters by type
      const scanCommand = new ScanCommand({
        TableName: this.tables.clusters,
        FilterExpression: '#type = :type AND #status = :status',
        ExpressionAttributeNames: {
          '#type': 'type',
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':type': clusterType,
          ':status': 'Active' // Only return active clusters
        }
      });

      const result = await this.client.send(scanCommand);
      
      logger.info('DynamoDB Scan by type completed', { 
        clusterType,
        tableName: this.tables.clusters,
        itemCount: result.Items?.length || 0,
        correlationId 
      });

      if (!result.Items) {
        return [];
      }

      // Validate all cluster records
      const validClusters: ClusterRecord[] = [];
      for (const item of result.Items) {
        try {
          const validationResult = ClusterRecordSchema.safeParse(item);
          if (validationResult.success) {
            validClusters.push(validationResult.data);
          } else {
            logger.warn('Invalid cluster record found during type scan, skipping', { 
              clusterId: item.cluster_id,
              clusterType,
              errors: validationResult.error.errors,
              correlationId 
            });
          }
        } catch (validationError) {
          logger.warn('Schema validation failed for cluster record during type scan, skipping', { 
            clusterId: item.cluster_id,
            clusterType,
            error: validationError instanceof Error ? validationError.message : 'Unknown validation error',
            correlationId 
          });
        }
      }

      return validClusters;
    } catch (error) {
      logger.error('Failed to get clusters by type', { 
        clusterType,
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId 
      });
      throw error;
    }
  }

  async createCluster(clusterData: Omit<ClusterRecord, 'cluster_id' | 'created_at' | 'updated_at'>, correlationId?: string): Promise<DatabaseOperationResult<ClusterRecord>> {
    try {
      // Get all existing clusters for CIDR overlap checking (without schema validation)
      const scanCommand = new ScanCommand({
        TableName: this.tables.clusters,
      });

      const scanResult = await this.client.send(scanCommand);
      const existingCidrs = (scanResult.Items || [])
        .map(item => item.cidr)
        .filter(cidr => typeof cidr === 'string');

      // Validate CIDR and check for overlaps
      const cidrValidation = validateCIDRWithOverlapCheck(clusterData.cidr, existingCidrs);
      if (!cidrValidation.valid) {
        logger.warn('CIDR validation failed for new cluster', { 
          cidr: clusterData.cidr,
          error: cidrValidation.error,
          overlaps: cidrValidation.overlaps,
          correlationId 
        });
        throw createApiError('Conflict', cidrValidation.error || 'CIDR validation failed');
      }

      const now = new Date().toISOString();
      const clusterRecord: ClusterRecord = {
        cluster_id: randomUUID(),
        ...clusterData,
        created_at: now,
        updated_at: now,
      };

      // Validate the record before saving
      const validationResult = ClusterRecordSchema.safeParse(clusterRecord);
      if (!validationResult.success) {
        logger.error('Invalid cluster record data', { 
          errors: validationResult.error.errors,
          correlationId 
        });
        throw createApiError('ValidationError', 'Invalid cluster record data');
      }

      await this.putItem(this.tables.clusters, validationResult.data, correlationId);
      
      return { 
        success: true, 
        data: validationResult.data,
        correlationId 
      };
    } catch (error) {
      logger.error('Failed to create cluster', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId 
      });
      
      if (error instanceof Error && (error.message.includes('overlap') || error.message.includes('CIDR'))) {
        return { 
          success: false, 
          error: error.message,
          correlationId 
        };
      }
      
      throw error;
    }
  }

  async updateCluster(clusterId: string, updates: ClusterUpdate, correlationId?: string): Promise<DatabaseOperationResult<ClusterRecord>> {
    try {
      // Add updated_at timestamp
      const updatesWithTimestamp = {
        ...updates,
        updated_at: new Date().toISOString(),
      };

      const updateExpression = 'SET ' + Object.keys(updatesWithTimestamp).map((key, index) => `#${key} = :val${index}`).join(', ');
      const expressionAttributeNames = Object.keys(updatesWithTimestamp).reduce((acc, key) => {
        acc[`#${key}`] = key;
        return acc;
      }, {} as Record<string, string>);
      const expressionAttributeValues = Object.keys(updatesWithTimestamp).reduce((acc, key, index) => {
        acc[`:val${index}`] = updatesWithTimestamp[key as keyof typeof updatesWithTimestamp];
        return acc;
      }, {} as Record<string, any>);

      const result = await this.updateItem(
        this.tables.clusters,
        { cluster_id: clusterId },
        updateExpression,
        expressionAttributeValues,
        expressionAttributeNames,
        correlationId
      );

      if (!result) {
        throw createApiError('NotFound', 'Cluster not found');
      }

      // Validate the updated record
      const validationResult = ClusterRecordSchema.safeParse(result);
      if (!validationResult.success) {
        logger.error('Invalid cluster record after update', { 
          clusterId, 
          errors: validationResult.error.errors,
          correlationId 
        });
        throw createApiError('InternalError', 'Invalid cluster record after update');
      }

      return { 
        success: true, 
        data: validationResult.data,
        correlationId 
      };
    } catch (error) {
      logger.error('Failed to update cluster', { 
        clusterId, 
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId 
      });
      throw error;
    }
  }

  async deleteCluster(clusterId: string, correlationId?: string): Promise<void> {
    return this.deleteItem(this.tables.clusters, { cluster_id: clusterId }, correlationId);
  }
}

// Export singleton instance (lazy initialization)
let dynamoDBHelperInstance: DynamoDBHelper | null = null;
export const dynamoDBHelper = {
  get instance(): DynamoDBHelper {
    if (!dynamoDBHelperInstance) {
      dynamoDBHelperInstance = new DynamoDBHelper();
    }
    return dynamoDBHelperInstance;
  },
  
  // Proxy methods for convenience
  getItem: (tableName: string, key: Record<string, any>, correlationId?: string) => 
    dynamoDBHelper.instance.getItem(tableName, key, correlationId),
  putItem: (tableName: string, item: Record<string, any>, correlationId?: string) => 
    dynamoDBHelper.instance.putItem(tableName, item, correlationId),
  updateItem: (tableName: string, key: Record<string, any>, updateExpression: string, expressionAttributeValues: Record<string, any>, expressionAttributeNames?: Record<string, string>, correlationId?: string) => 
    dynamoDBHelper.instance.updateItem(tableName, key, updateExpression, expressionAttributeValues, expressionAttributeNames, correlationId),
  deleteItem: (tableName: string, key: Record<string, any>, correlationId?: string) => 
    dynamoDBHelper.instance.deleteItem(tableName, key, correlationId),
  queryItems: (tableName: string, keyConditionExpression: string, expressionAttributeValues: Record<string, any>, indexName?: string, expressionAttributeNames?: Record<string, string>, correlationId?: string) => 
    dynamoDBHelper.instance.queryItems(tableName, keyConditionExpression, expressionAttributeValues, indexName, expressionAttributeNames, correlationId),
  
  // Staff methods
  getStaffById: (staffId: string, correlationId?: string) => 
    dynamoDBHelper.instance.getStaffById(staffId, correlationId),
  getStaffByEmail: (email: string, correlationId?: string) => 
    dynamoDBHelper.instance.getStaffByEmail(email, correlationId),
  createStaff: (staffData: Omit<StaffRecord, 'staff_id' | 'created_at' | 'updated_at'>, correlationId?: string) => 
    dynamoDBHelper.instance.createStaff(staffData, correlationId),
  updateStaff: (staffId: string, updates: StaffUpdate, correlationId?: string) => 
    dynamoDBHelper.instance.updateStaff(staffId, updates, correlationId),
  updateStaffPassword: (staffId: string, passwordHash: string, correlationId?: string) => 
    dynamoDBHelper.instance.updateStaffPassword(staffId, passwordHash, correlationId),
  
  // Password reset token methods
  getPasswordResetToken: (tokenHash: string, correlationId?: string) => 
    dynamoDBHelper.instance.getPasswordResetToken(tokenHash, correlationId),
  createPasswordResetToken: (tokenData: Omit<PasswordResetToken, 'created_at'>, correlationId?: string) => 
    dynamoDBHelper.instance.createPasswordResetToken(tokenData, correlationId),
  markPasswordResetTokenUsed: (tokenHash: string, correlationId?: string) => 
    dynamoDBHelper.instance.markPasswordResetTokenUsed(tokenHash, correlationId),
  deletePasswordResetToken: (tokenHash: string, correlationId?: string) => 
    dynamoDBHelper.instance.deletePasswordResetToken(tokenHash, correlationId),
  
  // Tenant methods
  getTenant: (tenantId: string, correlationId?: string) => 
    dynamoDBHelper.instance.getTenant(tenantId, correlationId),
  getTenantByUrl: (tenantUrl: string, correlationId?: string) => 
    dynamoDBHelper.instance.getTenantByUrl(tenantUrl, correlationId),
  createTenant: (tenantData: Omit<TenantRecord, 'tenant_id' | 'status' | 'created_at' | 'updated_at'>, correlationId?: string) => 
    dynamoDBHelper.instance.createTenant(tenantData, correlationId),
  updateTenant: (tenantId: string, updates: TenantUpdate, correlationId?: string) => 
    dynamoDBHelper.instance.updateTenant(tenantId, updates, correlationId),

  // Cluster methods
  getCluster: (clusterId: string, correlationId?: string) => 
    dynamoDBHelper.instance.getCluster(clusterId, correlationId),
  getAllClusters: (correlationId?: string) => 
    dynamoDBHelper.instance.getAllClusters(correlationId),
  getClustersByType: (clusterType: 'shared' | 'dedicated', correlationId?: string) => 
    dynamoDBHelper.instance.getClustersByType(clusterType, correlationId),
  createCluster: (clusterData: Omit<ClusterRecord, 'cluster_id' | 'created_at' | 'updated_at'>, correlationId?: string) => 
    dynamoDBHelper.instance.createCluster(clusterData, correlationId),
  updateCluster: (clusterId: string, updates: ClusterUpdate, correlationId?: string) => 
    dynamoDBHelper.instance.updateCluster(clusterId, updates, correlationId),
  deleteCluster: (clusterId: string, correlationId?: string) => 
    dynamoDBHelper.instance.deleteCluster(clusterId, correlationId),
};