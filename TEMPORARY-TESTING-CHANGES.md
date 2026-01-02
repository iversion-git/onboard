# Temporary Testing Changes - UNDO LATER

## Overview
We temporarily modified the templates for quick testing by hardcoding values and removing the database stack. These changes need to be reverted once testing is complete.

## Changes Made for Testing

### 1. Hardcoded Code Bucket Value
**File**: `stacks/shared-main-template.yaml`
**Change**: Added default value to CodeBucketName parameter
```yaml
# BEFORE (restore this):
CodeBucketName:
  Type: String
  Description: S3 bucket name containing lambda-api.zip (from cluster code_bucket field)
  MinLength: 1
  ConstraintDescription: Must specify the code bucket name

# AFTER (current - remove default):
CodeBucketName:
  Type: String
  Description: S3 bucket name containing lambda-api.zip (from cluster code_bucket field)
  Default: manual-api-code-bucketstatic
  MinLength: 1
  ConstraintDescription: Must specify the code bucket name
```

**File**: `stacks/shared-app-template.yaml`
**Change**: Added default value to CodeBucketName parameter
```yaml
# BEFORE (restore this):
CodeBucketName:
  Type: String
  Description: S3 bucket name containing lambda-api.zip (from cluster code_bucket field)
  MinLength: 1
  ConstraintDescription: Must specify the code bucket name

# AFTER (current - remove default):
CodeBucketName:
  Type: String
  Description: S3 bucket name containing lambda-api.zip (from cluster code_bucket field)
  Default: manual-api-code-bucketstatic
  MinLength: 1
  ConstraintDescription: Must specify the code bucket name
```

**File**: `handlers/cluster/deploy.ts`
**Change**: Hardcoded code bucket value instead of using cluster.code_bucket
```typescript
// BEFORE (restore this):
{ ParameterKey: 'CodeBucketName', ParameterValue: cluster.code_bucket }, // Lambda code bucket

// AFTER (current - revert to above):
{ ParameterKey: 'CodeBucketName', ParameterValue: 'manual-api-code-bucketstatic' }, // Hardcoded for testing
```

### 2. Hardcoded Redis Endpoint
**File**: `stacks/shared-app-template.yaml`
**Change**: Replaced CloudFormation imports with hardcoded values
```yaml
# BEFORE (restore this):
# From DB stack output (Redis endpoint)
REDIS_HOST: !ImportValue
  'Fn::Sub': '${EnvironmentName}-RedisEndpoint'
# Database connection (RDS Proxy endpoint)
DB_HOST: !ImportValue
  'Fn::Sub': '${EnvironmentName}-DBProxyEndpoint'
DB_PORT: "3306"
DB_DATABASE: !ImportValue
  'Fn::Sub': '${EnvironmentName}-DatabaseName'

# AFTER (current - revert to above):
# From hardcoded values for testing (Redis endpoint)
REDIS_HOST: mycluster-12-redis-cache-gm1fmx.serverless.apse2.cache.amazonaws.com
# Database connection (hardcoded for testing - will be replaced with RDS Proxy later)
DB_HOST: localhost
DB_PORT: "3306"
DB_DATABASE: appdb
```

### 3. Removed Database Stack from Main Template
**File**: `stacks/shared-main-template.yaml`

