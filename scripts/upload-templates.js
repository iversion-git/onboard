#!/usr/bin/env node

/**
 * Upload CloudFormation templates to S3 during deployment
 * This script uploads only the shared cluster templates (main + 3 nested stacks)
 * Updated to support IAM authentication and 3-tier network architecture
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
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

// Template files to upload - Only shared cluster templates
const TEMPLATES = [
  // Main orchestration template
  {
    localPath: 'stacks/shared-main-template.yaml',
    s3Key: 'shared-main-template.yaml',
    description: 'Shared cluster main template (orchestrates nested stacks)'
  },
  // Shared cluster nested templates
  {
    localPath: 'stacks/shared-infrastructure-template.yaml',
    s3Key: 'shared-infrastructure-template.yaml',
    description: 'Shared cluster infrastructure template (VPC, subnets, security groups)'
  },
  {
    localPath: 'stacks/shared-database-template.yaml',
    s3Key: 'shared-database-template.yaml',
    description: 'Shared cluster database template (Aurora MySQL, RDS Proxy, Redis with IAM auth)'
  },
  {
    localPath: 'stacks/shared-app-template.yaml',
    s3Key: 'shared-app-template.yaml',
    description: 'Shared cluster application template (Laravel Lambda, API Gateway, SQS)'
  }
];

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