# Onboard Service API Documentation

## Base URL
```
https://85n0x7rpf3.execute-api.ap-southeast-2.amazonaws.com/v1
```

## API Endpoints Summary

**Total Endpoints: 20**

### Authentication Endpoints (3)
- `POST /auth/login` - Staff login with JWT token generation
- `POST /auth/password-reset/request` - Request password reset token via email
- `POST /auth/password-reset/confirm` - Confirm password reset with token

### Staff Management Endpoints (4)
- `POST /staff/register` - Create new staff account (Admin only)
- `POST /staff/enable` - Enable staff account (Admin only)
- `POST /staff/disable` - Disable staff account (Admin only)
- `GET /staff/me` - Get current authenticated staff profile

### Tenant Management Endpoints (2)
- `POST /tenant/register` - Register new tenant for ERP provisioning (Admin/Manager)
- `GET /tenant/available-clusters` - Get available clusters by deployment type (Admin/Manager)

### Subscription Management Endpoints (3)
- `POST /subscription/create` - Create new subscription for tenant (Admin/Manager)
- `GET /subscription/list` - List subscriptions for a tenant (Admin/Manager)
- `GET /subscription/:subscriptionId` - Get specific subscription details (Admin/Manager)

### Cluster Management Endpoints (6)
- `GET /clusters` - List all clusters (Admin only)
- `POST /cluster/register` - Create new cluster record (Admin only)
- `POST /cluster/:id/deploy` - Deploy cluster infrastructure (Admin only)
- `POST /cluster/:id/update` - Update existing cluster infrastructure (Admin only)
- `GET /cluster/:id/status` - Get cluster deployment status (Admin only)
- `DELETE /cluster/:id` - Delete In-Active cluster from database (Admin only)

### Package Management Endpoints (1)
- `GET /packages` - List all active packages for dropdown selection (Admin/Manager)

