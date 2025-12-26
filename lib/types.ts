// Core types for the internal routing system
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';

// Internal Router Types
export interface RouteHandler {
  (req: InternalRequest, res: InternalResponse): Promise<void>;
}

export interface InternalRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: any;
  query: Record<string, string>;
  params: Record<string, string>;
  context: AuthContext;
  correlationId: string;
  rawEvent: APIGatewayProxyEvent;
  lambdaContext: Context;
}

export interface InternalResponse {
  status(code: number): InternalResponse;
  json(data: any): InternalResponse;
  send(data: string): InternalResponse;
  header(name: string, value: string): InternalResponse;
  end(): void;
  _statusCode: number;
  _headers: Record<string, string>;
  _body: string;
  _ended: boolean;
}

// HTTP Response Utilities
export interface ApiResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

// Authentication Context
export interface AuthContext {
  staff_id?: string;
  email?: string;
  roles?: string[];
  stage?: string;
  authenticated: boolean;
}

// Error Types
export type ApiError = 
  | 'Unauthorized'
  | 'Forbidden' 
  | 'ValidationError'
  | 'NotFound'
  | 'Conflict'
  | 'InternalError';

// Request Validation
export interface ValidatedRequest<T> {
  body: T;
  context: AuthContext;
  correlationId: string;
}

// Middleware function type
export interface Middleware {
  (req: InternalRequest, res: InternalResponse, next: () => Promise<void>): Promise<void>;
}

// Route definition
export interface Route {
  method: string;
  path: string;
  handler: RouteHandler;
  middlewares?: Middleware[];
}

// Router configuration
export interface RouterConfig {
  corsOrigins?: string[];
  enableLogging?: boolean;
  enableTracing?: boolean;
}

// Error response format
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    correlationId: string;
  };
  timestamp: string;
}