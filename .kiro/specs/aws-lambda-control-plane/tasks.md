# Implementation Plan

- [x] 1. Set up project structure and package management





  - Create directory structure following recommended layout (api/, core/, layers/, tests/)
  - Initialize PNPM workspace with package.json and pnpm-workspace.yaml
  - Configure TypeScript with strict settings for Node.js 24
  - Set up Serverless Framework v3 configuration
  - _Requirements: 8.1, 8.3, PNPM requirement_

- [ ]* 1.1 Write property test for PNPM usage validation
  - **Property 11: PNPM dependency management**
  - **Validates: Package management requirements**

- [x] 2. Create shared core layer foundation





  - Implement HTTP utilities (request parsing, response building, CORS handling)
  - Create error handling system with standardized error types and responses
  - Build configuration management with environment variable validation
  - Set up logging utilities with PII-safe logging helpers
  - _Requirements: 7.1, 7.2, 7.3, 9.5_

- [ ]* 2.1 Write property test for error response consistency
  - **Property 6: Data validation consistency**
  - **Validates: Requirements 7.1, 9.1**

- [ ]* 2.2 Write property test for sensitive data protection
  - **Property 5: Sensitive data protection**
  - **Validates: Requirements 1.5, 3.2, 5.4, 7.3**

- [ ] 3. Set up dependencies layer and AWS integrations
  - Create Lambda Layer with AWS Lambda Powertools, jose, zod, bcrypt, AWS SDK v3
  - Configure DynamoDB client factory with retry patterns and table name resolution
  - Implement SES helpers for templated email sending
  - Set up Secrets Manager integration for JWT signing key
  - _Requirements: 1.1, 3.1, 3.5, 6.1_

- [ ]* 3.1 Write property test for email normalization
  - **Property 7: Email normalization**
  - **Validates: Requirements 9.2**

- [ ] 4. Implement JWT authentication system
  - Create JWT signing and verification utilities using jose library
  - Implement password hashing and verification with bcrypt
  - Build authentication context management
  - Set up JWT signing key retrieval from Secrets Manager with caching
  - _Requirements: 1.1, 1.4, 1.5, 6.1_

- [ ]* 4.1 Write property test for authentication round trip
  - **Property 1: Authentication round trip**
  - **Validates: Requirements 1.1, 1.4**

- [ ]* 4.2 Write property test for invalid authentication rejection
  - **Property 2: Invalid authentication rejection**
  - **Validates: Requirements 1.2, 1.3**

- [ ] 5. Create Lambda Authorizer for centralized JWT verification
  - Implement Lambda Authorizer with JWT verification and role-based access control
  - Configure authorization result caching with 5-minute TTL
  - Build context passing to business lambdas
  - Set up role enforcement for different endpoint requirements
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ]* 5.1 Write property test for authorization enforcement
  - **Property 3: Authorization enforcement**
  - **Validates: Requirements 2.2, 4.2, 6.4**

- [ ]* 5.2 Write property test for JWT authorizer context passing
  - **Property 8: JWT authorizer context passing**
  - **Validates: Requirements 6.1, 6.3**

- [ ] 6. Implement DynamoDB data models and access patterns
  - Create Staff table schema with EmailIndex GSI
  - Implement PasswordResetTokens table with TTL configuration
  - Create Tenants table schema
  - Build data access layer with query helpers and validation
  - _Requirements: 2.1, 2.5, 3.2, 4.1, 4.3, 4.5_

- [ ]* 6.1 Write property test for duplicate prevention
  - **Property 9: Duplicate prevention**
  - **Validates: Requirements 2.5, 4.5**

- [ ] 7. Build authentication endpoints
  - Implement POST /auth/login with credential validation and JWT generation
  - Create POST /auth/password-reset/request with token generation and SES integration
  - Build POST /auth/password-reset/confirm with token validation and password update
  - _Requirements: 1.1, 1.2, 1.3, 3.1, 3.3, 3.4_

- [ ]* 7.1 Write property test for password reset round trip
  - **Property 4: Password reset round trip**
  - **Validates: Requirements 3.1, 3.3**

- [ ] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Implement staff management endpoints
  - Create POST /staff/register with admin-only access and account creation
  - Build POST /staff/enable and POST /staff/disable with admin authorization
  - Implement GET /staff/me with authenticated profile retrieval
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 5.1, 5.3, 5.4, 5.5_

- [ ] 10. Build tenant registration endpoint
  - Implement POST /tenant/register with admin/manager authorization
  - Create tenant data validation and storage
  - Set up preparation for future downstream provisioning workflows
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 11. Configure Serverless Framework deployment
  - Set up serverless.yml with HTTP API Gateway configuration
  - Configure Lambda functions with proper IAM roles per function
  - Set up Lambda Layers deployment for dependencies and shared core
  - Configure DynamoDB tables with stage-scoped naming
  - _Requirements: 8.4, 9.4, 10.1, 10.2_

- [ ]* 11.1 Write property test for observability consistency
  - **Property 10: Observability consistency**
  - **Validates: Requirements 7.2, 10.3, 10.4**

- [ ] 12. Set up observability and monitoring
  - Configure AWS Lambda Powertools for structured logging, tracing, and metrics
  - Implement correlation ID generation and request tracking
  - Set up AWS X-Ray tracing across all functions
  - Configure performance monitoring and alerting
  - _Requirements: 7.2, 7.4, 10.3, 10.4_

- [ ] 13. Implement security hardening
  - Configure API Gateway throttling and CORS policies
  - Set up input validation with Zod schemas for all endpoints
  - Implement least-privilege IAM roles for each function
  - Configure Secrets Manager access restrictions
  - _Requirements: 8.2, 9.1, 9.4, 9.5_

- [ ] 14. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.