# AWS Lambda Control Plane - Single Function Deployment Guide

This document provides comprehensive deployment instructions for the AWS Lambda Control Plane API using a single function architecture.

## Architecture Overview

The system uses a **single Lambda function** with internal Node.js routing to handle all API endpoints. This approach provides:

- **Optimal Performance**: All dependencies bundled with esbuild for faster cold starts
- **Deployment Flexibility**: Can run on AWS Lambda or AWS App Runner without code changes
- **Simplified Management**: One function to monitor, scale, and maintain
- **Cost Efficiency**: Reduced cold starts and better resource utilization

## Prerequisites

### Required Software
- **Node.js 20+**: Required runtime version
- **PNPM**: Package manager (required, not npm)
- **AWS CLI**: Configured with appropriate credentials
- **Serverless Framework v3**: For deployment automation

### AWS Permissions Required
Your AWS credentials must have permissions for:
- Lambda function creation and management
- API Gateway HTTP API creation
- DynamoDB table creation and management
- IAM role creation for Lambda execution
- CloudWatch alarms and logging
- X-Ray tracing configuration
- SES email sending (for password reset functionality)

## Environment Variables

### Required for All Deployments
```bash
# JWT signing secret (minimum 32 characters)
export JWT_SECRET="your-secure-jwt-secret-here"
```

### Required for Production
```bash
# Verified email address in Amazon SES
export SES_FROM_EMAIL="noreply@yourdomain.com"

# Optional: Custom CORS origins (defaults to stage-specific values)
export CORS_ORIGINS="https://yourdomain.com,https://app.yourdomain.com"
```

## Deployment Process

### 1. Pre-Deployment Validation

```bash
# Validate deployment configuration
npm run validate-deployment

# Generate JWT secret if needed
node scripts/generate-jwt-secret.js
export JWT_SECRET="generated-secret-here"
```

### 2. Development Deployment

```bash
# Quick development deployment
npm run deploy:dev

# Or using the deployment script (recommended)
npm run deploy:script
```

### 3. Production Deployment

```bash
# Set production environment variables
export JWT_SECRET="$(node scripts/generate-jwt-secret.js)"
export SES_FROM_EMAIL="noreply@yourdomain.com"

# Deploy to production with validation
npm run deploy:script:prod
```

### 4. Custom Stage/Region Deployment

```bash
# Deploy to custom stage and region
npm run deploy -- --stage staging --region us-west-2
```

## Single Function Configuration

### Serverless Framework Configuration

The `serverless.yml` is configured for single function deployment with:

#### Function Configuration
```yaml
functions:
  api:
    name: ${self:service}-${self:provider.stage}-api
    handler: index.handler
    description: "Single Lambda function handling all API endpoints with internal routing"
    events:
      - httpApi:
          path: /{proxy+}
          method: ANY
      - httpApi:
          path: /
          method: ANY
```

#### Performance Optimization
- **Memory**: 1024MB (optimized for performance)
- **Timeout**: 30 seconds
- **Architecture**: ARM64 for better price/performance
- **Reserved Concurrency**: 100 concurrent executions
- **Provisioned Concurrency**: 5 warm instances

#### Bundling Configuration
```yaml
custom:
  esbuild:
    bundle: true
    minify: true
    bundleNodeModules: true
    bundleExternalDependencies: true
    treeShaking: true
    target: node20
    format: esm
```

### API Gateway Configuration

- **Type**: HTTP API (lower latency and cost than REST API)
- **Integration**: Lambda Proxy Integration
- **Routing**: All routes (`/{proxy+}`) forwarded to single function
- **CORS**: Environment-specific origin configuration
- **Tracing**: X-Ray enabled for observability

### DynamoDB Tables

All tables use onboard-service naming convention:
- `onboard-staff-${stage}`: Staff accounts and authentication
- `onboard-password-reset-tokens-${stage}`: Time-limited password reset tokens
- `onboard-tenants-${stage}`: Tenant registration data
- `onboard-packages-${stage}`: Package definitions
- `onboard-subscription-types-${stage}`: Subscription type definitions
- `onboard-subscriptions-${stage}`: Subscription records
- `onboard-clusters-${stage}`: Cluster infrastructure records
- `landlord-${stage}`: **Global Table** - Landlord data replicated across multiple regions

## Monitoring and Observability

### CloudWatch Alarms

The deployment automatically creates alarms for:

1. **Lambda Duration Alarm**
   - Metric: p95 duration > 500ms
   - Evaluation: 2 periods of 5 minutes

2. **Lambda Error Rate Alarm**
   - Metric: Error count > 10 in 5 minutes
   - Evaluation: 2 periods

3. **API Gateway 4xx Errors**
   - Metric: Client errors > 20 in 5 minutes
   - Evaluation: 2 periods

4. **API Gateway 5xx Errors**
   - Metric: Server errors > 5 in 5 minutes
   - Evaluation: 1 period (immediate alert)

