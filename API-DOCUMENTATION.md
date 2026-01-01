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
  "cidr": "10.0.0.0/16"                          // ✅ Required - CIDR block (validated for uniqueness)
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
    "status": "Active",
    "deployment_status": null,
    "created_at": "2025-12-26T05:00:00.000Z"
  },
  "timestamp": "2025-12-26T05:00:00.000Z"
}
```

**Note**: This endpoint only creates the cluster record in the database with status "Active". To deploy the actual infrastructure, use the deploy endpoint.

**Error Responses**:
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - Insufficient permissions (not admin)
- `409 Conflict` - CIDR block overlaps with existing cluster
- `400 ValidationError` - Invalid cluster configuration

---

### POST /clusters/{cluster_id}/deploy
**Description**: Deploy cluster infrastructure using CloudFormation (admin only)

**Authentication**: ✅ Required (Admin only)

**Prerequisites**: Cluster must be in "Active" status (created but not yet deployed)

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
- Cluster status changes from "Active" → "Deploying"
- Use the status endpoint to monitor deployment progress
- Final status will be "Active" (success) or "Failed" (error)

**Error Responses**:
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - Insufficient permissions (not admin)
- `404 NotFound` - Cluster not found or template not found
- `409 Conflict` - Cluster not in "Active" status or deployment already in progress
- `400 ValidationError` - Invalid cross-account configuration or parameters

---

### GET /clusters/{cluster_id}/status
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
      "VpcId": "vpc-12345678",
      "SubnetIds": ["subnet-12345678", "subnet-87654321"]
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
- `Active`: Cluster record created and ready for deployment, or successfully deployed
- `Deploying`: Infrastructure deployment in progress
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

## Cross-Account IAM Role Configuration

The deployment will create IAM roles in target AWS accounts with these permissions:
- CloudFormation: Full stack operations
- EC2: VPC and networking operations  
- IAM: Role and policy management (limited)
- S3: Template access (read-only)
- CloudWatch: Logging and monitoring

**Required**: List of target AWS account IDs as deployment variables.