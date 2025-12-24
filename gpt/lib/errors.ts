export type ErrorCode =
  | "ValidationError"
  | "Unauthorized"
  | "Forbidden"
  | "NotFound"
  | "Conflict"
  | "InternalError";

export class ApiError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(code: ErrorCode, statusCode: number, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const Errors = {
  validation: (message: string, details?: unknown) => new ApiError("ValidationError", 400, message, details),
  unauthorized: (message = "Unauthorized") => new ApiError("Unauthorized", 401, message),
  forbidden: (message = "Forbidden") => new ApiError("Forbidden", 403, message),
  notFound: (message = "Not found") => new ApiError("NotFound", 404, message),
  conflict: (message = "Conflict") => new ApiError("Conflict", 409, message),
  internal: (message = "Internal error", details?: unknown) => new ApiError("InternalError", 500, message, details)
};
