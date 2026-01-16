# Subscription Status and Landlord Table Changes

## Summary of Changes

### 1. Removed Database Credentials from Landlord Table
- **Removed fields**: `dbusername`, `dbpassword`, `dburl`
- **Reason**: Database credentials are now managed centrally by the cluster, not per-subscription
- **Impact**: Landlord table is simpler and more secure

### 2. Added Status Field to Landlord Table
- **New field**: `status` with values `Active` or `Suspended`
- **Status mapping**:
  - Subscription `Active` → Landlord `Active`
  - Subscription `Pending`, `Deploying`, `Failed`, `Suspended`, `Terminated` → Landlord `Suspended`
- **Default**: New subscriptions default to `Active` status in both tables

### 3. Changed Default Subscription Status
- **Old default**: `Pending`
- **New default**: `Active`
- **Reason**: Subscriptions are immediately active upon creation unless explicitly set otherwise

### 4. Status Synchronization
All status changes are automatically synchronized across tables:

#### Subscription Creation
- Creates subscription with status `Active` (default)
- Creates landlord record with status `Active` (default)

#### Subscription Update
- When subscription status is updated, landlord status is automatically updated
- When package_id is updated, landlord package_id is automatically updated
- When URLs/domain/stores are updated, landlord fields are automatically updated
- Admin-only permission for status updates
- All updatable fields sync to landlord table:
  - `package_id` → `package_id`
  - `tenant_url` → `domain`
  - `tenant_api_url` → `api_url`
  - `domain_name` → `url`
  - `number_of_stores` → `outlets`
  - `status` → `status` (Active or Suspended)

#### Tenant Status Cascade
- When tenant status changes to `Suspended` or `Terminated`:
  1. All tenant's subscriptions are updated to match
  2. All corresponding landlord records are updated to `Suspended`
  3. Ensures consistency across all three tables

## Updated Landlord Table Schema

```typescript
interface LandlordRecord {
  id: string;                     // Subscription ID
  name: string;                   // Business name
  domain: string;                 // Tenant URL (e.g., "acme-corp-prod.shared.au.myapp.com")
  database: string;               // Database name
  s3id: string;                   // S3 identifier
  url: string;                    // Custom domain (e.g., "https://acme-corp.com")
  api_url: string;                // API URL (e.g., "acme-corp-prod-api.shared.au.myapp.com")
  package_id: number;             // Package ID
  industry_id: number;            // Subscription type ID
  environment: string;            // "Production", "Staging", or "Development"
  outlets: number;                // Number of stores
  status: 'Active' | 'Suspended'; // NEW: Status field
  created_at: string;
  updated_at: string;
}
```

## Files Modified

1. **lib/data-models.ts**
   - Updated `LandlordRecord` interface (removed db fields, added status)
   - Updated `LandlordRecordSchema` validation
   - Updated `LandlordUpdate` type

2. **lib/dynamodb.ts**
   - Changed default subscription status from `Pending` to `Active`

3. **handlers/subscription/create.ts**
   - Removed database credential generation
   - Added status mapping for landlord record
   - Default status is `Active`

4. **handlers/subscription/update.ts**
   - Added status synchronization to landlord table
   - Status updates are admin-only

5. **handlers/tenant/update.ts**
   - Enhanced status cascade to update landlord records
   - Both Suspended and Terminated tenant statuses map to Suspended in landlord table

6. **LANDLORD-MAPPING-REFERENCE.md**
   - Updated documentation to reflect changes
   - Added status mapping details
   - Removed database credential references

## Testing Checklist

- [ ] Create new subscription - verify status is `Active` in both tables
- [ ] Update subscription status - verify landlord table is updated
- [ ] Suspend tenant - verify all subscriptions and landlord records are updated
- [ ] Terminate tenant - verify all subscriptions and landlord records are updated
- [ ] Admin can update subscription status
- [ ] Manager cannot update subscription status (403 Forbidden)

## Migration Notes

**For existing records**: If you have existing landlord records without the `status` field, you'll need to run a migration to add the status field based on the current subscription status.

Example migration logic:
```typescript
// For each landlord record:
const subscription = await getSubscription(landlord.id);
const landlordStatus = subscription.status === 'Active' ? 'Active' : 'Suspended';
await updateLandlord(landlord.id, { status: landlordStatus });
```
