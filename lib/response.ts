// Response utilities for Lambda proxy integration
import type { InternalResponse, ApiResponse, ErrorResponse, ApiError } from './types.js';
import { getCorsHeaders } from './http.js';

export class ResponseBuilder implements InternalResponse {
  public _statusCode: number = 200;
  public _headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...getCorsHeaders()
  };
  public _body: string = '';
  public _ended: boolean = false;

  status(code: number): InternalResponse {
    this._statusCode = code;
    return this;
  }

  json(data: any): InternalResponse {
    this._headers['Content-Type'] = 'application/json';
    this._body = JSON.stringify(data);
    this._ended = true;
    return this;
  }

  send(data: string): InternalResponse {
    this._body = data;
    this._ended = true;
    return this;
  }

  header(name: string, value: string): InternalResponse {
    this._headers[name] = value;
    return this;
  }

  end(): void {
    this._ended = true;
  }

  toApiGatewayResponse(): ApiResponse {
    return {
      statusCode: this._statusCode,
      headers: this._headers,
      body: this._body
    };
  }
}

// Error response utilities
export function createErrorResponse(
  error: ApiError,
  message: string,
  correlationId: string,
  details?: any
): ErrorResponse {
  return {
    error: {
      code: error,
      message,
      details,
      correlationId
    },
    timestamp: new Date().toISOString()
  };
}

export function getHttpStatusForError(error: ApiError): number {
  switch (error) {
    case 'ValidationError':
      return 400;
    case 'Unauthorized':
      return 401;
    case 'Forbidden':
      return 403;
    case 'NotFound':
      return 404;
    case 'Conflict':
      return 409;
    case 'InternalError':
    default:
      return 500;
  }
}

export function sendError(
  res: InternalResponse,
  error: ApiError,
  message: string,
  correlationId: string,
  details?: any
): void {
  const statusCode = getHttpStatusForError(error);
  const errorResponse = createErrorResponse(error, message, correlationId, details);
  
  res.status(statusCode).json(errorResponse);
}