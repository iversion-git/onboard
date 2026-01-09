#!/usr/bin/env node

/**
 * Script to inject initial packages into the onboard-packages DynamoDB table
 * Usage: node scripts/inject-packages.js [stage]
 * Example: node scripts/inject-packages.js dev
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

// Configuration
const STAGE = process.argv[2] || 'dev';
const REGION = 'ap-southeast-2';
const TABLE_NAME = `onboard-packages-${STAGE}`;

// AWS SDK Configuration - Use default credential chain (same as upload-templates.js)
const client = new DynamoDBClient({
  region: REGION,
  maxAttempts: 3
});
const docClient = DynamoDBDocumentClient.from(client);

// Package data to inject
const PACKAGES = [
  {
    package_id: 10,
    package_name: 'Essential',
    description: 'Basic feature set for small businesses',
    features: [
      'Basic inventory management',
      'Simple reporting',
      'Up to 2 users',
      'Email support'
    ],
    price: 29.99,
    active: true
  },
  {
    package_id: 20,
    package_name: 'Professional',
    description: 'Enhanced features for growing businesses',
    features: [
      'Advanced inventory management',
      'Custom reporting',
      'Up to 10 users',
      'Priority support',
      'API access'
    ],
    price: 79.99,
    active: true
  },
  {
    package_id: 30,
    package_name: 'Premium',
    description: 'Advanced features for established businesses',
    features: [
      'Full inventory management',
      'Advanced analytics',
      'Up to 50 users',
      'Phone support',
      'Custom integrations',
      'Multi-location support'
    ],
    price: 149.99,
    active: true
  },
  {
    package_id: 40,
    package_name: 'Enterprise',
    description: 'Full feature set for large organizations',
    features: [
      'Enterprise inventory management',
      'Real-time analytics',
      'Unlimited users',
      'Dedicated support',
      'Custom development',
      'White-label options',
      'Advanced security'
    ],
    price: 299.99,
    active: true
  }
];

async function checkPackageExists(packageId) {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { package_id: packageId }
    }));
    return !!result.Item;
  } catch (error) {
    return false;
  }
}

async function injectPackage(packageData) {
  const now = new Date().toISOString();
  
  const item = {
    ...packageData,
    created_at: now,
    updated_at: now
  };

  try {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
      ConditionExpression: 'attribute_not_exists(package_id)' // Prevent overwriting
    }));
    return { success: true };
  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      return { success: false, error: 'Package already exists' };
    }
    throw error;
  }
}

async function main() {
  console.log(`🚀 Starting package injection for stage: ${STAGE}`);
  console.log(`📍 Region: ${REGION}`);
  console.log(`📍 Table: ${TABLE_NAME}`);
  console.log('');

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const packageData of PACKAGES) {
    try {
      console.log(`📦 Processing package: ${packageData.package_name} (ID: ${packageData.package_id})`);
      
      // Check if package already exists
      const exists = await checkPackageExists(packageData.package_id);
      if (exists) {
        console.log(`   ⚠️  Package already exists, skipping...`);
        skipCount++;
        continue;
      }

      // Inject package
      const result = await injectPackage(packageData);
      
      if (result.success) {
        console.log(`   ✅ Successfully injected package`);
        successCount++;
      } else {
        console.log(`   ❌ Failed to inject package: ${result.error}`);
        skipCount++;
      }
    } catch (error) {
      console.log(`   ❌ Error injecting package: ${error.message}`);
      errorCount++;
    }
    console.log('');
  }

  console.log('📊 Injection Summary:');
  console.log(`   ✅ Successfully injected: ${successCount}`);
  console.log(`   ⚠️  Skipped (already exists): ${skipCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📦 Total packages: ${PACKAGES.length}`);

  if (errorCount > 0) {
    process.exit(1);
  } else {
    console.log('🎉 Package injection completed successfully!');
  }
}

// Run the script
main().catch(error => {
  console.error('💥 Script failed:', error.message);
  process.exit(1);
});