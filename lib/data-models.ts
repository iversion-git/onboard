// Data models for DynamoDB tables with validation schemas
import { z } from 'zod';
import { validateCIDR } from './cidr-utils.js';

// Staff Table Data Model
export interface StaffRecord {
  staff_id: string;           // PK
  email: string;              // GSI PK (EmailIndex)
  password_hash: string;      // bcrypt hash
  roles: string[];            // ['admin', 'manager', 'user']
  enabled: boolean;
  last_login?: string;        // ISO timestamp of last successful login
  created_at: string;         // ISO timestamp
  updated_at: string;         // ISO timestamp
}

// Password Reset Tokens Table Data Model
export interface PasswordResetToken {
  token_hash: string;         // PK (SHA-256 hash of token)
  staff_id: string;
  expires_at: number;         // TTL attribute (epoch seconds)
  created_at: string;
  used_at?: string;           // Optional, set when token is consumed
}

// Tenants Table Data Model
export interface TenantRecord {
  tenant_id: string;          // PK
  name: string;               // Contact name
  email: string;              // Contact email
  mobile_number: string;      // Contact mobile number
  business_name: string;      // Business/company name
  status: 'Pending' | 'Active' | 'Suspended' | 'Terminated';
  deployment_type: 'Shared' | 'Dedicated';
  region: 'Australia' | 'US' | 'UK' | 'Europe';
  tenant_url: string;         // Tenant subdomain (e.g., tenant1, tenant2)
  subscription_type_id?: number; // FK to subscription_types table (optional for backward compatibility)
  package_id?: number;        // FK to packages table (optional for backward compatibility)
  cluster_id: string;         // Required cluster ID for referential integrity
  cluster_name: string;       // Required cluster name for display purposes
  created_at: string;
  updated_at: string;
}

// Packages Table Data Model
export interface PackageRecord {
  package_id: number;         // PK
  package_name: string;       // Package name (e.g., "Essential", "Professional", "Premium", "Enterprise")
  description?: string;       // Optional description
  features?: string[];        // Optional list of features
  price?: number;            // Optional price
  active: boolean;           // Whether this package is active/available
  created_at: string;
  updated_at: string;
}

// Subscription Types Table Data Model
export interface SubscriptionTypeRecord {
  subscription_type_id: number; // PK
  subscription_type_name: string; // Type name (e.g., "General", "Made to Measure", "Automotive", "Rental")
  description?: string;         // Optional description
  active: boolean;             // Whether this subscription type is active/available
  created_at: string;
  updated_at: string;
}

// Landlord Table Data Model (Global Table)
export interface LandlordRecord {
  id: string;                     // PK - Unique landlord identifier
  name: string;                   // Landlord name
  domain: string;                 // Generated tenant URL without https:// (e.g., "acme-corp-prod.shared.au.myapp.com")
  database: string;               // Database name
  dbusername: string;             // Database username
  dbpassword: string;             // Database password (encrypted)
  dburl: string;                  // Database hostname only
  s3id: string;                   // S3 identifier
  url: string;                    // Full URL of domain supplied during subscription creation (e.g., "https://acme-corp.com")
  api_url: string;                // Generated tenant API URL without https:// (e.g., "tenant1.au.flowrix.app")
  package_id: number;             // FK to packages table
  industry_id: number;            // Industry identifier
  environment: 'Production' | 'Staging' | 'Development';  // Environment type
  outlets: number;                // Number of outlets
  created_at: string;             // ISO timestamp
  updated_at: string;             // ISO timestamp
}

