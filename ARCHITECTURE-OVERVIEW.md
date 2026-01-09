# Onboard Service - Architecture Overview

## 🏗️ **System Architecture**

### **Two-Tier Application Architecture**

#### **1. Onboard Control Plane (This Application)**
- **Service Name**: `onboard-service`
- **Purpose**: Infrastructure management and tenant provisioning control plane
- **Deployment**: Single centralized control plane
- **Naming Convention**: `onboard-service-${stage}` (e.g., `onboard-service-dev`, `onboard-service-prod`)
- **Primary Responsibilities**:
  - Manage infrastructure clusters across multiple AWS regions
  - Handle tenant registration and subscription management
  - Orchestrate multi-stage tenant onboarding process
  - **Exclusive writer** to the landlord global table
  - Provision databases, DNS entries, and proxy stacks for tenants

#### **2. Multi-Tenant ERP Solution (Main Business Application)**
- **Purpose**: The actual SaaS ERP application that customers use
- **Deployment**: Deployed on clusters created and managed by onboard control plane
- **Architecture**: Multi-tenant SaaS solution
- **Access Pattern**: Customers access via subdomains that route to regional API gateways
- **Data Access**: Reads from landlord global table to validate tenant access and routing

### **Infrastructure Hierarchy**
```
┌─────────────────────────────────────────────────────────────┐
│                 Onboard Control Plane                       │
│                 (Single Instance)                           │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ├── Creates & Manages
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                Infrastructure Clusters                      │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ │
│ │   Cluster 1     │ │   Cluster 2     │ │   Cluster 3     │ │
│ │ ap-southeast-2  │ │   us-east-1     │ │  eu-central-1   │ │
│ │                 │ │                 │ │                 │ │
│ │ Multi-Tenant    │ │ Multi-Tenant    │ │ Multi-Tenant    │ │
│ │ ERP App         │ │ ERP App         │ │ ERP App         │ │
│ └─────────────────┘ └─────────────────┘ └─────────────────┘ │
│ ┌─────────────────┐                                         │
│ │   Cluster 4     │                                         │
│ │   eu-west-2     │                                         │
│ │                 │                                         │
│ │ Multi-Tenant    │                                         │
│ │ ERP App         │                                         │
│ └─────────────────┘                                         │
└─────────────────────────────────────────────────────────────┘
```

## 🎯 **Core Concepts**

### **Clusters**
- **Definition**: Infrastructure environments deployed in specific AWS regions
- **Types**: 
  - `shared`: Multiple tenants share cluster resources
  - `dedicated`: Single tenant has dedicated cluster resources
- **Environments**: `Production`, `Staging`, `Dev` (cluster-level environments)
- **Management**: Created, updated, and monitored via onboard control plane

### **Tenants**
- **Definition**: Business customers who purchase subscriptions to the ERP solution
- **Registration**: Handled through onboard control plane
- **Assignment**: Each tenant is assigned to a specific cluster based on region and deployment type
- **Data**: Stored in `onboard-tenants-${stage}` table

### **Subscriptions**
- **Definition**: Individual environments (Production or Dev) for a tenant
- **Types**:
  - **Production Subscription**: Live customer environment (1 per tenant max)
  - **Dev Subscription**: Development/testing environment (unlimited per tenant)
- **Important**: These are tenant-level subscriptions, NOT deployment stages of onboard app
- **Naming**: Uses random suffixes for dev subscriptions (e.g., `tenant1-dev-22`)
- **Data**: Stored in `onboard-subscriptions-${stage}` table

### **Landlord Global Table**
- **Purpose**: Single source of truth for all active subscriptions across all regions
- **Replication**: Global table replicated across ap-southeast-2, us-east-1, eu-central-1, eu-west-2
- **Access Pattern**:
  - **Write**: Only onboard control plane app
  - **Read**: Multi-tenant ERP apps in all regions
- **Use Case**: Enable ERP apps to validate tenant access and route requests correctly

## 🔄 **Data Flow Architecture**

### **Customer Journey**
```
1. Business Customer Purchases Subscription
   ↓
2. Admin Creates Tenant via Onboard Control Plane
   ↓
3. Admin Creates Production/Dev Subscriptions for Tenant
   ↓
4. Multi-Stage Onboarding Process Executes
   ↓
5. Customer Accesses ERP via Subdomain → Regional API Gateway
```

