// Script to create initial administrator user in the staff table
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';

const region = process.env.AWS_REGION || 'ap-southeast-2';
const client = DynamoDBDocumentClient.from(new DynamoDBClient({
  region: region,
  profile: 'node'
}));

const stage = process.env.STAGE || 'dev';

// Initial admin user configuration
const ADMIN_EMAIL = 'fahad@flowrix.com';
const ADMIN_PASSWORD = 'Password123';
const BCRYPT_ROUNDS = 12;

async function createInitialAdmin() {
  const tableName = `onboard-staff-${stage}`;
  
  console.log('🚀 Creating initial administrator user...');
  console.log(`Stage: ${stage}`);
  console.log(`Region: ${region}`);
  console.log(`Table: ${tableName}`);
  console.log(`Email: ${ADMIN_EMAIL}`);
  
  try {
    // Hash the password
    console.log('🔐 Hashing password...');
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_ROUNDS);
    
    // Create admin user record
    const adminUser = {
      staff_id: randomUUID(),
      email: ADMIN_EMAIL.toLowerCase(),
      password_hash: passwordHash,
      roles: ['admin'],
      enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    console.log('📝 Creating admin user record...');
    await client.send(new PutCommand({
      TableName: tableName,
      Item: adminUser,
      ConditionExpression: 'attribute_not_exists(email)', // Prevent overwriting existing user
    }));
    
    console.log('✅ Initial administrator user created successfully!');
    console.log(`   Staff ID: ${adminUser.staff_id}`);
    console.log(`   Email: ${adminUser.email}`);
    console.log(`   Roles: ${adminUser.roles.join(', ')}`);
    console.log(`   Enabled: ${adminUser.enabled}`);
    console.log('');
    console.log('🔑 Login credentials:');
    console.log(`   Email: ${ADMIN_EMAIL}`);
    console.log(`   Password: ${ADMIN_PASSWORD}`);
    console.log('');
    console.log('⚠️  IMPORTANT: Change the password after first login for security!');
    
  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      console.log('⚠️  Admin user already exists with this email address');
      console.log(`   Email: ${ADMIN_EMAIL}`);
      console.log('   No changes made.');
    } else {
      console.error('❌ Failed to create initial admin user:', error.message);
      throw error;
    }
  }
}

async function main() {
  try {
    await createInitialAdmin();
  } catch (error) {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  }
}

main();