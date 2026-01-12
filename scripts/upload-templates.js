#!/usr/bin/env node

/**
 * Upload CloudFormation templates to S3 during deployment
 * This script uploads universal cluster templates (main + 3 nested stacks)
 * Templates work for both shared and dedicated cluster deployments
 * Updated to support IAM authentication and 3-tier network architecture
 */

import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand, ListObjectVersionsCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';

// Configuration - Dynamic bucket name resolution
const REGION = process.env.AWS_REGION || 'ap-southeast-2';
const STAGE = process.env.STAGE || 'dev';

// Function to get bucket name dynamically
function getBucketName() {
  // Priority 1: Environment variable (set by serverless deployment)
  if (process.env.S3_TEMPLATE_BUCKET) {
    console.log(`📍 Using bucket from environment: ${process.env.S3_TEMPLATE_BUCKET}`);
    return process.env.S3_TEMPLATE_BUCKET;
  }
  
  // Priority 2: Service name + stage (matches serverless.yml pattern)
  const bucketName = `onboard-templates-${STAGE}`;
  console.log(`📍 Using default bucket pattern: ${bucketName}`);
  return bucketName;
}

const BUCKET_NAME = getBucketName();

// Template files to upload - Universal templates for both shared and dedicated clusters
const TEMPLATES = [
  // Main orchestration template
  {
    localPath: 'stacks/main-template.yaml',
    s3Key: 'main-template.yaml',
    description: 'Main cluster template (orchestrates nested stacks for both shared and dedicated)'
  },
  // Nested templates
  {
    localPath: 'stacks/infrastructure-template.yaml',
    s3Key: 'infrastructure-template.yaml',
    description: 'Infrastructure template (VPC, subnets, security groups)'
  },
  {
    localPath: 'stacks/database-template.yaml',
    s3Key: 'database-template.yaml',
    description: 'Database template (Aurora MySQL, RDS Proxy, Redis with IAM auth)'
  },
  {
    localPath: 'stacks/app-template.yaml',
    s3Key: 'app-template.yaml',
    description: 'Application template (Laravel Lambda, API Gateway, SQS)'
  }
];

async function cleanupOldTemplates(s3Client) {
  console.log('🧹 Cleaning up old template files and versions...');
  
  try {
    // List all object versions in the bucket (including delete markers)
    const listVersionsCommand = new ListObjectVersionsCommand({
      Bucket: BUCKET_NAME,
    });
    
    const versionsResponse = await s3Client.send(listVersionsCommand);
    
    // Collect all objects and versions to delete
    const objectsToDelete = [];
    
    // Add all object versions
    if (versionsResponse.Versions) {
      versionsResponse.Versions.forEach(version => {
        if (version.Key && version.Key.startsWith('shared-')) {
          objectsToDelete.push({
            Key: version.Key,
            VersionId: version.VersionId
          });
        }
      });
    }
    
    // Add all delete markers
    if (versionsResponse.DeleteMarkers) {
      versionsResponse.DeleteMarkers.forEach(marker => {
        if (marker.Key && marker.Key.startsWith('shared-')) {
          objectsToDelete.push({
            Key: marker.Key,
            VersionId: marker.VersionId
          });
        }
      });
    }
    
    if (objectsToDelete.length === 0) {
      console.log('   No old template files or versions to clean up');
      return;
    }
    
    console.log(`   Found ${objectsToDelete.length} old template files/versions to delete`);
    
    // Delete objects in batches (S3 allows max 1000 per request)
    const batchSize = 1000;
    for (let i = 0; i < objectsToDelete.length; i += batchSize) {
      const batch = objectsToDelete.slice(i, i + batchSize);
      
      try {
        const deleteCommand = new DeleteObjectsCommand({
          Bucket: BUCKET_NAME,
          Delete: {
            Objects: batch,
            Quiet: false
          }
        });
        
        const deleteResponse = await s3Client.send(deleteCommand);
        
        if (deleteResponse.Deleted) {
          console.log(`   ✅ Deleted ${deleteResponse.Deleted.length} objects/versions`);
        }
        
        if (deleteResponse.Errors && deleteResponse.Errors.length > 0) {
          console.log(`   ⚠️  ${deleteResponse.Errors.length} deletion errors:`);
          deleteResponse.Errors.forEach(error => {
            console.log(`      - ${error.Key}: ${error.Message}`);
          });
        }
      } catch (error) {
        console.error(`   ❌ Failed to delete batch:`, error.message);
      }
    }
    
    console.log('✅ Old template cleanup completed');
    console.log('');
  } catch (error) {
    console.error('❌ Failed to cleanup old templates:', error.message);
    console.log('');
  }
}

async function uploadTemplate(s3Client, template) {
  try {
    console.log(`📤 Uploading ${template.description}...`);
    
    // Read template file
    const templateContent = fs.readFileSync(template.localPath, 'utf8');
    
    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: template.s3Key,
      Body: templateContent,
      ContentType: 'application/x-yaml',
      ServerSideEncryption: 'AES256',
      Metadata: {
        'template-name': path.basename(template.s3Key, '.yaml'),
        'template-version': '1.0.0',
        'template-type': template.s3Key.includes('main') ? 'main' :
                        template.s3Key.includes('infrastructure') ? 'infrastructure' : 
                        template.s3Key.includes('database') ? 'database' :
                        template.s3Key.includes('app') ? 'application' :
                        template.s3Key.includes('edge') ? 'edge' :
                        template.s3Key.includes('dedicated') ? 'dedicated' : 'shared',
        'template-description': template.description,
        'created-at': new Date().toISOString(),
        'updated-at': new Date().toISOString()
      }
    });
    
    const response = await s3Client.send(command);
    
    console.log(`✅ Successfully uploaded ${template.s3Key}`);
    console.log(`   ETag: ${response.ETag}`);
    console.log(`   URL: https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${template.s3Key}`);
    
    return true;
  } catch (error) {
    console.error(`❌ Failed to upload ${template.s3Key}:`, error.message);
    return false;
  }
}

async function uploadAllTemplates() {
  console.log('🚀 Starting CloudFormation template upload...');
  console.log(`📍 Region: ${REGION}`);
  console.log(`📍 Stage: ${STAGE}`);
  console.log(`📍 Bucket: ${BUCKET_NAME}`);
  console.log('');
  
  // Create S3 client
  const s3Client = new S3Client({ 
    region: REGION,
    maxAttempts: 3
  });
  
  // Clean up old template files first
  await cleanupOldTemplates(s3Client);
  
  let successCount = 0;
  let totalCount = TEMPLATES.length;
  
  // Upload each template
  for (const template of TEMPLATES) {
    // Check if file exists
    if (!fs.existsSync(template.localPath)) {
      console.error(`❌ Template file not found: ${template.localPath}`);
      continue;
    }
    
    const success = await uploadTemplate(s3Client, template);
    if (success) {
      successCount++;
    }
  }
  
  console.log('');
  console.log(`📊 Upload Summary:`);
  console.log(`   ✅ Successful: ${successCount}/${totalCount}`);
  console.log(`   ❌ Failed: ${totalCount - successCount}/${totalCount}`);
  
  if (successCount === totalCount) {
    console.log('🎉 All templates uploaded successfully!');
    process.exit(0);
  } else {
    console.error('💥 Some templates failed to upload');
    process.exit(1);
  }
}

// Run the upload process
uploadAllTemplates().catch(error => {
  console.error('💥 Upload process failed:', error);
  process.exit(1);
});