#!/usr/bin/env node

// Deployment validation script for AWS Lambda Control Plane
// Validates serverless.yml configuration and environment setup

import { readFileSync } from 'fs';
import { join } from 'path';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const NC = '\x1b[0m'; // No Color

console.log(`${GREEN}🔍 Validating AWS Lambda Control Plane Deployment Configuration${NC}\n`);

let hasErrors = false;
let hasWarnings = false;

// Check Node.js version
const nodeVersion = process.version.slice(1).split('.')[0];
if (parseInt(nodeVersion) < 20) {
    console.log(`${RED}❌ Node.js version ${process.version} is not supported. Requires Node.js 20+${NC}`);
    hasErrors = true;
} else {
    console.log(`${GREEN}✅ Node.js version ${process.version} is supported${NC}`);
}

// Check if JWT_SECRET is set
if (!process.env.JWT_SECRET) {
    console.log(`${RED}❌ JWT_SECRET environment variable is not set${NC}`);
    console.log(`${YELLOW}💡 Run: node scripts/generate-jwt-secret.js${NC}`);
    hasErrors = true;
} else if (process.env.JWT_SECRET.length < 32) {
    console.log(`${RED}❌ JWT_SECRET is too short (${process.env.JWT_SECRET.length} chars). Minimum 32 characters required${NC}`);
    hasErrors = true;
} else {
    console.log(`${GREEN}✅ JWT_SECRET is properly configured (${process.env.JWT_SECRET.length} chars)${NC}`);
}

// Check serverless.yml configuration
try {
    const serverlessConfig = readFileSync(join(process.cwd(), 'serverless.yml'), 'utf8');
    
    // Check for single function configuration
    if (serverlessConfig.includes('functions:') && serverlessConfig.includes('api:')) {
        console.log(`${GREEN}✅ Single function configuration detected${NC}`);
    } else {
        console.log(`${RED}❌ Single function configuration not found in serverless.yml${NC}`);
        hasErrors = true;
    }
    
    // Check for proxy integration
    if (serverlessConfig.includes('/{proxy+}')) {
        console.log(`${GREEN}✅ API Gateway proxy integration configured${NC}`);
    } else {
        console.log(`${RED}❌ API Gateway proxy integration not configured${NC}`);
        hasErrors = true;
    }
    
    // Check for stage-scoped table naming
    if (serverlessConfig.includes('Staff-${self:provider.stage}')) {
        console.log(`${GREEN}✅ Stage-scoped DynamoDB table naming configured${NC}`);
    } else {
        console.log(`${RED}❌ Stage-scoped DynamoDB table naming not configured${NC}`);
        hasErrors = true;
    }
    
    // Check for esbuild configuration
    if (serverlessConfig.includes('serverless-esbuild') && serverlessConfig.includes('bundleNodeModules: true')) {
        console.log(`${GREEN}✅ esbuild bundling configuration found${NC}`);
    } else {
        console.log(`${RED}❌ esbuild bundling configuration not properly set${NC}`);
        hasErrors = true;
    }
    
    // Check for performance monitoring
    if (serverlessConfig.includes('LambdaDurationAlarm')) {
        console.log(`${GREEN}✅ Performance monitoring alarms configured${NC}`);
    } else {
        console.log(`${YELLOW}⚠️  Performance monitoring alarms not configured${NC}`);
        hasWarnings = true;
    }
    
    // Check for X-Ray tracing
    if (serverlessConfig.includes('tracing:') && serverlessConfig.includes('lambda: true')) {
        console.log(`${GREEN}✅ X-Ray tracing enabled${NC}`);
    } else {
        console.log(`${YELLOW}⚠️  X-Ray tracing not enabled${NC}`);
        hasWarnings = true;
    }
    
} catch (error) {
    console.log(`${RED}❌ Error reading serverless.yml: ${error.message}${NC}`);
    hasErrors = true;
}

// Check package.json configuration
try {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
    
    // Check for PNPM package manager
    if (packageJson.packageManager && packageJson.packageManager.includes('pnpm')) {
        console.log(`${GREEN}✅ PNPM package manager configured${NC}`);
    } else {
        console.log(`${YELLOW}⚠️  PNPM package manager not explicitly configured${NC}`);
        hasWarnings = true;
    }
    
    // Check for ES modules
    if (packageJson.type === 'module') {
        console.log(`${GREEN}✅ ES modules configuration found${NC}`);
    } else {
        console.log(`${RED}❌ ES modules not configured (type: "module" missing)${NC}`);
        hasErrors = true;
    }
    
    // Check for required dependencies
    const requiredDeps = [
        '@aws-sdk/client-dynamodb',
        '@aws-sdk/client-ses',
        'jose',
        'bcryptjs',
        'zod',
        'validator'
    ];
    
    const missingDeps = requiredDeps.filter(dep => !packageJson.dependencies[dep]);
    if (missingDeps.length === 0) {
        console.log(`${GREEN}✅ All required dependencies found${NC}`);
    } else {
        console.log(`${RED}❌ Missing dependencies: ${missingDeps.join(', ')}${NC}`);
        hasErrors = true;
    }
    
} catch (error) {
    console.log(`${RED}❌ Error reading package.json: ${error.message}${NC}`);
    hasErrors = true;
}

// Check for required files
const requiredFiles = [
    'index.ts',
    'lib/router.ts',
    'lib/setup.ts',
    'handlers/auth/index.ts',
    'handlers/staff/index.ts',
    'handlers/tenant/index.ts',
    'middleware/auth.ts',
    'middleware/validation.ts'
];

let missingFiles = [];
for (const file of requiredFiles) {
    try {
        readFileSync(join(process.cwd(), file));
    } catch {
        missingFiles.push(file);
    }
}

if (missingFiles.length === 0) {
    console.log(`${GREEN}✅ All required source files found${NC}`);
} else {
    console.log(`${RED}❌ Missing required files: ${missingFiles.join(', ')}${NC}`);
    hasErrors = true;
}

// Summary
console.log('\n' + '='.repeat(60));
if (hasErrors) {
    console.log(`${RED}❌ Validation failed with errors. Please fix the issues above before deploying.${NC}`);
    process.exit(1);
} else if (hasWarnings) {
    console.log(`${YELLOW}⚠️  Validation completed with warnings. Deployment should work but consider addressing warnings.${NC}`);
    process.exit(0);
} else {
    console.log(`${GREEN}✅ All validation checks passed! Ready for deployment.${NC}`);
    console.log(`${GREEN}🚀 Run: pnpm run deploy:script${NC}`);
    process.exit(0);
}