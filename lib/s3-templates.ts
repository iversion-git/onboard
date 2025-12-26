/**
 * S3 Template Management Module
 * 
 * Provides S3 integration for CloudFormation template storage, retrieval,
 * and versioning with proper access controls and audit logging.
 */

import { 
  S3Client, 
  GetObjectCommand, 
  PutObjectCommand, 
  ListObjectsV2Command, 
  HeadObjectCommand,
  DeleteObjectCommand
} from '@aws-sdk/client-s3';
import { getConfig } from './config.js';
import { logger } from './logging.js';
import { z } from 'zod';

// Template metadata schema
const templateMetadataSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  type: z.enum(['dedicated', 'shared']),
  description: z.string().optional(),
  parameters: z.array(z.object({
    name: z.string(),
    type: z.string(),
    description: z.string().optional(),
    required: z.boolean().default(false)
  })).optional(),
  tags: z.record(z.string()).optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});

// Template upload configuration
const templateUploadConfigSchema = z.object({
  bucketName: z.string().min(1),
  key: z.string().min(1),
  content: z.string().min(1),
  contentType: z.string().default('application/x-yaml'),
  metadata: z.record(z.string()).optional(),
  tags: z.record(z.string()).optional(),
  serverSideEncryption: z.string().default('AES256')
});

export type TemplateMetadata = z.infer<typeof templateMetadataSchema>;
export type TemplateUploadConfig = z.infer<typeof templateUploadConfigSchema>;

// Template information with S3 details
export interface TemplateInfo {
  key: string;
  url: string;
  metadata: TemplateMetadata;
  size: number;
  lastModified: Date;
  etag: string;
  versionId?: string;
}

// Template list result
export interface TemplateListResult {
  templates: TemplateInfo[];
  continuationToken?: string;
  totalCount: number;
}

/**
 * S3 Template Manager Class
 * Handles CloudFormation template storage and management in S3
 */
export class S3TemplateManager {
  private client: S3Client;
  private config: ReturnType<typeof getConfig>;
  private bucketName: string;

  constructor(bucketName: string, region?: string) {
    this.config = getConfig();
    this.bucketName = bucketName;
    
    const clientRegion = region || this.config.aws.region;
    
    this.client = new S3Client({
      region: clientRegion,
      maxAttempts: 3
    });
  }

  /**
   * Upload CloudFormation template to S3
   */
  async uploadTemplate(uploadConfig: TemplateUploadConfig): Promise<{ url: string; versionId?: string }> {
    try {
      // Validate upload configuration
      const validatedConfig = templateUploadConfigSchema.parse(uploadConfig);
      
      logger.info('Uploading CloudFormation template to S3', {
        bucket: validatedConfig.bucketName,
        key: validatedConfig.key,
        size: validatedConfig.content.length
      });

      const command = new PutObjectCommand({
        Bucket: validatedConfig.bucketName,
        Key: validatedConfig.key,
        Body: validatedConfig.content,
        ContentType: validatedConfig.contentType,
        Metadata: validatedConfig.metadata,
        ServerSideEncryption: validatedConfig.serverSideEncryption as 'AES256'
      });

      const response = await this.client.send(command);
      
      const templateUrl = `https://${validatedConfig.bucketName}.s3.${this.client.config.region}.amazonaws.com/${validatedConfig.key}`;
      
      logger.info('CloudFormation template uploaded successfully', {
        bucket: validatedConfig.bucketName,
        key: validatedConfig.key,
        url: templateUrl,
        versionId: response.VersionId,
        etag: response.ETag
      });

      return {
        url: templateUrl,
        ...(response.VersionId && { versionId: response.VersionId })
      };
    } catch (error) {
      logger.error('Failed to upload CloudFormation template', {
        error: error instanceof Error ? error.message : 'Unknown error',
        bucket: uploadConfig.bucketName,
        key: uploadConfig.key
      });
      throw error;
    }
  }
  /**
   * Download CloudFormation template from S3
   */
  async downloadTemplate(key: string, versionId?: string): Promise<{ content: string; metadata: Record<string, string> }> {
    try {
      logger.info('Downloading CloudFormation template from S3', {
        bucket: this.bucketName,
        key,
        versionId
      });

      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        VersionId: versionId
      });

