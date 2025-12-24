/**
 * PII-safe logging utilities
 * Provides structured logging with automatic PII detection and masking
 * Leverages AWS Lambda's built-in CloudWatch integration
 */

import { LogContext } from './types.js';
import { getConfig } from './config.js';

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

/**
 * PII patterns to detect and mask
 */
const PII_PATTERNS = [
  // Email addresses
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  // Phone numbers (various formats)
  /(\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g,
  // SSN patterns
  /\b\d{3}-?\d{2}-?\d{4}\b/g,
  // Credit card patterns (basic)
  /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g
];

/**
 * Sensitive field names to mask
 */
const SENSITIVE_FIELDS = new Set([
  'password',
  'password_hash',
  'token',
  'secret',
  'key',
  'authorization',
  'auth',
  'jwt',
  'ssn',
  'social_security_number',
  'credit_card',
  'card_number',
  'cvv',
  'pin'
]);

/**
 * Logger class with PII protection
 */
export class Logger {
  private context: LogContext;
  private logLevel: LogLevel;

  constructor(context: LogContext) {
    this.context = context;
    const config = getConfig();
    this.logLevel = this.parseLogLevel(config.logLevel);
  }

  private parseLogLevel(level: string): LogLevel {
    switch (level.toUpperCase()) {
      case 'DEBUG': return LogLevel.DEBUG;
      case 'INFO': return LogLevel.INFO;
      case 'WARN': return LogLevel.WARN;
      case 'ERROR': return LogLevel.ERROR;
      default: return LogLevel.INFO;
    }
  }

  /**
   * Mask PII in text content
   */
  private maskPII(text: string): string {
    let masked = text;
    
    PII_PATTERNS.forEach(pattern => {
      masked = masked.replace(pattern, '[MASKED]');
    });
    
    return masked;
  }

  /**
   * Recursively mask sensitive data in objects
   */
  private maskSensitiveData(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return this.maskPII(obj);
    }

    if (typeof obj === 'number' || typeof obj === 'boolean') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.maskSensitiveData(item));
    }

    if (typeof obj === 'object') {
      const masked: any = {};
      
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        
        if (SENSITIVE_FIELDS.has(lowerKey) || lowerKey.includes('password') || lowerKey.includes('token')) {
          masked[key] = '[MASKED]';
        } else {
          masked[key] = this.maskSensitiveData(value);
        }
      }
      
      return masked;
    }

    return obj;
  }

  /**
   * Create structured log entry
   */
  private createLogEntry(level: string, message: string, data?: any) {
    return {
      timestamp: new Date().toISOString(),
      level,
      message: this.maskPII(message),
      correlationId: this.context.correlationId,
      staffId: this.context.staffId,
      operation: this.context.operation,
      stage: this.context.stage,
      ...(data && { data: this.maskSensitiveData(data) })
    };
  }

  /**
   * Log at DEBUG level
   */
  debug(message: string, data?: any): void {
    if (this.logLevel <= LogLevel.DEBUG) {
      console.debug(JSON.stringify(this.createLogEntry('DEBUG', message, data)));
    }
  }

  /**
   * Log at INFO level
   */
  info(message: string, data?: any): void {
    if (this.logLevel <= LogLevel.INFO) {
      console.info(JSON.stringify(this.createLogEntry('INFO', message, data)));
    }
  }

  /**
   * Log at WARN level
   */
  warn(message: string, data?: any): void {
    if (this.logLevel <= LogLevel.WARN) {
      console.warn(JSON.stringify(this.createLogEntry('WARN', message, data)));
    }
  }

  /**
   * Log at ERROR level
   */
  error(message: string, error?: Error | any, data?: any): void {
    if (this.logLevel <= LogLevel.ERROR) {
      const logData = {
        ...data,
        ...(error && {
          error: {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            name: error instanceof Error ? error.name : undefined
          }
        })
      };
      
      console.error(JSON.stringify(this.createLogEntry('ERROR', message, logData)));
    }
  }
}

/**
 * Create logger instance with context
 */
export function createLogger(context: LogContext): Logger {
  return new Logger(context);
}

/**
 * Create logger from correlation ID and operation
 */
export function createLoggerFromCorrelationId(
  correlationId: string,
  operation: string,
  staffId?: string
): Logger {
  const config = getConfig();
  
  const context: LogContext = {
    correlationId,
    operation,
    stage: config.stage,
    ...(staffId && { staffId })
  };
  
  return new Logger(context);
}