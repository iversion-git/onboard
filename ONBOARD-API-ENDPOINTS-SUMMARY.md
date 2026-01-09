# Onboard Service API Endpoints Summary

**Base URL:** `https://85n0x7rpf3.execute-api.ap-southeast-2.amazonaws.com/v1`

**Total Endpoints:** 20

## Recent Architectural Changes

### Tenant & Subscription Separation
- **Tenant Registration**: Now only collects basic tenant information (contact details, deployment preferences)
- **Subscription Creation**: Handles subscription type, package selection, and cluster assignment
- **Benefits**: One tenant can have multiple subscriptions with different packages/clusters

### Subscription Enhancements
- **Uniqueness Validation**: domain_name, tenant_url, and tenant_api_url must be unique across all subscriptions
- **Tenant Name**: Copies business_name from tenant to subscription as tenant_name for easy reference
- **Removed Fields**: subscription_name field removed (was redundant)
- **Flexible Input**: Accepts either IDs or names for subscription types and packages

---

## Authentication Endpoints (3)

### 1. POST /auth/login
**Description:** Staff login with JWT token generation  
**Authentication:** None required  
**Example Body:**
```json
{
  "email": "fahad@flowrix.com",
  "password": "Password123"
}
```

### 2. POST /auth/password-reset/request
**Description:** Request password reset token via email  
**Authentication:** None required  
**Example Body:**
```json
{
  "email": "fahad@flowrix.com"
}
```

### 3. POST /auth/password-reset/confirm
**Description:** Confirm password reset with token  
**Authentication:** None required  
**Example Body:**
```json
{
  "token": "reset-token-from-email",
  "new_password": "NewPassword123!"
}
```

---

## Staff Management Endpoints (4)

### 4. POST /staff/register
**Description:** Create new staff account  
**Authentication:** ✅ Required (Admin only)  
**Example Body:**
```json
{
  "email": "newstaff@flowrix.com",
  "password": "StrongPassword123!",
  "roles": ["staff"]
}
```

### 5. POST /staff/enable
**Description:** Enable staff account  
**Authentication:** ✅ Required (Admin only)  
**Example Body:**
```json
{
  "staff_id": "550e8400-e29b-41d4-a716-446655440002"
}
```

### 6. POST /staff/disable
**Description:** Disable staff account  
**Authentication:** ✅ Required (Admin only)  
**Example Body:**
```json
{
  "staff_id": "550e8400-e29b-41d4-a716-446655440002"
}
```

### 7. GET /staff/me
**Description:** Get current authenticated staff profile  
**Authentication:** ✅ Required (Any authenticated user)  
**Example Body:** None (GET request)

---

## Tenant Management Endpoints (2)

### 8. POST /tenant/register
**Description:** Register new tenant for ERP provisioning (basic tenant information only)  
**Authentication:** ✅ Required (Admin or Manager only)  
**Example Body:**
```json
{
  "name": "John Smith",
  "email": "john.smith@acme.com",
  "mobile_number": "+1-555-123-4567",
  "business_name": "Acme Corporation",
  "deployment_type": "Shared",
  "region": "Australia",
  "tenant_url": "acme-corp"
}
```
**Key Changes:**
- Removed subscription_type and package_name fields
- Subscription type and package selection moved to subscription creation
- Simplified to basic tenant identity and preferences only

### 9. GET /tenant/available-clusters
**Description:** Get available clusters by deployment type  
**Authentication:** ✅ Required (Admin or Manager only)  
**Query Parameters:** `deployment_type=Shared` or `deployment_type=Dedicated`  
**Example Body:** None (GET request)

---

## Subscription Management Endpoints (3)

### 10. POST /subscription/create
**Description:** Create new subscription for tenant with package and subscription type selection  
**Authentication:** ✅ Required (Admin or Manager only)  
**Example Body:**
```json
{
  "tenant_id": "550e8400-e29b-41d4-a716-446655440003",
  "subscription_type_level": "Production",
  "domain_name": "https://mywebsite.com",
  "number_of_stores": 3,
  "cluster_id": "550e8400-e29b-41d4-a716-446655440004",
  "subscription_type_id": 10,
  "package_id": 20
}
```
**Key Features:**
- Accepts subscription_type_id/subscription_type and package_id/package_name
- Validates uniqueness of domain_name, tenant_url, and tenant_api_url
- Copies tenant business_name as tenant_name to subscription
- Removed subscription_name field (was redundant)

### 11. GET /subscription/list
**Description:** List subscriptions for a tenant  
**Authentication:** ✅ Required (Admin or Manager only)  
**Query Parameters:** `tenant_id=550e8400-e29b-41d4-a716-446655440003`  
**Example Body:** None (GET request)