### Performance Targets

The single function is optimized for:
- **p50 Response Time**: ≤ 300ms (warm requests)
- **p95 Response Time**: ≤ 500ms (warm requests)
- **p95 Cold Start**: ≤ 1200ms (first request)

### X-Ray Tracing

Distributed tracing is enabled for:
- Lambda function execution
- API Gateway requests
- DynamoDB operations
- SES email sending

## Security Configuration

### IAM Roles

The Lambda function uses least-privilege IAM roles with permissions for:
- DynamoDB operations on stage-specific tables
- SES email sending with resource restrictions
- CloudWatch logging and X-Ray tracing
- No unnecessary permissions granted

### Input Validation

All endpoints use Zod schemas for:
- Request body validation
- Query parameter validation
- Header validation
- Strict type checking with unknown field rejection

### CORS Configuration

Environment-specific CORS origins:
- **Development**: `*` (all origins)
- **Staging**: `https://staging.example.com`
- **Production**: `https://app.example.com`

## Deployment Outputs

After successful deployment, you'll receive:

### API Information
- **API URL**: HTTP API Gateway endpoint
- **API ID**: Gateway identifier for monitoring
- **Function Name**: Lambda function identifier
- **Function ARN**: Complete function resource name

### Database Information
- **Staff Table**: `onboard-staff-${stage}`
- **Tenants Table**: `onboard-tenants-${stage}`
- **Clusters Table**: `onboard-clusters-${stage}`
- **Packages Table**: `onboard-packages-${stage}`
- **Subscription Types Table**: `onboard-subscription-types-${stage}`
- **Subscriptions Table**: `onboard-subscriptions-${stage}`
- **Landlord Global Table**: `landlord-${stage}` (replicated in ap-southeast-2, us-east-1, eu-central-1, eu-west-2)
- **Password Reset Tokens Table**: `PasswordResetTokens-${stage}`
- **Tenants Table**: `Tenants-${stage}`

### Performance Configuration
- Response time thresholds
- Cold start targets
- Monitoring alarm configuration

## Available API Endpoints

Once deployed, the following endpoints are available:

### Authentication
- `POST /auth/login` - Staff authentication with JWT token generation
- `POST /auth/password-reset/request` - Request password reset via email
- `POST /auth/password-reset/confirm` - Confirm password reset with token

### Staff Management (Admin Only)
- `POST /staff/register` - Register new staff account
- `POST /staff/enable` - Enable staff account
- `POST /staff/disable` - Disable staff account

### Profile Management
- `GET /staff/me` - Get current staff profile (authenticated)

### Tenant Management (Admin/Manager Only)
- `POST /tenant/register` - Register new tenant for ERP provisioning

## Troubleshooting

### Common Issues

1. **JWT_SECRET Not Set**
   ```bash
   Error: JWT_SECRET environment variable is not set
   Solution: Run `node scripts/generate-jwt-secret.js` and export the result
   ```

2. **SES Email Not Verified**
   ```bash
   Error: Email address not verified in SES
   Solution: Verify your email address in AWS SES console
   ```

3. **Insufficient AWS Permissions**
   ```bash
   Error: User is not authorized to perform action
   Solution: Ensure your AWS credentials have required permissions
   ```

4. **Node.js Version Mismatch**
   ```bash
   Error: Node.js version not supported
   Solution: Upgrade to Node.js 20 or higher
   ```

### Deployment Validation

Use the validation script to check configuration:
```bash
npm run validate-deployment
```

This will verify:
- Node.js version compatibility
- Environment variable configuration
- Serverless.yml syntax
- Required dependencies
- Source file structure

### Monitoring Deployment Health

After deployment, monitor:
- CloudWatch metrics for response times
- X-Ray traces for performance bottlenecks
- CloudWatch alarms for error rates
- Lambda function logs for errors

## Rollback Procedures

### Quick Rollback
```bash
# Remove current deployment
npm run remove

# Redeploy previous version
git checkout previous-version
npm run deploy:script
```

### Gradual Rollback
1. Monitor CloudWatch alarms
2. Check X-Ray traces for errors
3. Review Lambda function logs
4. If issues persist, execute quick rollback

## Cost Optimization

The single function architecture provides cost benefits:
- **Reduced Cold Starts**: Bundled dependencies load faster
- **Shared Resources**: One function handles all endpoints
- **Efficient Scaling**: Better resource utilization
- **Lower API Gateway Costs**: HTTP API is cheaper than REST API

### Cost Monitoring
- Monitor Lambda invocation counts
- Track API Gateway request volumes
- Review DynamoDB read/write capacity usage
- Monitor data transfer costs

## Next Steps

After successful deployment:
1. Test all API endpoints
2. Set up monitoring dashboards
3. Configure alerting for production issues
4. Review security configurations
5. Plan for scaling and performance optimization