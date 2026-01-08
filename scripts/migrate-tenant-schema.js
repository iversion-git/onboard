#!/usr/bin/env node

/**
 * Migration script to add subscription_type and package_name fields to existing tenant records
 * 
 * Usage: node scripts/migrate-tenant-schema.js
 * 
 * This script will:
 * 1. Scan all existing tenant records
 * 2. Add default values for missing subscription_type and package_name fields
 * 3. Update records in DynamoDB
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

// Configuration
const REGION = process.env.AWS_REGION || 'ap-southeast-2';
const TABLE_NAME = process.env.DYNAMODB_TENANTS_TABLE || 'onboard-tenants-prod';

// Default values for new fields
const DEFAULT_SUBSCRIPTION_TYPE = 'General';
const DEFAULT_PACKAGE_NAME = 'Essential';

// Initialize DynamoDB client
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

async function migrateTenantRecords() {
  console.log('🚀 Starting tenant schema migration...');
  console.log(`📋 Table: ${TABLE_NAME}`);
  console.log(`🌍 Region: ${REGION}`);
  
  try {
    // Scan all tenant records
    console.log('\n📖 Scanning existing tenant records...');
    const scanResult = await dynamoClient.send(new ScanCommand({
      TableName: TABLE_NAME
    }));

    const tenants = scanResult.Items || [];
    console.log(`📊 Found ${tenants.length} tenant records`);

    if (tenants.length === 0) {
      console.log('✅ No tenant records found. Migration complete.');
      return;
    }

    // Filter records that need migration
    const tenantsToMigrate = tenants.filter(tenant => 
      !tenant.subscription_type || !tenant.package_name
    );

    console.log(`🔄 ${tenantsToMigrate.length} records need migration`);

    if (tenantsToMigrate.length === 0) {
      console.log('✅ All records already have the new fields. Migration complete.');
      return;
    }

    // Migrate each record
    let successCount = 0;
    let errorCount = 0;

    for (const tenant of tenantsToMigrate) {
      try {
        const updateParams = {
          TableName: TABLE_NAME,
          Key: { tenant_id: tenant.tenant_id },
          UpdateExpression: 'SET',
          ExpressionAttributeValues: {},
          ExpressionAttributeNames: {}
        };

        const updates = [];
        
        // Add subscription_type if missing
        if (!tenant.subscription_type) {
          updates.push('#subscription_type = :subscription_type');
          updateParams.ExpressionAttributeNames['#subscription_type'] = 'subscription_type';
          updateParams.ExpressionAttributeValues[':subscription_type'] = DEFAULT_SUBSCRIPTION_TYPE;
        }

        // Add package_name if missing
        if (!tenant.package_name) {
          updates.push('#package_name = :package_name');
          updateParams.ExpressionAttributeNames['#package_name'] = 'package_name';
          updateParams.ExpressionAttributeValues[':package_name'] = DEFAULT_PACKAGE_NAME;
        }

        // Add updated_at timestamp
        updates.push('#updated_at = :updated_at');
        updateParams.ExpressionAttributeNames['#updated_at'] = 'updated_at';
        updateParams.ExpressionAttributeValues[':updated_at'] = new Date().toISOString();

        updateParams.UpdateExpression = `SET ${updates.join(', ')}`;

        await dynamoClient.send(new UpdateCommand(updateParams));
        
        console.log(`✅ Updated tenant: ${tenant.tenant_id} (${tenant.business_name || tenant.name})`);
        successCount++;
        
      } catch (error) {
        console.error(`❌ Failed to update tenant ${tenant.tenant_id}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`✅ Successfully updated: ${successCount} records`);
    console.log(`❌ Failed to update: ${errorCount} records`);
    console.log(`📋 Total processed: ${tenantsToMigrate.length} records`);

    if (errorCount === 0) {
      console.log('\n🎉 Migration completed successfully!');
    } else {
      console.log('\n⚠️  Migration completed with some errors. Please review the failed records.');
    }

  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateTenantRecords().catch(console.error);