### 12. GET /subscription/:subscriptionId
**Description:** Get specific subscription details  
**Authentication:** ✅ Required (Admin or Manager only)  
**Path Parameters:** `subscriptionId` (UUID)  
**Example Body:** None (GET request)

---

## Cluster Management Endpoints (6)

### 13. GET /clusters
**Description:** List all clusters  
**Authentication:** ✅ Required (Admin only)  
**Example Body:** None (GET request)

### 14. POST /cluster/register
**Description:** Create new cluster record in database  
**Authentication:** ✅ Required (Admin only)  
**Example Body:**
```json
{
  "name": "Production Cluster",
  "type": "dedicated",
  "environment": "Production",
  "region": "us-east-1",
  "cidr": "10.0.0.0/16",
  "code_bucket": "my-lambda-code-bucket",
  "bref_layer_arn": "arn:aws:lambda:us-east-1:534081306603:layer:php-82:60",
  "api_domain": "tenant1.au.myapp.com",
  "certificate_arn": "arn:aws:acm:us-east-1:123456789012:certificate/12345678-1234-1234-1234-123456789012"
}
```

### 15. POST /cluster/:id/deploy
**Description:** Deploy cluster infrastructure using CloudFormation  
**Authentication:** ✅ Required (Admin only)  
**Path Parameters:** `id` (cluster UUID)  
**Example Body:**
```json
{
  "cross_account_config": {
    "target_account_id": "123456789012",
    "role_name": "CrossAccountDeploymentRole",
    "external_id": "optional-external-id"
  },
  "parameters": [
    {
      "ParameterKey": "CustomParam",
      "ParameterValue": "CustomValue"
    }
  ],
  "tags": [
    {
      "Key": "Environment",
      "Value": "Production"
    }
  ]
}
```

### 16. POST /cluster/:id/update
**Description:** Update existing cluster infrastructure  
**Authentication:** ✅ Required (Admin only)  
**Path Parameters:** `id` (cluster UUID)  
**Query Parameters:** Optional cross_account_config, parameters, tags as JSON strings  
**Example Body:** None (uses query parameters)

### 17. GET /cluster/:id/status
**Description:** Get cluster deployment status  
**Authentication:** ✅ Required (Admin only)  
**Path Parameters:** `id` (cluster UUID)  
**Query Parameters:** Optional `include_events=true`, cross_account_config as JSON string  
**Example Body:** None (GET request)

### 18. DELETE /cluster/:id
**Description:** Delete In-Active cluster from database  
**Authentication:** ✅ Required (Admin only)  
**Path Parameters:** `id` (cluster UUID)  
**Example Body:** None (DELETE request)

---

## Package Management Endpoints (1)

### 19. GET /packages
**Description:** List all active packages for dropdown selection  
**Authentication:** ✅ Required (Admin or Manager only)  
**Example Body:** None (GET request)

---

## Subscription Type Management Endpoints (1)

### 20. GET /subscription-types
**Description:** List all active subscription types for dropdown selection  
**Authentication:** ✅ Required (Admin or Manager only)  
**Example Body:** None (GET request)

---

## Role Permissions Summary

| Role | Login | Profile | Staff Mgmt | Tenant Mgmt | Subscription Mgmt | Cluster Mgmt |
|------|-------|---------|------------|-------------|-------------------|--------------|
| **admin** | ✅ | ✅ | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| **manager** | ✅ | ✅ | ❌ None | ✅ Register | ✅ Full | ❌ None |
| **staff** | ✅ | ✅ | ❌ None | ❌ None | ❌ None | ❌ None |

---

## Postman Environment Variables

For easier testing, set up these Postman environment variables:

### Environment Variables
- `base_url`: `https://85n0x7rpf3.execute-api.ap-southeast-2.amazonaws.com/v1`
- `auth_token`: `{{login_response.data.token}}` (auto-populated after login)
- `tenant_id`: `550e8400-e29b-41d4-a716-446655440003` (example tenant ID)
- `subscription_id`: `550e8400-e29b-41d4-a716-446655440005` (example subscription ID)
- `cluster_id`: `550e8400-e29b-41d4-a716-446655440004` (example cluster ID)
- `staff_id`: `550e8400-e29b-41d4-a716-446655440002` (example staff ID)

### Authorization Header
For authenticated endpoints, use:
```
Authorization: Bearer {{auth_token}}
```

### Example URLs
- Login: `{{base_url}}/auth/login`
- Create Tenant: `{{base_url}}/tenant/register`
- List Subscriptions: `{{base_url}}/subscription/list?tenant_id={{tenant_id}}`
- Get Subscription: `{{base_url}}/subscription/{{subscription_id}}`
- Deploy Cluster: `{{base_url}}/cluster/{{cluster_id}}/deploy`