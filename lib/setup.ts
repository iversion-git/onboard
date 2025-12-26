// Router setup utilities with common middleware configuration
import { InternalRouter } from './router.js';
import { corsMiddleware, loggingMiddleware } from '../middleware/index.js';

export interface RouterSetupOptions {
  corsOrigins?: string[];
  enableLogging?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export function createConfiguredRouter(options: RouterSetupOptions = {}): InternalRouter {
  const {
    corsOrigins = ['*'],
    enableLogging = true,
    logLevel = 'info'
  } = options;

  const router = new InternalRouter({
    corsOrigins,
    enableLogging,
    enableTracing: true
  });

  // Add global middleware
  if (enableLogging) {
    router.use(loggingMiddleware({
      enableRequestLogging: true,
      enableResponseLogging: true,
      logLevel
    }));
  }

  router.use(corsMiddleware({
    origins: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    headers: ['Content-Type', 'Authorization', 'X-Correlation-ID'],
    credentials: false
  }));

  return router;
}

// Environment-specific router configuration
export function createRouterForEnvironment(): InternalRouter {
  const stage = process.env['STAGE'] || 'dev';
  
  const corsOrigins = stage === 'prod' 
    ? (process.env['CORS_ORIGINS']?.split(',') || ['https://app.example.com'])
    : ['*']; // Allow all origins in non-prod environments

  return createConfiguredRouter({
    corsOrigins,
    enableLogging: true,
    logLevel: stage === 'prod' ? 'info' : 'debug'
  });
}