# Manual DynamoDB Update Examples

## Using AWS CLI

### Update a single tenant record:
```bash
aws dynamodb update-item \
  --table-name Tenants-prod \
  --key '{"tenant_id": {"S": "your-tenant-id-here"}}' \
  --update-expression "SET subscription_type = :st, package_name = :pn, updated_at = :ua" \
  --expression-attribute-values '{
    ":st": {"S": "General"},
    ":pn": {"S": "Essential"},
    ":ua": {"S": "2025-01-07T05:00:00.000Z"}
  }'
```

### Scan and update multiple records:
```bash
# First, scan to see existing records
aws dynamodb scan --table-name Tenants-prod

# Then update each record individually using the update-item command above
```

## Using AWS Console

1. Go to DynamoDB in AWS Console
2. Select your Tenants table
3. Go to "Explore table items"
4. Select each tenant record
5. Click "Edit item"
6. Add the new fields:
   - `subscription_type`: "General" (or appropriate value)
   - `package_name`: "Essential" (or appropriate value)
7. Update the `updated_at` timestamp
8. Save changes

## Default Values to Use

- **subscription_type**: "General" (most common)
- **package_name**: "Essential" (starter package)

You can change these later through your application's update functionality.