#### A. Removed Database Parameters
**Change**: Removed all database-related parameters from Parameters section
```yaml
# RESTORE THESE PARAMETERS:
DatabaseName:
  Type: String
  Description: Default database name to create
  Default: appdb
  MinLength: 1
  MaxLength: 64
  AllowedPattern: ^[a-zA-Z][a-zA-Z0-9_]*$
  ConstraintDescription: Must begin with a letter and contain only alphanumeric characters and underscores

MinCapacity:
  Type: Number
  Description: Minimum Aurora Capacity Units (ACU) for serverless v2
  Default: 0.5
  MinValue: 0.5
  MaxValue: 128
  ConstraintDescription: Must be between 0.5 and 128

MaxCapacity:
  Type: Number
  Description: Maximum Aurora Capacity Units (ACU) for serverless v2
  Default: 128
  MinValue: 0.5
  MaxValue: 128
  ConstraintDescription: Must be between 0.5 and 128

BackupRetentionPeriod:
  Type: Number
  Description: Number of days to retain automated backups
  Default: 7
  MinValue: 1
  MaxValue: 35
  ConstraintDescription: Must be between 1 and 35 days

PreferredBackupWindow:
  Type: String
  Description: Preferred backup window (UTC time)
  Default: "03:00-04:00"
  AllowedPattern: ^([0-1][0-9]|2[0-3]):[0-5][0-9]-([0-1][0-9]|2[0-3]):[0-5][0-9]$
  ConstraintDescription: Must be in format HH:MM-HH:MM (UTC)

PreferredMaintenanceWindow:
  Type: String
  Description: Preferred maintenance window
  Default: "sun:04:00-sun:05:00"
  AllowedPattern: ^(sun|mon|tue|wed|thu|fri|sat):[0-2][0-9]:[0-5][0-9]-(sun|mon|tue|wed|thu|fri|sat):[0-2][0-9]:[0-5][0-9]$
  ConstraintDescription: Must be in format ddd:HH:MM-ddd:HH:MM

DeletionProtection:
  Type: String
  Description: Enable deletion protection for Aurora cluster
  Default: "false"
  AllowedValues:
    - "true"
    - "false"
  ConstraintDescription: Must be true or false
```

#### B. Removed Database Configuration from Metadata
**Change**: Removed database parameter group from AWS::CloudFormation::Interface
```yaml
# RESTORE THIS PARAMETER GROUP:
- Label:
    default: "Database Configuration"
  Parameters:
    - DatabaseName
    - MinCapacity
    - MaxCapacity
    - BackupRetentionPeriod
    - PreferredBackupWindow
    - PreferredMaintenanceWindow
    - DeletionProtection
```

#### C. Removed DatabaseStack Resource
**Change**: Removed entire DatabaseStack resource and changed ApplicationStack dependency
```yaml
# RESTORE THIS ENTIRE RESOURCE:
DatabaseStack:
  Type: AWS::CloudFormation::Stack
  DependsOn: InfrastructureStack
  Properties:
    TemplateURL: !Sub
      - 'https://${TemplateS3Bucket}.s3.${AWS::Region}.amazonaws.com/${Prefix}shared-database-template.yaml'
      - Prefix: !If [HasTemplatePrefix, !Sub '${TemplateS3KeyPrefix}/', '']
    Parameters:
      EnvironmentName: !Ref EnvironmentName
      DatabaseName: !Ref DatabaseName
      MinCapacity: !Ref MinCapacity
      MaxCapacity: !Ref MaxCapacity
      BackupRetentionPeriod: !Ref BackupRetentionPeriod
      PreferredBackupWindow: !Ref PreferredBackupWindow
      PreferredMaintenanceWindow: !Ref PreferredMaintenanceWindow
      DeletionProtection: !Ref DeletionProtection
      ProjectName: !Ref ProjectName
      CostCenter: !Ref CostCenter
      Owner: !Ref Owner
      ClusterName: !Ref ClusterName
      ClusterType: !Ref ClusterType
      ClusterEnvironment: !Ref ClusterEnvironment
    Tags:
      - Key: Name
        Value: !Sub ${ClusterName}-Database
      - Key: Type
        Value: !Ref ClusterType
      - Key: Environment
        Value: !Ref ClusterEnvironment
      - Key: StackType
        Value: Database
      - Key: ManagedBy
        Value: CloudFormation
      - !If
        - HasProjectName
        - Key: Project
          Value: !Ref ProjectName
        - !Ref AWS::NoValue
      - !If
        - HasCostCenter
        - Key: CostCenter
          Value: !Ref CostCenter
        - !Ref AWS::NoValue
      - !If
        - HasOwner
        - Key: Owner
          Value: !Ref Owner
        - !Ref AWS::NoValue

# CHANGE ApplicationStack DEPENDENCY BACK TO:
ApplicationStack:
  Type: AWS::CloudFormation::Stack
  DependsOn: DatabaseStack  # CHANGE FROM: DependsOn: InfrastructureStack
```

