#!/usr/bin/env node

/**
 * Upload CloudFormation templates to S3 during deployment
 * This script runs as part of the serverless deployment process
 */

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

// Configuration
const REGION = process.env.AWS_REGION || 'ap-southeast-2';
const STAGE = process.env.STAGE || 'dev';
const BUCKET_NAME = `aws-lambda-control-plane-templates-${STAGE}`;

// Template files to upload
const TEMPLATES = [
  {
    localPath: 'dedicated-cluster-template.yaml',
    s3Key: 'dedicated-cluster-template.yaml',
    description: 'Dedicated cluster CloudFormation template'
  },
  {
    localPath: 'shared-cluster-template.yaml', 
    s3Key: 'shared-cluster-template.yaml',
    description: 'Shared cluster CloudFormation template'
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
        'template-type': template.s3Key.includes('dedicated') ? 'dedicated' : 'shared',
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