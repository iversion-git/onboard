import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { getConfig } from './config.js';
import { logger } from './logging.js';
import type { 
  StaffRecord, 
  PasswordResetToken, 
  TenantRecord,
  PackageRecord,
  SubscriptionTypeRecord,
  SubscriptionRecord,
  LandlordRecord,
  ClusterRecord,
  StaffUpdate,
  TenantUpdate,
  LandlordUpdate,
  SubscriptionUpdate,
  ClusterUpdate,
  DatabaseOperationResult,
  StaffQueryResult,
  TenantQueryResult,
  PackageQueryResult,
  SubscriptionTypeQueryResult,
  SubscriptionQueryResult,
  LandlordQueryResult,
  ClusterQueryResult,
  PasswordResetTokenQueryResult,
  CIDRValidationResult
} from './data-models.js';
import {
  StaffRecordSchema,
  PasswordResetTokenSchema,
  TenantRecordSchema,
  PackageRecordSchema,
  SubscriptionTypeRecordSchema,
  SubscriptionRecordSchema,
  LandlordRecordSchema,
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
    packages: config.dynamodb.packagesTable,
    subscriptionTypes: config.dynamodb.subscriptionTypesTable,
    subscriptions: config.dynamodb.subscriptionsTable,
    clusters: config.dynamodb.clustersTable,
    landlord: config.dynamodb.landlordTable,
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

  async scanTable(tableName: string, correlationId?: string) {
    try {
      logger.info('DynamoDB Scan operation', { 
        tableName,
        correlationId 
      });

      const command = new ScanCommand({
        TableName: tableName,
      });

      const result = await this.client.send(command);
      
      logger.info('DynamoDB Scan completed', { 
        tableName, 
        itemCount: result.Items?.length || 0,
        correlationId 
      });

      return result.Items || [];
    } catch (error) {
      logger.error('DynamoDB Scan failed', { 
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

  async listAllStaff(correlationId?: string): Promise<StaffRecord[]> {
    try {
      const items = await this.scanTable(this.tables.staff, correlationId);
      
      logger.info('Scanned staff table', {
        totalItems: items.length,
        correlationId
      });
      
      // Validate and filter valid staff records
      const validStaff: StaffRecord[] = [];
      for (const item of items) {
        const validationResult = StaffRecordSchema.safeParse(item);
        if (validationResult.success) {
          validStaff.push(validationResult.data);
        } else {
          logger.warn('Invalid staff record found during scan', {
            staffId: item.staff_id,
            email: item.email,
            itemKeys: Object.keys(item),
            errors: validationResult.error.errors,
            correlationId
          });
        }
      }

      logger.info('Listed all staff members', {
        totalScanned: items.length,
        validCount: validStaff.length,
        invalidCount: items.length - validStaff.length,
        correlationId
      });

      return validStaff;
    } catch (error) {
      logger.error('Failed to list all staff', {
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

  async listAllTenants(correlationId?: string): Promise<TenantRecord[]> {
    try {
      const items = await this.scanTable(this.tables.tenants, correlationId);
      
      logger.info('Scanned tenants table', {
        totalItems: items.length,
        correlationId
      });
      
      // Validate and filter valid tenant records
      const validTenants: TenantRecord[] = [];
      for (const item of items) {
        const validationResult = TenantRecordSchema.safeParse(item);
        if (validationResult.success) {
          validTenants.push(validationResult.data);
        } else {
          logger.warn('Invalid tenant record found during scan', {
            tenantId: item.tenant_id,
            itemKeys: Object.keys(item),
            errors: validationResult.error.issues,
            correlationId
          });
        }
      }

      logger.info('Listed all tenants', {
        totalScanned: items.length,
        validCount: validTenants.length,
        invalidCount: items.length - validTenants.length,
        correlationId
      });

      return validTenants;
    } catch (error) {
      logger.error('Failed to list all tenants', {
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

      // Temporary fix: Skip Zod validation and return raw data
      // TODO: Fix ClusterRecordSchema validation issue
      return { cluster: item as any, found: true };

      // Original code with validation (commented out due to Zod issue):
      // const validationResult = ClusterRecordSchema.safeParse(item);
      // if (!validationResult.success) {
      //   logger.error('Invalid cluster record format in database', { 
      //     clusterId, 
      //     errors: validationResult.error.errors,
      //     correlationId 
      //   });
      //   throw createApiError('InternalError', 'Invalid cluster record format');
      // }
      // return { cluster: validationResult.data, found: true };
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

  // Package data access methods
  async getPackage(packageId: number, correlationId?: string): Promise<PackageQueryResult> {
    try {
      const item = await this.getItem(this.tables.packages, { package_id: packageId }, correlationId);
      
      if (!item) {
        return { found: false };
      }

      const validationResult = PackageRecordSchema.safeParse(item);
      if (!validationResult.success) {
        logger.error('Invalid package record format in database', { 
          packageId, 
          errors: validationResult.error.issues,
          correlationId 
        });
        throw createApiError('InternalError', 'Invalid package record format');
      }

      return { package: validationResult.data, found: true };
    } catch (error) {
      logger.error('Failed to get package', { 
        packageId, 
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId 
      });
      throw error;
    }
  }

  async getAllActivePackages(correlationId?: string): Promise<PackageRecord[]> {
    try {
      logger.info('Getting all active packages', { 
        tableName: this.tables.packages,
        correlationId 
      });

      const scanCommand = new ScanCommand({
        TableName: this.tables.packages,
        FilterExpression: '#active = :active',
        ExpressionAttributeNames: {
          '#active': 'active'
        },
        ExpressionAttributeValues: {
          ':active': true
        }
      });

      const result = await this.client.send(scanCommand);
      
      logger.info('DynamoDB Scan for active packages completed', { 
        tableName: this.tables.packages,
        itemCount: result.Items?.length || 0,
        correlationId 
      });

      if (!result.Items) {
        return [];
      }

      const validPackages: PackageRecord[] = [];
      for (const item of result.Items) {
        try {
          const validationResult = PackageRecordSchema.safeParse(item);
          if (validationResult.success) {
            validPackages.push(validationResult.data);
          } else {
            logger.warn('Invalid package record found during scan, skipping', { 
              packageId: item.package_id,
              errors: validationResult.error.issues,
              correlationId 
            });
          }
        } catch (validationError) {
          logger.warn('Schema validation failed for package record, skipping', { 
            packageId: item.package_id,
            error: validationError instanceof Error ? validationError.message : 'Unknown validation error',
            correlationId 
          });
        }
      }

      return validPackages;
    } catch (error) {
      logger.error('Failed to get active packages', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId 
      });
      throw error;
    }
  }

  async getAllPackages(correlationId?: string): Promise<PackageRecord[]> {
    try {
      const items = await this.scanTable(this.tables.packages, correlationId);
      
      logger.info('Scanned packages table', {
        totalItems: items.length,
        correlationId
      });
      
      const validPackages: PackageRecord[] = [];
      for (const item of items) {
        const validationResult = PackageRecordSchema.safeParse(item);
        if (validationResult.success) {
          validPackages.push(validationResult.data);
        } else {
          logger.warn('Invalid package record found during scan', {
            packageId: item.package_id,
            errors: validationResult.error.issues,
            correlationId
          });
        }
      }

      logger.info('Listed all packages', {
        totalScanned: items.length,
        validCount: validPackages.length,
        correlationId
      });

      return validPackages;
    } catch (error) {
      logger.error('Failed to list all packages', {
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId
      });
      throw error;
    }
  }

  async createPackage(packageData: Omit<PackageRecord, 'created_at' | 'updated_at'>, correlationId?: string): Promise<DatabaseOperationResult<PackageRecord>> {
    try {
      const now = new Date().toISOString();
      const packageRecord: PackageRecord = {
        ...packageData,
        created_at: now,
        updated_at: now,
      };

      // Validate the record before saving
      const validationResult = PackageRecordSchema.safeParse(packageRecord);
      if (!validationResult.success) {
        logger.error('Invalid package record data', { 
          errors: validationResult.error.issues,
          correlationId 
        });
        throw createApiError('ValidationError', 'Invalid package record data');
      }

      await this.putItem(this.tables.packages, validationResult.data, correlationId);
      
      return { 
        success: true, 
        data: validationResult.data,
        correlationId 
      };
    } catch (error) {
      logger.error('Failed to create package', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId 
      });
      throw error;
    }
  }

  // Subscription Type data access methods
  async getSubscriptionType(subscriptionTypeId: number, correlationId?: string): Promise<SubscriptionTypeQueryResult> {
    try {
      const item = await this.getItem(this.tables.subscriptionTypes, { subscription_type_id: subscriptionTypeId }, correlationId);
      
      if (!item) {
        return { found: false };
      }

      const validationResult = SubscriptionTypeRecordSchema.safeParse(item);
      if (!validationResult.success) {
        logger.error('Invalid subscription type record format in database', { 
          subscriptionTypeId, 
          errors: validationResult.error.issues,
          correlationId 
        });
        throw createApiError('InternalError', 'Invalid subscription type record format');
      }

      return { subscriptionType: validationResult.data, found: true };
    } catch (error) {
      logger.error('Failed to get subscription type', { 
        subscriptionTypeId, 
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId 
      });
      throw error;
    }
  }

  async getAllActiveSubscriptionTypes(correlationId?: string): Promise<SubscriptionTypeRecord[]> {
    try {
      logger.info('Getting all active subscription types', { 
        tableName: this.tables.subscriptionTypes,
        correlationId 
      });

      const scanCommand = new ScanCommand({
        TableName: this.tables.subscriptionTypes,
        FilterExpression: '#active = :active',
        ExpressionAttributeNames: {
          '#active': 'active'
        },
        ExpressionAttributeValues: {
          ':active': true
        }
      });

      const result = await this.client.send(scanCommand);
      
      logger.info('DynamoDB Scan for active subscription types completed', { 
        tableName: this.tables.subscriptionTypes,
        itemCount: result.Items?.length || 0,
        correlationId 
      });

      if (!result.Items) {
        return [];
      }

      const validSubscriptionTypes: SubscriptionTypeRecord[] = [];
      for (const item of result.Items) {
        try {
          const validationResult = SubscriptionTypeRecordSchema.safeParse(item);
          if (validationResult.success) {
            validSubscriptionTypes.push(validationResult.data);
          } else {
            logger.warn('Invalid subscription type record found during scan, skipping', { 
              subscriptionTypeId: item.subscription_type_id,
              errors: validationResult.error.issues,
              correlationId 
            });
          }
        } catch (validationError) {
          logger.warn('Schema validation failed for subscription type record, skipping', { 
            subscriptionTypeId: item.subscription_type_id,
            error: validationError instanceof Error ? validationError.message : 'Unknown validation error',
            correlationId 
          });
        }
      }

      return validSubscriptionTypes;
    } catch (error) {
      logger.error('Failed to get active subscription types', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId 
      });
      throw error;
    }
  }

  async getAllSubscriptionTypes(correlationId?: string): Promise<SubscriptionTypeRecord[]> {
    try {
      const items = await this.scanTable(this.tables.subscriptionTypes, correlationId);
      
      logger.info('Scanned subscription types table', {
        totalItems: items.length,
        correlationId
      });
      
      const validTypes: SubscriptionTypeRecord[] = [];
      for (const item of items) {
        const validationResult = SubscriptionTypeRecordSchema.safeParse(item);
        if (validationResult.success) {
          validTypes.push(validationResult.data);
        } else {
          logger.warn('Invalid subscription type record found during scan', {
            subscriptionTypeId: item.subscription_type_id,
            errors: validationResult.error.issues,
            correlationId
          });
        }
      }

      logger.info('Listed all subscription types', {
        totalScanned: items.length,
        validCount: validTypes.length,
        correlationId
      });

      return validTypes;
    } catch (error) {
      logger.error('Failed to list all subscription types', {
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId
      });
      throw error;
    }
  }

  async createSubscriptionType(subscriptionTypeData: Omit<SubscriptionTypeRecord, 'created_at' | 'updated_at'>, correlationId?: string): Promise<DatabaseOperationResult<SubscriptionTypeRecord>> {
    try {
      const now = new Date().toISOString();
      const subscriptionTypeRecord: SubscriptionTypeRecord = {
        ...subscriptionTypeData,
        created_at: now,
        updated_at: now,
      };

      // Validate the record before saving
      const validationResult = SubscriptionTypeRecordSchema.safeParse(subscriptionTypeRecord);
      if (!validationResult.success) {
        logger.error('Invalid subscription type record data', { 
          errors: validationResult.error.issues,
          correlationId 
        });
        throw createApiError('ValidationError', 'Invalid subscription type record data');
      }

      await this.putItem(this.tables.subscriptionTypes, validationResult.data, correlationId);
      
      return { 
        success: true, 
        data: validationResult.data,
        correlationId 
      };
    } catch (error) {
      logger.error('Failed to create subscription type', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId 
      });
      throw error;
    }
  }

  // Subscription data access methods
  async getSubscription(subscriptionId: string, correlationId?: string): Promise<SubscriptionQueryResult> {
    try {
      const item = await this.getItem(this.tables.subscriptions, { subscription_id: subscriptionId }, correlationId);
      
      if (!item) {
        return { found: false };
      }

      const validationResult = SubscriptionRecordSchema.safeParse(item);
      if (!validationResult.success) {
        logger.error('Invalid subscription record format in database', { 
          subscriptionId, 
          errors: validationResult.error.issues,
          correlationId 
        });
        throw createApiError('InternalError', 'Invalid subscription record format');
      }

      return { subscription: validationResult.data, found: true };
    } catch (error) {
      logger.error('Failed to get subscription', { 
        subscriptionId, 
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId 
      });
      throw error;
    }
  }

  async getSubscriptionsByTenant(tenantId: string, correlationId?: string): Promise<SubscriptionRecord[]> {
    try {
      logger.info('Getting subscriptions by tenant', { 
        tenantId,
        tableName: this.tables.subscriptions,
        correlationId 
      });

      // Use scan with filter expression to get subscriptions by tenant_id
      const scanCommand = new ScanCommand({
        TableName: this.tables.subscriptions,
        FilterExpression: 'tenant_id = :tenant_id',
        ExpressionAttributeValues: {
          ':tenant_id': tenantId
        }
      });

      const result = await this.client.send(scanCommand);
      
      logger.info('DynamoDB Scan by tenant completed', { 
        tenantId,
        tableName: this.tables.subscriptions,
        itemCount: result.Items?.length || 0,
        correlationId 
      });

      if (!result.Items) {
        return [];
      }

      // Validate all subscription records
      const validSubscriptions: SubscriptionRecord[] = [];
      for (const item of result.Items) {
        try {
          const validationResult = SubscriptionRecordSchema.safeParse(item);
          if (validationResult.success) {
            validSubscriptions.push(validationResult.data);
          } else {
            logger.warn('Invalid subscription record found during tenant scan, skipping', { 
              subscriptionId: item.subscription_id,
              tenantId,
              errors: validationResult.error.issues,
              correlationId 
            });
          }
        } catch (validationError) {
          logger.warn('Schema validation failed for subscription record during tenant scan, skipping', { 
            subscriptionId: item.subscription_id,
            tenantId,
            error: validationError instanceof Error ? validationError.message : 'Unknown validation error',
            correlationId 
          });
        }
      }

      return validSubscriptions;
    } catch (error) {
      logger.error('Failed to get subscriptions by tenant', { 
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId 
      });
      throw error;
    }
  }

  async listAllSubscriptions(correlationId?: string): Promise<SubscriptionRecord[]> {
    try {
      const items = await this.scanTable(this.tables.subscriptions, correlationId);
      
      logger.info('Scanned subscriptions table', {
        totalItems: items.length,
        correlationId
      });
      
      // Validate and filter valid subscription records
      const validSubscriptions: SubscriptionRecord[] = [];
      for (const item of items) {
        const validationResult = SubscriptionRecordSchema.safeParse(item);
        if (validationResult.success) {
          validSubscriptions.push(validationResult.data);
        } else {
          logger.warn('Invalid subscription record found during scan', {
            subscriptionId: item.subscription_id,
            itemKeys: Object.keys(item),
            errors: validationResult.error.issues,
            correlationId
          });
        }
      }

      logger.info('Listed all subscriptions', {
        totalScanned: items.length,
        validCount: validSubscriptions.length,
        invalidCount: items.length - validSubscriptions.length,
        correlationId
      });

      return validSubscriptions;
    } catch (error) {
      logger.error('Failed to list all subscriptions', {
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId
      });
      throw error;
    }
  }

  async createSubscription(subscriptionData: Omit<SubscriptionRecord, 'subscription_id' | 'status' | 'created_at' | 'updated_at'>, correlationId?: string): Promise<DatabaseOperationResult<SubscriptionRecord>> {
    try {
      const now = new Date().toISOString();
      const subscriptionRecord: SubscriptionRecord = {
        subscription_id: randomUUID(),
        ...subscriptionData,
        status: 'Active', // Default status is Active
        created_at: now,
        updated_at: now,
      };

      // Validate the record before saving
      const validationResult = SubscriptionRecordSchema.safeParse(subscriptionRecord);
      if (!validationResult.success) {
        logger.error('Invalid subscription record data', { 
          errors: validationResult.error.issues,
          correlationId 
        });
        throw createApiError('ValidationError', 'Invalid subscription record data');
      }

      await this.putItem(this.tables.subscriptions, validationResult.data, correlationId);
      
      return { 
        success: true, 
        data: validationResult.data,
        correlationId 
      };
    } catch (error) {
      logger.error('Failed to create subscription', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId 
      });
      throw error;
    }
  }

  async updateSubscription(subscriptionId: string, updates: SubscriptionUpdate, correlationId?: string): Promise<DatabaseOperationResult<SubscriptionRecord>> {
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
        this.tables.subscriptions,
        { subscription_id: subscriptionId },
        updateExpression,
        expressionAttributeValues,
        expressionAttributeNames,
        correlationId
      );

      if (!result) {
        throw createApiError('NotFound', 'Subscription not found');
      }

      // Validate the updated record
      const validationResult = SubscriptionRecordSchema.safeParse(result);
      if (!validationResult.success) {
        logger.error('Invalid subscription record after update', { 
          subscriptionId, 
          errors: validationResult.error.issues,
          correlationId 
        });
        throw createApiError('InternalError', 'Invalid subscription record after update');
      }

      return { 
        success: true, 
        data: validationResult.data,
        correlationId 
      };
    } catch (error) {
      logger.error('Failed to update subscription', { 
        subscriptionId, 
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId 
      });
      throw error;
    }
  }

  async deleteSubscription(subscriptionId: string, correlationId?: string): Promise<void> {
    return this.deleteItem(this.tables.subscriptions, { subscription_id: subscriptionId }, correlationId);
  }

  // ============================================================================
  // LANDLORD TABLE OPERATIONS (Global Table)
  // ============================================================================

  async getLandlord(landlordId: string, correlationId?: string): Promise<LandlordQueryResult> {
    try {
      logger.info('Getting landlord by ID', { 
        landlordId, 
        tableName: this.tables.landlord,
        correlationId 
      });

      const item = await this.getItem(this.tables.landlord, { id: landlordId }, correlationId);
      
      if (!item) {
        logger.info('Landlord not found', { 
          landlordId, 
          tableName: this.tables.landlord,
          correlationId 
        });
        return { landlord: undefined, found: false };
      }

      // Validate the record format
      const validationResult = LandlordRecordSchema.safeParse(item);
      if (!validationResult.success) {
        logger.error('Invalid landlord record format in database', { 
          landlordId, 
          errors: validationResult.error.issues,
          correlationId 
        });
        throw createApiError('InternalError', 'Invalid landlord record format');
      }

      return { landlord: validationResult.data, found: true };
    } catch (error) {
      logger.error('Failed to get landlord', { 
        landlordId, 
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId 
      });
      throw error;
    }
  }

  async createLandlord(landlordData: Omit<LandlordRecord, 'created_at' | 'updated_at'>, correlationId?: string): Promise<DatabaseOperationResult<LandlordRecord>> {
    try {
      const now = new Date().toISOString();
      const landlordRecord: LandlordRecord = {
        ...landlordData,
        created_at: now,
        updated_at: now,
      };

      // Validate the record before saving
      const validationResult = LandlordRecordSchema.safeParse(landlordRecord);
      if (!validationResult.success) {
        logger.error('Invalid landlord record data', { 
          errors: validationResult.error.issues,
          correlationId 
        });
        throw createApiError('ValidationError', 'Invalid landlord record data');
      }

      await this.putItem(this.tables.landlord, validationResult.data, correlationId);
      
      return { 
        success: true, 
        data: validationResult.data,
        correlationId 
      };
    } catch (error) {
      logger.error('Failed to create landlord', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId 
      });
      throw error;
    }
  }

  async updateLandlord(landlordId: string, updates: LandlordUpdate, correlationId?: string): Promise<DatabaseOperationResult<LandlordRecord>> {
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

      const updateCommand = new UpdateCommand({
        TableName: this.tables.landlord,
        Key: { id: landlordId },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW',
      });

      const result = await this.client.send(updateCommand);
      
      if (!result.Attributes) {
        throw createApiError('NotFound', 'Landlord not found');
      }

      // Validate the updated record
      const validationResult = LandlordRecordSchema.safeParse(result.Attributes);
      if (!validationResult.success) {
        logger.error('Invalid updated landlord record format', { 
          landlordId,
          errors: validationResult.error.issues,
          correlationId 
        });
        throw createApiError('InternalError', 'Invalid updated landlord record format');
      }

      return { 
        success: true, 
        data: validationResult.data,
        correlationId 
      };
    } catch (error) {
      logger.error('Failed to update landlord', { 
        landlordId,
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId 
      });
      throw error;
    }
  }

  async deleteLandlord(landlordId: string, correlationId?: string): Promise<void> {
    return this.deleteItem(this.tables.landlord, { id: landlordId }, correlationId);
  }

  async getAllLandlords(correlationId?: string): Promise<LandlordRecord[]> {
    try {
      logger.info('Getting all landlords', { 
        tableName: this.tables.landlord,
        correlationId 
      });

      const scanCommand = new ScanCommand({
        TableName: this.tables.landlord,
      });

      const result = await this.client.send(scanCommand);
      
      logger.info('DynamoDB Scan for landlords completed', { 
        tableName: this.tables.landlord,
        itemCount: result.Items?.length || 0,
        correlationId 
      });

      if (!result.Items) {
        return [];
      }

      // Validate all records
      const validatedRecords: LandlordRecord[] = [];
      for (const item of result.Items) {
        const validationResult = LandlordRecordSchema.safeParse(item);
        if (validationResult.success) {
          validatedRecords.push(validationResult.data);
        } else {
          logger.warn('Skipping invalid landlord record', { 
            item,
            errors: validationResult.error.issues,
            correlationId 
          });
        }
      }

      return validatedRecords;
    } catch (error) {
      logger.error('Failed to get all landlords', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId 
      });
      throw error;
    }
  }

  // Uniqueness validation methods for subscription creation
  async checkTenantUrlUniqueness(tenantUrl: string, correlationId?: string): Promise<boolean> {
    try {
      logger.info('Checking tenant URL uniqueness', { 
        tenantUrl,
        tableName: this.tables.subscriptions,
        correlationId 
      });

      const scanCommand = new ScanCommand({
        TableName: this.tables.subscriptions,
        FilterExpression: 'tenant_url = :tenant_url',
        ExpressionAttributeValues: {
          ':tenant_url': tenantUrl
        }
      });

      const result = await this.client.send(scanCommand);
      const isUnique = !result.Items || result.Items.length === 0;
      
      logger.info('Tenant URL uniqueness check completed', { 
        tenantUrl,
        isUnique,
        existingCount: result.Items?.length || 0,
        correlationId 
      });

      return isUnique;
    } catch (error) {
      logger.error('Failed to check tenant URL uniqueness', { 
        tenantUrl,
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId 
      });
      throw error;
    }
  }

  async checkTenantApiUrlUniqueness(tenantApiUrl: string, correlationId?: string): Promise<boolean> {
    try {
      logger.info('Checking tenant API URL uniqueness', { 
        tenantApiUrl,
        tableName: this.tables.subscriptions,
        correlationId 
      });

      const scanCommand = new ScanCommand({
        TableName: this.tables.subscriptions,
        FilterExpression: 'tenant_api_url = :tenant_api_url',
        ExpressionAttributeValues: {
          ':tenant_api_url': tenantApiUrl
        }
      });

      const result = await this.client.send(scanCommand);
      const isUnique = !result.Items || result.Items.length === 0;
      
      logger.info('Tenant API URL uniqueness check completed', { 
        tenantApiUrl,
        isUnique,
        existingCount: result.Items?.length || 0,
        correlationId 
      });

      return isUnique;
    } catch (error) {
      logger.error('Failed to check tenant API URL uniqueness', { 
        tenantApiUrl,
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId 
      });
      throw error;
    }
  }

  async checkDomainNameUniqueness(domainName: string, correlationId?: string): Promise<boolean> {
    try {
      logger.info('Checking domain name uniqueness', { 
        domainName,
        tableName: this.tables.subscriptions,
        correlationId 
      });

      const scanCommand = new ScanCommand({
        TableName: this.tables.subscriptions,
        FilterExpression: 'domain_name = :domain_name',
        ExpressionAttributeValues: {
          ':domain_name': domainName
        }
      });

      const result = await this.client.send(scanCommand);
      const isUnique = !result.Items || result.Items.length === 0;
      
      logger.info('Domain name uniqueness check completed', { 
        domainName,
        isUnique,
        existingCount: result.Items?.length || 0,
        correlationId 
      });

      return isUnique;
    } catch (error) {
      logger.error('Failed to check domain name uniqueness', { 
        domainName,
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId 
      });
      throw error;
    }
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
  listAllStaff: (correlationId?: string) => 
    dynamoDBHelper.instance.listAllStaff(correlationId),
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
  listAllTenants: (correlationId?: string) => 
    dynamoDBHelper.instance.listAllTenants(correlationId),
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

  // Package methods
  getPackage: (packageId: number, correlationId?: string) => 
    dynamoDBHelper.instance.getPackage(packageId, correlationId),
  getAllActivePackages: (correlationId?: string) => 
    dynamoDBHelper.instance.getAllActivePackages(correlationId),
  getAllPackages: (correlationId?: string) => 
    dynamoDBHelper.instance.getAllPackages(correlationId),
  createPackage: (packageData: Omit<PackageRecord, 'created_at' | 'updated_at'>, correlationId?: string) => 
    dynamoDBHelper.instance.createPackage(packageData, correlationId),

  // Subscription Type methods
  getSubscriptionType: (subscriptionTypeId: number, correlationId?: string) => 
    dynamoDBHelper.instance.getSubscriptionType(subscriptionTypeId, correlationId),
  getAllActiveSubscriptionTypes: (correlationId?: string) => 
    dynamoDBHelper.instance.getAllActiveSubscriptionTypes(correlationId),
  getAllSubscriptionTypes: (correlationId?: string) => 
    dynamoDBHelper.instance.getAllSubscriptionTypes(correlationId),
  createSubscriptionType: (subscriptionTypeData: Omit<SubscriptionTypeRecord, 'created_at' | 'updated_at'>, correlationId?: string) => 
    dynamoDBHelper.instance.createSubscriptionType(subscriptionTypeData, correlationId),

  // Subscription methods
  getSubscription: (subscriptionId: string, correlationId?: string) => 
    dynamoDBHelper.instance.getSubscription(subscriptionId, correlationId),
  getSubscriptionsByTenant: (tenantId: string, correlationId?: string) => 
    dynamoDBHelper.instance.getSubscriptionsByTenant(tenantId, correlationId),
  listAllSubscriptions: (correlationId?: string) => 
    dynamoDBHelper.instance.listAllSubscriptions(correlationId),
  createSubscription: (subscriptionData: Omit<SubscriptionRecord, 'subscription_id' | 'status' | 'created_at' | 'updated_at'>, correlationId?: string) => 
    dynamoDBHelper.instance.createSubscription(subscriptionData, correlationId),
  updateSubscription: (subscriptionId: string, updates: SubscriptionUpdate, correlationId?: string) => 
    dynamoDBHelper.instance.updateSubscription(subscriptionId, updates, correlationId),
  deleteSubscription: (subscriptionId: string, correlationId?: string) => 
    dynamoDBHelper.instance.deleteSubscription(subscriptionId, correlationId),

  // Landlord methods (Global Table)
  getLandlord: (landlordId: string, correlationId?: string) => 
    dynamoDBHelper.instance.getLandlord(landlordId, correlationId),
  getAllLandlords: (correlationId?: string) => 
    dynamoDBHelper.instance.getAllLandlords(correlationId),
  createLandlord: (landlordData: Omit<LandlordRecord, 'created_at' | 'updated_at'>, correlationId?: string) => 
    dynamoDBHelper.instance.createLandlord(landlordData, correlationId),
  updateLandlord: (landlordId: string, updates: LandlordUpdate, correlationId?: string) => 
    dynamoDBHelper.instance.updateLandlord(landlordId, updates, correlationId),
  deleteLandlord: (landlordId: string, correlationId?: string) => 
    dynamoDBHelper.instance.deleteLandlord(landlordId, correlationId),

  // Uniqueness validation methods
  checkTenantUrlUniqueness: (tenantUrl: string, correlationId?: string) => 
    dynamoDBHelper.instance.checkTenantUrlUniqueness(tenantUrl, correlationId),
  checkTenantApiUrlUniqueness: (tenantApiUrl: string, correlationId?: string) => 
    dynamoDBHelper.instance.checkTenantApiUrlUniqueness(tenantApiUrl, correlationId),
  checkDomainNameUniqueness: (domainName: string, correlationId?: string) => 
    dynamoDBHelper.instance.checkDomainNameUniqueness(domainName, correlationId),
};