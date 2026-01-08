# Subscription Management API Examples

## Create Subscription

### Production Subscription Example
```json
{
  "tenant_id": "550e8400-e29b-41d4-a716-446655440003",
  "subscription_type_level": "Production",
  "domain_name": "https://mywebsite.com"
}
```
**Result**: Subscription name will be auto-generated as `{tenant_url}-prod` (e.g., `acme-corp-prod`)

### Development Subscription Example
```json
{
  "tenant_id": "550e8400-e29b-41d4-a716-446655440003",
  "subscription_type_level": "Dev",
  "domain_name": "https://dev.mywebsite.com"
}
```
**Result**: Subscription name will be auto-generated as `{tenant_url}-dev-{random2digits}` (e.g., `acme-corp-dev-22`, `acme-corp-dev-87`, `acme-corp-dev-45`)

## Subscription Naming Convention

### Production Subscriptions
- Format: `{tenant_url}-prod`
- Examples: `acme-corp-prod`, `tenant1-prod`, `my-company-prod`
- Limit: Only one production subscription per tenant

### Development Subscriptions
- Format: `{tenant_url}-dev-{random2digits}` where random2digits is a 2-digit number (10-99)
- Examples: 
  - `acme-corp-dev-22` (first dev subscription)
  - `acme-corp-dev-87` (second dev subscription)
  - `acme-corp-dev-45` (third dev subscription)
- Limit: Unlimited dev subscriptions per tenant (each gets unique random suffix)

## Additional Subscription Information

When a subscription is created, the following information is automatically copied from the tenant:

### From Tenant Table:
- **Region**: Converted to AWS region codes
  - Australia → `ap-southeast-2`
  - US → `us-east-1` 
  - UK → `eu-west-2`
  - Europe → `eu-central-1`
  - Dedicated → `dedicated` (regardless of display region)
- **Deployment Type**: `Shared` or `Dedicated`
- **Subscription Type**: `General`, `Made to Measure`, `Automotive`, or `Rental`
- **Subscription Type ID**: Numeric mapping (1=General, 2=Made to Measure, 3=Automotive, 4=Rental)
- **Package Name**: `Essential`, `Professional`, `Premium`, or `Enterprise`
- **Package ID**: Numeric mapping (1=Essential, 2=Professional, 3=Premium, 4=Enterprise)
- **Cluster ID**: UUID of the assigned cluster
- **Cluster Name**: Display name of the assigned cluster

### From Request:
- **Domain Name**: Custom domain name provided by user (e.g., `https://mywebsite.com`)

### Example Subscription Response:
```json
{
  "subscription_id": "550e8400-e29b-41d4-a716-446655440005",
  "tenant_id": "550e8400-e29b-41d4-a716-446655440003",
  "subscription_name": "acme-corp-prod",
  "subscription_type_level": "Production",
  "tenant_url": "acme-corp.flowrix.app",
  "tenant_api_url": "acme-corp.au.flowrix.app",
  "domain_name": "https://mywebsite.com",
  "region": "ap-southeast-2",
  "deployment_type": "Shared",
  "subscription_type_id": 1,
  "subscription_type_name": "General",
  "package_id": 2,
  "package_name": "Professional",
  "cluster_id": "550e8400-e29b-41d4-a716-446655440004",
  "cluster_name": "Shared Production Cluster AU",
  "status": "Pending"
}
```

## URL Generation Examples

### Production Subscriptions (All Deployment Types)
- **Tenant URL**: `acme-corp.flowrix.app`

### Development Subscriptions (All Deployment Types)  
- **Tenant URL**: `acme-corp-dev-22.flowrix.app` (random 2-digit suffix)

### API URLs by Deployment Type

#### Dedicated Deployment (Any Region)
- **Production API URL**: `acme-corp.flowrix.app`
- **Dev API URL**: `acme-corp-dev-22.flowrix.app`

#### Shared Deployment (Australia)
- **Production API URL**: `acme-corp.au.flowrix.app`
- **Dev API URL**: `acme-corp-dev-22.au.flowrix.app`

#### Shared Deployment (US)
- **Production API URL**: `acme-corp.us.flowrix.app`
- **Dev API URL**: `acme-corp-dev-22.us.flowrix.app`

#### Shared Deployment (UK)
- **Production API URL**: `acme-corp.uk.flowrix.app`
- **Dev API URL**: `acme-corp-dev-22.uk.flowrix.app`

#### Shared Deployment (Europe)
- **Production API URL**: `acme-corp.eu.flowrix.app`
- **Dev API URL**: `acme-corp-dev-22.eu.flowrix.app`

## Business Rules

1. **Production Subscription Limit**: Each tenant can have only one Production subscription (named `{tenant_url}-prod`)
2. **Multiple Dev Subscriptions**: Each tenant can have multiple Dev subscriptions with unique random 2-digit suffixes (e.g., `{tenant_url}-dev-22`, `{tenant_url}-dev-87`, `{tenant_url}-dev-45`)
3. **Auto-Generated Names**: Subscription names are automatically generated based on tenant URL and type
4. **URL Generation**: URLs are automatically generated based on tenant's deployment type and region
5. **Tenant Status**: Tenant must be in Active or Pending status to create subscriptions

## API Endpoints

- `POST /subscription/create` - Create a new subscription
- `GET /subscription/list?tenant_id={uuid}` - List all subscriptions for a tenant
- `GET /subscription/{subscriptionId}` - Get specific subscription details