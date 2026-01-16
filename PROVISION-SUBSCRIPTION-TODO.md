# Subscription Provision Button - Implementation Task List

## Overview
The Provision button will automate the complete deployment of a subscription, including database provisioning, DNS configuration, and infrastructure deployment.

---

## 📋 Task List

### **Phase 1: Database Provisioning**

#### Task 1.1: Create Database Schema in Aurora MySQL
- [ ] Fetch DB proxy URL from cluster table (cluster.stack_outputs.DBProxyEndpoint)
- [ ] Get database name from landlord global table
- [ ] Connect to Aurora MySQL using DB proxy URL
- [ ] Create new database schema with the name from landlord table
- [ ] Handle connection errors and timeouts gracefully
- [ ] Log all database operations

**Technical Details:**
- Use MySQL client library (e.g., `mysql2` npm package)
- Connection string: `mysql://{username}:{password}@{dbProxyUrl}/{databaseName}`
- Database credentials: Retrieved from cluster secrets or environment variables
- SQL: `CREATE DATABASE IF NOT EXISTS {databaseName} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`

---

#### Task 1.2: SQL Script Storage Structure
- [ ] Create `db-migrations/` folder in project root for local SQL scripts
- [ ] Create folder structure in S3 bucket (same bucket as cluster YAML files):
  ```
  s3://{code-bucket}/sql/
    ├── package-10-type-10.sql  (Essential + General)
    ├── package-10-type-20.sql  (Essential + Made to Measure)
    ├── package-20-type-10.sql  (Professional + General)
    ├── package-20-type-20.sql  (Professional + Made to Measure)
    ├── package-30-type-10.sql  (Premium + General)
    ├── package-40-type-10.sql  (Enterprise + General)
    └── ... (other combinations)
  ```
- [ ] Naming convention: `package-{package_id}-type-{subscription_type_id}.sql`

**File Naming Examples:**
- Package 10 (Essential) + Type 10 (General) = `package-10-type-10.sql`
- Package 20 (Professional) + Type 20 (Made to Measure) = `package-20-type-20.sql`
- Package 30 (Premium) + Type 10 (General) = `package-30-type-10.sql`

---

#### Task 1.3: Create Sample SQL Scripts for Testing
- [ ] Create simple test SQL scripts in `db-migrations/` folder
- [ ] Example script content:
  ```sql
  -- Sample SQL script for testing
  -- Package: Essential (10), Type: General (10)
  
  CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  
  CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  
  -- Insert sample data
  INSERT INTO users (email, name) VALUES 
    ('admin@example.com', 'Admin User'),
    ('user@example.com', 'Regular User');
  ```
- [ ] Create at least 3 different SQL scripts for different package/type combinations

---

#### Task 1.4: Create SQL Upload Script
- [ ] Create `scripts/upload-sql-scripts.ts` (similar to `upload-cluster-templates.ts`)
- [ ] Script should:
  - Read SQL files from `db-migrations/` folder
  - Upload to S3 bucket under `sql/` prefix
  - Validate file naming convention
  - Show upload progress and results
  - Handle errors gracefully
- [ ] Add npm script: `"upload:sql": "tsx scripts/upload-sql-scripts.ts"`

**Script Features:**
- List all `.sql` files in `db-migrations/`
- Validate naming pattern: `package-{number}-type-{number}.sql`
- Upload with proper content type: `text/plain` or `application/sql`
- Set appropriate S3 permissions
- Display summary of uploaded files

---

#### Task 1.5: Fetch and Execute SQL Script
- [ ] Determine correct SQL script based on subscription's package_id and subscription_type_id
- [ ] Construct S3 key: `sql/package-{package_id}-type-{subscription_type_id}.sql`
- [ ] Download SQL script from S3
- [ ] Parse SQL script (handle multiple statements separated by semicolons)
- [ ] Execute SQL statements sequentially against the database
- [ ] Handle SQL execution errors
- [ ] Log each statement execution
- [ ] Rollback on failure (if possible)

**Technical Details:**
- Use AWS SDK S3 client to download script
- Split SQL by semicolons (handle edge cases like semicolons in strings)
- Execute each statement using MySQL connection
- Wrap in transaction if possible
- Log execution time for each statement

---

### **Phase 2: DNS Configuration (Route 53)**

#### Task 2.1: Configure Route 53 DNS Records
- [ ] Hard-code Route 53 Hosted Zone ID (get from AWS console or environment variable)
- [ ] Create A record or CNAME for tenant URL (from subscription.tenant_url)
- [ ] Create A record or CNAME for tenant API URL (from subscription.tenant_api_url)
- [ ] Point records to appropriate API Gateway or CloudFront distribution
- [ ] Handle DNS propagation delays
- [ ] Verify DNS records were created successfully