      const response = await this.client.send(command);
      
      if (!response.Body) {
        throw new Error('Template content is empty');
      }

      const content = await response.Body.transformToString();
      
      logger.info('CloudFormation template downloaded successfully', {
        bucket: this.bucketName,
        key,
        size: content.length,
        contentType: response.ContentType
      });

      return {
        content,
        metadata: response.Metadata || {}
      };
    } catch (error) {
      logger.error('Failed to download CloudFormation template', {
        error: error instanceof Error ? error.message : 'Unknown error',
        bucket: this.bucketName,
        key,
        versionId
      });
      throw error;
    }
  }

  /**
   * List CloudFormation templates in S3 bucket
   */
  async listTemplates(prefix?: string, maxKeys?: number, continuationToken?: string): Promise<TemplateListResult> {
    try {
      logger.info('Listing CloudFormation templates from S3', {
        bucket: this.bucketName,
        prefix,
        maxKeys
      });

      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
        MaxKeys: maxKeys || 100,
        ContinuationToken: continuationToken
      });

      const response = await this.client.send(command);
      
      const templates: TemplateInfo[] = [];
      
      if (response.Contents) {
        for (const object of response.Contents) {
          if (object.Key && object.LastModified && object.Size !== undefined) {
            try {
              // Get object metadata to extract template information
              const headCommand = new HeadObjectCommand({
                Bucket: this.bucketName,
                Key: object.Key
              });
              
              const headResponse = await this.client.send(headCommand);
              
              // Parse template metadata from S3 object metadata
              const templateMetadata = this.parseTemplateMetadata(headResponse.Metadata || {});
              
              const templateUrl = `https://${this.bucketName}.s3.${this.client.config.region}.amazonaws.com/${object.Key}`;
              
              templates.push({
                key: object.Key,
                url: templateUrl,
                metadata: templateMetadata,
                size: object.Size,
                lastModified: object.LastModified,
                etag: object.ETag || '',
                ...(headResponse.VersionId && { versionId: headResponse.VersionId })
              });
            } catch (metadataError) {
              logger.warn('Failed to get metadata for template', {
                key: object.Key,
                error: metadataError instanceof Error ? metadataError.message : 'Unknown error'
              });
            }
          }
        }
      }

      logger.info('CloudFormation templates listed successfully', {
        bucket: this.bucketName,
        count: templates.length,
        hasMore: !!response.NextContinuationToken
      });

      return {
        templates,
        totalCount: response.KeyCount || 0,
        ...(response.NextContinuationToken && { continuationToken: response.NextContinuationToken })
      };
    } catch (error) {
      logger.error('Failed to list CloudFormation templates', {
        error: error instanceof Error ? error.message : 'Unknown error',
        bucket: this.bucketName,
        prefix
      });
      throw error;
    }
  }
  /**
   * Get template information without downloading content
   */
  async getTemplateInfo(key: string, versionId?: string): Promise<TemplateInfo | null> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        VersionId: versionId
      });

      const response = await this.client.send(command);
      
      const templateMetadata = this.parseTemplateMetadata(response.Metadata || {});
      const templateUrl = `https://${this.bucketName}.s3.${this.client.config.region}.amazonaws.com/${key}`;
      
      return {
        key,
        url: templateUrl,
        metadata: templateMetadata,
        size: response.ContentLength || 0,
        lastModified: response.LastModified || new Date(),
        etag: response.ETag || '',
        ...(response.VersionId && { versionId: response.VersionId })
      };
    } catch (error) {
      logger.error('Failed to get template info', {
        error: error instanceof Error ? error.message : 'Unknown error',
        bucket: this.bucketName,
        key,
        versionId
      });
      return null;
    }
  }

  /**
   * Delete CloudFormation template from S3
   */
  async deleteTemplate(key: string, versionId?: string): Promise<boolean> {
    try {
      logger.info('Deleting CloudFormation template from S3', {
        bucket: this.bucketName,
        key,
        versionId
      });

      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        VersionId: versionId
      });

      await this.client.send(command);
      
      logger.info('CloudFormation template deleted successfully', {
        bucket: this.bucketName,
        key,
        versionId
      });

      return true;
    } catch (error) {
      logger.error('Failed to delete CloudFormation template', {
        error: error instanceof Error ? error.message : 'Unknown error',
        bucket: this.bucketName,
        key,
        versionId
      });
      return false;
    }
  }

  /**
   * Create a new version of an existing template
   */
  async createTemplateVersion(
    sourceKey: string, 
    newContent: string, 
    versionMetadata?: Record<string, string>
  ): Promise<{ url: string; versionId?: string }> {
    try {
      // Generate versioned key (append timestamp)
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const versionedKey = `${sourceKey.replace(/\.(yaml|yml|json)$/, '')}-${timestamp}.$1`;
      
      const uploadConfig: TemplateUploadConfig = {
        bucketName: this.bucketName,
        key: versionedKey,
        content: newContent,
        contentType: 'application/x-yaml',
        serverSideEncryption: 'AES256',
        metadata: {
          'original-key': sourceKey,
          'version-timestamp': timestamp,
          ...versionMetadata
        }
      };

      return await this.uploadTemplate(uploadConfig);
    } catch (error) {
      logger.error('Failed to create template version', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sourceKey
      });
      throw error;
    }
  }

  /**
   * Validate template format and structure
   */
  async validateTemplateFormat(content: string): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    try {
      // Basic YAML/JSON format validation
      if (content.trim().startsWith('{')) {
        // JSON format
        JSON.parse(content);
      } else {
        // Assume YAML format - basic validation
        if (!content.includes('AWSTemplateFormatVersion') && !content.includes('Resources')) {
          errors.push('Template must contain AWSTemplateFormatVersion or Resources section');
        }
      }
      
      // Check for required CloudFormation sections
      if (!content.includes('Resources')) {
        errors.push('Template must contain a Resources section');
      }
      
      return {
        valid: errors.length === 0,
        errors
      };
    } catch (parseError) {
      errors.push(`Template format error: ${parseError instanceof Error ? parseError.message : 'Invalid format'}`);
      return {
        valid: false,
        errors
      };
    }
  }

  /**
   * Parse template metadata from S3 object metadata
   */
  private parseTemplateMetadata(s3Metadata: Record<string, string>): TemplateMetadata {
    try {
      // Try to parse structured metadata
      const metadata: Partial<TemplateMetadata> = {
        name: s3Metadata['template-name'] || 'Unknown',
        version: s3Metadata['template-version'] || '1.0.0',
        type: (s3Metadata['template-type'] as 'dedicated' | 'shared') || 'dedicated',
        description: s3Metadata['template-description'],
        createdAt: s3Metadata['created-at'] || new Date().toISOString(),
        updatedAt: s3Metadata['updated-at'] || new Date().toISOString()
      };

      // Parse parameters if present
      if (s3Metadata['template-parameters']) {
        try {
          metadata.parameters = JSON.parse(s3Metadata['template-parameters']);
        } catch {
          // Ignore parsing errors for parameters
        }
      }

      // Parse tags if present
      if (s3Metadata['template-tags']) {
        try {
          metadata.tags = JSON.parse(s3Metadata['template-tags']);
        } catch {
          // Ignore parsing errors for tags
        }
      }

      return templateMetadataSchema.parse(metadata);
    } catch {
      // Return default metadata if parsing fails
      return {
        name: 'Unknown',
        version: '1.0.0',
        type: 'dedicated',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
  }
}

// Template manager instances by bucket
const templateManagers = new Map<string, S3TemplateManager>();

/**
 * Get S3 template manager instance for a specific bucket
 */
export function getS3TemplateManager(bucketName: string, region?: string): S3TemplateManager {
  const key = `${bucketName}-${region || 'default'}`;
  
  if (!templateManagers.has(key)) {
    templateManagers.set(key, new S3TemplateManager(bucketName, region));
  }
  
  return templateManagers.get(key)!;
}

/**
 * Get S3 client directly
 */
export function getS3Client(region?: string): S3Client {
  const config = getConfig();
  const clientRegion = region || config.aws.region;
  
  return new S3Client({
    region: clientRegion,
    maxAttempts: 3
  });
}