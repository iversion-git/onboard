# Deployment Configuration Guide

## Overview

All deployment settings are now centralized in the `deployment-config.yml` file. You can customize your deployment by editing this single file instead of dealing with environment variables or command-line parameters.

## Configuration File: `deployment-config.yml`

### Basic Configuration

```yaml
# Basic Configuration
service_name: aws-lambda-control-plane  # Change this to customize your service name
default_stage: dev                       # Default deployment stage
default_region: ap-southeast-2          # Default AWS region
aws_profile: node                       # AWS CLI profile to use
```

### Security Configuration

```yaml
# Security Configuration
jwt_secret: your-jwt-secret-here        # CHANGE THIS! Generate with: node scripts/generate-jwt-secret.js
ses_from_email: noreply@example.com     # Email address for sending notifications
```

**⚠️ IMPORTANT**: Always change the `jwt_secret` value! Generate a new one using:
```bash
node scripts/generate-jwt-secret.js
```

### Performance Configuration

```yaml
# Performance Configuration
lambda_memory: 1024                     # Lambda memory in MB
lambda_timeout: 30                      # Lambda timeout in seconds
lambda_architecture: arm64              # Lambda architecture (arm64 or x86_64)
reserved_concurrency: 100               # Reserved concurrency limit
provisioned_concurrency: 5              # Provisioned concurrency (warm instances)
```

### CORS Configuration

```yaml
# CORS Configuration by Stage
cors_origins:
  dev: "*"                              # Allow all origins in development
  staging: "https://staging.example.com" # Staging domain
  prod: "https://app.example.com"       # Production domain
```

### Monitoring Configuration

```yaml
# Performance Monitoring Thresholds
performance:
  p50_response_time: 300                # p50 response time target (ms)
  p95_response_time: 500                # p95 response time target (ms)
  p95_cold_start: 1200                  # p95 cold start target (ms)

# CloudWatch Alarms Configuration
alarms:
  lambda_duration_threshold: 500        # Lambda duration alarm threshold (ms)
  lambda_error_threshold: 10            # Lambda error count threshold (5 min)
  api_4xx_error_threshold: 20           # API 4xx error threshold (5 min)
  api_5xx_error_threshold: 5            # API 5xx error threshold (5 min)
```

## How to Deploy

### Method 1: Simple Deployment (Recommended)

Just run the batch file - it reads all settings from `deployment-config.yml`:

```cmd
deploy.bat
```

### Method 2: Using Serverless CLI Directly

```bash
# Deploy using default settings from config file
serverless deploy

# Deploy to specific stage
serverless deploy --stage prod

# Deploy to specific region
serverless deploy --region us-east-1
```

### Method 3: Using PowerShell Script

```powershell
# Deploy with default settings
.\deploy-simple.ps1

# Deploy to specific stage
.\deploy-simple.ps1 -Stage prod

# Deploy to specific region and stage
.\deploy-simple.ps1 -Stage prod -Region us-east-1
```

### Method 4: Using NPM Scripts

```bash
# Deploy to development
npm run deploy:dev

# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:prod
```

## Customization Examples

### Example 1: Different Service Name

```yaml
service_name: my-company-api
```

This will create resources like:
- Lambda function: `my-company-api-dev-api`
- DynamoDB tables: `Staff-dev`, `Tenants-dev`, etc.

### Example 2: Different Region

```yaml
default_region: us-west-2
```

### Example 3: Production Configuration

```yaml
# Production settings
default_stage: prod
lambda_memory: 2048
reserved_concurrency: 500
provisioned_concurrency: 20

cors_origins:
  prod: "https://myapp.com,https://admin.myapp.com"

jwt_secret: "your-super-secure-production-jwt-secret-here"
ses_from_email: "noreply@myapp.com"
```

### Example 4: High-Performance Configuration

```yaml
# High-performance settings
lambda_memory: 3008                     # Maximum Lambda memory
lambda_timeout: 30
reserved_concurrency: 1000
provisioned_concurrency: 50

performance:
  p50_response_time: 100                # Stricter performance targets
  p95_response_time: 200
  p95_cold_start: 500

alarms:
  lambda_duration_threshold: 200        # Stricter monitoring
  lambda_error_threshold: 5
  api_4xx_error_threshold: 10
  api_5xx_error_threshold: 2
```

## Configuration Validation

Before deploying, you can validate your configuration:

```bash
# Check configuration syntax
serverless print

# Validate deployment readiness
npm run validate-deployment
```

## Environment-Specific Deployments

You can have different configurations for different environments by creating multiple config files:

1. `deployment-config.yml` (default/development)
2. `deployment-config-staging.yml`
3. `deployment-config-prod.yml`

Then modify the serverless.yml to load the appropriate config:

```yaml
configFile: ${file(./deployment-config-${self:provider.stage, 'dev'}.yml)}
```

## Security Best Practices

1. **Never commit real JWT secrets** to version control
2. **Use different JWT secrets** for each environment
3. **Restrict CORS origins** in production
4. **Use verified SES email addresses** in production
5. **Set appropriate alarm thresholds** for your use case

## Troubleshooting

### Common Issues

1. **Invalid JWT Secret**: Make sure it's at least 32 characters long
2. **AWS Profile Not Found**: Ensure your AWS profile is configured correctly
3. **Region Mismatch**: Check that your AWS profile region matches the config
4. **SES Email Not Verified**: Verify your email address in AWS SES console

### Getting Help

- Check the deployment logs: `serverless logs -f api`
- View stack info: `serverless info`
- Remove and redeploy: `serverless remove` then `serverless deploy`