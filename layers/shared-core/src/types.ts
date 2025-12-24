/**
 * Core type definitions for the AWS Lambda Control Plane API
 * These types are shared across all Lambda functions
 */

// HTTP Response structure - leverages AWS Lambda's built-in response format
export interface ApiResponse<T = any> {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

// Authentication context passed from Lambda Authorizer
export interface AuthContext {
  staff_id: string;
  email: string;
  roles: string[];
  stage: string;
}

// Standardized error types for consistent API responses
export type ApiError = 
  | 'Unauthorized'
  | 'Forbidden' 
  | 'ValidationError'
  | 'NotFound'
  | 'Conflict'
  | 'InternalError';

// Error response structure
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    correlationId: string;
  };
  timestamp: string;
}

// Validated request structure with context
export interface ValidatedRequest<T> {
  body: T;
  context: AuthContext;
  correlationId: string;
}

// Environment configuration structure
export interface Config {
  stage: string;
  region: string;
  staffTableName: string;
  passwordResetTokensTableName: string;
  tenantsTableName: string;
  jwtSigningKeySecretName: string;
  sesFromEmail: string;
  corsOrigins: string[];
  logLevel: string;
}

// Logging context for structured logging
export interface LogContext {
  correlationId: string;
  staffId?: string;
  operation: string;
  stage: string;
}