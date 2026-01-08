// Script to populate initial data for packages and subscription types tables
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1'
}));

const stage = process.env.STAGE || 'dev';

// Initial packages data
const packages = [
  {
    package_id: 1,
    package_name: 'Essential',
    description: 'Basic package with essential features for small businesses',
    features: ['Basic Dashboard', 'User Management', 'Basic Reports'],
    price: 29.99,
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    package_id: 2,
    package_name: 'Professional',
    description: 'Professional package with advanced features for growing businesses',
    features: ['Advanced Dashboard', 'User Management', 'Advanced Reports', 'API Access'],
    price: 79.99,
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    package_id: 3,
    package_name: 'Premium',
    description: 'Premium package with comprehensive features for established businesses',
    features: ['Premium Dashboard', 'Advanced User Management', 'Premium Reports', 'Full API Access', 'Priority Support'],
    price: 149.99,
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    package_id: 4,
    package_name: 'Enterprise',
    description: 'Enterprise package with all features for large organizations',
    features: ['Enterprise Dashboard', 'Complete User Management', 'Enterprise Reports', 'Full API Access', '24/7 Support', 'Custom Integrations'],
    price: 299.99,
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

// Initial subscription types data
const subscriptionTypes = [
  {
    subscription_type_id: 1,
    subscription_type_name: 'General',
    description: 'General purpose subscription for standard business operations',
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    subscription_type_id: 2,
    subscription_type_name: 'Made to Measure',
    description: 'Customized subscription tailored to specific business requirements',
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    subscription_type_id: 3,
    subscription_type_name: 'Automotive',
    description: 'Specialized subscription for automotive industry businesses',
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    subscription_type_id: 4,
    subscription_type_name: 'Rental',
    description: 'Specialized subscription for rental and leasing businesses',
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

async function populatePackages() {
  const tableName = `Packages-${stage}`;
  console.log(`Populating ${tableName} table...`);
  
  for (const packageData of packages) {
    try {
      await client.send(new PutCommand({
        TableName: tableName,
        Item: packageData
      }));
      console.log(`✅ Added package: ${packageData.package_name} (ID: ${packageData.package_id})`);
    } catch (error) {
      console.error(`❌ Failed to add package ${packageData.package_name}:`, error.message);
    }
  }
}

async function populateSubscriptionTypes() {
  const tableName = `SubscriptionTypes-${stage}`;
  console.log(`\nPopulating ${tableName} table...`);
  
  for (const subscriptionType of subscriptionTypes) {
    try {
      await client.send(new PutCommand({
        TableName: tableName,
        Item: subscriptionType
      }));
      console.log(`✅ Added subscription type: ${subscriptionType.subscription_type_name} (ID: ${subscriptionType.subscription_type_id})`);
    } catch (error) {
      console.error(`❌ Failed to add subscription type ${subscriptionType.subscription_type_name}:`, error.message);
    }
  }
}

async function main() {
  console.log('🚀 Starting lookup tables population...');
  console.log(`Stage: ${stage}`);
  console.log(`Region: ${process.env.AWS_REGION || 'us-east-1'}`);
  
  try {
    await populatePackages();
    await populateSubscriptionTypes();
    console.log('\n✅ Lookup tables populated successfully!');
  } catch (error) {
    console.error('\n❌ Failed to populate lookup tables:', error);
    process.exit(1);
  }
}

main();