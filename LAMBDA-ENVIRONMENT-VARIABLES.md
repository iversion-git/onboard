# Lambda Environment Variables Documentation

This document describes all environment variables configured for the Lambda functions deployed in the cluster application stack.

## Overview

All three Lambda functions (Web, Worker, and Artisan) share the same environment variables configuration defined in the `Globals.Function.Environment.Variables` section of the CloudFormation template.

## Environment Variables Reference

### Laravel Application Settings

| Variable | Type | Value | Description |
|----------|------|-------|-------------|
| `APP_ENV` | Dynamic | `Production`, `Staging`, or `Dev` | Laravel environment mode derived from `ClusterEnvironment` parameter |
| `APP_DEBUG` | Static | `false` | Laravel debug mode (always disabled for production) |

### AWS Infrastructure

| Variable | Type | Value/Source | Description |
|----------|------|--------------|-------------|
| `AWS_BUCKET` | Dynamic | `!Ref PrivateDataBucket` | S3 bucket name for tenant private data storage |
| `AWS_S3_REGION` | Dynamic | `!Ref AWS::Region` | AWS region where the S3 bucket is deployed |
| `AWS_EVENT_BRIDGE_ARN` | Dynamic | `!GetAtt AppQueue.Arn` | ARN of the SQS queue for EventBridge integration |
| `AWS_EVENT_BRIDGE_ROLE_ARN` | Dynamic | `!GetAtt SchedulerToSqsRole.Arn` | IAM role ARN for EventBridge Scheduler to send messages to SQS |

### Database Configuration

| Variable | Type | Value/Source | Description |
|----------|------|--------------|-------------|
| `DB_CONNECTION` | Static | `mysql` | Database driver type |
| `DB_HOST` | Dynamic | Import from `${EnvironmentName}-DBProxyEndpoint` | RDS Proxy endpoint for Aurora MySQL cluster |
| `DB_PORT` | Static | `3306` | MySQL database port |
| `DB_DATABASE` | Static | `""` (empty) | Database name (intentionally empty, managed by application) |
| `DB_USERNAME` | Dynamic | Import from `${EnvironmentName}-DBSecretArn` | AWS Secrets Manager ARN containing database username |
| `DB_PASSWORD` | Dynamic | Import from `${EnvironmentName}-DBSecretArn` | AWS Secrets Manager ARN containing database password |
| `DB_SSL_MODE` | Static | `REQUIRED` | Enforce SSL/TLS for database connections |

**Note:** Both `DB_USERNAME` and `DB_PASSWORD` reference the same Secrets Manager ARN. The application should parse the secret JSON to extract the username and password fields.

### Redis Configuration

| Variable | Type | Value/Source | Description |
|----------|------|--------------|-------------|
| `REDIS_HOST` | Dynamic | Import from `${EnvironmentName}-RedisEndpoint` | ElastiCache Serverless Redis endpoint |
| `REDIS_PORT` | Static | `6379` | Redis port (standard port with TLS) |
| `REDIS_SCHEME` | Static | `tls` | Connection scheme (TLS encryption enabled) |
| `REDIS_CLIENT` | Static | `predis` | PHP Redis client library |

**Note:** ElastiCache Serverless Redis has TLS enabled by default and uses port 6379.

### SQS Configuration

| Variable | Type | Value/Source | Description |
|----------|------|--------------|-------------|
| `SQS_PREFIX` | Dynamic | `https://sqs.${AWS::Region}.amazonaws.com/${AWS::AccountId}` | SQS URL prefix for the current region and account |
| `SQS_QUEUE` | Dynamic | `${ClusterName}-${Environment}-sqs-${ClusterIdShort}` | SQS queue name (e.g., `cluster-66-prod-sqs-954ac351`) |
| `SQS_QUEUE_URL` | Dynamic | `!Ref AppQueue` | Full SQS queue URL |

**Environment Mapping for SQS_QUEUE:**
- `Production` → `prod`
- `Staging` → `staging`
- `Dev` → `dev`

