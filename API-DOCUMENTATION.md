# AWS Lambda Control Plane API Documentation

## Base URL
```
https://6eoez7ugs9.execute-api.ap-southeast-2.amazonaws.com
```

## Authentication
Most endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Response Format
All responses follow this structure:
```json
{
  "success": true,
  "data": { /* endpoint-specific data */ },
  "timestamp": "2025-12-26T05:00:00.000Z"
}
```

Error responses:
```json
{
  "error": {
    "code": "ErrorCode",
    "message": "Error description",
    "correlationId": "unique-request-id"
  },
  "timestamp": "2025-12-26T05:00:00.000Z"
}
```

---

## Authentication Endpoints

### POST /auth/login
**Description**: Authenticate staff member and receive JWT token

**Authentication**: None required

**Request Body**:
```json
{
  "email": "user@example.com",     // ✅ Required - Valid email address
  "password": "Password123!"       // ✅ Required - Minimum 1 character
}
```

**Success Response (200)**:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "staff": {
      "staff_id": "550e8400-e29b-41d4-a716-446655440001",
      "email": "user@example.com",
      "roles": ["admin"],
      "enabled": true
    }
  },
  "timestamp": "2025-12-26T05:00:00.000Z"
}
```

**Error Responses**:
- `400 ValidationError` - Invalid email format or missing fields
- `401 Unauthorized` - Invalid credentials or disabled account

---

### POST /auth/password-reset/request
**Description**: Request password reset token via email

**Authentication**: None required

**Request Body**:
```json
{
  "email": "user@example.com"      // ✅ Required - Valid email address
}
```

**Success Response (200)**:
```json
{
  "success": true,
  "data": {
    "message": "Password reset email sent if account exists"
  },
  "timestamp": "2025-12-26T05:00:00.000Z"
}
```

**Error Responses**:
- `400 ValidationError` - Invalid email format
- `500 InternalError` - Email service error

---

### POST /auth/password-reset/confirm
**Description**: Confirm password reset with token

**Authentication**: None required

**Request Body**:
```json
{
  "token": "reset-token-from-email",    // ✅ Required - Reset token from email
  "new_password": "NewPassword123!"     // ✅ Required - 8-128 characters
}
```

**Success Response (200)**:
```json
{
  "success": true,
  "data": {
    "message": "Password updated successfully"
  },
  "timestamp": "2025-12-26T05:00:00.000Z"
}
```

**Error Responses**:
- `400 ValidationError` - Invalid token or password format
- `401 Unauthorized` - Expired or invalid token
- `500 InternalError` - Database error

---

## Staff Management Endpoints

### GET /staff/me
**Description**: Get current authenticated staff member's profile

**Authentication**: ✅ Required (Any authenticated user)

**Request Body**: None

**Success Response (200)**:
```json
{
  "success": true,
  "data": {
    "staff_id": "550e8400-e29b-41d4-a716-446655440001",
    "email": "user@example.com",
    "roles": ["admin"],
    "enabled": true,
    "created_at": "2025-12-26T05:00:00.000Z",
    "updated_at": "2025-12-26T05:00:00.000Z"
  },
  "timestamp": "2025-12-26T05:00:00.000Z"
}
```

**Error Responses**:
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - Account is disabled
- `404 NotFound` - Staff member not found

---

### POST /staff/register
**Description**: Create new staff account

**Authentication**: ✅ Required (Admin only)

**Request Body**:
```json
{
  "email": "newstaff@example.com",     // ✅ Required - Valid email address
  "password": "StrongPassword123!",    // ✅ Required - 8-128 characters
  "roles": ["staff"]                   // ✅ Required - Array of: admin, manager, staff
}
```

**Success Response (201)**:
```json
{
  "success": true,
  "data": {
    "staff_id": "550e8400-e29b-41d4-a716-446655440002",
    "email": "newstaff@example.com",
    "roles": ["staff"],
    "enabled": true,
    "created_at": "2025-12-26T05:00:00.000Z"
  },
  "timestamp": "2025-12-26T05:00:00.000Z"
}
```

**Error Responses**:
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - Insufficient permissions (not admin)
- `409 Conflict` - Email already exists
- `400 ValidationError` - Invalid email, password, or roles

---

### POST /staff/enable
**Description**: Enable a staff account

**Authentication**: ✅ Required (Admin only)

**Request Body**:
```json
{
  "staff_id": "550e8400-e29b-41d4-a716-446655440002"  // ✅ Required - Valid UUID
}
```

**Success Response (200)**:
```json
{
  "success": true,
  "data": {
    "message": "Staff account enabled successfully",
    "staff_id": "550e8400-e29b-41d4-a716-446655440002"
  },
  "timestamp": "2025-12-26T05:00:00.000Z"
}
```

**Error Responses**:
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - Insufficient permissions (not admin)
- `404 NotFound` - Staff member not found
- `400 ValidationError` - Invalid UUID format

---

### POST /staff/disable
**Description**: Disable a staff account

**Authentication**: ✅ Required (Admin only)

**Request Body**:
```json
{
  "staff_id": "550e8400-e29b-41d4-a716-446655440002"  // ✅ Required - Valid UUID
}
```

**Success Response (200)**:
```json
{
  "success": true,
  "data": {
    "message": "Staff account disabled successfully",
    "staff_id": "550e8400-e29b-41d4-a716-446655440002"
  },
  "timestamp": "2025-12-26T05:00:00.000Z"
}
```

**Error Responses**:
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - Insufficient permissions (not admin)
- `404 NotFound` - Staff member not found
- `400 ValidationError` - Invalid UUID format

---

## Tenant Management Endpoints

### POST /tenant/register
**Description**: Register a new tenant for ERP provisioning

**Authentication**: ✅ Required (Admin or Manager only)

**Request Body**:
```json
{
  "name": "Acme Corporation",              // ✅ Required - 1-255 characters
  "email": "contact@acme.com",             // ✅ Required - Valid email address
  "contact_info": {                        // ❌ Optional - Contact details
    "phone": "+1-555-123-4567",           // ❌ Optional - Phone number
    "address": "123 Main St, City, State", // ❌ Optional - Physical address
    "company": "Acme Corp"                 // ❌ Optional - Company name
  }
}
```

**Success Response (201)**:
```json
{
  "success": true,
  "data": {
    "tenant_id": "550e8400-e29b-41d4-a716-446655440003",
    "name": "Acme Corporation",
    "email": "contact@acme.com",
    "contact_info": {
      "phone": "+1-555-123-4567",
      "address": "123 Main St, City, State",
      "company": "Acme Corp"
    },
    "status": "pending",
    "created_at": "2025-12-26T05:00:00.000Z"
  },
  "timestamp": "2025-12-26T05:00:00.000Z"
}
```

**Error Responses**:
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - Insufficient permissions (not admin or manager)
- `409 Conflict` - Tenant already exists
- `400 ValidationError` - Invalid name, email, or contact info

---

## Role Permissions

| Role | Login | Profile | Staff Mgmt | Tenant Mgmt |
|------|-------|---------|------------|-------------|
| **admin** | ✅ | ✅ | ✅ Full | ✅ Full |
| **manager** | ✅ | ✅ | ❌ None | ✅ Register |
| **staff** | ✅ | ✅ | ❌ None | ❌ None |

## Field Validation Rules

### Email Fields
- Must be valid email format
- Automatically converted to lowercase
- Required in all cases where specified

### Password Fields
- Minimum 8 characters
- Maximum 128 characters
- Must contain uppercase, lowercase, number, and special character (for new passwords)

### UUID Fields
- Must be valid UUID v4 format
- Used for staff_id, tenant_id identifiers

### Role Fields
- Valid values: `admin`, `manager`, `staff`
- Must be provided as array
- At least one role required

## Error Codes

| Code | Description |
|------|-------------|
| `ValidationError` | Invalid request format or missing required fields |
| `Unauthorized` | Missing, invalid, or expired authentication |
| `Forbidden` | Insufficient permissions for requested action |
| `NotFound` | Requested resource does not exist |
| `Conflict` | Resource already exists (duplicate email, etc.) |
| `InternalError` | Server-side error (database, email service, etc.) |

## Rate Limiting
- No explicit rate limiting implemented
- AWS API Gateway and Lambda have built-in limits
- Monitor CloudWatch for throttling metrics

## CORS
- Configured for cross-origin requests
- Supports all standard HTTP methods
- Allows Authorization and Content-Type headers

---

## Cluster Management Endpoints

### GET /clusters
**Description**: Get all clusters (admin only)

**Authentication**: ✅ Required (Admin only)

**Request Body**: None

**Success Response (200)**:
```json
{
  "success": true,
  "data": {
    "clusters": [
      {
        "cluster_id": "550e8400-e29b-41d4-a716-446655440004",
        "name": "Production Cluster",
        "type": "dedicated",
        "environment": "Production",
        "region": "us-east-1",
        "cidr": "10.0.0.0/16",
        "status": "Active",
        "deployment_status": "SUCCESS",
        "created_at": "2025-12-26T05:00:00.000Z",
        "deployed_at": "2025-12-26T05:15:00.000Z"
      }
    ]
  },
  "timestamp": "2025-12-26T05:00:00.000Z"
}
```

**Error Responses**:
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - Insufficient permissions (not admin)

---

### POST /cluster/register
**Description**: Create a new cluster record in database (admin only)

**Authentication**: ✅ Required (Admin only)

**Request Body**:
```json
{
  "name": "Production Cluster",                    // ✅ Required - Cluster name (1-255 chars)
  "type": "dedicated",                            // ✅ Required - "dedicated" or "shared"
  "environment": "Production",                    // ✅ Required - "Production", "Staging", or "Dev"
  "region": "us-east-1",                          // ✅ Required - AWS region
  "cidr": "10.0.0.0/16",                         // ✅ Required - CIDR block (validated for uniqueness)
  "code_bucket": "my-lambda-code-bucket"          // ✅ Required - S3 bucket for Lambda function code
}
```

**Success Response (201)**:
```json
{
  "success": true,
  "data": {
    "cluster_id": "550e8400-e29b-41d4-a716-446655440004",
    "name": "Production Cluster",
    "type": "dedicated",
    "environment": "Production",
    "region": "us-east-1",
    "cidr": "10.0.0.0/16",
    "code_bucket": "my-lambda-code-bucket",
    "status": "In-Active",
    "deployment_status": null,
    "created_at": "2025-12-26T05:00:00.000Z"
  },
  "timestamp": "2025-12-26T05:00:00.000Z"
}
```

**Note**: This endpoint only creates the cluster record in the database with status "In-Active". To deploy the actual infrastructure, use the deploy endpoint.

**Error Responses**:
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - Insufficient permissions (not admin)
- `409 Conflict` - CIDR block overlaps with existing cluster
- `400 ValidationError` - Invalid cluster configuration

---

### POST /cluster/{cluster_id}/deploy
**Description**: Deploy cluster infrastructure using CloudFormation (admin only)

**Authentication**: ✅ Required (Admin only)

**Prerequisites**: Cluster must be in "In-Active" or "Failed" status

**Deployment Logic**:
- **In-Active**: Ready for first-time deployment (newly created cluster)
- **Active**: Successfully deployed and operational
- **Failed**: Deployment failed, can retry deployment
- **Deploying**: ❌ Cannot deploy (deployment in progress)

**Request Body** (All fields optional):
```json
{
  "cross_account_config": {                        // ❌ Optional - Cross-account deployment configuration
    "target_account_id": "123456789012",           // ✅ Required if cross_account_config provided - 12-digit AWS account ID
    "role_name": "CrossAccountDeploymentRole",     // ✅ Required if cross_account_config provided - IAM role name
    "external_id": "optional-external-id"         // ❌ Optional - External ID for role assumption
  },
  "parameters": [                                  // ❌ Optional - Additional CloudFormation parameters
    {
      "ParameterKey": "CustomParam",               // ✅ Required - Parameter name
      "ParameterValue": "CustomValue"              // ✅ Required - Parameter value
    }
  ],
  "tags": [                                        // ❌ Optional - Additional resource tags
    {
      "Key": "Environment",                        // ✅ Required - Tag key
      "Value": "Production"                        // ✅ Required - Tag value
    }
  ]
}
```

**Template Selection Logic**:
- Templates are automatically selected based on cluster type:
- For `dedicated` clusters: `dedicated-cluster-template.yaml`
- For `shared` clusters: `shared-cluster-template.yaml`
- Templates are retrieved from the configured S3 template bucket

**Automatic Parameters** (calculated from cluster record):
- `EnvironmentName`: The cluster's name
- `VpcCIDR`: The cluster's CIDR block
- All subnet CIDRs: Dynamically calculated from VPC CIDR with /24 subnets

**Success Response (200)**:
```json
{
  "success": true,
  "data": {
    "cluster_id": "550e8400-e29b-41d4-a716-446655440004",
    "deployment_id": "arn:aws:cloudformation:us-east-1:123456789012:stack/cluster-prod/12345678",
    "stack_name": "control-plane-Production-Cluster-550e8400",
    "status": "CREATE_IN_PROGRESS",
    "template_url": "https://s3.amazonaws.com/templates-bucket/dedicated-cluster-template.yaml",
    "initiated_at": "2025-12-26T05:00:00.000Z"
  },
  "timestamp": "2025-12-26T05:00:00.000Z"
}
```

**Status Changes**:
- **In-Active** → **Deploying** (deployment starts)
- **Failed** → **Deploying** (retry deployment)
- Use the status endpoint to monitor deployment progress
- Final status will be **Active** (success) or **Failed** (error)

**Error Responses**:
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - Insufficient permissions (not admin)
- `404 NotFound` - Cluster not found or template not found
- `409 Conflict` - Cluster in "Deploying" status (deployment in progress)
- `400 ValidationError` - Invalid cross-account configuration or parameters

---

### POST /cluster/{cluster_id}/update
**Description**: Update existing cluster infrastructure using CloudFormation (admin only)

**Authentication**: ✅ Required (Admin only)

**Security**: Only clusters that have been previously deployed can be updated. Clusters currently deploying cannot be updated.

**Query Parameters** (All optional):
- `cross_account_config`: JSON string containing cross-account configuration for updates
- `parameters`: JSON string containing additional CloudFormation parameters  
- `tags`: JSON string containing additional resource tags

**Request Body**: None

**Success Response (200)**:
```json
{
  "success": true,
  "data": {
    "cluster_id": "550e8400-e29b-41d4-a716-446655440004",
    "deployment_id": "arn:aws:cloudformation:us-east-1:123456789012:stack/cluster-prod/12345678",
    "stack_name": "cluster-prod-550e8400",
    "status": "UPDATE_IN_PROGRESS", 
    "template_url": "https://s3.amazonaws.com/templates/shared-cluster-template.yaml",
    "initiated_at": "2025-12-26T05:00:00.000Z",
    "message": "Cluster update initiated successfully"
  },
  "timestamp": "2025-12-26T05:00:00.000Z"
}
```

**What the Update Does**:
- Re-runs the CloudFormation template against the existing stack
- Applies any template changes or updates  
- Fixes configuration drift back to template definition
- Maintains all existing resources and data
- Preserves delete protection settings

**Use Cases**:
- Apply template updates or improvements
- Fix configuration drift
- Update resource configurations
- Apply security patches or updates

**Error Responses**:
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - Insufficient permissions (not admin)
- `404 NotFound` - Cluster not found
- `400 BadRequest` - Cluster has never been deployed
- `409 Conflict` - Cluster is currently deploying
- `500 InternalError` - CloudFormation update failed

---

### GET /cluster/{cluster_id}/status
**Description**: Check cluster deployment status (admin only)

**Authentication**: ✅ Required (Admin only)

**Query Parameters** (All optional):
- `cross_account_config`: JSON string containing cross-account configuration for status checks
  ```json
  {
    "target_account_id": "123456789012",
    "role_name": "CrossAccountDeploymentRole", 
    "external_id": "optional-external-id"
  }
  ```
- `include_events`: Set to "true" to include recent CloudFormation stack events

**Request Body**: None

**Success Response (200)**:
```json
{
  "success": true,
  "data": {
    "cluster_id": "550e8400-e29b-41d4-a716-446655440004",
    "cluster_status": "deployed",
    "deployment_status": "CREATE_COMPLETE",
    "deployment_id": "arn:aws:cloudformation:us-east-1:123456789012:stack/cluster-prod/12345678",
    "stack_outputs": {
      "VPC": "vpc-12345678",
      "VPCCidr": "10.0.0.0/16",
      "PublicSubnets": "subnet-12345678,subnet-87654321",
      "PrivateAppSubnets": "subnet-11111111,subnet-22222222",
      "PrivateDBSubnets": "subnet-33333333,subnet-44444444",
      "AppSecurityGroup": "sg-app12345",
      "DBSecurityGroup": "sg-db12345",
      "AuroraClusterEndpoint": "cluster-prod.cluster-xyz.ap-southeast-2.rds.amazonaws.com",
      "AuroraClusterReadEndpoint": "cluster-prod.cluster-ro-xyz.ap-southeast-2.rds.amazonaws.com",
      "DBProxyEndpoint": "cluster-prod-proxy.proxy-xyz.ap-southeast-2.rds.amazonaws.com",
      "DBSecretArn": "arn:aws:secretsmanager:ap-southeast-2:123456789012:secret:cluster-prod-aurora-mysql-password-AbCdEf",
      "DatabaseName": "appdb"
    },
    "last_updated": "2025-12-26T05:15:00.000Z",
    "deployed_at": "2025-12-26T05:15:00.000Z",
    "recent_events": [
      {
        "timestamp": "2025-12-26T05:15:00.000Z",
        "resource_type": "AWS::CloudFormation::Stack",
        "logical_resource_id": "cluster-prod",
        "resource_status": "CREATE_COMPLETE",
        "resource_status_reason": "Stack creation completed successfully"
      }
    ]
  },
  "timestamp": "2025-12-26T05:00:00.000Z"
}
```

**Cluster Status Values**:
- `In-Active`: Cluster record created, ready for first deployment
- `Deploying`: Infrastructure deployment in progress
- `Active`: Successfully deployed and operational
- `Failed`: Deployment failed or stack in error state

**Deployment Status Values**:
- CloudFormation stack status values (e.g., `CREATE_IN_PROGRESS`, `CREATE_COMPLETE`, `CREATE_FAILED`)
- `NOT_DEPLOYED`: No deployment initiated
- `DEPLOYMENT_INITIATED`: Deployment just started
- `DEPLOYMENT_FAILED`: Deployment process failed
- `STACK_NOT_FOUND`: CloudFormation stack no longer exists
- `STATUS_CHECK_FAILED`: Unable to retrieve status from CloudFormation

**Error Responses**:
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - Insufficient permissions (not admin)
- `404 NotFound` - Cluster not found
- `400 ValidationError` - Invalid query parameters
- `500 InternalError` - CloudFormation API error

---

### DELETE /cluster/{cluster_id}
**Description**: Delete cluster record from database (admin only)

**Authentication**: ✅ Required (Admin only)

**Security**: Only clusters with status `In-Active` can be deleted. This ensures that active infrastructure cannot be accidentally removed from tracking.

**Request Body**: None

**Success Response (200)**:
```json
{
  "success": true,
  "data": {
    "cluster_id": "550e8400-e29b-41d4-a716-446655440004",
    "cluster_name": "production-cluster-01",
    "message": "Cluster record deleted from database successfully",
    "deleted_at": "2025-12-26T05:00:00.000Z",
    "deleted_by": "admin@company.com"
  },
  "timestamp": "2025-12-26T05:00:00.000Z"
}
```

**Error Responses**:
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - Insufficient permissions (not admin) OR cluster status is not `In-Active`
- `404 NotFound` - Cluster not found
- `500 InternalError` - Database operation failed

**Important Notes**:
- Only deletes the cluster record from the database
- Does NOT delete any AWS infrastructure (CloudFormation stacks must be manually deleted)
- Cluster must have status `In-Active` (not deployed or manually deleted from AWS)
- This is a safety measure to prevent accidental deletion of active infrastructure

---

## Updated Role Permissions

| Role | Login | Profile | Staff Mgmt | Tenant Mgmt | Cluster Mgmt |
|------|-------|---------|------------|-------------|--------------|
| **admin** | ✅ | ✅ | ✅ Full | ✅ Full | ✅ Full |
| **manager** | ✅ | ✅ | ❌ None | ✅ Register | ❌ None |
| **staff** | ✅ | ✅ | ❌ None | ❌ None | ❌ None |

## Additional Field Validation Rules

### CIDR Block Fields
- Must be valid CIDR notation (e.g., "10.0.0.0/16")
- Cannot overlap with existing cluster CIDRs
- Must be private IP ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)

### AWS Region Fields
- Must be valid AWS region identifier
- Validated against current AWS region list
- Used for cluster infrastructure deployment

### Cluster Type Fields
- Valid values: `dedicated`, `shared`
- Determines which CloudFormation template to use
- Affects resource allocation and configuration

## Infrastructure Template Management

### S3 Storage Approach (Recommended)
- **Pros**: Versioning, encryption, access control, audit trails
- **Cons**: Additional S3 setup and permissions required
- **Structure**: 
  ```
  s3://your-templates-bucket/
  ├── dedicated/
  │   ├── v1.0.0/infrastructure.yaml
  │   └── v1.1.0/infrastructure.yaml
  └── shared/
      ├── v1.0.0/infrastructure.yaml
      └── v1.1.0/infrastructure.yaml
  ```

### Project Integration Approach (Alternative)
- **Pros**: Simpler deployment, version controlled with code
- **Cons**: Larger deployment package, less flexible updates
- **Structure**: 
  ```
  templates/
  ├── dedicated-infrastructure.yaml
  └── shared-infrastructure.yaml
  ```

**Recommendation**: Use S3 storage for production flexibility and proper template versioning.

## Infrastructure Components

### Network Architecture
Both dedicated and shared cluster templates create a three-tier VPC architecture:

**Public Zone**:
- Internet Gateway for external connectivity
- Public subnets across multiple Availability Zones
- NAT Gateways for outbound internet access from private zones

**Private App Zone**:
- Private subnets for application workloads (ECS, Lambda)
- Route tables with NAT Gateway routes for internet access
- App Security Group allowing outbound HTTPS/HTTP traffic

**Private DB Zone**:
- Private subnets for database resources
- No internet access (isolated network zone)
- DB Security Group with restricted access from App Zone only

### Database Infrastructure

**Aurora MySQL Serverless v2**:
- Engine: `aurora-mysql` version `8.0.mysql_aurora.3.02.0`
- Scaling: 0.5 to 128 ACU (Aurora Capacity Units)
- Configuration: Write instance only (no read replicas)
- Backup: 7-day retention with automated backups
- Maintenance: Sunday 04:00-05:00 UTC window
- Security: Encryption at rest, deletion protection enabled
- Monitoring: CloudWatch logs for errors, general, and slow queries

**RDS Proxy for Connection Pooling**:
- Engine Family: MySQL
- Authentication: AWS Secrets Manager integration
- Security: TLS required for all connections
- Connection Management: 100% max connections, 50% max idle connections
- Timeout: 30-minute idle client timeout

**Secrets Management**:
- Master password stored in AWS Secrets Manager
- Auto-generated 32-character password with special character exclusions
- Integrated with RDS Proxy for seamless authentication

**Network Security**:
- Database resources deployed in Private DB Zone only
- Security groups restrict access to port 3306 from App Zone only
- No direct internet access or public endpoints

### Security Groups Configuration

**App Security Group**:
- Outbound: HTTPS (443) and HTTP (80) to internet
- Outbound: MySQL (3306), Redis (6379), Vault (8200) to DB Security Group
- No inbound rules (applications initiate connections)

**DB Security Group**:
- Inbound: MySQL (3306), Redis (6379), Vault (8200) from App Security Group only
- No outbound rules (databases don't initiate external connections)

**Note**: ALB Security Group has been removed as Load Balancers are not part of the current architecture.

## Cross-Account IAM Role Configuration

The deployment will create IAM roles in target AWS accounts with these permissions:
- CloudFormation: Full stack operations
- EC2: VPC and networking operations  
- IAM: Role and policy management (limited)
- S3: Template access (read-only)
- CloudWatch: Logging and monitoring

**Required**: List of target AWS account IDs as deployment variables.