// Subscriptions Table Data Model
export interface SubscriptionRecord {
  subscription_id: string;        // PK
  tenant_id: string;              // FK to tenant
  subscription_name: string;      // Subscription name (e.g., "tenant1-prod", "tenant1-dev", "tenant1-dev-2")
  subscription_type_level: 'Production' | 'Dev';
  tenant_url: string;             // Generated tenant URL (e.g., acme-corp.flowrix.app)
  tenant_api_url: string;         // Generated API URL based on deployment type and region
  domain_name: string;            // Custom domain name (e.g., https://mywebsite.com)
  number_of_stores: number;       // Number of stores (default: 1)
  region: string;                 // AWS region code (ap-southeast-2, us-east-1, eu-west-2, eu-central-1, or "dedicated")
  deployment_type: 'Shared' | 'Dedicated';
  subscription_type_id: number;   // FK to subscription_types table
  package_id: number;             // FK to packages table
  cluster_id: string;             // Cluster ID from tenant
  cluster_name: string;           // Cluster name from tenant
  status: 'Pending' | 'Deploying' | 'Active' | 'Failed' | 'Suspended' | 'Terminated';
  deployment_id?: string;         // CloudFormation stack ARN
  deployment_status?: string;     // CloudFormation stack status
  stack_outputs?: Record<string, any>; // CloudFormation outputs
  created_at: string;
  updated_at: string;
  deployed_at?: string;           // When deployment completed
}
export interface ClusterRecord {
  cluster_id: string;         // PK
  name: string;
  type: 'dedicated' | 'shared';
  environment: 'Production' | 'Staging' | 'Dev';  // New field for environment type
  region: string;             // AWS region
  cidr: string;               // Network CIDR block
  code_bucket: string;        // S3 bucket for Lambda function code
  bref_layer_arn: string;     // Bref PHP layer ARN for the region
  api_domain: string;         // Custom API domain (e.g., tenant1.au.myapp.com)
  certificate_arn: string;    // ACM certificate ARN for the API domain
  status: 'In-Active' | 'Deploying' | 'Active' | 'Failed';
  deployment_status?: string; // CloudFormation stack status
  deployment_id?: string;     // CloudFormation stack ARN
  stack_outputs?: Record<string, any>; // CloudFormation outputs
  created_at: string;
  updated_at: string;
  deployed_at?: string;       // When deployment completed
}

// JWT Token Structure
export interface JWTPayload {
  sub: string;                // staff_id
  email: string;
  roles: string[];
  iat: number;                // issued at
  exp: number;                // expires at
  iss?: string;               // issuer (optional)
  aud?: string;               // audience (optional)
}

// Validation schemas using Zod

// AWS regions validation - comprehensive list of active regions
const AWS_REGIONS = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1', 'eu-north-1', 'eu-south-1',
  'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'ap-northeast-2', 'ap-northeast-3', 'ap-south-1', 'ap-east-1',
  'ca-central-1', 'sa-east-1', 'af-south-1', 'me-south-1'
] as const;