**DNS Records to Create:**
1. **Tenant URL**: `{tenant_url}` → Points to CloudFront or API Gateway
2. **Tenant API URL**: `{tenant_api_url}` → Points to API Gateway

**Technical Details:**
- Use AWS SDK Route53 client
- Record type: A (Alias) or CNAME
- TTL: 300 seconds (5 minutes)
- Target: API Gateway domain or CloudFront distribution
- Handle existing records (update vs create)

---

#### Task 2.2: Environment Variables for Route 53
- [ ] Add `ROUTE53_HOSTED_ZONE_ID` to environment variables
- [ ] Add `API_GATEWAY_DOMAIN` or `CLOUDFRONT_DOMAIN` for DNS target
- [ ] Document required environment variables in README
- [ ] Add validation for required environment variables

---

### **Phase 3: Infrastructure Deployment**

#### Task 3.1: Deploy Website Cluster using CloudFormation
- [ ] Fetch website cluster YAML template from S3 (user will provide this)
- [ ] Prepare CloudFormation parameters from subscription data:
  - Tenant URL
  - API URL
  - Database name
  - S3 bucket ID
  - Package configuration
  - Environment (Production/Development)
- [ ] Deploy CloudFormation stack
- [ ] Monitor stack creation progress
- [ ] Store stack ARN in subscription.deployment_id
- [ ] Update subscription.deployment_status
- [ ] Store stack outputs in subscription.stack_outputs

**Stack Naming Convention:**
- `{tenant_url}-{subscription_type_level}-website`
- Example: `acme-corp-prod-website`

---

#### Task 3.2: Handle Deployment Status Updates
- [ ] Update subscription status to "Deploying" when provision starts
- [ ] Poll CloudFormation stack status during deployment
- [ ] Update subscription status to "Active" on successful deployment
- [ ] Update subscription status to "Failed" on deployment failure
- [ ] Update subscription.deployed_at timestamp on success
- [ ] Store error messages in subscription record on failure

---

### **Phase 4: API Endpoint Implementation**

#### Task 4.1: Create Provision Handler
- [ ] Create `handlers/subscription/provision.ts`
- [ ] Implement `POST /subscription/:subscriptionId/provision` endpoint
- [ ] Admin-only access (require admin role)
- [ ] Validate subscription exists and is in correct status
- [ ] Orchestrate all provisioning steps in sequence
- [ ] Handle errors at each step
- [ ] Return detailed progress/status information

**Endpoint Requirements:**
- Method: POST
- Path: `/subscription/:subscriptionId/provision`
- Auth: Admin only
- Request body: None (all data from subscription record)
- Response: Provisioning status and progress

---

#### Task 4.2: Provision Workflow Orchestration
- [ ] Step 1: Validate subscription is ready for provisioning
  - Check subscription status is "Pending" or "Failed"
  - Verify cluster is Active
  - Verify landlord record exists
- [ ] Step 2: Update subscription status to "Deploying"
- [ ] Step 3: Execute database provisioning (Phase 1)
- [ ] Step 4: Execute DNS configuration (Phase 2)
- [ ] Step 5: Execute infrastructure deployment (Phase 3)
- [ ] Step 6: Update subscription status to "Active" or "Failed"
- [ ] Step 7: Update landlord status to match subscription status

**Error Handling:**
- If any step fails, mark subscription as "Failed"
- Log detailed error information
- Store error details in subscription record
- Allow retry by calling provision endpoint again

---

#### Task 4.3: Add Route Registration
- [ ] Export `provisionSubscriptionHandler` from `handlers/subscription/index.ts`
- [ ] Register route in `routes/subscription.ts`
- [ ] Add route to API documentation

---

### **Phase 5: Helper Functions and Utilities**

#### Task 5.1: Database Connection Helper
- [ ] Create `lib/database.ts` with MySQL connection utilities
- [ ] Function: `connectToDatabase(dbProxyUrl, credentials)`
- [ ] Function: `createDatabaseSchema(connection, databaseName)`
- [ ] Function: `executeSqlScript(connection, sqlScript, databaseName)`
- [ ] Handle connection pooling
- [ ] Handle connection timeouts
- [ ] Proper connection cleanup

---

#### Task 5.2: S3 SQL Script Helper
- [ ] Create `lib/sql-scripts.ts` with S3 utilities
- [ ] Function: `getSqlScriptKey(packageId, subscriptionTypeId)`
- [ ] Function: `downloadSqlScript(bucketName, key)`
- [ ] Function: `parseSqlScript(scriptContent)` - Split into statements
- [ ] Handle missing scripts gracefully
- [ ] Cache downloaded scripts (optional optimization)

---

#### Task 5.3: Route 53 Helper
- [ ] Create `lib/route53.ts` with DNS utilities
- [ ] Function: `createDnsRecord(hostedZoneId, recordName, target)`
- [ ] Function: `updateDnsRecord(hostedZoneId, recordName, target)`
- [ ] Function: `verifyDnsRecord(recordName)`
- [ ] Handle DNS propagation delays
- [ ] Support both A and CNAME records

