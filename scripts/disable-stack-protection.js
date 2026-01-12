#!/usr/bin/env node

/**
 * Disable termination protection on the CloudFormation stack
 * Run this ONLY when you intentionally want to remove the stack
 */

import { CloudFormationClient, UpdateTerminationProtectionCommand, DescribeStacksCommand } from '@aws-sdk/client-cloudformation';

// Configuration
const REGION = process.env.AWS_REGION || 'ap-southeast-2';
const STAGE = process.env.STAGE || 'dev';
const STACK_NAME = `onboard-service-${STAGE}`;

async function disableStackProtection() {
  console.log('⚠️  DISABLING stack termination protection...');
  console.log(`📍 Region: ${REGION}`);
  console.log(`📍 Stage: ${STAGE}`);
  console.log(`📍 Stack: ${STACK_NAME}`);
  console.log('');
  
  console.log('🚨 WARNING: This will allow the stack to be deleted!');
  console.log('   Only proceed if you intentionally want to remove the stack.');
  console.log('');

  const cfnClient = new CloudFormationClient({ 
    region: REGION,
    maxAttempts: 3
  });

  try {
    // First check if stack exists
    console.log('🔍 Checking stack status...');
    const describeCommand = new DescribeStacksCommand({
      StackName: STACK_NAME
    });
    
    const stackResponse = await cfnClient.send(describeCommand);
    const stack = stackResponse.Stacks[0];
    
    if (!stack) {
      console.error(`❌ Stack ${STACK_NAME} not found`);
      process.exit(1);
    }
    
    console.log(`   Stack Status: ${stack.StackStatus}`);
    console.log(`   Current Protection: ${stack.EnableTerminationProtection ? 'ENABLED' : 'DISABLED'}`);
    
    if (!stack.EnableTerminationProtection) {
      console.log('ℹ️  Termination protection is already disabled.');
      return;
    }
    
    // Disable termination protection
    console.log('🔓 Disabling termination protection...');
    const protectionCommand = new UpdateTerminationProtectionCommand({
      StackName: STACK_NAME,
      EnableTerminationProtection: false
    });
    
    await cfnClient.send(protectionCommand);
    
    console.log('✅ Termination protection disabled.');
    console.log('');
    console.log('⚠️  Your stack can now be deleted with: serverless remove --stage ' + STAGE);
    console.log('');
    console.log('🛡️  To re-enable protection after deployment:');
    console.log('   node scripts/enable-stack-protection.js');
    
  } catch (error) {
    console.error('❌ Failed to disable stack protection:', error.message);
    
    if (error.name === 'ValidationError' && error.message.includes('does not exist')) {
      console.error(`   Stack ${STACK_NAME} does not exist.`);
    }
    
    process.exit(1);
  }
}

// Run the protection disabler
disableStackProtection().catch(error => {
  console.error('💥 Protection disabler failed:', error);
  process.exit(1);
});