export const StaffRecordSchema = z.object({
  staff_id: z.string().uuid(),
  email: z.string().email().toLowerCase(),
  password_hash: z.string().min(1),
  roles: z.array(z.enum(['admin', 'manager', 'user'])).min(1),
  enabled: z.boolean(),
  last_login: z.string().datetime().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const PasswordResetTokenSchema = z.object({
  token_hash: z.string().min(1),
  staff_id: z.string().uuid(),
  expires_at: z.number().int().positive(),
  created_at: z.string().datetime(),
  used_at: z.string().datetime().optional(),
});

export const PackageRecordSchema = z.object({
  package_id: z.number().int().positive(),
  package_name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  features: z.array(z.string()).optional(),
  price: z.number().positive().optional(),
  active: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const SubscriptionTypeRecordSchema = z.object({
  subscription_type_id: z.number().int().positive(),
  subscription_type_name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  active: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const TenantRecordSchema = z.object({
  tenant_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  email: z.string().email().toLowerCase(),
  mobile_number: z.string().min(1).max(20),
  business_name: z.string().min(1).max(255),
  status: z.enum(['Pending', 'Active', 'Suspended', 'Terminated']),
  deployment_type: z.enum(['Shared', 'Dedicated']),
  region: z.enum(['Australia', 'US', 'UK', 'Europe']),
  tenant_url: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'Tenant URL must contain only lowercase letters, numbers, and hyphens').refine(
    (url) => !url.startsWith('-') && !url.endsWith('-'),
    'Tenant URL cannot start or end with a hyphen'
  ).refine(
    (url) => !url.includes('--'),
    'Tenant URL cannot contain consecutive hyphens'
  ),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const LandlordRecordSchema = z.object({
  id: z.string().min(1).max(255),
  name: z.string().min(1).max(255),
  domain: z.string().min(1).max(255), // Generated tenant URL without https:// (e.g., "acme-corp-prod.shared.au.myapp.com")
  database: z.string().min(1).max(255),
  dbusername: z.string().min(1).max(255),
  dbpassword: z.string().min(1).max(255), // Should be encrypted
  dburl: z.string().min(1).max(255), // Just the database hostname (e.g., "prod-db-01-instance-1.cabaivmklndo.ap-southeast-2.rds.amazonaws.com")
  s3id: z.string().min(1).max(255),
  url: z.string().url(), // Full URL of the domain supplied during subscription creation (e.g., "https://acme-corp.com")
  api_url: z.string().min(1).max(255), // Generated tenant API URL without https:// (e.g., "tenant1.au.flowrix.app")
  package_id: z.number().int().positive(),
  industry_id: z.number().int().positive(),
  environment: z.enum(['Production', 'Staging', 'Development']),
  outlets: z.number().int().min(0),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const SubscriptionRecordSchema = z.object({
  subscription_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  tenant_name: z.string().min(1).max(255), // Business name from tenant table
  subscription_type_level: z.enum(['Production', 'Dev']),
  tenant_url: z.string().min(1).max(255),
  tenant_api_url: z.string().min(1).max(255),
  domain_name: z.string().url().describe('Custom domain name (e.g., https://mywebsite.com)'),
  number_of_stores: z.number().int().min(1).default(1).describe('Number of stores (minimum 1, default 1)'),
  region: z.string().min(1).max(50), // AWS region code or "dedicated"
  deployment_type: z.enum(['Shared', 'Dedicated']),
  subscription_type_id: z.number().int().positive(), // FK to subscription_types table
  package_id: z.number().int().positive(), // FK to packages table
  cluster_id: z.string().uuid(), // Reference to cluster for DB/resource lookups
  cluster_name: z.string().min(1).max(255), // Display name for cluster
  cluster_region: z.string().min(1).max(50), // Cluster AWS region
  db_proxy_url: z.string().optional(), // DB proxy URL from cluster stack outputs
  status: z.enum(['Pending', 'Deploying', 'Active', 'Failed', 'Suspended', 'Terminated']),
  deployment_id: z.string().optional(),
  deployment_status: z.string().optional(),
  stack_outputs: z.record(z.any()).optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  deployed_at: z.string().datetime().optional(),
});

export const ClusterRecordSchema = z.object({
  cluster_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  type: z.enum(['dedicated', 'shared']),
  environment: z.enum(['Production', 'Staging', 'Dev']),
  region: z.enum(AWS_REGIONS),
  cidr: z.string().min(1), // Simplified validation to avoid circular import issues
  code_bucket: z.string().min(1).max(255),
  bref_layer_arn: z.string().min(1),
  api_domain: z.string().min(1).max(255),
  certificate_arn: z.string().min(1),
  status: z.enum(['In-Active', 'Deploying', 'Active', 'Failed']),
  deployment_status: z.string().optional(),
  deployment_id: z.string().optional(),
  stack_outputs: z.record(z.any()).optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  deployed_at: z.string().datetime().optional(),
});

export const JWTPayloadSchema = z.object({
  sub: z.string().uuid(),
  email: z.string().email(),
  roles: z.array(z.enum(['admin', 'manager', 'user'])),
  iat: z.number().int().positive(),
  exp: z.number().int().positive(),
  iss: z.string().optional(),
  aud: z.string().optional(),
});

// Input validation schemas for API endpoints
export const CreateStaffSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(128),
  roles: z.array(z.enum(['admin', 'manager', 'user'])).min(1),
});

export const UpdateStaffSchema = z.object({
  roles: z.array(z.enum(['admin', 'manager', 'user'])).min(1).optional(),
  enabled: z.boolean().optional(),
});

export const CreateTenantSchema = z.object({
  name: z.string().min(1).max(255).describe('Contact person name'),
  email: z.string().email().toLowerCase().describe('Contact email address'),
  mobile_number: z.string().min(1).max(20).describe('Contact mobile number'),
  business_name: z.string().min(1).max(255).describe('Business or company name'),
  deployment_type: z.enum(['Shared', 'Dedicated']).describe('Deployment type'),
  region: z.enum(['Australia', 'US', 'UK', 'Europe']).describe('Preferred region'),
  tenant_url: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'Tenant URL must contain only lowercase letters, numbers, and hyphens').refine(
    (url) => !url.startsWith('-') && !url.endsWith('-'),
    'Tenant URL cannot start or end with a hyphen'
  ).refine(
    (url) => !url.includes('--'),
    'Tenant URL cannot contain consecutive hyphens'
  ).describe('Tenant subdomain (e.g., acme-corp, tenant123)'),
});

export const CreateSubscriptionSchema = z.object({
  tenant_id: z.string().uuid().describe('Tenant ID to create subscription for'),
  subscription_type_level: z.enum(['Production', 'Dev']).describe('Subscription type level'),
  domain_name: z.string().url().describe('Custom domain name (e.g., https://mywebsite.com)'),
  number_of_stores: z.number().int().min(1).default(1).optional().describe('Number of stores (minimum 1, default 1 if not provided)'),
  cluster_id: z.string().uuid().describe('Required cluster ID to assign subscription to specific cluster'),
  // Subscription type selection (either ID or name required)
  subscription_type_id: z.number().int().positive().optional().describe('Subscription type ID (preferred)'),
  subscription_type: z.enum(['General', 'Made to Measure', 'Automotives', 'Rental', 'Subscriptions']).optional().describe('Subscription type name (for backward compatibility)'),
  // Package selection (either ID or name required)
  package_id: z.number().int().positive().optional().describe('Package ID (preferred)'),
  package_name: z.enum(['Essential', 'Professional', 'Premium', 'Enterprise']).optional().describe('Package name (for backward compatibility)'),
}).refine(
  (data) => data.subscription_type_id || data.subscription_type,
  'Either subscription_type_id or subscription_type must be provided'
).refine(
  (data) => data.package_id || data.package_name,
  'Either package_id or package_name must be provided'
);

export const CreateClusterSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['dedicated', 'shared']),
  environment: z.enum(['Production', 'Staging', 'Dev']),
  region: z.enum(AWS_REGIONS),
  cidr: z.string().min(1), // Simplified validation
  code_bucket: z.string().min(1).max(255),
  bref_layer_arn: z.string().min(1),
  api_domain: z.string().min(1).max(255),
  certificate_arn: z.string().min(1),
});

export const UpdateClusterSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  environment: z.enum(['Production', 'Staging', 'Dev']).optional(),
  status: z.enum(['In-Active', 'Deploying', 'Active', 'Failed']).optional(),
  deployment_status: z.string().optional(),
  deployment_id: z.string().optional(),
  stack_outputs: z.record(z.any()).optional(),
  deployed_at: z.string().datetime().optional(),
});

export const LoginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

export const PasswordResetRequestSchema = z.object({
  email: z.string().email().toLowerCase(),
});

export const PasswordResetConfirmSchema = z.object({
  token: z.string().min(1),
  new_password: z.string().min(8).max(128),
});

// Type guards for runtime type checking
export const isStaffRecord = (obj: any): obj is StaffRecord => {
  return StaffRecordSchema.safeParse(obj).success;
};

export const isPasswordResetToken = (obj: any): obj is PasswordResetToken => {
  return PasswordResetTokenSchema.safeParse(obj).success;
};

export const isLandlordRecord = (obj: any): obj is LandlordRecord => {
  return LandlordRecordSchema.safeParse(obj).success;
};

export const isTenantRecord = (obj: any): obj is TenantRecord => {
  return TenantRecordSchema.safeParse(obj).success;
};

export const isClusterRecord = (obj: any): obj is ClusterRecord => {
  return ClusterRecordSchema.safeParse(obj).success;
};

export const isJWTPayload = (obj: any): obj is JWTPayload => {
  return JWTPayloadSchema.safeParse(obj).success;
};

// Utility types for partial updates
export type StaffUpdate = Partial<Pick<StaffRecord, 'roles' | 'enabled' | 'updated_at'>>;
export type StaffPasswordUpdate = Partial<Pick<StaffRecord, 'password_hash' | 'updated_at'>>;
export type LandlordUpdate = Partial<Pick<LandlordRecord, 'name' | 'domain' | 'database' | 'dbusername' | 'dbpassword' | 'dburl' | 's3id' | 'url' | 'package_id' | 'industry_id' | 'environment' | 'outlets' | 'updated_at'>>;
export type TenantUpdate = Partial<Pick<TenantRecord, 'name' | 'email' | 'mobile_number' | 'business_name' | 'status' | 'deployment_type' | 'region' | 'tenant_url' | 'subscription_type' | 'package_name' | 'cluster_id' | 'cluster_name' | 'updated_at'>>;
export type SubscriptionUpdate = Partial<Pick<SubscriptionRecord, 'subscription_name' | 'domain_name' | 'number_of_stores' | 'status' | 'deployment_id' | 'deployment_status' | 'stack_outputs' | 'deployed_at' | 'updated_at'>>;
export type ClusterUpdate = Partial<Pick<ClusterRecord, 'name' | 'environment' | 'status' | 'deployment_status' | 'deployment_id' | 'stack_outputs' | 'deployed_at' | 'updated_at'>>;

// Database operation result types
export interface DatabaseOperationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  correlationId?: string;
}

