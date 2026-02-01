# Environment Variables Quick Reference

## Static Variables (Never Change)

| Variable | Value | Purpose |
|----------|-------|---------|
| `APP_DEBUG` | `false` | Laravel debug mode |
| `DB_CONNECTION` | `mysql` | Database driver |
| `DB_PORT` | `3306` | MySQL port |
| `DB_DATABASE` | `""` | Database name (empty) |
| `DB_SSL_MODE` | `REQUIRED` | Force SSL connections |
| `REDIS_PORT` | `6379` | Redis port with TLS |
| `REDIS_SCHEME` | `tls` | Redis encryption |
| `REDIS_CLIENT` | `predis` | PHP Redis client |
| `JWT_TTL` | `60` | JWT expiry (minutes) |
| `CACHE_DRIVER` | `redis` | Laravel cache |
| `LOG_CHANNEL` | `stderr` | CloudWatch logging |
| `QUEUE_CONNECTION` | `sqs` | Laravel queue |
| `SESSION_DRIVER` | `redis` | Laravel sessions |

## Dynamic Variables (From CloudFormation)

### From Stack Parameters

| Variable | Source | Example |
|----------|--------|---------|
| `APP_ENV` | `ClusterEnvironment` parameter | `Production`, `Staging`, `Dev` |

### From Stack Resources

| Variable | Source | Example |
|----------|--------|---------|
| `AWS_BUCKET` | `!Ref PrivateDataBucket` | `cluster-66-prod-bucket-954ac351` |
| `AWS_S3_REGION` | `!Ref AWS::Region` | `ap-southeast-2` |
| `AWS_EVENT_BRIDGE_ARN` | `!GetAtt AppQueue.Arn` | `arn:aws:sqs:...` |
| `AWS_EVENT_BRIDGE_ROLE_ARN` | `!GetAtt SchedulerToSqsRole.Arn` | `arn:aws:iam::...` |
| `SQS_QUEUE_URL` | `!Ref AppQueue` | `https://sqs.ap-southeast-2.amazonaws.com/...` |

### From Stack Imports (Database Stack)

| Variable | Import Name | Example |
|----------|-------------|---------|
| `DB_HOST` | `${EnvironmentName}-DBProxyEndpoint` | `cluster-66-prod-aurora-proxy-954ac351.proxy-...` |
| `DB_USERNAME` | `${EnvironmentName}-DBSecretArn` | `arn:aws:secretsmanager:...` |
| `DB_PASSWORD` | `${EnvironmentName}-DBSecretArn` | `arn:aws:secretsmanager:...` |
| `REDIS_HOST` | `${EnvironmentName}-RedisEndpoint` | `cluster-66-prod-redis-cache-954ac351-...` |

### Computed Dynamic Variables

| Variable | Formula | Example |
|----------|---------|---------|
| `SQS_PREFIX` | `https://sqs.${Region}.amazonaws.com/${AccountId}` | `https://sqs.ap-southeast-2.amazonaws.com/078607863013` |
| `SQS_QUEUE` | `${ClusterName}-${Env}-sqs-${ClusterIdShort}` | `cluster-66-prod-sqs-954ac351` |
| `DYNAMODB_TABLE` | `landlord-${Stage}` | `landlord-prod` |

## Environment Mapping

| ClusterEnvironment | Resolves To |
|-------------------|-------------|
| `Production` | `prod` |
| `Staging` | `staging` |
| `Dev` | `dev` |

## To Be Implemented

| Variable | Current | Future |
|----------|---------|--------|
| `JWT_SECRET` | `""` (empty) | Secrets Manager ARN |

## IAM Permissions Required

All Lambda functions need:
- ✅ S3: Read/write to `AWS_BUCKET`
- ✅ Secrets Manager: Read `DB_USERNAME` and `DB_PASSWORD` ARN
- ✅ RDS: IAM authentication to `DB_HOST`
- ✅ DynamoDB: Read from `onboard-tenants-{env}` table
- ✅ SQS: Send/receive from `SQS_QUEUE_URL`

## Application Code Notes

### Database Credentials
The application must parse the Secrets Manager secret JSON:
```json
{
  "username": "admin",
  "password": "actual_password_here"
}
```

### DynamoDB Table Names
- Tenant table: `onboard-tenants-dev` or `onboard-tenants-prod`
- Landlord table: `landlord-dev` or `landlord-prod`

### Redis Connection
- Uses TLS encryption (mandatory for ElastiCache Serverless)
- Port 6379 (not 6380)
- Predis client library

### SQS Queue
- Worker function polls automatically via Lambda event source mapping
- Web and Artisan functions send messages using `SQS_QUEUE_URL`
