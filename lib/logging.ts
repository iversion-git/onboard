// Enhanced logging utilities with PII-safe logging helpers and correlation IDs
import type { InternalRequest } from './types.js';
import { getConfig } from './config.js';
import { extractRequestMetadata } from './http.js';

/**
 * Log levels in order of severity
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

/**
 * Base log entry structure
 */
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  correlationId?: string;
  requestId?: string;
  userId?: string;
  operation?: string;
  duration?: string;
  metadata?: Record<string, any>;
}

/**
 * PII-sensitive field patterns
 */
const PII_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /key/i,
  /auth/i,
  /credential/i,
  /ssn/i,
  /social.security/i,
  /credit.card/i,
  /card.number/i,
  /cvv/i,
  /pin/i,
  /phone/i,
  /email/i,
  /address/i,
  /zip/i,
  /postal/i
];

/**
 * Email pattern for detection
 */
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

/**
 * Phone number patterns
 */
const PHONE_PATTERNS = [
  /\b\d{3}-\d{3}-\d{4}\b/g,           // 123-456-7890
  /\b\(\d{3}\)\s*\d{3}-\d{4}\b/g,    // (123) 456-7890
  /\b\d{10}\b/g,                     // 1234567890
  /\b\+1\s*\d{3}\s*\d{3}\s*\d{4}\b/g // +1 123 456 7890
];

/**
 * Logger class with PII protection
 */
export class Logger {
  private logLevel: LogLevel;
  private enableConsoleOutput: boolean;

  constructor(logLevel: LogLevel = LogLevel.INFO, enableConsoleOutput: boolean = true) {
    this.logLevel = logLevel;
    this.enableConsoleOutput = enableConsoleOutput;
  }

  /**
   * Check if a log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const currentIndex = levels.indexOf(this.logLevel);
    const messageIndex = levels.indexOf(level);
    return messageIndex >= currentIndex;
  }

  /**
   * Create a base log entry
   */
  private createLogEntry(
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>
  ): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...(metadata && { metadata: this.sanitizeMetadata(metadata) })
    };
  }

  /**
   * Output log entry
   */
  private output(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) {
      return;
    }

    if (this.enableConsoleOutput) {
      console.log(JSON.stringify(entry));
    }

    // TODO: Add integration with AWS CloudWatch Logs or other logging services
  }

  /**
   * Debug level logging
   */
  debug(message: string, metadata?: Record<string, any>): void {
    const entry = this.createLogEntry(LogLevel.DEBUG, message, metadata);
    this.output(entry);
  }

  /**
   * Info level logging
   */
  info(message: string, metadata?: Record<string, any>): void {
    const entry = this.createLogEntry(LogLevel.INFO, message, metadata);
    this.output(entry);
  }

  /**
   * Warning level logging
   */
  warn(message: string, metadata?: Record<string, any>): void {
    const entry = this.createLogEntry(LogLevel.WARN, message, metadata);
    this.output(entry);
  }

  /**
   * Error level logging
   */
  error(message: string, error?: Error | unknown, metadata?: Record<string, any>): void {
    const entry = this.createLogEntry(LogLevel.ERROR, message, {
      ...metadata,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error
    });
    this.output(entry);
  }

  /**
   * Sanitize metadata to remove PII
   */
  private sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
    return this.sanitizeObject(metadata);
  }

  /**
   * Recursively sanitize an object
   */
  private sanitizeObject(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }

    if (typeof obj === 'number' || typeof obj === 'boolean') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    if (typeof obj === 'object') {
      const sanitized: Record<string, any> = {};
      
      for (const [key, value] of Object.entries(obj)) {
        if (this.isPiiField(key)) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = this.sanitizeObject(value);
        }
      }
      
      return sanitized;
    }

    return obj;
  }

  /**
   * Check if a field name indicates PII
   */
  private isPiiField(fieldName: string): boolean {
    return PII_PATTERNS.some(pattern => pattern.test(fieldName));
  }

  /**
   * Sanitize a string by removing PII patterns
   */
  private sanitizeString(str: string): string {
    let sanitized = str;

    // Remove email addresses
    sanitized = sanitized.replace(EMAIL_PATTERN, '[EMAIL_REDACTED]');

    // Remove phone numbers
    PHONE_PATTERNS.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '[PHONE_REDACTED]');
    });

    return sanitized;
  }
}

/**
 * Global logger instance
 */
let globalLogger: Logger | null = null;

/**
 * Get or create global logger instance
 */
export function getLogger(): Logger {
  if (!globalLogger) {
    const config = getConfig();
    globalLogger = new Logger(
      config.LOG_LEVEL as LogLevel,
      true // Always enable console output in Lambda
    );
  }
  return globalLogger;
}

/**
 * Request logging utilities
 */
export class RequestLogger {
  private logger: Logger;
  private correlationId: string;
  private requestId: string;
  private startTime: number;

  constructor(req: InternalRequest) {
    this.logger = getLogger();
    this.correlationId = req.correlationId;
    this.requestId = req.rawEvent.requestContext.requestId;
    this.startTime = Date.now();
  }

