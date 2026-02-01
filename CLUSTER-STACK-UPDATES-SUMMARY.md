# Cluster Stack Updates Summary

## Overview

This document summarizes all changes made to the cluster stack templates to properly configure Lambda functions with correct environment variables, security group ports, and IAM permissions.

## Files Modified

1. `stacks/infrastructure-template.yaml` - Security group port updates for Redis
2. `stacks/app-template.yaml` - Environment variables and IAM permissions updates
3. `LAMBDA-ENVIRONMENT-VARIABLES.md` - New documentation file (created)

## Changes Made

### 1. Infrastructure Template (`stacks/infrastructure-template.yaml`)

#### Redis Security Group Port Changes

**Changed Redis port from 6380 to 6379 (standard Redis port with TLS)**

- **RedisSecurityGroup Ingress Rule**:
  - Changed `FromPort: 6380` → `FromPort: 6379`
  - Changed `ToPort: 6380` → `ToPort: 6379`

- **LambdaSecurityGroupEgressRedis**:
  - Changed `FromPort: 6380` → `FromPort: 6379`
  - Changed `ToPort: 6380` → `ToPort: 6379`

**Rationale**: ElastiCache Serverless Redis uses port 6379 with TLS enabled by default.

---

### 2. Application Template (`stacks/app-template.yaml`)

#### A. Environment Variables - Complete Restructure

Reorganized and updated all environment variables to match production requirements:

##### Laravel Application Settings
- ✅ **NEW**: `APP_ENV` - Dynamic from `ClusterEnvironment` parameter
- ✅ **NEW**: `APP_DEBUG` - Static value `"false"`

##### AWS Infrastructure
- ✅ **UPDATED**: `AWS_BUCKET` - References `PrivateDataBucket` (removed `PRIVATE_BUCKET` duplicate)
- ✅ **KEPT**: `AWS_S3_REGION` - Dynamic from region
- ✅ **KEPT**: `AWS_EVENT_BRIDGE_ARN` - SQS queue ARN
- ✅ **KEPT**: `AWS_EVENT_BRIDGE_ROLE_ARN` - Scheduler role ARN

##### Database Configuration
- ✅ **KEPT**: `DB_CONNECTION` - Static `"mysql"`
- ✅ **KEPT**: `DB_HOST` - Dynamic from database stack
- ✅ **KEPT**: `DB_PORT` - Static `"3306"`
- ✅ **NEW**: `DB_DATABASE` - Empty string (managed by application)
- ✅ **UPDATED**: `DB_USERNAME` - Now references Secrets Manager ARN
- ✅ **UPDATED**: `DB_PASSWORD` - Now references Secrets Manager ARN
- ✅ **KEPT**: `DB_SSL_MODE` - Static `"REQUIRED"`
- ❌ **REMOVED**: `DB_AUTH_METHOD` - No longer needed

##### Redis Configuration
- ✅ **KEPT**: `REDIS_HOST` - Dynamic from database stack
- ✅ **UPDATED**: `REDIS_PORT` - Changed from `"6380"` to `"6379"`
- ✅ **KEPT**: `REDIS_SCHEME` - Static `"tls"`
- ✅ **KEPT**: `REDIS_CLIENT` - Static `"predis"`

##### SQS Configuration
- ✅ **KEPT**: `SQS_PREFIX` - Dynamic URL prefix
- ✅ **UPDATED**: `SQS_QUEUE` - Now dynamic with cluster name and environment
- ✅ **KEPT**: `SQS_QUEUE_URL` - Full queue URL
- ❌ **REMOVED**: `SQS_QUEUE_NAME` - Consolidated into `SQS_QUEUE`

##### DynamoDB Configuration
- ✅ **NEW**: `DYNAMODB_TABLE` - Dynamic `landlord-${Stage}` table name
- ❌ **REMOVED**: `TENANT_TABLE_NAME` - Replaced with `DYNAMODB_TABLE`

##### JWT Configuration
- ✅ **NEW**: `JWT_SECRET` - Empty (to be populated with Secrets Manager ARN later)
- ✅ **NEW**: `JWT_TTL` - Static `"60"` minutes

##### Laravel Driver Configuration
- ✅ **KEPT**: `CACHE_DRIVER` - Static `"redis"`
- ✅ **KEPT**: `LOG_CHANNEL` - Static `"stderr"`
- ✅ **KEPT**: `QUEUE_CONNECTION` - Static `"sqs"`
- ✅ **KEPT**: `SESSION_DRIVER` - Static `"redis"`

#### B. IAM Permissions Updates

Added permissions to all three Lambda functions (Web, Worker, Artisan):

##### New Permissions Added

1. **Secrets Manager Access** (all functions):
   ```yaml
   - Effect: Allow
     Action:
       - secretsmanager:GetSecretValue
       - secretsmanager:DescribeSecret
     Resource: 
       - !ImportValue '${EnvironmentName}-DBSecretArn'
   ```

