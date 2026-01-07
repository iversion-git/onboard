// Data models for DynamoDB tables with validation schemas
import { z } from 'zod';
import { validateCIDR } from './cidr-utils.js';

// Staff Table Data Model
export interface StaffRecord {
  staff_id: string;           // PK
  email: string;              // GSI PK (EmailIndex)
  password_hash: string;      // bcrypt hash
  roles: string[];            // ['admin', 'manager', 'staff']
  enabled: boolean;
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
  subscription_type?: 'General' | 'Made to Measure' | 'Automotive' | 'Rental'; // Optional for backward compatibility
  package_name?: 'Essential' | 'Professional' | 'Premium' | 'Enterprise'; // Optional for backward compatibility
  cluster_id: string;         // Required cluster ID for referential integrity
  cluster_name: string;       // Required cluster name for display purposes
  created_at: string;
  updated_at: string;
}

// Clusters Table Data Model
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
  roles: z.array(z.enum(['admin', 'manager', 'staff'])).min(1),
  enabled: z.boolean(),
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
  subscription_type: z.enum(['General', 'Made to Measure', 'Automotive', 'Rental']).optional(), // Make optional for backward compatibility
  package_name: z.enum(['Essential', 'Professional', 'Premium', 'Enterprise']).optional(), // Make optional for backward compatibility
  cluster_id: z.string().uuid(), // Required cluster ID for referential integrity
  cluster_name: z.string().min(1).max(255), // Required cluster name for display
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const ClusterRecordSchema = z.object({
  cluster_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  type: z.enum(['dedicated', 'shared']),
  environment: z.enum(['Production', 'Staging', 'Dev']),
  region: z.enum(AWS_REGIONS),
  cidr: z.string().refine(validateCIDR, {
    message: 'CIDR must be a valid private IPv4 CIDR block (RFC 1918)'
  }),
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
  roles: z.array(z.enum(['admin', 'manager', 'staff'])),
  iat: z.number().int().positive(),
  exp: z.number().int().positive(),
  iss: z.string().optional(),
  aud: z.string().optional(),
});

// Input validation schemas for API endpoints
export const CreateStaffSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(128),
  roles: z.array(z.enum(['admin', 'manager', 'staff'])).min(1),
});

export const UpdateStaffSchema = z.object({
  roles: z.array(z.enum(['admin', 'manager', 'staff'])).min(1).optional(),
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
  subscription_type: z.enum(['General', 'Made to Measure', 'Automotive', 'Rental']).describe('Subscription type'),
  package_name: z.enum(['Essential', 'Professional', 'Premium', 'Enterprise']).describe('Package name'),
  cluster_id: z.string().uuid().describe('Required cluster ID to assign tenant to specific cluster'),
});

export const CreateClusterSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['dedicated', 'shared']),
  environment: z.enum(['Production', 'Staging', 'Dev']),
  region: z.enum(AWS_REGIONS),
  cidr: z.string().refine(validateCIDR, {
    message: 'CIDR must be a valid private IPv4 CIDR block (RFC 1918)'
  }),
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
export type TenantUpdate = Partial<Pick<TenantRecord, 'name' | 'email' | 'mobile_number' | 'business_name' | 'status' | 'deployment_type' | 'region' | 'tenant_url' | 'subscription_type' | 'package_name' | 'cluster_id' | 'cluster_name' | 'updated_at'>>;
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

export interface TenantQueryResult {
  tenant?: TenantRecord;
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