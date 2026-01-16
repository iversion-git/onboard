# Onboard Service API Documentation

## Base URL
```
https://85n0x7rpf3.execute-api.ap-southeast-2.amazonaws.com/v1
```

## API Endpoints Summary

**Total Endpoints: 28**

### Authentication Endpoints (3)
- `POST /auth/login` - Staff login with JWT token generation
- `POST /auth/password-reset/request` - Request password reset token via email
- `POST /auth/password-reset/confirm` - Confirm password reset with token

### Staff Management Endpoints (5)
- `POST /staff/register` - Create new staff account (Admin only)
- `POST /staff/enable` - Enable staff account (Admin only)
- `POST /staff/disable` - Disable staff account (Admin only)
- `GET /staff/me` - Get current authenticated staff profile
- `GET /staff/list` - List all staff members with last login tracking (Admin only)

### Tenant Management Endpoints (5)
- `POST /tenant/register` - Register new tenant for ERP provisioning (Admin/Manager/User)
- `GET /tenant/available-clusters` - Get available clusters by deployment type (Admin/Manager/User)
- `GET /tenant/list` - List all tenants with filtering and search (Admin/Manager/User)
- `GET /tenant/:tenantId` - Get single tenant details (Admin/Manager/User)
- `PUT /tenant/:tenantId` - Update tenant information (Admin/Manager)

### Subscription Management Endpoints (3)
- `POST /subscription/create` - Create new subscription for tenant (Admin/Manager/User)
- `GET /subscription/list` - List all subscriptions with filtering and search (Admin/Manager/User)
- `GET /subscription/:subscriptionId` - Get specific subscription details (Admin/Manager/User)

### Cluster Management Endpoints (6)
- `GET /clusters` - List all clusters with filtering and search (Admin only)
- `POST /cluster/register` - Create new cluster record (Admin only)
- `POST /cluster/:id/deploy` - Deploy cluster infrastructure (Admin only)
- `POST /cluster/:id/update` - Update existing cluster infrastructure (Admin only)
- `GET /cluster/:id/status` - Get cluster deployment status (Admin only)
- `DELETE /cluster/:id` - Delete In-Active cluster from database (Admin only)

### Package Management Endpoints (2)
- `GET /packages` - List all active packages for dropdown selection (Admin/Manager)
- `POST /packages/create` - Create new package (Admin only)

