#!/usr/bin/env node
// Script to generate a secure JWT secret for the AWS Lambda Control Plane API

import { randomBytes } from 'crypto';

/**
 * Generate a cryptographically secure JWT secret
 * @param {number} length - Length in bytes (default: 48 bytes = 64 base64 characters)
 * @returns {string} Base64 encoded secret
 */
function generateJwtSecret(length = 48) {
  const secret = randomBytes(length).toString('base64');
  return secret;
}

/**
 * Validate that a secret meets minimum requirements
 * @param {string} secret - The secret to validate
 * @returns {boolean} Whether the secret is valid
 */
function validateSecret(secret) {
  if (secret.length < 32) {
    console.error('❌ Secret must be at least 32 characters long');
    return false;
  }
  
  if (secret.length < 44) {
    console.warn('⚠️  Secret is shorter than recommended (44+ characters)');
  }
  
  return true;
}

// Main execution
function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
JWT Secret Generator for AWS Lambda Control Plane API

Usage:
  node scripts/generate-jwt-secret.js [options]

Options:
  --length <bytes>    Length in bytes (default: 48)
  --validate <secret> Validate an existing secret
  --help, -h          Show this help message

Examples:
  # Generate a new secret
  node scripts/generate-jwt-secret.js

  # Generate with custom length
  node scripts/generate-jwt-secret.js --length 64

  # Validate an existing secret
  node scripts/generate-jwt-secret.js --validate "your-secret-here"

  # Use in deployment
  export JWT_SECRET=$(node scripts/generate-jwt-secret.js)
`);
    return;
  }
  
  const validateIndex = args.indexOf('--validate');
  if (validateIndex !== -1 && args[validateIndex + 1]) {
    const secret = args[validateIndex + 1];
    console.log(`Validating secret: ${secret.substring(0, 8)}...`);
    
    if (validateSecret(secret)) {
      console.log('✅ Secret is valid');
      process.exit(0);
    } else {
      process.exit(1);
    }
  }
  
  const lengthIndex = args.indexOf('--length');
  const length = lengthIndex !== -1 && args[lengthIndex + 1] 
    ? parseInt(args[lengthIndex + 1], 10) 
    : 48;
  
  if (isNaN(length) || length < 24) {
    console.error('❌ Length must be a number >= 24');
    process.exit(1);
  }
  
  const secret = generateJwtSecret(length);
  
  // Only output the secret to stdout (for piping)
  if (process.stdout.isTTY) {
    console.log('Generated JWT Secret:');
    console.log(secret);
    console.log('');
    console.log('To use in deployment:');
    console.log(`export JWT_SECRET="${secret}"`);
  } else {
    // When piped, only output the secret
    console.log(secret);
  }
}

main();