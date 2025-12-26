import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { getConfig } from './config.js';
import { logger } from './logging.js';

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

  // Convenience methods for specific tables
  async getStaffById(staffId: string, correlationId?: string) {
    return this.getItem(this.tables.staff, { staff_id: staffId }, correlationId);
  }

  async getStaffByEmail(email: string, correlationId?: string) {
    const items = await this.queryItems(
      this.tables.staff,
      'email = :email',
      { ':email': email.toLowerCase() },
      'EmailIndex',
      undefined,
      correlationId
    );
    return items[0] || null;
  }

  async createStaff(staffData: any, correlationId?: string) {
    return this.putItem(this.tables.staff, staffData, correlationId);
  }

  async updateStaff(staffId: string, updates: Record<string, any>, correlationId?: string) {
    const updateExpression = 'SET ' + Object.keys(updates).map((key, index) => `#${key} = :val${index}`).join(', ');
    const expressionAttributeNames = Object.keys(updates).reduce((acc, key) => {
      acc[`#${key}`] = key;
      return acc;
    }, {} as Record<string, string>);
    const expressionAttributeValues = Object.keys(updates).reduce((acc, key, index) => {
      acc[`:val${index}`] = updates[key];
      return acc;
    }, {} as Record<string, any>);

    return this.updateItem(
      this.tables.staff,
      { staff_id: staffId },
      updateExpression,
      expressionAttributeValues,
      expressionAttributeNames,
      correlationId
    );
  }

  async getPasswordResetToken(tokenHash: string, correlationId?: string) {
    return this.getItem(this.tables.passwordResetTokens, { token_hash: tokenHash }, correlationId);
  }

  async createPasswordResetToken(tokenData: any, correlationId?: string) {
    return this.putItem(this.tables.passwordResetTokens, tokenData, correlationId);
  }

  async deletePasswordResetToken(tokenHash: string, correlationId?: string) {
    return this.deleteItem(this.tables.passwordResetTokens, { token_hash: tokenHash }, correlationId);
  }

  async getTenant(tenantId: string, correlationId?: string) {
    return this.getItem(this.tables.tenants, { tenant_id: tenantId }, correlationId);
  }

  async createTenant(tenantData: any, correlationId?: string) {
    return this.putItem(this.tables.tenants, tenantData, correlationId);
  }

  async updateTenant(tenantId: string, updates: Record<string, any>, correlationId?: string) {
    const updateExpression = 'SET ' + Object.keys(updates).map((key, index) => `#${key} = :val${index}`).join(', ');
    const expressionAttributeNames = Object.keys(updates).reduce((acc, key) => {
      acc[`#${key}`] = key;
      return acc;
    }, {} as Record<string, string>);
    const expressionAttributeValues = Object.keys(updates).reduce((acc, key, index) => {
      acc[`:val${index}`] = updates[key];
      return acc;
    }, {} as Record<string, any>);

    return this.updateItem(
      this.tables.tenants,
      { tenant_id: tenantId },
      updateExpression,
      expressionAttributeValues,
      expressionAttributeNames,
      correlationId
    );
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
  getStaffById: (staffId: string, correlationId?: string) => 
    dynamoDBHelper.instance.getStaffById(staffId, correlationId),
  getStaffByEmail: (email: string, correlationId?: string) => 
    dynamoDBHelper.instance.getStaffByEmail(email, correlationId),
  createStaff: (staffData: any, correlationId?: string) => 
    dynamoDBHelper.instance.createStaff(staffData, correlationId),
  updateStaff: (staffId: string, updates: Record<string, any>, correlationId?: string) => 
    dynamoDBHelper.instance.updateStaff(staffId, updates, correlationId),
  getPasswordResetToken: (tokenHash: string, correlationId?: string) => 
    dynamoDBHelper.instance.getPasswordResetToken(tokenHash, correlationId),
  createPasswordResetToken: (tokenData: any, correlationId?: string) => 
    dynamoDBHelper.instance.createPasswordResetToken(tokenData, correlationId),
  deletePasswordResetToken: (tokenHash: string, correlationId?: string) => 
    dynamoDBHelper.instance.deletePasswordResetToken(tokenHash, correlationId),
  getTenant: (tenantId: string, correlationId?: string) => 
    dynamoDBHelper.instance.getTenant(tenantId, correlationId),
  createTenant: (tenantData: any, correlationId?: string) => 
    dynamoDBHelper.instance.createTenant(tenantData, correlationId),
  updateTenant: (tenantId: string, updates: Record<string, any>, correlationId?: string) => 
    dynamoDBHelper.instance.updateTenant(tenantId, updates, correlationId),
};