// Query result types
export interface StaffQueryResult {
  staff?: StaffRecord;
  found: boolean;
}

export interface LandlordQueryResult {
  landlord?: LandlordRecord;
  found: boolean;
}

export interface TenantQueryResult {
  tenant?: TenantRecord;
  found: boolean;
}

export interface PackageQueryResult {
  package?: PackageRecord;
  found: boolean;
}

export interface SubscriptionTypeQueryResult {
  subscriptionType?: SubscriptionTypeRecord;
  found: boolean;
}

export interface SubscriptionQueryResult {
  subscription?: SubscriptionRecord;
  found: boolean;
}

export interface ClusterQueryResult {
  cluster?: ClusterRecord;
  found: boolean;
}

export interface PasswordResetTokenQueryResult {
  token?: PasswordResetToken;
  found: boolean;
  expired?: boolean;
}

// CIDR validation utilities
export interface CIDRValidationResult {
  valid: boolean;
  error?: string;
  overlaps?: string[];
}

export interface CIDROverlapCheck {
  cidr: string;
  existingCidrs: string[];
}

// Export AWS regions for external use
export { AWS_REGIONS };

// Subscription Type ID Mapping
export const SUBSCRIPTION_TYPE_IDS = {
  'General': 1,
  'Made to Measure': 2,
  'Automotive': 3,
  'Rental': 4,
} as const;

