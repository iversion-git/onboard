# Landlord Table Mapping Reference - IMPLEMENTATION COMPLETE ✅

## 📋 **Field Mapping for Subscription → Landlord Integration**

### **Process Overview**
When a subscription is successfully created in `onboard-subscriptions-${stage}`, we automatically create a corresponding record in the `landlord-${stage}` global table. This document defines the field mappings and transformation logic that has been **IMPLEMENTED** in the subscription creation handler.

---

## ✅ **IMPLEMENTED MAPPING**

The following mapping has been successfully implemented in `handlers/subscription/create.ts`:

```typescript
const landlordData = {
  id: subscription_id,                    // ✅ Uses subscription.subscription_id as unique identifier
  name: tenant.business_name,             // ✅ Uses tenant business name
  domain: tenantUrl,                      // ✅ Generated tenant URL without https:// (e.g., "acme-corp-prod.shared.au.myapp.com")
  database: generateDatabaseName(tenant.tenant_url, subscription_type_level), // ✅ Generated database name
  dbusername: generateDatabaseUsername(), // ✅ Random generated username
  dbpassword: generateDatabasePassword(), // ✅ Random generated password (plain text)
  dburl: extractDatabaseHostname(dbProxyUrl), // ✅ Just DB hostname without port (e.g., "prod-db-01-instance-1.cabaivmklndo.ap-southeast-2.rds.amazonaws.com")
  s3id: generateS3Id(`${subscription_id}-${Date.now()}`), // ✅ 8-character unique hash
  url: `https://${extractDomain(domain_name)}`, // ✅ Full URL of domain supplied during subscription creation (e.g., "https://acme-corp.com")
  api_url: tenantApiUrl,                  // ✅ Generated tenant API URL without https:// (e.g., "tenant1.au.flowrix.app")
  package_id: subscription.package_id,    // ✅ From subscription
  industry_id: subscription.subscription_type_id, // ✅ Maps subscription_type_id to industry_id
  environment: mapSubscriptionToEnvironment(subscription_type_level), // ✅ Maps Production/Dev
  outlets: subscription.number_of_stores, // ✅ Uses number_of_stores field
  created_at: current_timestamp,          // ✅ Auto-generated
  updated_at: current_timestamp           // ✅ Auto-generated
};
```

### **Environment Mapping (Implemented)**
- `subscription_type_level: "Production"` → `environment: "Production"`
- `subscription_type_level: "Dev"` → `environment: "Development"`

### **Database Name Generation Rules (Implemented)**
- **Production**: `{tenant_url_first_part}-{randomstring}` (e.g., "acme-abc123")
- **Dev**: `dev-{tenant_url_first_part}-{randomstring}` (e.g., "dev-acme-xyz789")

### **Generation Functions (Implemented)**
- **Database name**: `generateDatabaseName()` - Uses tenant URL + random string
- **DB username**: `generateDatabaseUsername()` - Random unique username (usr + 8 hex chars)
- **DB password**: `generateDatabasePassword()` - 16-character secure password (plain text)
- **S3 ID**: `generateS3Id()` - 8-character SHA256 hash
- **DB hostname**: `extractDatabaseHostname()` - Extracts hostname from DB proxy URL (removes port)
- **Domain extraction**: `extractDomain()` - Extracts domain from full URL for domain field

---

## 🔧 **Implementation Details**

### **Files Modified**
- ✅ `lib/landlord-utils.ts` - Utility functions for data generation
- ✅ `handlers/subscription/create.ts` - Integrated landlord record creation
- ✅ `lib/data-models.ts` - LandlordRecord interface and validation
- ✅ `lib/dynamodb.ts` - Landlord CRUD operations

### **Error Handling**
- ✅ Landlord creation failure doesn't rollback subscription creation
- ✅ Comprehensive logging for debugging
- ✅ Graceful degradation if landlord table is unavailable

### **Testing Status**
- ✅ Utility functions working correctly
- ✅ Subscription creation tests passing
- ✅ No breaking changes to existing functionality

---

## 🚀 **Next Steps**

### **Step 3: Database Provisioning (Future)**
- Create actual RDS Aurora MySQL database
- Update `dburl` field with real database proxy URL
- Implement database schema creation

### **Step 4: Route 53 DNS Management (Future)**
- Create subdomain DNS records
- Point to appropriate regional API gateway

### **Step 5: Ecommerce Proxy Stack (Future)**
- Deploy tenant-specific proxy configuration

---

## 📊 **Current Status**

| Component | Status | Notes |
|-----------|--------|-------|
| Field Mapping | ✅ Complete | All fields mapped and implemented |
| Utility Functions | ✅ Complete | All generation functions working |
| Integration | ✅ Complete | Landlord creation integrated in subscription flow |
| Error Handling | ✅ Complete | Graceful failure handling implemented |
| Testing | ✅ Complete | Core functionality tested and working |
| Database URL | ✅ Complete | Uses actual DB proxy URL from cluster or placeholder |

---

*This implementation completes Step 2 of the multi-stage onboarding process. The landlord global table now receives data automatically when subscriptions are created, providing a single source of truth for all active subscriptions across all regions.*