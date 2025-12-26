// Logging middleware with structured logging and correlation IDs
import type { Middleware } from '../lib/types.js';

export interface LoggingOptions {
  enableRequestLogging?: boolean;
  enableResponseLogging?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  sensitiveHeaders?: string[];
}

export function loggingMiddleware(options: LoggingOptions = {}): Middleware {
  const {
    enableRequestLogging = true,
    enableResponseLogging = true,
    logLevel = 'info',
    sensitiveHeaders = ['authorization', 'cookie', 'x-api-key']
  } = options;

  return async (req, res, next) => {
    const startTime = Date.now();

    // Log incoming request
    if (enableRequestLogging) {
      const sanitizedHeaders = sanitizeHeaders(req.headers, sensitiveHeaders);
      
      console.log(JSON.stringify({
        level: logLevel,
        message: 'Incoming request',
        correlationId: req.correlationId,
        method: req.method,
        path: req.path,
        headers: sanitizedHeaders,
        query: req.query,
        timestamp: new Date().toISOString(),
        requestId: req.rawEvent.requestContext.requestId
      }));
    }

    // Store original response methods to intercept
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);
    const originalEnd = res.end.bind(res);

    // Intercept response to log it
    if (enableResponseLogging) {
      res.json = function(data: any) {
        logResponse(req.correlationId, res._statusCode, data, startTime);
        return originalJson(data);
      };

      res.send = function(data: string) {
        logResponse(req.correlationId, res._statusCode, data, startTime);
        return originalSend(data);
      };

      res.end = function() {
        logResponse(req.correlationId, res._statusCode, res._body, startTime);
        return originalEnd();
      };
    }

    try {
      await next();
    } catch (error) {
      console.error(JSON.stringify({
        level: 'error',
        message: 'Request processing error',
        correlationId: req.correlationId,
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : error,
        timestamp: new Date().toISOString()
      }));
      throw error;
    }
  };
}

function sanitizeHeaders(
  headers: Record<string, string>, 
  sensitiveHeaders: string[]
): Record<string, string> {
  const sanitized: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(headers)) {
    if (sensitiveHeaders.includes(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

function logResponse(
  correlationId: string, 
  statusCode: number, 
  body: any, 
  startTime: number
): void {
  const duration = Date.now() - startTime;
  
  console.log(JSON.stringify({
    level: 'info',
    message: 'Response sent',
    correlationId,
    statusCode,
    duration: `${duration}ms`,
    bodySize: typeof body === 'string' ? body.length : JSON.stringify(body).length,
    timestamp: new Date().toISOString()
  }));
}