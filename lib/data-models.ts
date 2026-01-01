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
  name: string;
  email: string;
  contact_info: {
    phone?: string;
    address?: string;
    company?: string;
  };
  status: 'pending' | 'active' | 'suspended';
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
  contact_info: z.object({
    phone: z.string().optional(),
    address: z.string().optional(),
    company: z.string().optional(),
  }),
  status: z.enum(['pending', 'active', 'suspended']),
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
  name: z.string().min(1).max(255),
  email: z.string().email().toLowerCase(),
  contact_info: z.object({
    phone: z.string().optional(),
    address: z.string().optional(),
    company: z.string().optional(),
  }).optional().default({}),
});

export const CreateClusterSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['dedicated', 'shared']),
  environment: z.enum(['Production', 'Staging', 'Dev']),
  region: z.enum(AWS_REGIONS),
  cidr: z.string().refine(validateCIDR, {
    message: 'CIDR must be a valid private IPv4 CIDR block (RFC 1918)'
  }),
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
export type TenantUpdate = Partial<Pick<TenantRecord, 'name' | 'email' | 'contact_info' | 'status' | 'updated_at'>>;
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