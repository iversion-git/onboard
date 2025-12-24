import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { createLoggerFromCorrelationId } from '../logging.js';

// Create a logger instance for DynamoDB operations
const logger = createLoggerFromCorrelationId('dynamodb-client', 'aws-integration');

/**
 * DynamoDB client factory with retry patterns and table name resolution
 */
export class DynamoDBClientFactory {
  private static client: DynamoDBDocumentClient | null = null;
  private static stage: string;

  /**
   * Initialize the DynamoDB client with retry configuration
   */
  static initialize(stage: string = process.env['STAGE'] || 'dev'): DynamoDBDocumentClient {
    if (!this.client) {
      this.stage = stage;
      
      const dynamoClient = new DynamoDBClient({
        region: process.env['AWS_REGION'] || 'us-east-1',
        maxAttempts: 3,
        retryMode: 'adaptive'
      });

      this.client = DynamoDBDocumentClient.from(dynamoClient, {
        marshallOptions: {
          convertEmptyValues: false,
          removeUndefinedValues: true,
          convertClassInstanceToMap: false
        },
        unmarshallOptions: {
          wrapNumbers: false
        }
      });

      logger.info('DynamoDB client initialized', { stage: this.stage });
    }

    return this.client;
  }

  /**
   * Get the DynamoDB client instance
   */
  static getClient(): DynamoDBDocumentClient {
    if (!this.client) {
      return this.initialize();
    }
    return this.client;
  }

  /**
   * Resolve table name with stage prefix
   */
  static getTableName(baseTableName: string): string {
    return `${baseTableName}-${this.stage || process.env['STAGE'] || 'dev'}`;
  }
}

/**
 * DynamoDB query helpers with consistent error handling
 */
export class DynamoDBHelpers {
  private static client = DynamoDBClientFactory.getClient();

  /**
   * Get item by primary key
   */
  static async getItem<T>(tableName: string, key: Record<string, any>): Promise<T | null> {
    try {
      const command = new GetCommand({
        TableName: DynamoDBClientFactory.getTableName(tableName),
        Key: key
      });

      const result = await this.client.send(command);
      return result.Item as T || null;
    } catch (error) {
      logger.error('DynamoDB getItem failed', { tableName, key, error });
      throw error;
    }
  }

  /**
   * Put item with automatic timestamps
   */
  static async putItem<T extends Record<string, any>>(
    tableName: string, 
    item: T, 
    options: { addTimestamps?: boolean } = { addTimestamps: true }
  ): Promise<void> {
    try {
      const itemWithTimestamps = options.addTimestamps 
        ? {
            ...item,
            created_at: item['created_at'] || new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        : item;

      const command = new PutCommand({
        TableName: DynamoDBClientFactory.getTableName(tableName),
        Item: itemWithTimestamps
      });

      await this.client.send(command);
      logger.debug('DynamoDB putItem successful', { tableName, itemId: item['id'] || 'unknown' });
    } catch (error) {
      logger.error('DynamoDB putItem failed', { tableName, item, error });
      throw error;
    }
  }

  /**
   * Update item with automatic updated_at timestamp
   */
  static async updateItem(
    tableName: string,
    key: Record<string, any>,
    updateExpression: string,
    expressionAttributeValues: Record<string, any>,
    expressionAttributeNames?: Record<string, string>
  ): Promise<void> {
    try {
      const command = new UpdateCommand({
        TableName: DynamoDBClientFactory.getTableName(tableName),
        Key: key,
        UpdateExpression: `${updateExpression}, updated_at = :updated_at`,
        ExpressionAttributeValues: {
          ...expressionAttributeValues,
          ':updated_at': new Date().toISOString()
        },
        ExpressionAttributeNames: expressionAttributeNames
      });

      await this.client.send(command);
      logger.debug('DynamoDB updateItem successful', { tableName, key });
    } catch (error) {
      logger.error('DynamoDB updateItem failed', { tableName, key, error });
      throw error;
    }
  }

  /**
   * Query items with GSI support
   */
  static async queryItems<T>(
    tableName: string,
    keyConditionExpression: string,
    expressionAttributeValues: Record<string, any>,
    options: {
      indexName?: string;
      expressionAttributeNames?: Record<string, string>;
      limit?: number;
      scanIndexForward?: boolean;
    } = {}
  ): Promise<T[]> {
    try {
      const command = new QueryCommand({
        TableName: DynamoDBClientFactory.getTableName(tableName),
        KeyConditionExpression: keyConditionExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        IndexName: options.indexName,
        ExpressionAttributeNames: options.expressionAttributeNames,
        Limit: options.limit,
        ScanIndexForward: options.scanIndexForward
      });

      const result = await this.client.send(command);
      return (result.Items as T[]) || [];
    } catch (error) {
      logger.error('DynamoDB queryItems failed', { tableName, keyConditionExpression, error });
      throw error;
    }
  }

  /**
   * Delete item
   */
  static async deleteItem(tableName: string, key: Record<string, any>): Promise<void> {
    try {
      const command = new DeleteCommand({
        TableName: DynamoDBClientFactory.getTableName(tableName),
        Key: key
      });

      await this.client.send(command);
      logger.debug('DynamoDB deleteItem successful', { tableName, key });
    } catch (error) {
      logger.error('DynamoDB deleteItem failed', { tableName, key, error });
      throw error;
    }
  }
}