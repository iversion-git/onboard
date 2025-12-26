// CORS middleware for handling cross-origin requests
import type { Middleware } from '../lib/types.js';

export interface CorsOptions {
  origins?: string[];
  methods?: string[];
  headers?: string[];
  credentials?: boolean;
}

export function corsMiddleware(options: CorsOptions = {}): Middleware {
  const {
    origins = ['*'],
    methods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    headers = ['Content-Type', 'Authorization', 'X-Correlation-ID'],
    credentials = false
  } = options;

  return async (req, res, next) => {
    const origin = req.headers['origin'] || req.headers['Origin'];
    
    // Determine allowed origin
    let allowedOrigin = '*';
    if (origins.length > 0 && !origins.includes('*')) {
      if (origin && origins.includes(origin)) {
        allowedOrigin = origin;
      } else {
        allowedOrigin = origins[0] || '*';
      }
    }

    // Set CORS headers
    res.header('Access-Control-Allow-Origin', allowedOrigin);
    res.header('Access-Control-Allow-Methods', methods.join(', '));
    res.header('Access-Control-Allow-Headers', headers.join(', '));
    
    if (credentials) {
      res.header('Access-Control-Allow-Credentials', 'true');
    }

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(200).send('');
      return;
    }

    await next();
  };
}