export const SUBSCRIPTION_TYPE_NAMES = {
  1: 'General',
  2: 'Made to Measure',
  3: 'Automotive',
  4: 'Rental',
} as const;

// Package ID Mapping
export const PACKAGE_IDS = {
  'Essential': 1,
  'Professional': 2,
  'Premium': 3,
  'Enterprise': 4,
} as const;

export const PACKAGE_NAMES = {
  1: 'Essential',
  2: 'Professional',
  3: 'Premium',
  4: 'Enterprise',
} as const;

// Utility functions for ID mapping
export function getSubscriptionTypeId(subscriptionType: 'General' | 'Made to Measure' | 'Automotive' | 'Rental'): number {
  return SUBSCRIPTION_TYPE_IDS[subscriptionType];
}

export function getSubscriptionTypeName(subscriptionTypeId: number): 'General' | 'Made to Measure' | 'Automotive' | 'Rental' {
  const name = SUBSCRIPTION_TYPE_NAMES[subscriptionTypeId as keyof typeof SUBSCRIPTION_TYPE_NAMES];
  if (!name) {
    throw new Error(`Invalid subscription type ID: ${subscriptionTypeId}`);
  }
  return name;
}

export function getPackageId(packageName: 'Essential' | 'Professional' | 'Premium' | 'Enterprise'): number {
  return PACKAGE_IDS[packageName];
}

export function getPackageName(packageId: number): 'Essential' | 'Professional' | 'Premium' | 'Enterprise' {
  const name = PACKAGE_NAMES[packageId as keyof typeof PACKAGE_NAMES];
  if (!name) {
    throw new Error(`Invalid package ID: ${packageId}`);
  }
  return name;
}