### DynamoDB Configuration

| Variable | Type | Value/Source | Description |
|----------|------|--------------|-------------|
| `DYNAMODB_TABLE` | Dynamic | `landlord-${Stage}` | Landlord global table name (e.g., `landlord-dev`, `landlord-prod`) |

**Note:** The table name is derived from the `Stage` parameter passed from the onboard application during cluster creation.

### JWT Configuration

| Variable | Type | Value | Description |
|----------|------|-------|-------------|
| `JWT_SECRET` | Static | `""` (empty) | JWT secret key (to be populated with Secrets Manager ARN in future) |
| `JWT_TTL` | Static | `60` | JWT token time-to-live in minutes |

**Note:** `JWT_SECRET` is currently empty and will be updated to reference a Secrets Manager ARN in a future iteration.

### Laravel Driver Configuration

| Variable | Type | Value | Description |
|----------|------|-------|-------------|
| `CACHE_DRIVER` | Static | `redis` | Laravel cache driver |
| `LOG_CHANNEL` | Static | `stderr` | Laravel logging channel (outputs to CloudWatch Logs) |
| `QUEUE_CONNECTION` | Static | `sqs` | Laravel queue driver |
| `SESSION_DRIVER` | Static | `redis` | Laravel session driver |

## IAM Permissions

All Lambda functions have the following IAM permissions to access the resources referenced in environment variables:

### Common Permissions (All Functions)

- **S3 Access**: Read/write to the private data bucket
- **RDS Access**: IAM database authentication via RDS Proxy
- **Secrets Manager**: Read database credentials from Secrets Manager
- **DynamoDB**: Read access to the tenant table (`onboard-tenants-dev` or `onboard-tenants-prod`)

### Function-Specific Permissions

#### Web Function
- **SQS**: Send messages to the queue

#### Worker Function
- **SQS**: Receive, delete, and manage messages from the queue (polling)

#### Artisan Function
- **SQS**: Send messages and purge queue

## Dynamic Value Resolution

### Environment Name Mapping

The `ClusterEnvironment` parameter maps to lowercase environment names:

```yaml
ClusterEnvironment: Production → Environment: prod
ClusterEnvironment: Staging   → Environment: staging
ClusterEnvironment: Dev       → Environment: dev
```

### Example Values

For a production cluster with ID `954ac351`:

```bash
APP_ENV=Production
AWS_BUCKET=cluster-66-prod-bucket-954ac351
DB_HOST=cluster-66-prod-aurora-proxy-954ac351.proxy-ct888uc424qp.ap-southeast-2.rds.amazonaws.com
REDIS_HOST=cluster-66-prod-redis-cache-954ac351-gm1fmx.serverless.apse2.cache.amazonaws.com
SQS_QUEUE=cluster-66-prod-sqs-954ac351
SQS_QUEUE_URL=https://sqs.ap-southeast-2.amazonaws.com/078607863013/cluster-66-prod-sqs-954ac351
DYNAMODB_TABLE=landlord-prod
```

## CloudFormation Imports

The following values are imported from other stacks:

| Import Name | Source Stack | Description |
|-------------|--------------|-------------|
| `${EnvironmentName}-DBProxyEndpoint` | Database Stack | RDS Proxy endpoint |
| `${EnvironmentName}-RedisEndpoint` | Database Stack | Redis endpoint |
| `${EnvironmentName}-DBSecretArn` | Database Stack | Database credentials secret ARN |

## Future Enhancements

1. **JWT_SECRET**: Will be updated to reference a Secrets Manager ARN instead of being empty
2. **Additional Secrets**: Consider moving other sensitive configuration to Secrets Manager
3. **Parameter Store**: Consider using AWS Systems Manager Parameter Store for non-sensitive configuration

## Related Files

- `stacks/app-template.yaml` - CloudFormation template defining these variables
- `stacks/database-template.yaml` - Database stack that exports DB and Redis endpoints
- `stacks/infrastructure-template.yaml` - Infrastructure stack defining VPC and security groups