#### D. Removed Database Outputs
**Change**: Removed all database-related outputs
```yaml
# RESTORE THESE OUTPUTS:
DatabaseStackId:
  Description: Database nested stack ID
  Value: !Ref DatabaseStack

# Database Outputs (passed through from nested stack)
AuroraClusterEndpoint:
  Description: Aurora MySQL cluster endpoint
  Value: !GetAtt DatabaseStack.Outputs.AuroraClusterEndpoint

AuroraClusterReadEndpoint:
  Description: Aurora MySQL cluster read endpoint
  Value: !GetAtt DatabaseStack.Outputs.AuroraClusterReadEndpoint

AuroraClusterPort:
  Description: Aurora MySQL cluster port
  Value: !GetAtt DatabaseStack.Outputs.AuroraClusterPort

DBProxyEndpoint:
  Description: RDS Proxy endpoint for connection pooling
  Value: !GetAtt DatabaseStack.Outputs.DBProxyEndpoint

DBSecretArn:
  Description: ARN of the database password secret (AWS managed)
  Value: !GetAtt DatabaseStack.Outputs.DBSecretArn

DatabaseName:
  Description: Default database name
  Value: !GetAtt DatabaseStack.Outputs.DatabaseName

# Redis Outputs (passed through from database stack)
RedisEndpoint:
  Description: ElastiCache Serverless Redis endpoint
  Value: !GetAtt DatabaseStack.Outputs.RedisEndpoint

RedisPort:
  Description: ElastiCache Serverless Redis port
  Value: !GetAtt DatabaseStack.Outputs.RedisPort
```

#### E. Changed Deployment Architecture Description
**Change**: Updated deployment architecture description
```yaml
# BEFORE (restore this):
DeploymentArchitecture:
  Description: Deployment architecture used
  Value: "Nested Stacks (Infrastructure + Database + Application)"

# AFTER (current - revert to above):
DeploymentArchitecture:
  Description: Deployment architecture used
  Value: "Nested Stacks (Infrastructure + Application)"
```

## Current Testing Architecture
```
shared-main-template.yaml (orchestrator)
├── shared-infrastructure-template.yaml (VPC, subnets, security groups)
└── shared-app-template.yaml (Laravel Lambda + API Gateway + SQS)
```

## Target Production Architecture (restore to this)
```
shared-main-template.yaml (orchestrator)
├── shared-infrastructure-template.yaml (VPC, subnets, security groups)
├── shared-database-template.yaml (Aurora MySQL + RDS Proxy + Redis)
└── shared-app-template.yaml (Laravel Lambda + API Gateway + SQS)
```

## Files Modified
1. `stacks/shared-main-template.yaml` - Major changes (parameters, resources, outputs)
2. `stacks/shared-app-template.yaml` - Environment variables hardcoded
3. `handlers/cluster/deploy.ts` - Hardcoded code bucket parameter

## Testing Values Used
- Code Bucket: `manual-api-code-bucketstatic`
- Redis Endpoint: `mycluster-12-redis-cache-gm1fmx.serverless.apse2.cache.amazonaws.com:6379`
- DB Host: `localhost` (placeholder)

## Restoration Priority
1. **High Priority**: Restore CloudFormation imports in app template (Redis/DB endpoints)
2. **High Priority**: Restore DatabaseStack resource and dependency in main template
3. **Medium Priority**: Restore database parameters and outputs in main template
4. **Low Priority**: Remove hardcoded defaults from CodeBucketName parameters
5. **Low Priority**: Restore dynamic code bucket usage in deploy handler

## Notes
- The database stack template (`shared-database-template.yaml`) was NOT modified
- The upload script already includes the app template
- All database functionality is intact, just temporarily bypassed
- The cluster creation API still accepts code_bucket field, it's just overridden during deployment