2. **DynamoDB Tenant Table Access** (all functions):
   ```yaml
   - Effect: Allow
     Action:
       - dynamodb:GetItem
       - dynamodb:Query
       - dynamodb:Scan
     Resource: 
       - "arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/onboard-tenants-${Environment}"
   ```
   - Environment resolves to `dev` or `prod` based on `ClusterEnvironment`

##### Existing Permissions Retained

- **S3 Access**: Read/write to private data bucket
- **RDS Access**: IAM database authentication
- **SQS Access**: 
  - Web & Artisan: Send messages
  - Worker: Receive, delete, and manage messages (polling)

---

## Environment Variable Resolution

### Dynamic Values

| Variable | Resolution Logic |
|----------|------------------|
| `APP_ENV` | Direct from `ClusterEnvironment` parameter (Production/Staging/Dev) |
| `SQS_QUEUE` | `${ClusterName}-${Environment}-sqs-${ClusterIdShort}` where Environment = prod/staging/dev |
| `DYNAMODB_TABLE` | `landlord-${Stage}` where Stage comes from onboard app |
| `DB_USERNAME` | Import from database stack: `${EnvironmentName}-DBSecretArn` |
| `DB_PASSWORD` | Import from database stack: `${EnvironmentName}-DBSecretArn` |

### Example Production Values

For cluster `cluster-66` in production with ID `954ac351`:

```bash
APP_ENV=Production
APP_DEBUG=false
AWS_BUCKET=cluster-66-prod-bucket-954ac351
AWS_S3_REGION=ap-southeast-2
DB_CONNECTION=mysql
DB_HOST=cluster-66-prod-aurora-proxy-954ac351.proxy-ct888uc424qp.ap-southeast-2.rds.amazonaws.com
DB_PORT=3306
DB_DATABASE=
DB_USERNAME=arn:aws:secretsmanager:ap-southeast-2:078607863013:secret:...
DB_PASSWORD=arn:aws:secretsmanager:ap-southeast-2:078607863013:secret:...
DB_SSL_MODE=REQUIRED
REDIS_HOST=cluster-66-prod-redis-cache-954ac351-gm1fmx.serverless.apse2.cache.amazonaws.com
REDIS_PORT=6379
REDIS_SCHEME=tls
REDIS_CLIENT=predis
SQS_PREFIX=https://sqs.ap-southeast-2.amazonaws.com/078607863013
SQS_QUEUE=cluster-66-prod-sqs-954ac351
SQS_QUEUE_URL=https://sqs.ap-southeast-2.amazonaws.com/078607863013/cluster-66-prod-sqs-954ac351
DYNAMODB_TABLE=landlord-prod
JWT_SECRET=
JWT_TTL=60
CACHE_DRIVER=redis
LOG_CHANNEL=stderr
QUEUE_CONNECTION=sqs
SESSION_DRIVER=redis
```

## Key Improvements

1. ✅ **Correct Redis Port**: Changed from 6380 to 6379 (standard port with TLS)
2. ✅ **Secrets Manager Integration**: Database credentials now reference Secrets Manager ARN
3. ✅ **Dynamic SQS Queue Name**: Queue name now includes cluster name and environment
4. ✅ **Proper Environment Mapping**: APP_ENV uses full environment name (Production/Staging/Dev)
5. ✅ **DynamoDB Table Access**: All Lambda functions can read tenant data
6. ✅ **Removed Duplicates**: Eliminated `PRIVATE_BUCKET` in favor of `AWS_BUCKET`
7. ✅ **Comprehensive IAM Permissions**: All functions have necessary permissions for their operations

## Testing Checklist

Before deploying these changes, verify:

- [ ] Database stack exports `${EnvironmentName}-DBSecretArn`
- [ ] Tenant table exists: `onboard-tenants-dev` or `onboard-tenants-prod`
- [ ] Landlord table exists: `landlord-dev` or `landlord-prod`
- [ ] Application code can parse Secrets Manager JSON for DB credentials
- [ ] Application code uses correct environment variable names
- [ ] Redis connection uses port 6379 with TLS
- [ ] SQS queue name matches the dynamic format

## Future Enhancements

1. **JWT_SECRET**: Populate with Secrets Manager ARN instead of empty string
2. **Additional Secrets**: Consider moving other sensitive config to Secrets Manager
3. **Parameter Store**: Use AWS Systems Manager Parameter Store for non-sensitive config
4. **Environment-Specific Settings**: Add more environment-specific configurations as needed

## Related Documentation

- `LAMBDA-ENVIRONMENT-VARIABLES.md` - Complete environment variables reference
- `stacks/app-template.yaml` - Application stack template
- `stacks/infrastructure-template.yaml` - Infrastructure stack template
- `stacks/database-template.yaml` - Database stack template

## Deployment Notes

When deploying these changes:

1. Deploy infrastructure stack first (Redis port changes)
2. Ensure database stack is up-to-date with secret exports
3. Deploy application stack with new environment variables
4. Verify Lambda functions can access all resources
5. Test database connectivity using Secrets Manager credentials
6. Verify SQS message processing works correctly