### Subscription Type Management Endpoints (1)
- `GET /subscription-types` - List all active subscription types for dropdown selection (Admin/Manager)

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
  "name": "John Smith",                        // ✅ Required - Contact person name (1-255 characters)
  "email": "john.smith@acme.com",              // ✅ Required - Contact email address
  "mobile_number": "+1-555-123-4567",         // ✅ Required - Contact mobile number (1-20 characters)
  "business_name": "Acme Corporation",         // ✅ Required - Business or company name (1-255 characters)
  "deployment_type": "Shared",                 // ✅ Required - "Shared" or "Dedicated"
  "region": "Australia",                       // ✅ Required - "Australia", "US", "UK", or "Europe"
  "tenant_url": "acme-corp"                    // ✅ Required - Tenant subdomain (1-50 chars, lowercase letters, numbers, and hyphens only)
}
```

**Note**: Subscription type and package selection have been moved to the subscription creation process for better flexibility.

**Success Response (201)**:
```json
{
  "success": true,
  "data": {
    "tenant_id": "550e8400-e29b-41d4-a716-446655440003",
    "name": "John Smith",
    "email": "john.smith@acme.com",
    "mobile_number": "+1-555-123-4567",
    "business_name": "Acme Corporation",
    "status": "Pending",
    "deployment_type": "Shared",
    "region": "Australia",
    "tenant_url": "acme-corp",
    "created_at": "2025-01-07T05:00:00.000Z",
    "updated_at": "2025-01-07T05:00:00.000Z"
  },
  "timestamp": "2025-01-07T05:00:00.000Z"
}
```

**Field Descriptions**:
- `name`: Contact person's full name
- `email`: Primary contact email address (automatically converted to lowercase)
- `mobile_number`: Contact mobile/phone number
- `business_name`: Official business or company name
- `status`: Automatically set to "Pending" on creation
- `deployment_type`: Infrastructure deployment preference
- `region`: Preferred geographic region for deployment
- `tenant_url`: Unique subdomain identifier (e.g., "acme-corp" becomes "acme-corp.myapp.com")

**Workflow**:
1. **Step 1**: Register tenant with basic information (this endpoint)
2. **Step 2**: Create subscription for the tenant with package and subscription type selection
3. **Step 3**: System provisions infrastructure based on subscription details

**Status Values**:
- `Pending`: Newly created, awaiting provisioning
- `Active`: Fully provisioned and operational
- `Suspended`: Temporarily disabled
- `Terminated`: Permanently disabled

**Subscription Types**:
- `General`: Standard business subscription
- `Made to Measure`: Custom tailored solutions
- `Automotive`: Automotive industry specific
- `Rental`: Rental business focused

**Package Names**:
- `Essential`: Basic feature set
- `Professional`: Enhanced features for growing businesses
- `Premium`: Advanced features for established businesses
- `Enterprise`: Full feature set for large organizations

**Tenant URL Validation Rules**:
- Only lowercase letters (a-z), numbers (0-9), and hyphens (-) allowed
- Cannot start or end with a hyphen
- Cannot contain consecutive hyphens (no --)
- Must be 1-50 characters long
- Must be unique across all tenants
- Examples:
  - ✅ Valid: `acme-corp`, `tenant123`, `my-company`, `test-env-1`
  - ❌ Invalid: `Acme-Corp` (uppercase), `-acme` (starts with hyphen), `acme-` (ends with hyphen), `acme--corp` (consecutive hyphens), `acme_corp` (underscore), `acme.corp` (dot)

**Error Responses**:
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - Insufficient permissions (not admin or manager)
- `409 Conflict` - Tenant URL is already taken
- `400 ValidationError` - Invalid field values or format

---

### GET /tenant/available-clusters
**Description**: Get available clusters based on deployment type

**Authentication**: ✅ Required (Admin or Manager only)

**Query Parameters**:
- `deployment_type` (required): "Shared" or "Dedicated"

**Example Request**:
```
GET /tenant/available-clusters?deployment_type=Shared
```

**Success Response (200)**:
```json
{
  "success": true,
  "data": {
    "deployment_type": "Shared",
    "available_clusters": [
      {
        "cluster_id": "550e8400-e29b-41d4-a716-446655440004",
        "name": "Shared Production Cluster",
        "type": "shared",
        "environment": "Production",
        "region": "ap-southeast-2",
        "status": "Active",
        "created_at": "2025-01-07T05:00:00.000Z",
        "deployed_at": "2025-01-07T05:15:00.000Z"
      },
      {
        "cluster_id": "550e8400-e29b-41d4-a716-446655440005",
        "name": "Shared Staging Cluster",
        "type": "shared",
        "environment": "Staging",
        "region": "ap-southeast-2",
        "status": "Active",
        "created_at": "2025-01-06T10:00:00.000Z",
        "deployed_at": "2025-01-06T10:20:00.000Z"
      }
    ],
    "total_count": 2
  },
  "timestamp": "2025-01-07T05:00:00.000Z"
}
```

**Response Fields**:
- `deployment_type`: The requested deployment type filter
- `available_clusters`: Array of active clusters matching the deployment type
- `total_count`: Number of available clusters

**Cluster Information**:
- Only returns clusters with status "Active"
- Clusters are filtered by type (shared/dedicated) to match deployment type
- Includes basic cluster information needed for tenant assignment

**Error Responses**:
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - Insufficient permissions (not admin or manager)
- `400 ValidationError` - Invalid deployment_type parameter

---

### GET /packages
**Description**: Get all active packages for dropdown selection

**Authentication**: ✅ Required (Admin or Manager only)

**Request Body**: None (GET request)

**Success Response (200)**:
```json
{
  "success": true,
  "data": {
    "packages": [
      {
        "package_id": 10,
        "package_name": "Essential",
        "description": "Basic feature set for small businesses",
        "price": 29.99,
        "features": [
          "Basic inventory management",
          "Simple reporting",
          "Up to 2 users",
          "Email support"
        ]
      },
      {
        "package_id": 20,
        "package_name": "Professional",
        "description": "Enhanced features for growing businesses",
        "price": 79.99,
        "features": [
          "Advanced inventory management",
          "Custom reporting",
          "Up to 10 users",
          "Priority support",
          "API access"
        ]
      },
      {
        "package_id": 30,
        "package_name": "Premium",
        "description": "Advanced features for established businesses",
        "price": 149.99,
        "features": [
          "Full inventory management",
          "Advanced analytics",
          "Up to 50 users",
          "Phone support",
          "Custom integrations",
          "Multi-location support"
        ]
      },
      {
        "package_id": 40,
        "package_name": "Enterprise",
        "description": "Full feature set for large organizations",
        "price": 299.99,
        "features": [
          "Enterprise inventory management",
          "Real-time analytics",
          "Unlimited users",
          "Dedicated support",
          "Custom development",
          "White-label options",
          "Advanced security"
        ]
      }
    ],
    "total_count": 4
  },
  "timestamp": "2025-01-09T05:00:00.000Z"
}
```

**Response Fields**:
- `packages`: Array of active packages with full details
- `total_count`: Number of active packages
- Only returns packages where `active: true`
- Sorted by `package_id` in ascending order

**Error Responses**:
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - Insufficient permissions (not admin or manager)

---

### GET /subscription-types
**Description**: Get all active subscription types for dropdown selection

**Authentication**: ✅ Required (Admin or Manager only)

**Request Body**: None (GET request)

**Success Response (200)**:
```json
{
  "success": true,
  "data": {
    "subscription_types": [
      {
        "subscription_type_id": 10,
        "subscription_type_name": "General",
        "description": "Standard business subscription for general retail and service businesses"
      },
      {
        "subscription_type_id": 20,
        "subscription_type_name": "Made to Measure",
        "description": "Custom tailored solutions for businesses with specific measurement requirements"
      },
      {
        "subscription_type_id": 30,
        "subscription_type_name": "Automotives",
        "description": "Specialized subscription for automotive industry businesses including parts, service, and sales"
      },
      {
        "subscription_type_id": 40,
        "subscription_type_name": "Rental",
        "description": "Focused subscription for rental businesses including equipment, vehicle, and property rentals"
      },
      {
        "subscription_type_id": 50,
        "subscription_type_name": "Subscriptions",
        "description": "Subscription-based business model for recurring services and products"
      }
    ],
    "total_count": 5
  },
  "timestamp": "2025-01-09T05:00:00.000Z"
}
```

**Response Fields**:
- `subscription_types`: Array of active subscription types with descriptions
- `total_count`: Number of active subscription types
- Only returns subscription types where `active: true`
- Sorted by `subscription_type_id` in ascending order

**Error Responses**:
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - Insufficient permissions (not admin or manager)

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

## Subscription Management Endpoints

### POST /subscription/create
**Description**: Create a new subscription for a tenant with package and subscription type selection

**Authentication**: ✅ Required (Admin or Manager only)

**Request Body**:
```json
{
  "tenant_id": "550e8400-e29b-41d4-a716-446655440003",  // ✅ Required - Tenant ID to create subscription for
  "subscription_type_level": "Production",               // ✅ Required - "Production" or "Dev"
  "domain_name": "https://mywebsite.com",                // ✅ Required - Custom domain name (must be unique)
  "number_of_stores": 3,                                 // ❌ Optional - Number of stores (default: 1, minimum: 1)
  "cluster_id": "550e8400-e29b-41d4-a716-446655440004", // ✅ Required - Specific cluster ID to assign subscription to
  
  // Subscription Type Selection (either ID or name required)
  "subscription_type_id": 10,                            // ✅ Required (if subscription_type not provided) - Subscription type ID (preferred)
  "subscription_type": "General",                        // ✅ Required (if subscription_type_id not provided) - Subscription type name
  
  // Package Selection (either ID or name required)
  "package_id": 20,                                      // ✅ Required (if package_name not provided) - Package ID (preferred)
  "package_name": "Professional"                         // ✅ Required (if package_id not provided) - Package name
}
```

**Input Flexibility**:
- You can provide `subscription_type_id` OR `subscription_type` (or both)
- You can provide `package_id` OR `package_name` (or both)
- If you provide both ID and name, the system validates they match
- If you provide only ID, the system looks up the name
- If you provide only name, the system looks up the ID

**Uniqueness Validation**:
- `domain_name` must be unique across all subscriptions
- Generated `tenant_url` must be unique across all subscriptions
- Generated `tenant_api_url` must be unique across all subscriptions
- Returns `409 Conflict` if any URL/domain is already in use

**Success Response (201)**:
```json
{
  "success": true,
  "data": {
    "subscription_id": "550e8400-e29b-41d4-a716-446655440005",
    "tenant_id": "550e8400-e29b-41d4-a716-446655440003",
    "tenant_name": "Acme Corporation",
    "subscription_type_level": "Production",
    "tenant_url": "acme-corp-prod.shared.au.myapp.com",
    "tenant_api_url": "acme-corp-prod-api.shared.au.myapp.com",
    "domain_name": "https://mywebsite.com",
    "number_of_stores": 3,
    "region": "ap-southeast-2",
    "deployment_type": "Shared",
    "subscription_type_id": 10,
    "subscription_type_name": "General",
    "package_id": 20,
    "package_name": "Professional",
    "cluster_id": "550e8400-e29b-41d4-a716-446655440004",
    "cluster_name": "Shared Production Cluster",
    "cluster_region": "ap-southeast-2",
    "db_proxy_url": "cluster-proxy.amazonaws.com:3306",
    "status": "Pending",
    "created_at": "2025-01-07T05:00:00.000Z",
    "updated_at": "2025-01-07T05:00:00.000Z"
  },
  "timestamp": "2025-01-07T05:00:00.000Z"
}
```

**Field Descriptions**:
- `subscription_id`: Unique identifier for the subscription
- `tenant_id`: ID of the tenant this subscription belongs to
- `tenant_name`: Business name copied from tenant table for easy reference
- `subscription_type_level`: Type of subscription (Production or Dev)
- `tenant_url`: Generated tenant URL (validated for uniqueness)
- `tenant_api_url`: Generated API URL (validated for uniqueness)
- `domain_name`: Custom domain name provided by user (validated for uniqueness)
- `number_of_stores`: Number of stores for this subscription (default: 1, minimum: 1)
- `region`: AWS region code (ap-southeast-2, us-east-1, eu-west-2, eu-central-1)
- `deployment_type`: Copied from tenant (Shared or Dedicated)
- `subscription_type_id`: Numeric ID of the selected subscription type
- `subscription_type_name`: Name of the selected subscription type
- `package_id`: Numeric ID of the selected package
- `package_name`: Name of the selected package
- `cluster_id`: ID of the assigned cluster
- `cluster_name`: Name of the assigned cluster
- `cluster_region`: AWS region of the assigned cluster
- `db_proxy_url`: Database proxy URL from cluster (if available)
- `status`: Current subscription status (Pending, Deploying, Active, Failed, Terminated)

**Available Subscription Types**:
- **ID 10**: General
- **ID 20**: Made to Measure
- **ID 30**: Automotives
- **ID 40**: Rental
- **ID 50**: Subscriptions

**Available Packages**:
- **ID 10**: Essential
- **ID 20**: Professional
- **ID 30**: Premium
- **ID 40**: Enterprise

**Business Rules**:
- Only one Production subscription allowed per tenant
- Multiple Dev subscriptions allowed per tenant
- Dev subscriptions get random 2-digit suffix for uniqueness
- Tenant must exist and be in Active or Pending status
- Cluster must exist and be Active
- Subscription type and package must be active

**URL Generation Rules**:
- **Production Tenant URL**: `{tenant_url}-prod.{deployment}.{region}.myapp.com`
- **Dev Tenant URL**: `{tenant_url}-dev-{random2digits}.{deployment}.{region}.myapp.com`
- **API URLs**: Same pattern with `-api` suffix
- **Shared deployments**: Include region code (au, us, uk, eu)
- **Dedicated deployments**: Use "dedicated" instead of region

**Error Responses**:
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - Insufficient permissions (not admin or manager)
- `400 ValidationError` - Invalid field values, missing required fields, or inactive subscription type/package
- `404 NotFound` - Tenant or cluster not found
- `409 Conflict` - Domain name, tenant URL, or API URL already in use, or multiple production subscriptions for tenant
- **Premium** → `3`
- **Enterprise** → `4`
- *Additional packages can be added to the table*

**Business Rules**:
- Each tenant can have only one Production subscription (named `{tenant_url}-prod`)
- Each tenant can have multiple Dev subscriptions (named `{tenant_url}-dev-{random2digits}`)
- Subscription names are automatically generated based on tenant URL and type
- Dev subscriptions use random 2-digit suffixes (10-99) for uniqueness
- All tenant information (region, deployment type, subscription, package, cluster) is copied to the subscription
- Tenant must exist and be in Active or Pending status
- URLs are automatically generated based on tenant's deployment type, region, and subscription type

**Error Responses**:
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - Insufficient permissions (not admin or manager)
- `400 ValidationError` - Invalid field values, tenant not found, tenant missing required fields, or tenant not in valid status
- `409 Conflict` - Tenant already has a production subscription (when creating Production type)

---

### GET /subscription/list
**Description**: List all subscriptions for a specific tenant

**Authentication**: ✅ Required (Admin or Manager only)

**Query Parameters**:
- `tenant_id` (required): UUID of the tenant to list subscriptions for

**Example Request**:
```
GET /subscription/list?tenant_id=550e8400-e29b-41d4-a716-446655440003
```

**Success Response (200)**:
```json
{
  "success": true,
  "data": {
    "tenant_id": "550e8400-e29b-41d4-a716-446655440003",
    "tenant_name": "Acme Corporation",
    "subscriptions": [
      {
        "subscription_id": "550e8400-e29b-41d4-a716-446655440005",
        "subscription_name": "acme-corp-prod",
        "subscription_type_level": "Production",
        "tenant_url": "acme-corp.flowrix.app",
        "tenant_api_url": "acme-corp.flowrix.app",
        "domain_name": "https://mywebsite.com",
        "number_of_stores": 5,
        "region": "dedicated",
        "deployment_type": "Dedicated",
        "subscription_type_id": 1,
        "subscription_type_name": "General",
        "package_id": 2,
        "package_name": "Professional",
        "cluster_id": "550e8400-e29b-41d4-a716-446655440004",
        "cluster_name": "Dedicated Production Cluster",
        "status": "Active",
        "deployment_id": "arn:aws:cloudformation:us-east-1:123456789012:stack/acme-prod/12345678",
        "deployment_status": "CREATE_COMPLETE",
        "created_at": "2025-01-07T05:00:00.000Z",
        "updated_at": "2025-01-07T06:00:00.000Z",
        "deployed_at": "2025-01-07T06:00:00.000Z"
      },
      {
        "subscription_id": "550e8400-e29b-41d4-a716-446655440006",
        "subscription_name": "acme-corp-dev-22",
        "subscription_type_level": "Dev",
        "tenant_url": "acme-corp-dev-22.flowrix.app",
        "tenant_api_url": "acme-corp-dev-22.flowrix.app",
        "domain_name": "https://dev.mywebsite.com",
        "number_of_stores": 2,
        "region": "dedicated",
        "deployment_type": "Dedicated",
        "subscription_type_id": 1,
        "subscription_type_name": "General",
        "package_id": 2,
        "package_name": "Professional",
        "cluster_id": "550e8400-e29b-41d4-a716-446655440004",
        "cluster_name": "Dedicated Production Cluster",
        "status": "Pending",
        "deployment_id": null,
        "deployment_status": null,
        "created_at": "2025-01-07T07:00:00.000Z",
        "updated_at": "2025-01-07T07:00:00.000Z",
        "deployed_at": null
      }
    ]
  },
  "timestamp": "2025-01-07T08:00:00.000Z"
}
```

**Error Responses**:
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - Insufficient permissions (not admin or manager)
- `400 ValidationError` - Invalid tenant_id or tenant not found

---

### GET /subscription/:subscriptionId
**Description**: Get detailed information about a specific subscription

**Authentication**: ✅ Required (Admin or Manager only)

**Path Parameters**:
- `subscriptionId` (required): UUID of the subscription to retrieve

**Example Request**:
```
GET /subscription/550e8400-e29b-41d4-a716-446655440005
```

**Success Response (200)**:
```json
{
  "success": true,
  "data": {
    "subscription_id": "550e8400-e29b-41d4-a716-446655440005",
    "tenant_id": "550e8400-e29b-41d4-a716-446655440003",
    "tenant_name": "Acme Corporation",
    "subscription_name": "acme-corp-prod",
    "subscription_type_level": "Production",
    "tenant_url": "acme-corp.flowrix.app",
    "tenant_api_url": "acme-corp.flowrix.app",
    "domain_name": "https://mywebsite.com",
    "number_of_stores": 5,
    "region": "dedicated",
    "deployment_type": "Dedicated",
    "subscription_type_id": 1,
    "subscription_type_name": "General",
    "package_id": 2,
    "package_name": "Professional",
    "cluster_id": "550e8400-e29b-41d4-a716-446655440004",
    "cluster_name": "Dedicated Production Cluster",
    "status": "Active",
    "deployment_id": "arn:aws:cloudformation:us-east-1:123456789012:stack/acme-prod/12345678",
    "deployment_status": "CREATE_COMPLETE",
    "stack_outputs": {
      "ApiGatewayUrl": "https://api.acme-corp.flowrix.app",
      "DatabaseEndpoint": "acme-prod-db.cluster-xyz.us-east-1.rds.amazonaws.com",
      "S3BucketName": "acme-prod-storage-bucket"
    },
    "created_at": "2025-01-07T05:00:00.000Z",
    "updated_at": "2025-01-07T06:00:00.000Z",
    "deployed_at": "2025-01-07T06:00:00.000Z"
  },
  "timestamp": "2025-01-07T08:00:00.000Z"
}
```

**Field Descriptions**:
- `deployment_id`: CloudFormation stack ARN (null if not deployed)
- `deployment_status`: CloudFormation stack status (null if not deployed)
- `stack_outputs`: CloudFormation stack outputs (null if not deployed)
- `deployed_at`: Timestamp when deployment completed (null if not deployed)

**Subscription Status Values**:
- `Pending`: Newly created, awaiting deployment
- `Deploying`: Currently being deployed via CloudFormation
- `Active`: Successfully deployed and operational
- `Failed`: Deployment failed
- `Terminated`: Subscription has been terminated/deleted

**Error Responses**:
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - Insufficient permissions (not admin or manager)
- `404 NotFound` - Subscription not found

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
  "code_bucket": "my-lambda-code-bucket",         // ✅ Required - S3 bucket for Lambda function code
  "bref_layer_arn": "arn:aws:lambda:us-east-1:534081306603:layer:php-82:60",  // ✅ Required - Bref PHP layer ARN for the region
  "api_domain": "tenant1.au.myapp.com",          // ✅ Required - Custom API domain name
  "certificate_arn": "arn:aws:acm:us-east-1:123456789012:certificate/12345678-1234-1234-1234-123456789012"  // ✅ Required - ACM certificate ARN
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
    "bref_layer_arn": "arn:aws:lambda:us-east-1:534081306603:layer:php-82:60",
    "api_domain": "tenant1.au.myapp.com",
    "certificate_arn": "arn:aws:acm:us-east-1:123456789012:certificate/12345678-1234-1234-1234-123456789012",
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