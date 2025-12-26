// Authentication routes registration
import type { InternalRouter } from '../lib/router.js';
import { validationMiddleware } from '../middleware/validation.js';
import { LoginSchema, PasswordResetRequestSchema, PasswordResetConfirmSchema } from '../lib/data-models.js';
import { 
  loginHandler, 
  passwordResetRequestHandler, 
  passwordResetConfirmHandler 
} from '../handlers/auth/index.js';

export function registerAuthRoutes(router: InternalRouter): void {
  // POST /auth/login - Staff login with credential validation and JWT generation
  router.post('/auth/login',
    validationMiddleware({
      body: LoginSchema
    }),
    loginHandler
  );

  // POST /auth/password-reset/request - Request password reset with token generation and SES integration
  router.post('/auth/password-reset/request',
    validationMiddleware({
      body: PasswordResetRequestSchema
    }),
    passwordResetRequestHandler
  );

  // POST /auth/password-reset/confirm - Confirm password reset with token validation and password update
  router.post('/auth/password-reset/confirm',
    validationMiddleware({
      body: PasswordResetConfirmSchema
    }),
    passwordResetConfirmHandler
  );
}