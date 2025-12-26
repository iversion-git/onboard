// Internal Node.js router with Express.js-style routing
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import type { 
  RouteHandler, 
  Middleware, 
  Route, 
  RouterConfig, 
  InternalRequest, 
  InternalResponse 
} from './types.js';
import { createInternalRequest, extractPathParameters } from './request.js';
import { ResponseBuilder, sendError } from './response.js';

export class InternalRouter {
  private routes: Route[] = [];
  private globalMiddlewares: Middleware[] = [];

  constructor(_config: RouterConfig = {}) {
    // Config will be used in future enhancements
  }

  // Add global middleware that runs for all routes
  use(middleware: Middleware): void {
    this.globalMiddlewares.push(middleware);
  }

  // Register route handlers
  get(path: string, ...args: Array<RouteHandler | Middleware>): void {
    this.addRoute('GET', path, ...args);
  }

  post(path: string, ...args: Array<RouteHandler | Middleware>): void {
    this.addRoute('POST', path, ...args);
  }

  put(path: string, ...args: Array<RouteHandler | Middleware>): void {
    this.addRoute('PUT', path, ...args);
  }

  delete(path: string, ...args: Array<RouteHandler | Middleware>): void {
    this.addRoute('DELETE', path, ...args);
  }

  options(path: string, ...args: Array<RouteHandler | Middleware>): void {
    this.addRoute('OPTIONS', path, ...args);
  }

  private addRoute(
    method: string, 
    path: string, 
    ...args: Array<RouteHandler | Middleware>
  ): void {
    // Last argument is always the handler, everything else is middleware
    const handler = args[args.length - 1] as RouteHandler;
    const middlewares = args.slice(0, -1) as Middleware[];

    this.routes.push({
      method: method.toUpperCase(),
      path,
      handler,
      middlewares
    });
  }

  // Find matching route for the request
  private findRoute(method: string, path: string): { route: Route; params: Record<string, string> } | null {
    for (const route of this.routes) {
      if (route.method !== method.toUpperCase()) {
        continue;
      }

      // Exact match
      if (route.path === path) {
        return { route, params: {} };
      }

      // Pattern match with parameters
      if (this.pathMatches(route.path, path)) {
        const params = extractPathParameters(path, route.path);
        return { route, params };
      }
    }

    return null;
  }

  private pathMatches(routePattern: string, actualPath: string): boolean {
    const routeParts = routePattern.split('/');
    const actualParts = actualPath.split('/');

    if (routeParts.length !== actualParts.length) {
      return false;
    }

    for (let i = 0; i < routeParts.length; i++) {
      const routePart = routeParts[i];
      const actualPart = actualParts[i];

      // Parameter segment (starts with :)
      if (routePart?.startsWith(':')) {
        continue;
      }

      // Exact match required for non-parameter segments
      if (routePart !== actualPart) {
        return false;
      }
    }

    return true;
  }

  // Execute middleware chain
  private async executeMiddlewares(
    middlewares: Middleware[],
    req: InternalRequest,
    res: InternalResponse
  ): Promise<boolean> {
    let index = 0;

    const next = async (): Promise<void> => {
      if (index >= middlewares.length) {
        return;
      }

      const middleware = middlewares[index++];
      if (middleware) {
        await middleware(req, res, next);
      }
    };

    try {
      await next();
      return !res._ended; // Continue if response hasn't been ended by middleware
    } catch (error) {
      console.error('Middleware error:', error);
      if (!res._ended) {
        sendError(res, 'InternalError', 'Internal server error', req.correlationId);
      }
      return false;
    }
  }

  // Main handler for Lambda proxy integration
  async handle(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
    // Handle both REST API and HTTP API event formats
    const method = (event.httpMethod || (event as any).requestContext?.http?.method)?.toUpperCase();
    const path = event.path || (event as any).rawPath;

    // Validate that we have the required fields
    if (!method) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: {
            code: 'BadRequest',
            message: 'Missing HTTP method in request',
            correlationId: event.requestContext?.requestId || 'unknown'
          },
          timestamp: new Date().toISOString()
        })
      };
    }

    if (!path) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: {
            code: 'BadRequest',
            message: 'Missing path in request',
            correlationId: event.requestContext?.requestId || 'unknown'
          },
          timestamp: new Date().toISOString()
        })
      };
    }

    // Handle CORS preflight requests
    if (method === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        },
        body: ''
      };
    }

    // Find matching route
    const routeMatch = this.findRoute(method, path);
    
    if (!routeMatch) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: {
            code: 'NotFound',
            message: `Route ${method} ${path} not found`,
            correlationId: event.requestContext?.requestId || 'unknown'
          },
          timestamp: new Date().toISOString()
        })
      };
    }

    const { route, params } = routeMatch;

    // Create internal request and response objects
    const req = createInternalRequest(event, context, params);
    const res = new ResponseBuilder();

    try {
      // Combine global middlewares with route-specific middlewares
      const allMiddlewares = [...this.globalMiddlewares, ...(route.middlewares || [])];

      // Execute middleware chain
      const shouldContinue = await this.executeMiddlewares(allMiddlewares, req, res);

      // If middleware didn't end the response, execute the route handler
      if (shouldContinue && !res._ended) {
        await route.handler(req, res);
      }

      // Ensure response is ended
      if (!res._ended) {
        res.status(500).json({
          error: {
            code: 'InternalError',
            message: 'Handler did not send a response',
            correlationId: req.correlationId
          },
          timestamp: new Date().toISOString()
        });
      }

      return res.toApiGatewayResponse();

    } catch (error) {
      console.error('Route handler error:', error);
      
      if (!res._ended) {
        sendError(res, 'InternalError', 'Internal server error', req.correlationId);
      }

      return res.toApiGatewayResponse();
    }
  }
}

// Create and export a default router instance
export const router = new InternalRouter();