### Subscription Type Management Endpoints (2)
- `GET /subscription-types` - List all active subscription types for dropdown selection (Admin/Manager)
- `POST /subscription-types/create` - Create new subscription type (Admin only)

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
  "roles": ["user"]                    // ✅ Required - Array of: admin, manager, user
}
```

**Success Response (201)**:
```json
{
  "success": true,
  "data": {
    "staff_id": "550e8400-e29b-41d4-a716-446655440002",
    "email": "newstaff@example.com",
    "roles": ["user"],
    "enabled": true,
    "created_at": "2025-12-26T05:00:00.000Z"
  },
  "timestamp": "2025-12-26T05:00:00.000Z"
}
```

**Available Roles**:
- `admin` - Full system access, can manage staff, tenants, subscriptions, and clusters
- `manager` - Can manage tenants and subscriptions with full permissions
- `user` - Read-only access to tenants and subscriptions, can create new tenant/subscription

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

### GET /staff/list
**Description**: List all staff members for grid display with last login tracking

**Authentication**: ✅ Required (Admin only)

**Request Body**: None

**Success Response (200)**:
```json
{
  "success": true,
  "data": {
    "staff": [
      {
        "staff_id": "550e8400-e29b-41d4-a716-446655440001",
        "full_name": "admin",
        "email": "admin@example.com",
        "roles": ["admin"],
        "enabled": true,
        "last_login": "2026-01-16T06:30:00.000Z",
        "created_at": "2025-12-26T05:00:00.000Z"
      },
      {
        "staff_id": "550e8400-e29b-41d4-a716-446655440002",
        "full_name": "john.smith",
        "email": "john.smith@example.com",
        "roles": ["manager"],
        "enabled": true,
        "last_login": "2026-01-15T14:20:00.000Z",
        "created_at": "2025-12-27T08:00:00.000Z"
      },
      {
        "staff_id": "550e8400-e29b-41d4-a716-446655440003",
        "full_name": "jane.doe",
        "email": "jane.doe@example.com",
        "roles": ["user"],
        "enabled": false,
        "last_login": null,
        "created_at": "2025-12-28T10:00:00.000Z"
      }
    ],
    "count": 3
  },
  "timestamp": "2026-01-16T07:00:00.000Z"
}
```

**Response Fields**:
- `staff_id` - Unique identifier for the staff member
- `full_name` - Extracted from email (part before @), can be enhanced later
- `email` - Staff member's email address
- `roles` - Array of assigned roles (admin, manager, user)
- `enabled` - Whether the account is active
- `last_login` - ISO timestamp of last successful login (null if never logged in)
- `created_at` - ISO timestamp when account was created
- `count` - Total number of staff members returned

**Last Login Tracking**:
- Automatically updated on each successful login
- Shows null for staff who have never logged in
- Useful for identifying inactive accounts

**Error Responses**:
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - Insufficient permissions (not admin)
- `500 InternalError` - Database error

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

**Authentication**: ✅ Required (Admin/Manager/User)

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
- `403 Forbidden` - Insufficient permissions
- `400 ValidationError` - Invalid deployment_type parameter

---

### GET /tenant/list
**Description**: List all tenants with optional filtering and search for grid display

**Authentication**: ✅ Required (Admin/Manager/User)

**Query Parameters** (all optional):
- `deployment_type` - Filter by deployment type: "shared" or "dedicated"
- `region` - Filter by region: "Australia", "US", "UK", or "Europe"
- `search` - Search across all text fields (name, email, mobile, business_name, tenant_url, etc.)

**Example Requests**:
```
GET /tenant/list
GET /tenant/list?deployment_type=shared
GET /tenant/list?region=Australia
GET /tenant/list?search=acme
GET /tenant/list?deployment_type=dedicated&region=US&search=corp
```

**Success Response (200)**:
```json
{
  "success": true,
  "data": {
    "tenants": [
      {
        "tenant_id": "550e8400-e29b-41d4-a716-446655440003",
        "name": "John Smith",
        "email": "john.smith@acme.com",
        "mobile_number": "+1-555-123-4567",
        "business_name": "Acme Corporation",
        "deployment_type": "Shared",
        "region": "Australia",
        "tenant_url": "acme-corp",
        "status": "Active",
        "created_at": "2025-01-07T05:00:00.000Z"
      },
      {
        "tenant_id": "550e8400-e29b-41d4-a716-446655440006",
        "name": "Jane Doe",
        "email": "jane.doe@techcorp.com",
        "mobile_number": "+1-555-987-6543",
        "business_name": "Tech Corporation",
        "deployment_type": "Dedicated",
        "region": "US",
        "tenant_url": "tech-corp",
        "status": "Pending",
        "created_at": "2025-01-08T10:00:00.000Z"
      }
    ],
    "count": 2,
    "filters": {
      "deployment_type": null,
      "region": null,
      "search": null
    }
  },
  "timestamp": "2026-01-16T07:00:00.000Z"
}
```

**Response Fields**:
- `tenants` - Array of tenant records matching the filters
- `count` - Number of tenants returned after filtering
- `filters` - Echo of applied filters (null if not used)

**Tenant Fields**:
- `tenant_id` - Unique identifier
- `name` - Contact person's name
- `email` - Contact email address
- `mobile_number` - Contact mobile/phone number
- `business_name` - Business or company name
- `deployment_type` - "Shared" or "Dedicated"
- `region` - Geographic region
- `tenant_url` - Tenant subdomain identifier
- `status` - Current status (Pending, Active, Suspended, Terminated)
- `created_at` - ISO timestamp when tenant was created

**Filtering Options**:

1. **Deployment Type Filter**:
   - Values: "shared" or "dedicated" (case-insensitive)
   - Filters tenants by their infrastructure deployment type
   - Example: `?deployment_type=shared`

2. **Region Filter**:
   - Values: "Australia", "US", "UK", "Europe" (case-insensitive)
   - Filters tenants by their geographic region
   - Example: `?region=Australia`

3. **Search Filter**:
   - Searches across all text fields:
     - name (contact person)
     - email
     - mobile_number
     - business_name
     - tenant_url
     - deployment_type
     - region
     - status
   - Case-insensitive partial matching
   - Example: `?search=acme` matches "Acme Corp", "acme@example.com", etc.

**Combining Filters**:
- All filters can be combined
- Filters are applied in order: deployment_type → region → search
- Example: `?deployment_type=shared&region=Australia&search=retail`
  - First filters for shared deployments
  - Then filters for Australia region
  - Finally searches for "retail" in remaining results

**Use Cases**:
- Display all tenants in a grid/table
- Filter by infrastructure type for capacity planning
- Filter by region for compliance or support purposes
- Search for specific tenant by name, email, or business name
- Combine filters for advanced queries

**Error Responses**:
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - Insufficient permissions
- `500 InternalError` - Database error

---

### GET /tenant/:tenantId
**Description**: Get single tenant details for viewing or editing

**Authentication**: ✅ Required (Admin/Manager/User)

**Path Parameters**:
- `tenantId` (required): UUID of the tenant to retrieve

**Example Request**:
```
GET /tenant/550e8400-e29b-41d4-a716-446655440003
```

**Success Response (200)**:
```json
{
  "success": true,
  "data": {
    "tenant_id": "550e8400-e29b-41d4-a716-446655440003",
    "name": "John Smith",
    "email": "john.smith@acme.com",
    "mobile_number": "+1-555-123-4567",
    "business_name": "Acme Corporation",
    "status": "Active",
    "deployment_type": "Shared",
    "region": "Australia",
    "tenant_url": "acme-corp",
    "subscription_type_id": 10,
    "package_id": 20,
    "cluster_id": "550e8400-e29b-41d4-a716-446655440004",
    "cluster_name": "Shared Production Cluster",
    "created_at": "2025-01-07T05:00:00.000Z",
    "updated_at": "2025-01-07T05:00:00.000Z"
  },
  "timestamp": "2026-01-16T08:00:00.000Z"
}
```

**Use Cases**:
- Populate edit form with current tenant data
- View detailed tenant information
- Verify tenant details before creating subscription

**Error Responses**:
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - Insufficient permissions
- `404 NotFound` - Tenant not found
- `400 ValidationError` - Invalid tenant ID format

---

### PUT /tenant/:tenantId
**Description**: Update tenant information (contact details and status)

**Authentication**: ✅ Required (Admin/Manager)

**Path Parameters**:
- `tenantId` (required): UUID of the tenant to update

**Request Body** (all fields optional, include only fields to update):
```json
{
  "name": "John Smith Jr.",                    // ❌ Optional - Contact person name (1-255 characters)
  "email": "john.smith.jr@acme.com",          // ❌ Optional - Contact email address
  "mobile_number": "+1-555-999-8888",         // ❌ Optional - Contact mobile number (1-20 characters)
  "business_name": "Acme Corporation Ltd",    // ❌ Optional - Business name (1-255 characters)
  "status": "Suspended"                        // ❌ Optional - Status (Admin only)
}
```

**Updatable Fields**:
- ✅ `name` - Contact person name
- ✅ `email` - Contact email (automatically converted to lowercase)
- ✅ `mobile_number` - Contact phone number
- ✅ `business_name` - Business or company name
- ✅ `status` - Tenant status (Admin only - Pending, Active, Suspended, Terminated)

**Immutable Fields** (cannot be updated):
- ❌ `tenant_url` - Would break existing subscriptions and URLs
- ❌ `deployment_type` - Infrastructure decision, cannot be changed
- ❌ `region` - Infrastructure decision, cannot be changed
- ❌ `cluster_id` - Infrastructure assignment, cannot be changed
- ❌ `subscription_type_id` - Moved to subscription level
- ❌ `package_id` - Moved to subscription level

**Example Request**:
```
PUT /tenant/550e8400-e29b-41d4-a716-446655440003
```

**Success Response (200)**:
```json
{
  "success": true,
  "data": {
    "tenant_id": "550e8400-e29b-41d4-a716-446655440003",
    "name": "John Smith Jr.",
    "email": "john.smith.jr@acme.com",
    "mobile_number": "+1-555-999-8888",
    "business_name": "Acme Corporation Ltd",
    "status": "Active",
    "deployment_type": "Shared",
    "region": "Australia",
    "tenant_url": "acme-corp",
    "subscription_type_id": 10,
    "package_id": 20,
    "cluster_id": "550e8400-e29b-41d4-a716-446655440004",
    "cluster_name": "Shared Production Cluster",
    "created_at": "2025-01-07T05:00:00.000Z",
    "updated_at": "2026-01-16T08:15:00.000Z"
  },
  "timestamp": "2026-01-16T08:15:00.000Z"
}
```

**Status Update Permissions**:
- Only **Admin** role can update the `status` field
- Manager attempting to update status will receive `403 Forbidden`
- Status values: `Pending`, `Active`, `Suspended`, `Terminated`

**Status Transition Rules**:
- ✅ Pending → Active (tenant is ready for use)
- ✅ Active → Suspended (temporarily disable tenant)
- ✅ Active → Terminated (permanently disable tenant)
- ❌ Active → Pending (cannot revert to pending once active)
- ✅ Suspended → Active (reactivate tenant)
- ✅ Suspended → Terminated (permanently disable)

**Status Cascading to Subscriptions**:
- When tenant status is changed to **Suspended**, all associated subscriptions are automatically set to **Suspended**
- When tenant status is changed to **Terminated**, all associated subscriptions are automatically set to **Terminated**
- This ensures consistency across tenant and subscription statuses
- Cascade happens automatically after tenant update succeeds
- If cascade fails, tenant update still succeeds (logged as error)

**Typical Workflow**:
1. User clicks "Edit" on tenant in grid
2. Frontend calls `GET /tenant/:tenantId` to fetch current data
3. User modifies fields in edit form
4. Frontend calls `PUT /tenant/:tenantId` with only changed fields
5. Backend validates, updates, and returns updated tenant

**Validation Rules**:
- At least one field must be provided for update
- Email must be valid email format
- Name and business_name must be 1-255 characters
- Mobile number must be 1-20 characters
- Status must be one of the valid enum values
- Unknown fields will be rejected (strict validation)

**Error Responses**:
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - Insufficient permissions (not admin/manager) or non-admin trying to update status
- `404 NotFound` - Tenant not found
- `400 ValidationError` - Invalid field values, no fields to update, or unknown fields
- `500 InternalError` - Database error

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

### POST /packages/create
**Description**: Create a new package (Admin only)

**Authentication**: ✅ Required (Admin only)

**Request Body**:
```json
{
  "package_name": "Enterprise Plus",           // ✅ Required - Package name (1-100 characters)
  "description": "Premium package features"    // ❌ Optional - Description (max 500 characters)
}
```

**Success Response (201)**:
```json
{
  "success": true,
  "data": {
    "package_id": 50,
    "package_name": "Enterprise Plus",
    "description": "Premium package features",
    "active": true,
    "created_at": "2026-01-16T09:00:00.000Z",
    "updated_at": "2026-01-16T09:00:00.000Z"
  },
  "timestamp": "2026-01-16T09:00:00.000Z"
}
```

**Features**:
- Auto-generates `package_id` (increments by 10 from highest existing ID)
- Automatically sets `active: true`
- Only requires package name
- Description is optional

**Error Responses**:
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - Insufficient permissions (not admin)
- `400 ValidationError` - Invalid package data

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

### POST /subscription-types/create
**Description**: Create a new subscription type (Admin only)

**Authentication**: ✅ Required (Admin only)

**Request Body**:
```json
{
  "subscription_type_name": "Healthcare"    // ✅ Required - Subscription type name (1-100 characters)
}
```

**Success Response (201)**:
```json
{
  "success": true,
  "data": {
    "subscription_type_id": 60,
    "subscription_type_name": "Healthcare",
    "active": true,
    "created_at": "2026-01-16T09:15:00.000Z",
    "updated_at": "2026-01-16T09:15:00.000Z"
  },
  "timestamp": "2026-01-16T09:15:00.000Z"
}
```

**Features**:
- Auto-generates `subscription_type_id` (increments by 10 from highest existing ID)
- Automatically sets `active: true`
- Only requires subscription type name

**Error Responses**:
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - Insufficient permissions (not admin)
- `400 ValidationError` - Invalid subscription type data

---

## Role Permissions

| Role | Login | Profile | Staff Mgmt | Tenant Mgmt | Subscription Mgmt | Cluster Mgmt |
|------|-------|---------|------------|-------------|-------------------|--------------|
| **admin** | ✅ | ✅ | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| **manager** | ✅ | ✅ | ❌ None | ✅ Full | ✅ Full | ❌ None |
| **user** | ✅ | ✅ | ❌ None | ✅ Read + Create | ✅ Read + Create | ❌ None |

### Role Details

**Admin Role**:
- Full access to all system functions
- Can manage staff accounts (create, enable, disable, list)
- Can manage tenants (create, list, update)
- Can manage subscriptions (create, list, view)
- Can manage clusters (create, deploy, update, delete, list)
- Can view all system resources

**Manager Role**:
- Can manage tenants with full permissions (create, list, update)
- Can manage subscriptions with full permissions (create, list, view)
- Can view available clusters
- Cannot manage staff accounts
- Cannot manage cluster infrastructure

**User Role**:
- Read-only access to tenants and subscriptions
- Can create new tenants
- Can create new subscriptions
- Cannot modify or delete existing tenants/subscriptions
- Cannot manage staff accounts
- Cannot manage cluster infrastructure

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
- Valid values: `admin`, `manager`, `user`
- Must be provided as array
- At least one role required
- Role hierarchy: admin (level 3) > manager (level 2) > user (level 1)

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
- **Tenant must be Active**: Only tenants with status "Active" can have subscriptions created
- Tenants with status Pending, Suspended, or Terminated cannot create subscriptions
- Only one Production subscription allowed per tenant
- Multiple Dev subscriptions allowed per tenant
- Dev subscriptions get random 2-digit suffix for uniqueness
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
**Description**: List all subscriptions with optional filtering and search for grid display

**Authentication**: ✅ Required (Admin/Manager/User)

**Query Parameters** (all optional):
- `tenant_id` - Filter by specific tenant UUID
- `subscription_type_level` - Filter by "Production" or "Dev"
- `region` - Filter by AWS region (e.g., "ap-southeast-2", "us-east-1", "dedicated")
- `package_id` - Filter by package ID (numeric)
- `subscription_type_id` - Filter by subscription type ID (numeric)
- `status` - Filter by status ("Pending", "Deploying", "Active", "Failed", "Terminated")
- `search` - Search across all text fields

**Example Requests**:
```
GET /subscription/list
GET /subscription/list?tenant_id=550e8400-e29b-41d4-a716-446655440003
GET /subscription/list?subscription_type_level=Production
GET /subscription/list?region=ap-southeast-2
GET /subscription/list?package_id=20
GET /subscription/list?status=Active
GET /subscription/list?search=acme
GET /subscription/list?subscription_type_level=Production&region=ap-southeast-2&status=Active
```

**Success Response (200)**:
```json
{
  "success": true,
  "data": {
    "subscriptions": [
      {
        "subscription_id": "550e8400-e29b-41d4-a716-446655440005",
        "tenant_id": "550e8400-e29b-41d4-a716-446655440003",
        "tenant_name": "Acme Corporation",
        "subscription_name": "acme-corp-prod",
        "subscription_type_level": "Production",
        "tenant_url": "acme-corp-prod.shared.au.myapp.com",
        "tenant_api_url": "acme-corp-prod-api.shared.au.myapp.com",
        "domain_name": "https://mywebsite.com",
        "number_of_stores": 5,
        "region": "ap-southeast-2",
        "deployment_type": "Shared",
        "subscription_type_id": 10,
        "subscription_type_name": "General",
        "package_id": 20,
        "package_name": "Professional",
        "cluster_id": "550e8400-e29b-41d4-a716-446655440004",
        "cluster_name": "Shared Production Cluster",
        "status": "Active",
        "created_at": "2025-01-07T05:00:00.000Z",
        "updated_at": "2025-01-07T06:00:00.000Z",
        "deployed_at": "2025-01-07T06:00:00.000Z"
      },
      {
        "subscription_id": "550e8400-e29b-41d4-a716-446655440006",
        "tenant_id": "550e8400-e29b-41d4-a716-446655440007",
        "tenant_name": "Tech Corporation",
        "subscription_name": "tech-corp-dev-45",
        "subscription_type_level": "Dev",
        "tenant_url": "tech-corp-dev-45.shared.au.myapp.com",
        "tenant_api_url": "tech-corp-dev-45-api.shared.au.myapp.com",
        "domain_name": "https://dev.techcorp.com",
        "number_of_stores": 2,
        "region": "ap-southeast-2",
        "deployment_type": "Shared",
        "subscription_type_id": 10,
        "subscription_type_name": "General",
        "package_id": 10,
        "package_name": "Essential",
        "cluster_id": "550e8400-e29b-41d4-a716-446655440004",
        "cluster_name": "Shared Production Cluster",
        "status": "Pending",
        "created_at": "2025-01-07T07:00:00.000Z",
        "updated_at": "2025-01-07T07:00:00.000Z",
        "deployed_at": null
      }
    ],
    "count": 2,
    "filters": {
      "tenant_id": null,
      "subscription_type_level": null,
      "region": null,
      "package_id": null,
      "subscription_type_id": null,
      "status": null,
      "search": null
    }
  },
  "timestamp": "2026-01-16T08:00:00.000Z"
}
```

**Response Fields**:
- `subscriptions` - Array of subscription records matching the filters
- `count` - Number of subscriptions returned after filtering
- `filters` - Echo of applied filters (null if not used)

**Subscription Fields**:
- `subscription_id` - Unique identifier
- `tenant_id` - Associated tenant ID
- `tenant_name` - Business name from tenant record
- `subscription_name` - Generated subscription name
- `subscription_type_level` - "Production" or "Dev"
- `tenant_url` - Generated tenant URL
- `tenant_api_url` - Generated API URL
- `domain_name` - Custom domain name
- `number_of_stores` - Number of stores
- `region` - AWS region code
- `deployment_type` - "Shared" or "Dedicated"
- `subscription_type_id` - Subscription type ID
- `subscription_type_name` - Subscription type name (e.g., "General")
- `package_id` - Package ID
- `package_name` - Package name (e.g., "Professional")
- `cluster_id` - Assigned cluster ID
- `cluster_name` - Assigned cluster name
- `status` - Current status
- `created_at` - ISO timestamp when created
- `updated_at` - ISO timestamp when last updated
- `deployed_at` - ISO timestamp when deployed (null if not deployed)

**Filtering Options**:

1. **Tenant ID Filter**:
   - Filter subscriptions for a specific tenant
   - Example: `?tenant_id=550e8400-e29b-41d4-a716-446655440003`

2. **Subscription Type Level Filter**:
   - Values: "Production" or "Dev" (case-insensitive)
   - Example: `?subscription_type_level=Production`

3. **Region Filter**:
   - Filter by AWS region code
   - Example: `?region=ap-southeast-2`

4. **Package ID Filter**:
   - Filter by package ID (numeric)
   - Example: `?package_id=20`

5. **Subscription Type ID Filter**:
   - Filter by subscription type ID (numeric)
   - Example: `?subscription_type_id=10`

6. **Status Filter**:
   - Values: "Pending", "Deploying", "Active", "Failed", "Terminated" (case-insensitive)
   - Example: `?status=Active`

7. **Search Filter**:
   - Searches across all text fields:
     - subscription_name
     - tenant_url
     - tenant_api_url
     - domain_name
     - region
     - deployment_type
     - cluster_name
     - status
     - subscription_type_level
   - Case-insensitive partial matching
   - Example: `?search=acme`

**Combining Filters**:
- All filters can be combined
- Filters are applied in order: tenant_id → subscription_type_level → region → package_id → subscription_type_id → status → search
- Example: `?subscription_type_level=Production&region=ap-southeast-2&status=Active`
  - First filters for Production subscriptions
  - Then filters for ap-southeast-2 region
  - Finally filters for Active status

**Use Cases**:
- Display all subscriptions in a grid/table
- Filter by tenant to see all subscriptions for a specific customer
- Filter by environment (Production/Dev) for capacity planning
- Filter by region for compliance or support purposes
- Filter by package or subscription type for billing analysis
- Search for specific subscription by name or URL
- Combine filters for advanced queries

**Error Responses**:
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - Insufficient permissions
- `500 InternalError` - Database error

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
- `Suspended`: Temporarily disabled (cascaded from tenant status)
- `Terminated`: Permanently disabled (cascaded from tenant status or manually set)

**Error Responses**:
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - Insufficient permissions (not admin or manager)
- `404 NotFound` - Subscription not found

---

## Cluster Management Endpoints

### GET /clusters
**Description**: List all clusters with optional filtering and search (Admin only)

**Authentication**: ✅ Required (Admin only)

**Query Parameters** (all optional):
- `type` - Filter by "shared" or "dedicated"
- `environment` - Filter by "Production", "Staging", or "Dev"
- `region` - Filter by AWS region (e.g., "ap-southeast-2", "us-east-1")
- `status` - Filter by status ("In-Active", "Deploying", "Active", "Failed")
- `search` - Search across name, type, region, CIDR, status, environment

**Example Requests**:
```
GET /clusters
GET /clusters?type=shared
GET /clusters?environment=Production
GET /clusters?region=ap-southeast-2
GET /clusters?status=Active
GET /clusters?search=prod
GET /clusters?type=shared&environment=Production&status=Active
```

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
    ],
    "count": 1,
    "filters": {
      "type": null,
      "environment": null,
      "region": null,
      "status": null,
      "search": null
    }
  },
  "timestamp": "2026-01-16T09:30:00.000Z"
}
```

**Filtering Options**:
- **Type Filter**: "shared" or "dedicated" (case-insensitive)
- **Environment Filter**: "Production", "Staging", or "Dev" (case-insensitive)
- **Region Filter**: AWS region code (case-insensitive)
- **Status Filter**: "In-Active", "Deploying", "Active", "Failed" (case-insensitive)
- **Search**: Searches across name, type, region, CIDR, status, environment fields

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

| Role | Login | Profile | Staff Mgmt | Tenant Mgmt | Subscription Mgmt | Cluster Mgmt |
|------|-------|---------|------------|-------------|-------------------|--------------|
| **admin** | ✅ | ✅ | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| **manager** | ✅ | ✅ | ❌ None | ✅ Full | ✅ Full | ❌ None |
| **user** | ✅ | ✅ | ❌ None | ✅ Read + Create | ✅ Read + Create | ❌ None |

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