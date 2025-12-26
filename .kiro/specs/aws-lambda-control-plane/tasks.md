# Implementation Plan: AWS Lambda Control Plane (Single Function)

## Overview

This implementation plan converts the AWS Lambda Control Plane API from a multi-function architecture to a single Lambda function with internal Node.js routing. The single function approach enables flexible deployment to either AWS Lambda or AWS App Runner while maintaining optimal performance through bundled dependencies.

## Tasks

- [x] 1. Set up single function project structure and package management
  - Create directory structure for single function (index.ts, lib/, handlers/, middleware/, tests/)
  - Initialize PNPM workspace with package.json and pnpm-workspace.yaml
  - Configure TypeScript with strict settings for Node.js 20
  - Set up Serverless Framework v3 with esbuild bundling for single function
  - Configure esbuild for ES modules with .mjs output extension and single entry point
  - _Requirements: 8.1, 8.3, 8.4_

- [ ]* 1.1 Write property test for single function architecture compliance
  - **Property 11: Single function architecture compliance**
  - **Validates: Requirements 8.1, 8.2, 8.5**

- [x] 2. Create internal routing system and middleware pipeline
  - Implement internal Node.js router (lib/router.ts) with Express.js-style routing
  - Create middleware pipeline for authentication, validation, CORS, and logging
  - Build request/response transformation for Lambda proxy integration
  - Set up route registration system for all API endpoints
  - _Requirements: 8.2, 6.1, 6.2_

- [ ]* 2.1 Write property test for internal routing consistency
  - **Property 8: Internal routing consistency**
  - **Validates: Requirements 6.1, 6.3, 8.2**

- [x] 3. Create shared lib utilities foundation
  - Implement HTTP utilities (request parsing, response building, CORS handling) in lib/
  - Create error handling system with standardized error types and responses
  - Build configuration management with environment variable validation
  - Set up logging utilities with PII-safe logging helpers and correlation IDs
  - _Requirements: 7.1, 7.2, 7.3, 9.5_

- [ ]* 3.1 Write property test for error response consistency
  - **Property 6: Data validation consistency**
  - **Validates: Requirements 7.1, 9.1**

- [ ]* 3.2 Write property test for sensitive data protection
  - **Property 5: Sensitive data protection**
  - **Validates: Requirements 1.5, 3.2, 5.4, 7.3**

- [x] 4. Set up bundled dependencies and AWS integrations
  - Configure esbuild to bundle all dependencies (AWS SDK v3, jose, zod, bcryptjs, routing framework) into single function
  - Configure DynamoDB client factory with retry patterns and table name resolution
  - Implement SES helpers for templated email sending
  - Set up JWT secret validation from environment variables
  - _Requirements: 1.1, 3.1, 3.5, 8.3_

- [ ]* 4.1 Write property test for email normalization
  - **Property 7: Email normalization**
  - **Validates: Requirements 9.2**

- [x] 5. Implement JWT authentication middleware
  - Create JWT signing and verification utilities using jose library in lib/
  - Implement password hashing and verification with bcryptjs
  - Build authentication middleware for JWT verification within the single function
  - Set up JWT secret retrieval from environment variables with validation
  - _Requirements: 1.1, 1.4, 1.5, 6.1_

- [ ]* 5.1 Write property test for authentication round trip
  - **Property 1: Authentication round trip**
  - **Validates: Requirements 1.1, 1.4**

- [ ]* 5.2 Write property test for invalid authentication rejection
  - **Property 2: Invalid authentication rejection**
  - **Validates: Requirements 1.2, 1.3**

- [x] 6. Implement authorization middleware and role enforcement
  - Create authorization middleware for role-based access control within the single function
  - Build context passing system for staff identity and roles
  - Set up role enforcement for different endpoint requirements
  - Implement permission checking utilities
  - _Requirements: 6.2, 6.3, 6.4, 6.5_

- [ ]* 6.1 Write property test for authorization enforcement
  - **Property 3: Authorization enforcement**
  - **Validates: Requirements 2.2, 4.2, 6.4**

- [-] 7. Implement DynamoDB data models and access patterns
  - Create Staff table schema with EmailIndex GSI
  - Implement PasswordResetTokens table with TTL configuration
  - Create Tenants table schema
  - Build data access layer with query helpers and validation
  - _Requirements: 2.1, 2.5, 3.2, 4.1, 4.3, 4.5_

- [ ]* 7.1 Write property test for duplicate prevention
  - **Property 9: Duplicate prevention**
  - **Validates: Requirements 2.5, 4.5**

- [ ] 8. Build authentication route handlers
  - Implement POST /auth/login handler with credential validation and JWT generation
  - Create POST /auth/password-reset/request handler with token generation and SES integration
  - Build POST /auth/password-reset/confirm handler with token validation and password update
  - Register authentication routes with the internal router
  - _Requirements: 1.1, 1.2, 1.3, 3.1, 3.3, 3.4_

- [ ]* 8.1 Write property test for password reset round trip
  - **Property 4: Password reset round trip**
  - **Validates: Requirements 3.1, 3.3**

- [ ] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Implement staff management route handlers
  - Create POST /staff/register handler with admin-only access and account creation
  - Build POST /staff/enable and POST /staff/disable handlers with admin authorization
  - Implement GET /staff/me handler with authenticated profile retrieval
  - Register staff management routes with the internal router
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 5.1, 5.3, 5.4, 5.5_

- [ ] 11. Build tenant registration route handler
  - Implement POST /tenant/register handler with admin/manager authorization
  - Create tenant data validation and storage
  - Set up preparation for future downstream provisioning workflows
  - Register tenant routes with the internal router
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 12. Create main Lambda handler and wire everything together
  - Implement main index.ts handler that initializes the router and processes all requests
  - Wire together all middleware, route handlers, and utilities
  - Set up Lambda proxy integration request/response transformation
  - Configure cold start optimization and connection pooling
  - _Requirements: 8.1, 8.2, 8.4_

- [ ] 13. Configure Serverless Framework deployment for single function
  - Set up serverless.yml with HTTP API Gateway configuration for single function
  - Configure single Lambda function with proper IAM roles and environment variables
  - Remove multiple function configurations in favor of single function approach
  - Configure DynamoDB tables with stage-scoped naming
  - Set up API Gateway proxy integration with `/{proxy+}` routing to single function
  - _Requirements: 8.4, 9.4, 10.1, 10.2_

- [ ]* 13.1 Write property test for observability consistency
  - **Property 10: Observability consistency**
  - **Validates: Requirements 7.2, 10.3, 10.4**

- [ ] 14. Set up observability and monitoring within single function
  - Configure AWS Lambda Powertools for structured logging, tracing, and metrics
  - Implement correlation ID generation and request tracking throughout the routing pipeline
  - Set up AWS X-Ray tracing within the single function
  - Configure performance monitoring and alerting for the single function
  - _Requirements: 7.2, 7.4, 10.3, 10.4_

- [ ] 15. Implement security hardening for single function
  - Configure API Gateway throttling and CORS policies
  - Set up input validation with Zod schemas for all route handlers
  - Implement least-privilege IAM roles for the single function
  - Configure environment variable security for JWT secrets
  - _Requirements: 9.1, 9.4, 9.5, 9.6_

- [ ] 16. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The single function architecture enables deployment flexibility between Lambda and App Runner