#!/usr/bin/env node

/**
 * Enable termination protection on the CloudFormation stack
 * Run this after deployment to protect against accidental deletion
 */

import { CloudFormationClient, UpdateTerminationProtectionCommand, DescribeStacksCommand } from '@aws-sdk/client-cloudformation';

// Configuration
const REGION = process.env.AWS_REGION || 'ap-southeast-2';
const STAGE = process.env.STAGE || 'dev';
const STACK_NAME = `onboard-service-${STAGE}`;

async function enableStackProtection() {
  console.log('🛡️  Enabling stack termination protection...');
  console.log(`📍 Region: ${REGION}`);
  console.log(`📍 Stage: ${STAGE}`);
  console.log(`📍 Stack: ${STACK_NAME}`);
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
    
    if (stack.EnableTerminationProtection) {
      console.log('✅ Termination protection is already enabled!');
      return;
    }
    
    // Enable termination protection
    console.log('🔒 Enabling termination protection...');
    const protectionCommand = new UpdateTerminationProtectionCommand({
      StackName: STACK_NAME,
      EnableTerminationProtection: true
    });
    
    await cfnClient.send(protectionCommand);
    
    console.log('✅ Termination protection enabled successfully!');
    console.log('');
    console.log('🛡️  Your stack is now protected from accidental deletion.');
    console.log('   To remove the stack, you must first disable termination protection.');
    console.log('');
    console.log('📝 To disable protection later (if needed):');
    console.log(`   aws cloudformation update-termination-protection --stack-name ${STACK_NAME} --no-enable-termination-protection --region ${REGION}`);
    
  } catch (error) {
    console.error('❌ Failed to enable stack protection:', error.message);
    
    if (error.name === 'ValidationError' && error.message.includes('does not exist')) {
      console.error(`   Stack ${STACK_NAME} does not exist. Deploy it first with: serverless deploy --stage ${STAGE}`);
    }
    
    process.exit(1);
  }
}

// Run the protection enabler
enableStackProtection().catch(error => {
  console.error('💥 Protection enabler failed:', error);
  process.exit(1);
});