### **Multi-Stage Onboarding Process**
```
Subscription Creation Request
   ↓
Step 1: Create Subscription Record (✅ Implemented)
   ├── Validate tenant exists and is active
   ├── Validate package and subscription type
   ├── Generate subscription name and URLs
   └── Store in onboard-subscriptions-${stage}
   ↓
Step 2: Update Landlord Global Table (✅ Implemented)
   ├── Map tenant + subscription data
   ├── Generate database credentials and URLs
   └── Insert/update in landlord-${stage}
   ↓
Step 3: Create Tenant Database (🔲 Future)
   ├── Provision RDS instance or schema
   └── Configure access credentials
   ↓
Step 4: Create Route 53 DNS Entries (🔲 Future)
   ├── Create subdomain DNS records
   └── Point to appropriate regional API gateway
   ↓
Step 5: Deploy Ecommerce Proxy Stack (🔲 Future)
   └── Deploy tenant-specific proxy configuration
```

## 🗄️ **Database Architecture**

### **Regional Tables (Per Stage)**
- `onboard-staff-${stage}`: Staff authentication and authorization
- `onboard-tenants-${stage}`: Tenant registration and configuration
- `onboard-subscriptions-${stage}`: Subscription records and status
- `onboard-clusters-${stage}`: Infrastructure cluster management
- `onboard-packages-${stage}`: Available service packages
- `onboard-subscription-types-${stage}`: Subscription type definitions

### **Global Table (Multi-Region)**
- `landlord-${stage}`: **Global table** replicated across all regions
  - Contains active subscription data for ERP apps
  - Single source of truth for tenant access validation
  - Enables regional ERP apps to validate and route tenant requests

## 🌐 **Regional Distribution**

### **Supported Regions**
- **ap-southeast-2** (Australia)
- **us-east-1** (US East)
- **eu-central-1** (Europe Central)
- **eu-west-2** (Europe West/UK)

### **Regional Routing Strategy**
- Tenants are assigned to clusters in regions closest to their location
- Subdomains route to regional API gateways
- Landlord global table ensures consistent data across all regions
- Regional ERP apps can validate tenant access locally

## 🔐 **Security & Access Control**

### **Onboard Control Plane Access**
- JWT-based authentication for staff members
- Role-based authorization (admin, manager, staff)
- Admin-only access for infrastructure management
- Manager/Admin access for tenant and subscription management

### **Tenant Access**
- Subdomain-based routing to regional clusters
- Tenant validation via landlord global table
- Database-level tenant isolation
- Regional data residency compliance

## 📊 **Naming Conventions**

### **Service Level**
- Service: `onboard-service`
- Lambda: `onboard-api-${stage}`
- API Gateway: `onboard-api-${stage}`

### **Database Tables**
- Regional: `onboard-{resource}-${stage}` (e.g., `onboard-tenants-dev`)
- Global: `landlord-${stage}` (e.g., `landlord-prod`)

### **Infrastructure Resources**
- S3 Buckets: `onboard-templates-${stage}`
- CloudWatch Alarms: `onboard-service-${stage}-{metric}`
- CloudFormation Exports: `onboard-service-${stage}-{resource}`

### **Tenant Subscriptions**
- Production: `{tenant_url}-prod` (e.g., `acme-corp-prod`)
- Development: `{tenant_url}-dev-{random2digits}` (e.g., `acme-corp-dev-22`)

## 🚀 **Deployment Strategy**

### **Control Plane Deployment**
- Single deployment per stage (dev, staging, prod)
- Serverless architecture using AWS Lambda + API Gateway
- Infrastructure as Code using Serverless Framework
- Global table automatically replicates across regions

### **ERP App Deployment**
- Deployed to clusters created by control plane
- Regional deployment for low latency
- Multi-tenant architecture with tenant isolation
- Reads from local replica of landlord global table

## 🔄 **Current Implementation Status**

### **✅ Completed Features**
- Service naming convention migration to `onboard-service`
- Complete tenant management (registration, validation)
- Subscription creation with domain name and store count
- DynamoDB global table setup for landlord data
- URL generation with random suffixes for dev subscriptions
- Package and subscription type dynamic lookup tables
- **Landlord table integration during subscription creation**
- **Data mapping from tenant + subscription → landlord record**
- **Automatic generation of database credentials and S3 identifiers**

### **🔲 Next Implementation Priority**
- **Step 3**: Database provisioning automation
- **Step 4**: Route 53 DNS management
- **Step 5**: Ecommerce proxy stack deployment
- Error handling and rollback mechanisms for multi-stage processes

### **🔲 Future Roadmap**
- Database provisioning automation
- Route 53 DNS management
- Ecommerce proxy stack deployment
- Monitoring and alerting for multi-stage processes
- Tenant lifecycle management (suspend, terminate, reactivate)

---

*This document serves as the architectural reference for the onboard service and will be updated as the system evolves.*