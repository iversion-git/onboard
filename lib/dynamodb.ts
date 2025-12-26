import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { getConfig } from './config.js';
import { logger } from './logging.js';
import { 
  StaffRecord, 
  PasswordResetToken, 
  TenantRecord,
  StaffRecordSchema,
  PasswordResetTokenSchema,
  TenantRecordSchema,
  StaffUpdate,
  TenantUpdate,
  DatabaseOperationResult,
  StaffQueryResult,
  TenantQueryResult,
  PasswordResetTokenQueryResult
} from './data-models.js';
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
          errors: validationResult.error.errors,
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

  async createTenant(tenantData: Omit<TenantRecord, 'tenant_id' | 'created_at' | 'updated_at'>, correlationId?: string): Promise<DatabaseOperationResult<TenantRecord>> {
    try {
      const now = new Date().toISOString();
      const tenantRecord: TenantRecord = {
        tenant_id: randomUUID(),
        ...tenantData,
        email: tenantData.email.toLowerCase(),
        status: 'pending',
        created_at: now,
        updated_at: now,
      };

      // Validate the record before saving
      const validationResult = TenantRecordSchema.safeParse(tenantRecord);
      if (!validationResult.success) {
        logger.error('Invalid tenant record data', { 
          errors: validationResult.error.errors,
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
  createTenant: (tenantData: Omit<TenantRecord, 'tenant_id' | 'created_at' | 'updated_at'>, correlationId?: string) => 
    dynamoDBHelper.instance.createTenant(tenantData, correlationId),
  updateTenant: (tenantId: string, updates: TenantUpdate, correlationId?: string) => 
    dynamoDBHelper.instance.updateTenant(tenantId, updates, correlationId),
};