  /**
   * Log request start
   */
  logRequestStart(req: InternalRequest): void {
    const metadata = extractRequestMetadata(req.rawEvent, req);
    
    this.logger.info('Request started', {
      ...metadata,
      correlationId: this.correlationId,
      requestId: this.requestId
    });
  }

  /**
   * Log request completion
   */
  logRequestComplete(statusCode: number, responseSize?: number): void {
    const duration = Date.now() - this.startTime;
    
    this.logger.info('Request completed', {
      correlationId: this.correlationId,
      requestId: this.requestId,
      statusCode,
      duration: `${duration}ms`,
      responseSize: responseSize ? `${responseSize} bytes` : undefined
    });
  }

  /**
   * Log request error
   */
  logRequestError(error: Error | unknown, statusCode?: number): void {
    const duration = Date.now() - this.startTime;
    
    this.logger.error('Request failed', error, {
      correlationId: this.correlationId,
      requestId: this.requestId,
      statusCode,
      duration: `${duration}ms`
    });
  }

  /**
   * Log business operation
   */
  logOperation(operation: string, metadata?: Record<string, any>): void {
    this.logger.info(`Operation: ${operation}`, {
      correlationId: this.correlationId,
      requestId: this.requestId,
      operation,
      ...metadata
    });
  }

  /**
   * Log security event
   */
  logSecurityEvent(event: string, metadata?: Record<string, any>): void {
    this.logger.warn(`Security event: ${event}`, {
      correlationId: this.correlationId,
      requestId: this.requestId,
      securityEvent: event,
      ...metadata
    });
  }
}

/**
 * Performance monitoring utilities
 */
export class PerformanceLogger {
  private logger: Logger;
  private timers: Map<string, number>;

  constructor() {
    this.logger = getLogger();
    this.timers = new Map();
  }

  /**
   * Start timing an operation
   */
  startTimer(operation: string): void {
    this.timers.set(operation, Date.now());
  }

  /**
   * End timing and log the duration
   */
  endTimer(operation: string, correlationId?: string, metadata?: Record<string, any>): void {
    const startTime = this.timers.get(operation);
    if (!startTime) {
      this.logger.warn(`Timer not found for operation: ${operation}`);
      return;
    }

    const duration = Date.now() - startTime;
    this.timers.delete(operation);

    this.logger.info(`Performance: ${operation}`, {
      correlationId,
      operation,
      duration: `${duration}ms`,
      ...metadata
    });
  }

  /**
   * Log a performance metric
   */
  logMetric(
    metric: string,
    value: number,
    unit: string,
    correlationId?: string,
    metadata?: Record<string, any>
  ): void {
    this.logger.info(`Metric: ${metric}`, {
      correlationId,
      metric,
      value,
      unit,
      ...metadata
    });
  }
}

/**
 * Audit logging utilities for security and compliance
 */
export class AuditLogger {
  private logger: Logger;

  constructor() {
    this.logger = getLogger();
  }

  /**
   * Log authentication events
   */
  logAuthEvent(
    event: 'login_success' | 'login_failure' | 'logout' | 'token_refresh',
    userId?: string,
    correlationId?: string,
    metadata?: Record<string, any>
  ): void {
    this.logger.info(`Auth event: ${event}`, {
      correlationId,
      auditEvent: 'authentication',
      authEvent: event,
      userId,
      ...metadata
    });
  }

  /**
   * Log authorization events
   */
  logAuthzEvent(
    event: 'access_granted' | 'access_denied',
    resource: string,
    action: string,
    userId?: string,
    correlationId?: string,
    metadata?: Record<string, any>
  ): void {
    this.logger.info(`Authz event: ${event}`, {
      correlationId,
      auditEvent: 'authorization',
      authzEvent: event,
      resource,
      action,
      userId,
      ...metadata
    });
  }

  /**
   * Log data access events
   */
  logDataAccess(
    operation: 'create' | 'read' | 'update' | 'delete',
    resource: string,
    resourceId?: string,
    userId?: string,
    correlationId?: string,
    metadata?: Record<string, any>
  ): void {
    this.logger.info(`Data access: ${operation}`, {
      correlationId,
      auditEvent: 'data_access',
      operation,
      resource,
      resourceId,
      userId,
      ...metadata
    });
  }
}

/**
 * Convenience functions for common logging patterns
 */
export const log = {
  debug: (message: string, metadata?: Record<string, any>) => getLogger().debug(message, metadata),
  info: (message: string, metadata?: Record<string, any>) => getLogger().info(message, metadata),
  warn: (message: string, metadata?: Record<string, any>) => getLogger().warn(message, metadata),
  error: (message: string, error?: Error | unknown, metadata?: Record<string, any>) => 
    getLogger().error(message, error, metadata)
};

/**
 * Create a request logger for a specific request
 */
export function createRequestLogger(req: InternalRequest): RequestLogger {
  return new RequestLogger(req);
}

/**
 * Create a performance logger
 */
export function createPerformanceLogger(): PerformanceLogger {
  return new PerformanceLogger();
}

/**
 * Create an audit logger
 */
export function createAuditLogger(): AuditLogger {
  return new AuditLogger();
}