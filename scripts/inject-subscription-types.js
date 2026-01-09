#!/usr/bin/env node

/**
 * Script to inject initial subscription types into the onboard-subscription-types DynamoDB table
 * Usage: node scripts/inject-subscription-types.js [stage]
 * Example: node scripts/inject-subscription-types.js dev
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

// Configuration
const STAGE = process.argv[2] || 'dev';
const REGION = 'ap-southeast-2';
const TABLE_NAME = `onboard-subscription-types-${STAGE}`;

// AWS SDK Configuration - Use default credential chain (same as upload-templates.js)
const client = new DynamoDBClient({
  region: REGION,
  maxAttempts: 3
});
const docClient = DynamoDBDocumentClient.from(client);

// Subscription type data to inject
const SUBSCRIPTION_TYPES = [
  {
    subscription_type_id: 10,
    subscription_type_name: 'General',
    description: 'Standard business subscription for general retail and service businesses',
    active: true
  },
  {
    subscription_type_id: 20,
    subscription_type_name: 'Made to Measure',
    description: 'Custom tailored solutions for businesses with specific measurement requirements',
    active: true
  },
  {
    subscription_type_id: 30,
    subscription_type_name: 'Automotives',
    description: 'Specialized subscription for automotive industry businesses including parts, service, and sales',
    active: true
  },
  {
    subscription_type_id: 40,
    subscription_type_name: 'Rental',
    description: 'Focused subscription for rental businesses including equipment, vehicle, and property rentals',
    active: true
  },
  {
    subscription_type_id: 50,
    subscription_type_name: 'Subscriptions',
    description: 'Subscription-based business model for recurring services and products',
    active: true
  }
];

async function checkSubscriptionTypeExists(subscriptionTypeId) {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { subscription_type_id: subscriptionTypeId }
    }));
    return !!result.Item;
  } catch (error) {
    return false;
  }
}

async function injectSubscriptionType(subscriptionTypeData) {
  const now = new Date().toISOString();
  
  const item = {
    ...subscriptionTypeData,
    created_at: now,
    updated_at: now
  };

  try {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
      ConditionExpression: 'attribute_not_exists(subscription_type_id)' // Prevent overwriting
    }));
    return { success: true };
  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      return { success: false, error: 'Subscription type already exists' };
    }
    throw error;
  }
}

async function main() {
  console.log(`🚀 Starting subscription type injection for stage: ${STAGE}`);
  console.log(`📍 Region: ${REGION}`);
  console.log(`📍 Table: ${TABLE_NAME}`);
  console.log('');

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const subscriptionTypeData of SUBSCRIPTION_TYPES) {
    try {
      console.log(`🏷️  Processing subscription type: ${subscriptionTypeData.subscription_type_name} (ID: ${subscriptionTypeData.subscription_type_id})`);
      
      // Check if subscription type already exists
      const exists = await checkSubscriptionTypeExists(subscriptionTypeData.subscription_type_id);
      if (exists) {
        console.log(`   ⚠️  Subscription type already exists, skipping...`);
        skipCount++;
        continue;
      }

      // Inject subscription type
      const result = await injectSubscriptionType(subscriptionTypeData);
      
      if (result.success) {
        console.log(`   ✅ Successfully injected subscription type`);
        successCount++;
      } else {
        console.log(`   ❌ Failed to inject subscription type: ${result.error}`);
        skipCount++;
      }
    } catch (error) {
      console.log(`   ❌ Error injecting subscription type: ${error.message}`);
      errorCount++;
    }
    console.log('');
  }

  console.log('📊 Injection Summary:');
  console.log(`   ✅ Successfully injected: ${successCount}`);
  console.log(`   ⚠️  Skipped (already exists): ${skipCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   🏷️  Total subscription types: ${SUBSCRIPTION_TYPES.length}`);

  if (errorCount > 0) {
    process.exit(1);
  } else {
    console.log('🎉 Subscription type injection completed successfully!');
  }
}

// Run the script
main().catch(error => {
  console.error('💥 Script failed:', error.message);
  process.exit(1);
});