---

#### Task 5.4: CloudFormation Deployment Helper
- [ ] Create `lib/cloudformation-deploy.ts` (or extend existing)
- [ ] Function: `deployWebsiteStack(stackName, templateUrl, parameters)`
- [ ] Function: `monitorStackProgress(stackName)`
- [ ] Function: `getStackOutputs(stackName)`
- [ ] Handle stack creation failures
- [ ] Support stack updates (for re-provisioning)

---

### **Phase 6: Testing and Documentation**

#### Task 6.1: Testing
- [ ] Test database schema creation with sample SQL scripts
- [ ] Test SQL script upload to S3
- [ ] Test SQL script download and execution
- [ ] Test DNS record creation in Route 53
- [ ] Test CloudFormation stack deployment
- [ ] Test complete provision workflow end-to-end
- [ ] Test error handling and rollback scenarios
- [ ] Test provision retry after failure

---

#### Task 6.2: Documentation
- [ ] Update API documentation with provision endpoint
- [ ] Document SQL script naming convention
- [ ] Document required environment variables
- [ ] Document provision workflow and steps
- [ ] Create troubleshooting guide for common issues
- [ ] Document how to upload SQL scripts
- [ ] Document how to upload website YAML template

---

#### Task 6.3: Monitoring and Logging
- [ ] Add comprehensive logging for each provision step
- [ ] Log timing information for performance monitoring
- [ ] Add CloudWatch metrics for provision success/failure rates
- [ ] Add alerts for provision failures
- [ ] Create dashboard for monitoring provision operations

---

## 📊 Implementation Order

### Priority 1 (Core Functionality)
1. Task 1.2: SQL script storage structure
2. Task 1.3: Create sample SQL scripts
3. Task 1.4: Create SQL upload script
4. Task 5.1: Database connection helper
5. Task 5.2: S3 SQL script helper
6. Task 1.1: Create database schema
7. Task 1.5: Fetch and execute SQL script

### Priority 2 (DNS and Deployment)
8. Task 5.3: Route 53 helper
9. Task 2.1: Configure Route 53 DNS records
10. Task 5.4: CloudFormation deployment helper
11. Task 3.1: Deploy website cluster

### Priority 3 (API and Orchestration)
12. Task 4.1: Create provision handler
13. Task 4.2: Provision workflow orchestration
14. Task 4.3: Add route registration
15. Task 3.2: Handle deployment status updates

### Priority 4 (Testing and Documentation)
16. Task 6.1: Testing
17. Task 6.2: Documentation
18. Task 6.3: Monitoring and logging

---

## 🔧 Required Dependencies

### NPM Packages to Install
```bash
npm install mysql2          # MySQL client for Node.js
npm install @types/mysql2   # TypeScript types for mysql2
```

### AWS Services Required
- RDS Aurora MySQL (already provisioned via cluster)
- S3 (for SQL scripts and YAML templates)
- Route 53 (for DNS management)
- CloudFormation (for infrastructure deployment)
- Secrets Manager (for database credentials)

---

## 📝 Environment Variables Needed

```env
# Database
DB_MASTER_USERNAME=admin
DB_MASTER_PASSWORD=<from-secrets-manager>

# Route 53
ROUTE53_HOSTED_ZONE_ID=Z1234567890ABC
API_GATEWAY_DOMAIN=api.myapp.com
CLOUDFRONT_DOMAIN=cdn.myapp.com

# S3
CODE_BUCKET=my-lambda-code-bucket
SQL_SCRIPTS_PREFIX=sql/
WEBSITE_TEMPLATE_KEY=templates/website-cluster.yaml
```

---

## 🎯 Success Criteria

A successful provision operation should:
1. ✅ Create database schema in Aurora MySQL
2. ✅ Execute SQL script and populate database with tables/data
3. ✅ Create DNS records in Route 53 for tenant URL and API URL
4. ✅ Deploy CloudFormation stack for website infrastructure
5. ✅ Update subscription status to "Active"
6. ✅ Update landlord status to "Active"
7. ✅ Store deployment details (stack ARN, outputs) in subscription record
8. ✅ Complete within reasonable time (< 10 minutes)
9. ✅ Handle errors gracefully and allow retry

---

## 🚨 Error Scenarios to Handle

1. **Database connection failure** - Retry with exponential backoff
2. **SQL script not found** - Return clear error message
3. **SQL execution error** - Rollback if possible, mark as failed
4. **DNS record creation failure** - Retry, don't fail entire provision
5. **CloudFormation deployment failure** - Store error, allow retry
6. **Timeout during deployment** - Continue monitoring in background
7. **Partial success** - Track which steps completed, resume from failure point

---

*This document will be updated as implementation progresses. Each completed task should be checked off.*
